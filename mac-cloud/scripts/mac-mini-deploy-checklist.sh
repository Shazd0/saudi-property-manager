#!/usr/bin/env bash
# Mac Mini operator checklist for MCP + action history.
# Run from the repository root on the Mac Mini once SSH is available.
# Does not invent or print production secrets. Dispatchers stay disabled.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

COMPOSE=(docker compose -f docker-compose.mac-mini.yml)
ENV_FILE="${ENV_FILE:-.env}"
STEP="${1:-all}"

die() { echo "ERROR: $*" >&2; exit 1; }
info() { echo "==> $*"; }
ok() { echo "OK: $*"; }

need_env() {
  [[ -f "$ENV_FILE" ]] || die "Missing $ENV_FILE — copy mac-cloud/.env.example and replace INVALID_* placeholders"
}

case "$STEP" in
  help|-h|--help)
    cat <<'EOF'
Usage: mac-cloud/scripts/mac-mini-deploy-checklist.sh [step]

Steps:
  all              Run validate → postgres → schema hint → up → health
  validate         docker compose config with --env-file .env
  postgres         Start postgres only
  schema           Reapply mac-cloud/schema.sql (idempotent DDL)
  roles-hint       Print role-provisioning reminder (passwords not generated)
  up               Build/start mcp + automation-worker
  health           curl loopback health endpoints
  cloudflare-hint  Print Cloudflare Access / tunnel notes
  capabilities-hint Print staged buyer capability guidance

Environment:
  ENV_FILE   Path to compose env file (default: .env)
EOF
    exit 0
    ;;
esac

run_validate() {
  need_env
  info "Validating compose config with $ENV_FILE"
  "${COMPOSE[@]}" --env-file "$ENV_FILE" config >/dev/null
  ok "compose config"
}

run_postgres() {
  need_env
  info "Starting postgres"
  "${COMPOSE[@]}" --env-file "$ENV_FILE" up -d postgres
  ok "postgres up"
}

run_schema() {
  need_env
  [[ -f mac-cloud/schema.sql ]] || die "mac-cloud/schema.sql missing"
  info "Reapplying schema (existing volumes must do this explicitly)"
  "${COMPOSE[@]}" --env-file "$ENV_FILE" exec -T postgres \
    sh -c 'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"' \
    < mac-cloud/schema.sql
  ok "schema applied"
}

run_roles_hint() {
  cat <<'EOF'
==> Role creation (manual — generate passwords on the Mac Mini)
Follow the SQL block in mac-cloud/MCP.md "Existing Mac Mini volume deployment".
Include GRANT on automation_reversal_requests for amlak_mcp_command.
Do not paste real passwords into tickets or git.
After creation, set distinct:
  MCP_DATABASE_URL
  MCP_COMMAND_DATABASE_URL
  AUTOMATION_DATABASE_URL
EOF
}

run_up() {
  need_env
  info "Building and starting mcp + automation-worker (dispatchers remain {})"
  "${COMPOSE[@]}" --env-file "$ENV_FILE" up -d --build mcp automation-worker
  ok "mcp + automation-worker"
}

run_health() {
  info "Checking local health endpoints"
  curl --fail --silent --show-error "http://127.0.0.1:8791/health" | tee /dev/stderr >/dev/null
  echo
  curl --fail --silent --show-error "http://127.0.0.1:8792/health" | tee /dev/stderr >/dev/null
  echo
  "${COMPOSE[@]}" ps
  ok "health checks"
}

run_cloudflare_hint() {
  cat <<'EOF'
==> Cloudflare Access / Tunnel (human console)
1. Tunnel origin: http://127.0.0.1:8791 only (do not publish 5432/8792).
2. Access app A — owner web UI + /owner
   - Policy: MCP_OWNER_ACCESS_EMAILS only
   - AUD → MCP_OWNER_ACCESS_AUD
   - TEAM → MCP_OWNER_ACCESS_TEAM_DOMAIN
   - ISSUER → same team URL with trailing /
   - CORS → MCP_OWNER_WEB_CORS_ORIGINS (exact origins)
   - Frontend: VITE_OWNER_AUTOMATION_URL=https://<owner-host>/owner
3. Access app B — /mcp
   - Record AUD in ops notes (MCP_ACCESS_AUD comment); server uses MCP_OWNER_TOKEN
   - Cursor/Gemini: Streamable HTTP + Bearer token via secret store
4. Restart mcp after Access env changes; re-run health.
See mac-cloud/DEPLOY_CHECKLIST.md §6 and mac-cloud/MCP.md.
EOF
}

run_capabilities_hint() {
  cat <<'EOF'
==> Staged buyer capabilities (default-deny)
capabilities authorize owner-managed buyer-target MCP commands only.
Buyer browsers: /assistant/actions read + reversal-request only (no confirm).
1. enabled:false, capabilities:[]
2. enabled:true, capabilities:[] → expect CAPABILITY_DENIED
3. Grant one exact low-risk action; prepare/cancel
4. Expand exact IDs / narrow prefixes; include command.rollback.v1 for reversals
5. Keep AUTOMATION_*_ENDPOINTS_JSON={} until real dispatchers exist
6. Avoid "*" except a controlled owner-managed cohort
EOF
}

run_all() {
  run_validate
  run_postgres
  info "Waiting for postgres health"
  sleep 3
  run_schema
  run_roles_hint
  run_up
  sleep 2
  run_health
  run_cloudflare_hint
  run_capabilities_hint
  ok "Automated steps finished — complete Cloudflare console + secrets manually"
}

case "$STEP" in
  all) run_all ;;
  validate) run_validate ;;
  postgres) run_postgres ;;
  schema) run_schema ;;
  roles-hint) run_roles_hint ;;
  up) run_up ;;
  health) run_health ;;
  cloudflare-hint) run_cloudflare_hint ;;
  capabilities-hint) run_capabilities_hint ;;
  *) die "Unknown step: $STEP (try help)" ;;
esac
