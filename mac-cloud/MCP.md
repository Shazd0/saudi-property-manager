# Mac Mini owner-control MCP

This is the operational contract for the implemented owner full-control system:
read tools, explicit prepare/confirm commands, buyer adapters, durable
automation, and action history / reversals. It is not a deployment record. Code
in this repository does not mean the Mac Mini is deployed: an operator must
reapply the schema, provision roles and real secrets, configure buyer projects
and dispatcher mappings, start the services, and verify them.

Operator runbook for Mac Mini + Cloudflare Access:
`mac-cloud/DEPLOY_CHECKLIST.md` and
`mac-cloud/scripts/mac-mini-deploy-checklist.sh`.

Never expose PostgreSQL, ports 5432/8791/8792, Firebase service accounts,
`MCP_CRITICAL_ACTION_SECRET`, dispatcher tokens, browser sessions, cookies, or
browser credentials. Bind locally and use Tailscale or a Cloudflare Tunnel
protected by Access. Keep external dispatcher maps empty until real credentials
exist.

## Identities and authority

- **Owner MCP identity:** `/mcp` requires `Authorization: Bearer
  <MCP_OWNER_TOKEN>`. The server assigns `actorType=owner`,
  `actorId=MCP_OWNER_ID`, and wildcard book read scope. Clients cannot submit
  identity fields. Only this identity can use command and automation tools.
  Put Cloudflare Access in front of `/mcp` as edge protection; the server still
  requires the bearer token.
- **Owner web identity (action history UI/API):** `/owner/*` requires a
  Cloudflare Access JWT in `Cf-Access-Jwt-Assertion`. The server verifies
  issuer, audience (`MCP_OWNER_ACCESS_AUD`), and allowlisted email
  (`MCP_OWNER_ACCESS_EMAILS`). Never put `MCP_OWNER_TOKEN` in a browser or
  Vite bundle. Set the owner app build var
  `VITE_OWNER_AUTOMATION_URL` to the Access-protected public
  `https://<owner-host>/owner` origin path (see
  `services/ownerAutomationService.ts`).
- **Buyer assistant identity:** `/assistant/chat` requires a Firebase ID token
  and `X-Amlak-Project-Id`. The server verifies the token against the
  allowlisted project, reads `authIndex/{uid}`, and derives buyer, book, role,
  customer, and building scope. Body-supplied authorization is rejected.
- **Buyer action history:** privileged buyer roles (`buyer_admin`, `manager`)
  may call `/assistant/actions` (scoped list/detail) and
  `POST /assistant/actions/:id/reversal-requests` (request only). Buyers cannot
  confirm, cancel, or prepare rollbacks. Platform owner may manage all
  configured buyer projects via MCP / owner web.
- A buyer project entry is server authority for `buyerId`, `tenantId`,
  `bookId`, schema version, enabled state, building ceiling, and command
  capabilities. Omitted `capabilities` is `[]` (deny all). Prefer exact action
  IDs or narrow prefixes such as `transaction.*`; `"*"` is an explicit broad
  grant for **owner-managed** buyer targets, not for unrestricted buyer
  browser writes.

Owner query tools and buyer assistant tools are read-only. Mutations are not
natural-language side effects: owner commands always require
`command.prepare`, inspection of the preview, and `command.confirm` with the
one-time confirmation token before expiry. `command.cancel` and
`command.status` affect/read only commands owned by that owner identity.

## Cloudflare Access variables

Configure from Zero Trust → Access (never invent production AUDs/secrets):

| Variable | Purpose |
| --- | --- |
| `MCP_OWNER_ACCESS_TEAM_DOMAIN` | `https://<team>.cloudflareaccess.com` (no trailing slash) |
| `MCP_OWNER_ACCESS_ISSUER` | Exactly `TEAM_DOMAIN` + `/` |
| `MCP_OWNER_ACCESS_AUD` | Audience of the **owner web** Access application (JWT verify for `/owner`) |
| `MCP_OWNER_ACCESS_EMAILS` | Comma-separated allowlisted owner emails |
| `MCP_OWNER_WEB_CORS_ORIGINS` | Exact HTTPS origins for the owner UI (no `*`) |
| `MCP_ALLOWED_HOSTS` | Include tunnel hostnames presented to `/mcp` and `/owner` |
| `ASSISTANT_CORS_ORIGINS` | Exact buyer app origins for `/assistant/*` |

