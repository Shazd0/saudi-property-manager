#!/usr/bin/env bash
# Run on the Mac Mini after git pull to rebuild MCP with latest fixes.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"
ENV_FILE="${ENV_FILE:-$ROOT/.env}"
[[ -f "$ENV_FILE" ]] || ENV_FILE="$ROOT/.env.mac.local"
[[ -f "$ENV_FILE" ]] || { echo "Missing .env" >&2; exit 1; }

git fetch origin
git checkout cursor/staff-login-owner-redirect
git pull origin cursor/staff-login-owner-redirect

docker compose --env-file "$ENV_FILE" -f docker-compose.mac-mini.yml up -d --build mcp automation-worker
curl --fail http://127.0.0.1:8791/health
curl --fail http://127.0.0.1:8792/health
echo "MCP updated. Test owner UI from https://amlakrrgroup.netlify.app (not raw /owner/actions URL)."
