#!/usr/bin/env bash
# Start the Product License API on the Mac mini (default :8787).
# Cloudflare Tunnel should point saleapi.amlak-app.com -> http://127.0.0.1:8787
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$ROOT_DIR/license-api-server/.env.production.local"

if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
else
  echo "Warning: missing $ENV_FILE — using process env only." >&2
fi

if [[ -z "${SALES_CONSOLE_PASSWORD:-}" ]]; then
  echo "Missing SALES_CONSOLE_PASSWORD. Add it to $ENV_FILE" >&2
  exit 1
fi

if [[ -z "${LICENSE_CORS_ORIGINS:-}" ]]; then
  export LICENSE_CORS_ORIGINS="https://amlak-app.com,https://www.amlak-app.com"
  echo "LICENSE_CORS_ORIGINS not set — using default: $LICENSE_CORS_ORIGINS"
fi

export NODE_ENV="${NODE_ENV:-production}"
export PORT="${PORT:-8787}"

cd "$ROOT_DIR"
echo "License API listening on http://127.0.0.1:${PORT}"
exec node license-api-server/index.js
