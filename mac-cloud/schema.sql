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
