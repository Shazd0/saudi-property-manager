CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS documents (
  book_id text NOT NULL DEFAULT 'default',
  collection_name text NOT NULL,
  doc_id text NOT NULL,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  deleted boolean NOT NULL DEFAULT false,
  source_collection text,
  source_path text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (book_id, collection_name, doc_id)
);

CREATE INDEX IF NOT EXISTS documents_collection_book_idx
  ON documents (collection_name, book_id);

CREATE INDEX IF NOT EXISTS documents_updated_at_idx
  ON documents (updated_at DESC);

CREATE INDEX IF NOT EXISTS documents_deleted_idx
  ON documents (deleted);

CREATE INDEX IF NOT EXISTS documents_data_gin_idx
  ON documents USING gin (data);

CREATE INDEX IF NOT EXISTS documents_user_id_idx
  ON documents ((data->>'userId'))
  WHERE data ? 'userId';

CREATE INDEX IF NOT EXISTS documents_building_id_idx
  ON documents ((data->>'buildingId'))
  WHERE data ? 'buildingId';

CREATE INDEX IF NOT EXISTS documents_date_idx
  ON documents ((data->>'date'))
  WHERE data ? 'date';

CREATE TABLE IF NOT EXISTS migration_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status text NOT NULL DEFAULT 'running',
  mode text NOT NULL DEFAULT 'all',
  options jsonb NOT NULL DEFAULT '{}'::jsonb,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  collections jsonb NOT NULL DEFAULT '{}'::jsonb,
  total_read integer NOT NULL DEFAULT 0,
  total_written integer NOT NULL DEFAULT 0,
  errors jsonb NOT NULL DEFAULT '[]'::jsonb
);

CREATE INDEX IF NOT EXISTS migration_runs_started_at_idx
  ON migration_runs (started_at DESC);