Optional ops note (not consumed by the server today): record the separate
`/mcp` Access application AUD beside `MCP_ACCESS_AUD` in `.env` comments.

Frontend (owner UI build env, not Compose):

```text
VITE_OWNER_AUTOMATION_URL=https://owner-app.example/owner
```

Create separate Access applications for owner web and MCP when practical.
Tunnel only to `127.0.0.1:8791`. Do not publish Postgres or the automation
event port.

## Action history and reversals

Durable command rows and immutable `automation_command_audit` power action
history. Schema also includes `automation_reversal_requests`.

**Owner MCP tools (read-only):** `owner.action-history`, `owner.action-detail`,
`owner.reversal-requests`.

**Owner web HTTP (Cloudflare Access JWT + CORS):**

- `GET /owner/actions`, `GET /owner/actions/:id`
- `GET /owner/reversal-requests`
- `POST /owner/actions/:id/prepare-reversal` → prepare `command.rollback.v1`
- `POST /owner/commands/:id/confirm` / `cancel`

Preparing rollback may require a fresh Access session
(`ACCESS_REAUTH_REQUIRED`). Critical rollback still follows the normal proof
rules when applicable. Inspect preview before confirm.

**Buyer HTTP (Firebase ID token, project-scoped):** list/detail of that
project's actions and create pending reversal requests only. Owner reviews and
executes rollbacks.

Rollout: schema/roles → local health → Access-protected owner list → buyer
request-only path → one prepare/cancel rollback → confirm only after preview
sign-off. Keep dispatcher maps empty during early rollout.

## Discovery, planning, and action domains

`command.catalog {}` is the source of truth. It returns every allowlisted action
with domain, critical flag, and JSON input schema. `automation.plan` accepts a
bounded natural-language request and returns matching catalog entries and
required schemas; it is read-only and explicitly executes nothing.

Implemented domains are:

- **finance:** transactions, rent, payments, expenses, journals, bank
  reconciliation/accounts, borrowing, credit notes, transfers/reversals, bank
  merge, and cross-book transfer.
- **property:** buildings/properties, units, contracts and renew/finalize/
  terminate, owners, and service agreements.
- **operations:** tasks, inventory/stock, utilities, deposits, licenses,
  civil-defense, vehicles, maintenance, compliance, reminders, schedules,
  event triggers, worker control, and emergency control.
- **administration:** customers, employees, vendors, approvals, staff
  assignments, settings, books, categories, users, roles, license
  configuration, buyer support, and buyer deployment.
- **reporting/export:** report/data export and data import.
- **backup/migration:** backup create/restore, book reset, and migration.
- **external effects:** email, SMS, WhatsApp, push, webhook, ZATCA, SADAD,
  Absher, and Ejar dispatch.

Generic document families expose create/update/soft-delete/restore and critical
permanent-delete actions. Permanent deletion, identity/role/license changes,
staff assignment changes, destructive recovery, cross-scope operations,
external government/payment submission, and automation controls are critical.
Always inspect the live catalog rather than relying on this summary.

## Targets and confirmation examples

Every action input includes a server-validated target and an idempotency key.

```json
{"adapter":"mac","tenantId":"the-exact-MCP_MAC_TENANT_ID","bookId":"book-1"}
```

Mac targets must omit `projectId`; tenant ID must exactly match the configured
Mac tenant. Buyer targets require all four values and must exactly match the
server project map:

```json
{"adapter":"buyer","projectId":"buyer-firebase-project","tenantId":"buyer-tenant-1","bookId":"buyer-book-1"}
```

Example non-critical flow (shown as MCP tool names and JSON arguments):

```text
command.prepare
{"actionId":"task.create.v1","input":{"target":{"adapter":"mac","tenantId":"mac-tenant-1","bookId":"book-1"},"idempotencyKey":"task-2026-08-08-001","data":{"title":"Inspect unit 12"}}}

# Verify commandId, exactTarget, summary, sideEffects, rollback, and expiry.
command.confirm
{"commandId":"<uuid-from-prepare>","confirmationToken":"<one-time-token-from-prepare>"}
```

For a critical action, generate a fresh server-side proof and include it only in
prepare. The proof does not replace confirmation:

