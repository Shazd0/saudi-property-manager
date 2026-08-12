# Mac Mini + Cloudflare Access deployment checklist

Offline-prepared operator checklist for the MCP + action-history stack.
This is not a deployment record. Do not invent production secrets. External
dispatchers stay empty/`{}` until real credentials exist.

Run on the Mac Mini from the repository root after SSH/Tailscale is available.
Prefer `scripts/mac-mini-deploy-checklist.sh` for the scripted steps; use this
document for Cloudflare console work and staged sign-off.

## Preconditions (human / network)

- [ ] Mac Mini reachable (`ssh` / Tailscale).
- [ ] Repo present on the Mac Mini at the intended path.
- [ ] Docker Desktop / Engine and Compose plugin available.
- [ ] Cloudflare Zero Trust team exists; you can create Access apps and a Tunnel.
- [ ] Owner allowlist emails known.
- [ ] Buyer Firebase service accounts available offline (if enabling buyer projects).

## 1. Backup and schema reapply

Existing Postgres volumes do **not** auto-run `/docker-entrypoint-initdb.d`.

```bash
docker compose -f docker-compose.mac-mini.yml up -d postgres
# Take a dump before schema changes when data already exists.
docker compose -f docker-compose.mac-mini.yml exec -T postgres \
  sh -c 'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"' \
  < mac-cloud/schema.sql
```

Confirm action-history tables exist: `automation_commands`,
`automation_command_audit`, `automation_reversal_requests`.

## 2. Role creation

Follow the role SQL in `mac-cloud/MCP.md` (includes
`automation_reversal_requests`). Use freshly generated passwords; never paste
them into chat, git, or screenshots. Verify with `\du` / `\dp`.

## 3. `.env` generation (placeholders only here)

```bash
cp mac-cloud/.env.example .env
chmod 600 .env
```

Replace every `INVALID_*` value. Required families:

| Area | Vars |
| --- | --- |
| Postgres / API | `POSTGRES_*`, `AMLAK_API_TOKEN` |
| MCP bearer | `MCP_OWNER_TOKEN`, `MCP_OWNER_ID`, `MCP_MAC_TENANT_ID`, `MCP_CRITICAL_ACTION_SECRET` |
| DB roles | distinct `MCP_DATABASE_URL`, `MCP_COMMAND_DATABASE_URL`, `AUTOMATION_DATABASE_URL` |
| Hosts / CORS | `MCP_ALLOWED_HOSTS`, `ASSISTANT_CORS_ORIGINS`, `MCP_OWNER_WEB_CORS_ORIGINS` |
| Cloudflare Access | `MCP_OWNER_ACCESS_TEAM_DOMAIN`, `MCP_OWNER_ACCESS_ISSUER`, `MCP_OWNER_ACCESS_AUD`, `MCP_OWNER_ACCESS_EMAILS` |
| Worker | `AUTOMATION_EVENT_TOKEN`; keep dispatcher maps `{}` |
| Buyers | `BUYER_FIREBASE_PROJECTS_JSON` start `enabled:false`, `capabilities:[]` |

Issuer must equal `TEAM_DOMAIN` + trailing `/`.

Frontend (separate build env, not Compose):

```bash
# VITE_OWNER_AUTOMATION_URL=https://<owner-public-host>/owner
```

## 4. Compose validation and services

```bash
docker compose --env-file .env -f docker-compose.mac-mini.yml config >/dev/null
docker compose --env-file .env -f docker-compose.mac-mini.yml \
  up -d --build mcp automation-worker
```

Dockerfile (`mac-cloud/Dockerfile`) builds one image; Compose overrides command to
`npm run start:mcp` / `npm run start:automation`. Ports stay loopback-published.

## 5. Health checks

```bash
curl --fail http://127.0.0.1:8791/health
curl --fail http://127.0.0.1:8792/health
docker compose -f docker-compose.mac-mini.yml ps
docker compose -f docker-compose.mac-mini.yml logs --since=10m mcp automation-worker
```

## 6. Cloudflare Access / Tunnel (console — human)

Create **two** Access applications when practical:

### A. Owner web (`/owner` + owner UI origin)

- Application type: self-hosted (owner UI hostname and/or path to MCP `/owner`).
- Policy: allow only `MCP_OWNER_ACCESS_EMAILS`.
- Copy **Application Audience (AUD)** → `MCP_OWNER_ACCESS_AUD`.
- Team domain → `MCP_OWNER_ACCESS_TEAM_DOMAIN` /
  `MCP_OWNER_ACCESS_ISSUER` (`…cloudflareaccess.com/`).
- CORS: exact origin(s) in `MCP_OWNER_WEB_CORS_ORIGINS`.
- UI calls send `Cf-Access-Jwt-Assertion` (Access cookie/session). Never
  `MCP_OWNER_TOKEN`.
- Set `VITE_OWNER_AUTOMATION_URL` to `https://<owner-host>/owner`.

### B. MCP Streamable HTTP (`/mcp`)

- Separate Access app for the MCP hostname/path.
- Record MCP AUD in ops notes (`MCP_ACCESS_AUD` comment in `.env.example`);
  the server does **not** verify it — clients still send
  `Authorization: Bearer <MCP_OWNER_TOKEN>`.
- Prefer Access Service Tokens / device posture for Cursor/Gemini; do not put
  the owner bearer token in screenshots or repo files.
- Tunnel: publish only to `127.0.0.1:8791` on the Mac Mini. Do not expose
  `5432` / `8792` publicly.

Restart `mcp` after Access env changes; re-check `/health`.

## 7. Action history rollout

1. Schema + roles applied; services healthy.
2. Owner MCP: list tools including `owner.action-history`,
   `owner.action-detail`, `owner.reversal-requests`.
3. Owner web behind Access: `GET /owner/actions` with JWT succeeds; without
   JWT / wrong email fails.
4. Buyer browser (when assistant origins configured):
   `GET /assistant/actions` scoped; `POST …/reversal-requests` only;
   no confirm/cancel routes for buyers.
5. Owner prepares rollback from history (fresh Access session if required),
   inspects preview, confirms or cancels.
6. Keep `AUTOMATION_*_ENDPOINTS_JSON={}` until dispatchers are real.

## 8. Staged buyer capability enablement

Capabilities default-deny (`[]` / omitted). They authorize **owner MCP**
commands targeting that buyer project — they do **not** give buyer browsers
unrestricted writes.

1. Project entry `enabled:false`, `capabilities:[]` — identity/config dry-run.
2. `enabled:true`, still `[]` — expect `CAPABILITY_DENIED` on prepare.
3. Grant one low-risk exact action (e.g. `task.create.v1`); owner prepare/cancel.
4. Expand with exact IDs or narrow prefixes (`transaction.*`, `contract.*`).
5. Always include `command.rollback.v1` before relying on action-history
   reversals for that project.
6. Avoid `"*"` except a time-boxed owner-managed cohort; never treat `*` as a
   buyer-browser permission.
7. Jobs/outbox/external effects still fail closed until dispatcher maps are set.

See `mac-cloud/MCP.md` § Buyer capability grants for the supported grant set.

## 9. Acceptance (still requires Mac Mini evidence)

- [ ] Local health for MCP + worker
- [ ] Access JWT path for `/owner`
- [ ] Bearer path for `/mcp` through protected tunnel
- [ ] Action history list/detail + reversal request path
- [ ] Buyer capability deny then narrow grant
- [ ] Dispatchers still empty / fail closed
- [ ] Backup/restore plan noted

Repository `npm run test:mcp` alone is not production acceptance.