CREATE TABLE IF NOT EXISTS api_audit_log (
  id bigserial PRIMARY KEY,
  action text NOT NULL,
  book_id text NOT NULL DEFAULT 'default',
  collection_name text NOT NULL,
  doc_id text,
  before_data jsonb,
  after_data jsonb,
  actor text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS api_audit_log_target_idx
  ON api_audit_log (book_id, collection_name, doc_id);

CREATE TABLE IF NOT EXISTS mcp_audit_log (
  id bigserial PRIMARY KEY,
  actor_type text NOT NULL CHECK (actor_type IN ('owner', 'buyer')),
  actor_id text NOT NULL,
  buyer_id text,
  book_id text NOT NULL,
  tool_name text NOT NULL,
  outcome text NOT NULL CHECK (outcome IN ('success', 'denied', 'error')),
  request_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS mcp_audit_log_actor_idx
  ON mcp_audit_log (actor_type, actor_id, created_at DESC);

CREATE INDEX IF NOT EXISTS mcp_audit_log_book_tool_idx
  ON mcp_audit_log (book_id, tool_name, created_at DESC);

-- Provision MCP database access separately, then put its URL in MCP_DATABASE_URL:
--   CREATE ROLE amlak_mcp LOGIN PASSWORD '<generated-secret>';
--   GRANT CONNECT ON DATABASE amlak TO amlak_mcp;
--   GRANT USAGE ON SCHEMA public TO amlak_mcp;
--   GRANT SELECT ON documents TO amlak_mcp;
--   GRANT INSERT ON mcp_audit_log TO amlak_mcp;
--   GRANT USAGE, SELECT ON SEQUENCE mcp_audit_log_id_seq TO amlak_mcp;
-- Do not grant UPDATE, DELETE, or access to api_audit_log.

CREATE OR REPLACE FUNCTION touch_documents_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS documents_touch_updated_at ON documents;
CREATE TRIGGER documents_touch_updated_at
BEFORE UPDATE ON documents
FOR EACH ROW
EXECUTE FUNCTION touch_documents_updated_at();

-- Durable owner command core. The application command role is deliberately
-- separate from the read-only amlak_mcp role documented above.
CREATE TABLE IF NOT EXISTS automation_commands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id text NOT NULL,
  action_id text NOT NULL,
  target jsonb NOT NULL CHECK (
    target ?& ARRAY['adapter','tenantId','bookId']
    AND target->>'adapter' IN ('mac','buyer')
  ),
  input jsonb NOT NULL,
  idempotency_key text NOT NULL,
  status text NOT NULL CHECK (status IN ('prepared','executing','completed','failed','cancelled')),
  confirmation_token_hash text,
  confirmation_expires_at timestamptz NOT NULL,
  critical_reauth_at timestamptz,
  preview jsonb NOT NULL,
  result jsonb,
  target_adapter text CHECK (target_adapter IN ('mac','buyer')),
  remote_operation_result jsonb,
  reconciliation_needed boolean NOT NULL DEFAULT false,
  error_code text,
  prepared_at timestamptz NOT NULL DEFAULT now(),
  confirmed_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  rollback_of_command_id uuid REFERENCES automation_commands(id),
  UNIQUE (actor_id, action_id, idempotency_key),
  CHECK ((status = 'prepared' AND confirmation_token_hash IS NOT NULL) OR status <> 'prepared')
);

ALTER TABLE automation_commands ADD COLUMN IF NOT EXISTS target_adapter text;
ALTER TABLE automation_commands ADD COLUMN IF NOT EXISTS remote_operation_result jsonb;
ALTER TABLE automation_commands ADD COLUMN IF NOT EXISTS reconciliation_needed boolean NOT NULL DEFAULT false;
ALTER TABLE automation_commands ADD COLUMN IF NOT EXISTS rollback_of_command_id uuid REFERENCES automation_commands(id);

CREATE INDEX IF NOT EXISTS automation_commands_status_expiry_idx
  ON automation_commands (status, confirmation_expires_at);
CREATE INDEX IF NOT EXISTS automation_commands_target_idx
  ON automation_commands ((target->>'tenantId'), (target->>'bookId'), prepared_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS automation_commands_active_rollback_idx
  ON automation_commands (rollback_of_command_id)
  WHERE rollback_of_command_id IS NOT NULL AND status IN ('prepared','executing','completed');

CREATE TABLE IF NOT EXISTS automation_command_audit (
  id bigserial PRIMARY KEY,
  command_id uuid NOT NULL REFERENCES automation_commands(id),
  actor_id text NOT NULL,
  action_id text NOT NULL,
  tenant_id text NOT NULL,
  book_id text NOT NULL,
  collection_name text NOT NULL,
  doc_id text NOT NULL,
  operation text NOT NULL,
  before_data jsonb,
  after_data jsonb,
  target_adapter text,
  remote_operation_result jsonb,
  reconciliation_needed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE automation_command_audit ADD COLUMN IF NOT EXISTS target_adapter text;
ALTER TABLE automation_command_audit ADD COLUMN IF NOT EXISTS remote_operation_result jsonb;
ALTER TABLE automation_command_audit ADD COLUMN IF NOT EXISTS reconciliation_needed boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS automation_command_audit_command_idx
  ON automation_command_audit (command_id, id);
CREATE INDEX IF NOT EXISTS automation_command_audit_target_idx
  ON automation_command_audit (tenant_id, book_id, collection_name, doc_id, created_at DESC);

CREATE OR REPLACE FUNCTION reject_automation_audit_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'automation command audit is immutable';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS automation_command_audit_immutable ON automation_command_audit;
CREATE TRIGGER automation_command_audit_immutable
BEFORE UPDATE OR DELETE ON automation_command_audit
FOR EACH ROW EXECUTE FUNCTION reject_automation_audit_mutation();

CREATE TABLE IF NOT EXISTS automation_reversal_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_actor_type text NOT NULL CHECK (requester_actor_type IN ('owner','buyer')),
  requester_actor_id text NOT NULL,
  project_id text,
  tenant_id text NOT NULL,
  book_id text NOT NULL,
  original_command_id uuid NOT NULL REFERENCES automation_commands(id),
  reason text NOT NULL CHECK (length(reason) BETWEEN 1 AND 1000),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','prepared','completed','rejected','cancelled')),
  reviewer_actor_id text,
  prepared_rollback_command_id uuid REFERENCES automation_commands(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS automation_reversal_requests_active_idx
  ON automation_reversal_requests (original_command_id)
  WHERE status IN ('pending','prepared');
CREATE INDEX IF NOT EXISTS automation_reversal_requests_scope_idx
  ON automation_reversal_requests (tenant_id, book_id, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS automation_reversal_requests_status_idx
  ON automation_reversal_requests (status, created_at DESC, id DESC);

CREATE TABLE IF NOT EXISTS automation_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  command_id uuid NOT NULL REFERENCES automation_commands(id),
  effect_type text NOT NULL,
  dedupe_id text NOT NULL UNIQUE,
  payload jsonb NOT NULL CHECK (octet_length(payload::text) <= 262144),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','delivered','failed','dead-letter')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  available_at timestamptz NOT NULL DEFAULT now(),
  locked_at timestamptz,
  delivered_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS automation_outbox_dispatch_idx
  ON automation_outbox (status, available_at) WHERE status IN ('pending','failed');
ALTER TABLE automation_outbox ADD COLUMN IF NOT EXISTS locked_by text;
ALTER TABLE automation_outbox ADD COLUMN IF NOT EXISTS lease_expires_at timestamptz;
ALTER TABLE automation_outbox ADD COLUMN IF NOT EXISTS max_attempts integer NOT NULL DEFAULT 5;
ALTER TABLE automation_outbox ADD COLUMN IF NOT EXISTS dead_lettered_at timestamptz;
ALTER TABLE automation_outbox ADD COLUMN IF NOT EXISTS response_metadata jsonb;
DO $$ BEGIN
  ALTER TABLE automation_outbox ADD CONSTRAINT automation_outbox_payload_bounded
    CHECK (octet_length(payload::text) <= 262144);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS automation_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  command_id uuid NOT NULL REFERENCES automation_commands(id),
  tenant_id text NOT NULL,
  book_id text NOT NULL,
  action_id text NOT NULL,
  action_input jsonb NOT NULL CHECK (octet_length(action_input::text) <= 262144),
  cron_expression text NOT NULL,
  timezone text NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','cancelled')),
  next_run_at timestamptz,
  last_run_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS automation_schedules_due_idx
  ON automation_schedules (status, next_run_at) WHERE status = 'active';
ALTER TABLE automation_schedules ADD COLUMN IF NOT EXISTS locked_by text;
ALTER TABLE automation_schedules ADD COLUMN IF NOT EXISTS lease_expires_at timestamptz;
ALTER TABLE automation_schedules ADD COLUMN IF NOT EXISTS last_error text;
DO $$ BEGIN
  ALTER TABLE automation_schedules ADD CONSTRAINT automation_schedules_input_bounded
    CHECK (octet_length(action_input::text) <= 262144);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS automation_checkpoints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  command_id uuid REFERENCES automation_commands(id),
  checkpoint_type text NOT NULL,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  released_at timestamptz
);
CREATE INDEX IF NOT EXISTS automation_checkpoints_command_idx
  ON automation_checkpoints (command_id, created_at DESC);
CREATE INDEX IF NOT EXISTS automation_emergency_disable_idx
  ON automation_checkpoints (checkpoint_type, released_at)
  WHERE checkpoint_type = 'emergency-disable' AND released_at IS NULL;

CREATE TABLE IF NOT EXISTS automation_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  command_id uuid NOT NULL REFERENCES automation_commands(id),
  job_type text NOT NULL,
  target jsonb NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (octet_length(payload::text) <= 262144),
  checkpoint_id uuid REFERENCES automation_checkpoints(id),
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','running','succeeded','failed','dead-letter','cancelled')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  max_attempts integer NOT NULL DEFAULT 5 CHECK (max_attempts > 0),
  available_at timestamptz NOT NULL DEFAULT now(),
  locked_at timestamptz,
  locked_by text,
  started_at timestamptz,
  finished_at timestamptz,
  last_error text,
  dead_lettered_at timestamptz,
  dead_letter_reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS automation_jobs_dispatch_idx
  ON automation_jobs (status, available_at) WHERE status IN ('queued','failed');
CREATE INDEX IF NOT EXISTS automation_jobs_dead_letter_idx
  ON automation_jobs (dead_lettered_at DESC) WHERE status = 'dead-letter';
ALTER TABLE automation_jobs ADD COLUMN IF NOT EXISTS lease_expires_at timestamptz;
ALTER TABLE automation_jobs ADD COLUMN IF NOT EXISTS checkpoint jsonb NOT NULL DEFAULT '{}'::jsonb;
DO $$ BEGIN
  ALTER TABLE automation_jobs ADD CONSTRAINT automation_jobs_payload_bounded
    CHECK (octet_length(payload::text) <= 262144);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Schedules and events create these records only. They never execute commands.
CREATE TABLE IF NOT EXISTS automation_triggers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dedupe_key text NOT NULL UNIQUE,
  source_type text NOT NULL CHECK (source_type IN ('schedule','event')),
  source_id uuid NOT NULL,
  run_key text NOT NULL,
  tenant_id text NOT NULL,
  book_id text NOT NULL,
  action_id text NOT NULL,
  action_input jsonb NOT NULL CHECK (octet_length(action_input::text) <= 262144),
  status text NOT NULL DEFAULT 'awaiting-confirmation'
    CHECK (status IN ('awaiting-confirmation','prepared','confirmed','completed','failed','cancelled')),
  command_id uuid REFERENCES automation_commands(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  prepared_at timestamptz,
  reconciled_at timestamptz,
  last_error text
);
CREATE INDEX IF NOT EXISTS automation_triggers_pending_idx
  ON automation_triggers (status, created_at) WHERE status = 'awaiting-confirmation';
CREATE UNIQUE INDEX IF NOT EXISTS automation_triggers_command_idx
  ON automation_triggers (command_id) WHERE command_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS automation_event_triggers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  command_id uuid NOT NULL REFERENCES automation_commands(id),
  tenant_id text NOT NULL,
  book_id text NOT NULL,
  event_type text NOT NULL,
  action_id text NOT NULL,
  action_input jsonb NOT NULL CHECK (octet_length(action_input::text) <= 262144),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS automation_event_triggers_match_idx
  ON automation_event_triggers (status, event_type, tenant_id, book_id);

CREATE TABLE IF NOT EXISTS automation_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dedupe_key text NOT NULL UNIQUE,
  tenant_id text NOT NULL,
  book_id text NOT NULL,
  event_type text NOT NULL,
  payload jsonb NOT NULL CHECK (octet_length(payload::text) <= 262144),
  received_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS automation_worker_state (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  paused boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  heartbeat_at timestamptz,
  worker_id text,
  last_once_at timestamptz
);
INSERT INTO automation_worker_state(singleton) VALUES(true) ON CONFLICT(singleton) DO NOTHING;

CREATE TABLE IF NOT EXISTS buyer_deployment_manifests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  command_id uuid NOT NULL REFERENCES automation_commands(id),
  buyer_id text NOT NULL,
  project_id text NOT NULL,
  version text NOT NULL,
  artifact_digest text NOT NULL,
  manifest jsonb NOT NULL,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','deploying','active','failed','superseded')),
  created_at timestamptz NOT NULL DEFAULT now(),
  activated_at timestamptz,
  UNIQUE (buyer_id, project_id, version)
);
CREATE INDEX IF NOT EXISTS buyer_deployment_manifests_active_idx
  ON buyer_deployment_manifests (buyer_id, project_id, status);

-- Provision a distinct command role and store only its URL in
-- MCP_COMMAND_DATABASE_URL. Never add these grants to amlak_mcp.
--   CREATE ROLE amlak_mcp_command LOGIN PASSWORD '<generated-command-secret>';
--   GRANT CONNECT ON DATABASE amlak TO amlak_mcp_command;
--   GRANT USAGE ON SCHEMA public TO amlak_mcp_command;
--   GRANT SELECT, INSERT, UPDATE, DELETE ON documents TO amlak_mcp_command;
--   GRANT SELECT, INSERT, UPDATE ON automation_commands TO amlak_mcp_command;
--   GRANT SELECT, INSERT ON automation_command_audit TO amlak_mcp_command;
--   GRANT SELECT, INSERT, UPDATE ON automation_reversal_requests TO amlak_mcp_command;
--   GRANT SELECT, INSERT, UPDATE ON automation_outbox, automation_schedules,
--     automation_jobs, automation_checkpoints, automation_triggers,
--     automation_event_triggers, automation_events, automation_worker_state,
--     buyer_deployment_manifests TO amlak_mcp_command;
--   GRANT USAGE, SELECT ON SEQUENCE automation_command_audit_id_seq TO amlak_mcp_command;
-- Do not grant TRUNCATE, schema DDL, role management, or UPDATE/DELETE on
-- automation_command_audit. The existing amlak_mcp role remains read-only.