```bash
cd mac-cloud
npm run critical-reauth -- backup.restore.v1
```

The utility reads only `MCP_OWNER_ID`, `MCP_CRITICAL_ACTION_SECRET`, and
`MCP_CRITICAL_REAUTH_MAX_AGE_MS` from server environment. It rejects unknown or
non-critical actions and prints only JSON containing `actionId`, `proof`,
`timestamp`, `expiresAt`, and guidance. It never prints either secret. Use the
proof immediately:

```text
command.prepare
{"actionId":"backup.restore.v1","criticalReauthProof":"<timestamp:hmac>","input":{"target":{"adapter":"mac","tenantId":"mac-tenant-1","bookId":"book-1"},"idempotencyKey":"restore-approved-001","backupId":"<uuid>","verifyDigest":"<64-hex-sha256>"}}
command.confirm
{"commandId":"<uuid-from-prepare>","confirmationToken":"<one-time-token-from-prepare>"}
```

Never run the proof generator in a client, browser, shared shell, or AI tool
environment. Restrict `.env` permissions and shell/log access.

## Schedules, events, jobs, and outbox

Creating or cancelling schedules and event triggers is itself a confirmed
command. Cron schedules and authenticated events never execute domain actions
directly. The worker creates deduplicated `automation_triggers` rows in
`awaiting-confirmation`. The owner must:

1. call `automation.pending-triggers`;
2. inspect the selected trigger;
3. call `automation.prepare-trigger` (with fresh proof if critical);
4. inspect the command preview; and
5. call `command.confirm`.

`automation.worker-status` reports heartbeat, pause state, and queue counts.
The worker leases due schedules, jobs, and outbox rows with `FOR UPDATE SKIP
LOCKED`. Jobs/outbox use stable IDs and idempotency headers. Failures are
retried with bounded exponential backoff; after `max_attempts` they become
`dead-letter` with error context. Operators must alert on dead letters, repair
the handler/configuration, and use an audited replay procedure rather than
editing immutable audit rows.

All external effects require an exact
`AUTOMATION_OUTBOX_ENDPOINTS_JSON[actionId]`. All queued high-risk/job actions
require either a compiled local handler or an exact
`AUTOMATION_JOB_ENDPOINTS_JSON[actionId]`. Current Compose startup provides no
local handlers, so these actions fail closed until endpoints are provisioned:

- jobs: `contract.finalize.v1`, `contract.terminate.v1`,
  `unit.rename-cascade.v1`, `report.export.v1`, `data.export.v1`,
  `data.import.v1`, `backup.create.v1`, `backup.restore.v1`,
  `book.reset.v1`, `migration.execute.v1`, `bank.merge.v1`,
  `book.cross-transfer.v1`, `buyer-support.operation.v1`, and
  `buyer.deployment.publish.v1`;
- outbox: `external.send.v1`, `notification.send.v1`, `reminder.send.v1`,
  `invoice.submit-zatca.v1`, `payment.send-sadad.v1`, `absher.submit.v1`,
  `ejar.submit.v1`, and `sadad.submit.v1`.

Payload URLs are ignored. Endpoint URLs come only from server maps. Each
endpoint's `auth` name selects a different server-side bearer token from
`AUTOMATION_SERVICE_TOKENS_JSON`; missing endpoint or token configuration must
be treated as unavailable. Dispatchers must enforce the idempotency key,
authenticate the worker, validate target/payload again, bound response size,
and return success only after durable acceptance.

## Emergency disable and worker pause

`automation.emergency-disable.v1` blocks prepare, confirm, status, cancel, and
catalog while leaving only a prepared/confirmed
`automation.emergency-enable.v1` recovery path. Both are critical, require a
reason, fresh proof, preview, and confirmation. Use emergency disable for a
suspected compromise or unsafe command path.

`automation.worker-pause.v1`/`automation.worker-resume.v1` are also critical.
Pause stops schedule, reconciliation, job, and outbox processing while keeping
the service and queues observable. It does not revoke owner credentials or
replace emergency disable. Confirm queue state and worker heartbeat after every
control change.

## Adapter capabilities and reconciliation

- **Mac adapter:** accepts only the configured Mac tenant, uses the command
  Postgres role, and executes supported document and central automation
  operations transactionally.
- **Firebase buyer adapter:** accepts only enabled project-map entries with
  schema version `1` and a matching capability. Supported document operations
  run in one Firestore transaction and create immutable
  `__mcpCommandAudits/{commandId}` records. Unsupported operations fail closed.
- **Buyer central infrastructure:** allowlisted jobs, outbox effects, schedules,
  controls, and deployment manifests are written to central Postgres after
  target/capability checks; they do not receive a Firebase transaction and
  never mutate Mac `documents`.
- **Future Postgres buyer adapter:** remains disabled. It must prove stable
  tenant/book/schema/capabilities, use transaction-scoped tenant context and
  RLS, and connect without superuser/BYPASSRLS before registration.

Commands, before/after command audit, remote result, adapter, and
`reconciliation_needed` are recorded centrally. A remote Firebase success
followed by a central completion failure is marked for reconciliation. Retry
with the same command ID/token path; the immutable remote command audit makes
the write idempotent. Never manually claim success without comparing central
and remote audit records.

## Buyer capability grants

`BUYER_FIREBASE_PROJECTS_JSON[].capabilities` is **default-deny**. Omitted or
`[]` denies every buyer-target command (`CAPABILITY_DENIED`).

These grants authorize the **platform owner** (MCP bearer or owner-web Access
identity) to run prepare/confirm against that buyer Firebase project. They do
**not** open unrestricted writes for buyer browsers. Buyer browsers stay on
read assistant tools plus request-only reversal requests.

Matching rules:

- exact action ID (preferred);
- single-segment prefix ending in `.*` (example: `transaction.*` matches
  `transaction.create.v1`);
- `"*"` matches all — use only for a time-boxed, owner-managed cohort.

Staged enablement:

1. `enabled:false`, `capabilities:[]` — config present, project offline.
2. `enabled:true`, `capabilities:[]` — identity ok; prepares deny.
3. Grant one low-risk exact ID; owner `command.prepare` then `command.cancel`.
4. Expand with exact IDs or narrow prefixes; always add `command.rollback.v1`
   before relying on action-history reversals for that project.
5. Leave `AUTOMATION_OUTBOX_ENDPOINTS_JSON` / `AUTOMATION_JOB_ENDPOINTS_JSON` /
   `AUTOMATION_SERVICE_TOKENS_JSON` as `{}` until real dispatchers exist
   (jobs/outbox still fail closed even if capability is granted).

Owner-managed “full supported buyer document surface” without browser write
escalation — grant explicit families (or equivalent prefixes), **not** buyer UI
tokens:

- Document families (each exposes create/update/delete/restore; permanent-
  delete is critical): `transaction`, `property`, `unit`, `contract`, `task`,
  `inventory-item`, `customer`, `employee`, `vendor`, `approval`,
  `bank-account`, `borrowing`, `owner`, `service-agreement`, `utility`,
  `security-deposit`, `municipality-license`, `civil-defense`, `vehicle`,
  `maintenance`, `compliance`, `staff-assignment`, `setting`, `book`,
  `category` → e.g. `transaction.create.v1` … or `transaction.*`.
- Common finance/property ops often needed with documents:
  `contract.renew.v1`, `transaction.transfer.v1`,
  `transaction.transfer-reverse.v1`, `rent.record.v1`, `payment.record.v1`,
  `expense.create.v1`, status updates, `credit-note.create.v1`, and related
  catalog entries returned by `command.catalog`.
- Reversals: `command.rollback.v1`.

Prefer listing exact IDs from a live `command.catalog` for the cohort rather
than copying this summary. Do not grant job/outbox/government/payment action
IDs until dispatcher endpoints and tokens are real.

## Firebase-to-Postgres migration contract

The migration is an explicit, audited data transfer, not an adapter switch. It
preserves document IDs, normalizes Firestore timestamps, records
`source_collection`/`source_path`, maps book-scoped collection names, upserts
each collection transactionally, and records `migration_runs`. Deleted rows
are skipped unless `--include-deleted` is specified. Collection read errors
produce `completed_with_errors`; that is not a successful cutover.

Contract:

1. take and verify a recoverable source and Postgres backup;
2. freeze writes or define a reconciliation window;
3. run `npm run migrate:dry` (or the Compose dry run) and reconcile per-
   collection counts;
4. run the transfer with explicit book/collection scope where practical;
5. inspect `migration_runs`, errors, IDs, deleted-row policy, sampled values,
   totals, and application reads;
6. dual-read or shadow-compare and reconcile drift;
7. switch one staged cohort; retain rollback credentials/data;
8. remove Firebase credentials only after the acceptance window.

`BuyerIdentityProvider` can be replaced by a provider implementing `available`,
`verify({projectId,idToken})`, `repositoryFor(principal)`, and `close()`.
Provider migration does not relax the target/capability/audit contract.

## Existing Mac Mini volume deployment

Run from the repository root on the Mac Mini. Back up first. Schema files under
`/docker-entrypoint-initdb.d` run only when a Postgres volume is first created,
so an existing volume **must be reapplied explicitly**:

```bash
docker compose -f docker-compose.mac-mini.yml up -d postgres
docker compose -f docker-compose.mac-mini.yml exec -T postgres \
  sh -c 'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"' \
  < mac-cloud/schema.sql
```

Create independent role passwords without placing them in source control:

```bash
read -rsp "MCP read role password: " MCP_READ_PASSWORD; echo
read -rsp "MCP command role password: " MCP_COMMAND_PASSWORD; echo
docker compose -f docker-compose.mac-mini.yml exec -T postgres \
  psql -v ON_ERROR_STOP=1 -U amlak -d amlak \
  -v read_password="$MCP_READ_PASSWORD" \
  -v command_password="$MCP_COMMAND_PASSWORD" <<'SQL'
SELECT format('CREATE ROLE amlak_mcp LOGIN PASSWORD %L', :'read_password')
WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname='amlak_mcp') \gexec
ALTER ROLE amlak_mcp PASSWORD :'read_password';
GRANT CONNECT ON DATABASE amlak TO amlak_mcp;
GRANT USAGE ON SCHEMA public TO amlak_mcp;
GRANT SELECT ON documents TO amlak_mcp;
GRANT INSERT ON mcp_audit_log TO amlak_mcp;
GRANT USAGE, SELECT ON SEQUENCE mcp_audit_log_id_seq TO amlak_mcp;

SELECT format('CREATE ROLE amlak_mcp_command LOGIN PASSWORD %L', :'command_password')
WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname='amlak_mcp_command') \gexec
ALTER ROLE amlak_mcp_command PASSWORD :'command_password';
GRANT CONNECT ON DATABASE amlak TO amlak_mcp_command;
GRANT USAGE ON SCHEMA public TO amlak_mcp_command;
GRANT SELECT, INSERT, UPDATE, DELETE ON documents TO amlak_mcp_command;
GRANT SELECT, INSERT, UPDATE ON automation_commands TO amlak_mcp_command;
GRANT SELECT, INSERT ON automation_command_audit TO amlak_mcp_command;
GRANT SELECT, INSERT, UPDATE ON automation_reversal_requests TO amlak_mcp_command;
GRANT SELECT, INSERT, UPDATE ON automation_outbox, automation_schedules,
  automation_jobs, automation_checkpoints, automation_triggers,
  automation_event_triggers, automation_events, automation_worker_state,
  buyer_deployment_manifests TO amlak_mcp_command;
GRANT USAGE, SELECT ON SEQUENCE automation_command_audit_id_seq TO amlak_mcp_command;
SQL
unset MCP_READ_PASSWORD MCP_COMMAND_PASSWORD
```

If database/user names differ, replace `amlak` consistently. Verify grants with
`\du` and `\dp`; never grant schema DDL, role administration, TRUNCATE,
superuser/BYPASSRLS, or audit UPDATE/DELETE.

Then follow `mac-cloud/DEPLOY_CHECKLIST.md` (or the script), summarized:

1. `cp mac-cloud/.env.example .env && chmod 600 .env`.
2. Generate separate values for owner token, critical secret, event token,
   database passwords, API token, and every dispatcher token (`openssl rand
   -base64 48`; `openssl rand -hex 32` for URL-safe DB passwords).
3. Set all required values documented in `.env.example`, including distinct
   `MCP_DATABASE_URL`/`MCP_COMMAND_DATABASE_URL`,
   `AUTOMATION_DATABASE_URL`, stable `MCP_MAC_TENANT_ID`, Cloudflare Access
   team/issuer/AUD/emails, exact hosts/origins, timeouts, and event settings.
4. Populate `BUYER_FIREBASE_PROJECTS_JSON` with server-only service accounts,
   stable IDs, `schemaVersion:1`, explicit `enabled`, building ceiling, and
   explicit default-deny capabilities. Start disabled/`[]`, verify identity,
   then grant narrowly per **Buyer capability grants**.
5. Leave dispatcher maps as `{}` until real dispatcher services and tokens
   exist. Do not map unimplemented handlers.
6. Validate configuration before startup:

   ```bash
   docker compose --env-file .env -f docker-compose.mac-mini.yml config >/dev/null
   ```

7. Start and rebuild MCP/worker:

   ```bash
   docker compose --env-file .env -f docker-compose.mac-mini.yml \
     up -d --build mcp automation-worker
   ```

8. Check local-only health and logs:

   ```bash
   curl --fail http://127.0.0.1:8791/health
   curl --fail http://127.0.0.1:8792/health
   docker compose -f docker-compose.mac-mini.yml ps
   docker compose -f docker-compose.mac-mini.yml logs --since=10m mcp automation-worker
   ```

Health must show MCP configuration and a recent worker heartbeat. Also test an
owner read, action-history list, a prepare/cancel, a critical proof plus
prepare/cancel, Access JWT owner-web auth, a denied buyer capability, a buyer
reversal request (no confirm), and an intentionally unconfigured dispatcher
fail-closed case before enabling writes.

## Cursor and Gemini Streamable HTTP

Publish `http://127.0.0.1:8791` only through Tailscale Serve or a Cloudflare
Tunnel protected by Access. Keep the MCP bearer token as a second layer. Prefer
a dedicated Access application for `/mcp` (AUD recorded in ops notes) separate
from the owner-web Access application whose AUD is `MCP_OWNER_ACCESS_AUD`.
The Streamable HTTP endpoint for both Cursor and Gemini-compatible MCP clients
is:

```text
https://mcp.private.example/mcp
```

Owner action-history UI/API (Access JWT, not bearer token):

```text
https://owner.private.example/owner
```

Cursor configuration (keep the token in local environment):

```json
{
  "mcpServers": {
    "amlak-owner": {
      "url": "https://mcp.private.example/mcp",
      "headers": {
        "Authorization": "Bearer ${env:MCP_OWNER_TOKEN}"
      }
    }
  }
}
```

For a Gemini-compatible MCP client, select **Streamable HTTP**, use the same
exact `/mcp` URL, and configure the same Authorization header through that
client's secret store. Do not put the token in a URL, prompt, repository,
browser JavaScript, or screenshot. `/assistant/chat` is a separate buyer API
and is not the owner MCP URL.

## Audit, backups, recovery, and rollout

- Retain and monitor `mcp_audit_log`, immutable
  `automation_command_audit`, commands, checkpoints, triggers, jobs, outbox,
  worker state, remote buyer audits, and migration runs. Alert on denied/error
  spikes, reconciliation flags, stale heartbeats, repeated retries, and dead
  letters. Audit intentionally excludes raw tokens/prompts/results.
- Use encrypted, access-controlled `pg_dump` backups and test restoration on an
  isolated host. Include both application and automation tables. Record RPO,
  RTO, retention, restore owner, digest verification, and post-restore
  reconciliation. A backup job is not protection until its handler and restore
  drill are verified.
- Rotate owner, critical, event, database, Firebase, tunnel, and dispatcher
  credentials independently. Restart only affected services, health-check,
  then revoke old credentials. Emergency-disable first if compromise is
  suspected.
- Stage rollout: schema/roles and read-only owner tools; Cloudflare Access for
  `/owner` and protected `/mcp`; action history list/detail; prepare/cancel
  without confirm; one low-risk Mac action; buyer request-only reversals;
  explicit buyer identity with `capabilities:[]`; one narrow buyer capability
  plus `command.rollback.v1`; schedules/events awaiting confirmation; one
  idempotent dispatcher only after real credentials; high-risk jobs;
  external/government/payment effects last. Keep emergency disable and rollback
  tested at every stage.

Production acceptance requires actual Mac Mini health evidence, provisioned
Cloudflare Access apps, credentials and (when ready) endpoint mappings,
successful restore/reconciliation drills, and operator sign-off. Passing
repository tests alone is not deployment.
