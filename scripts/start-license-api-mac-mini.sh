#!/usr/bin/env bash
# Start the Product License API on the Mac mini (default :8787).
# Cloudflare Tunnel should point saleapi.amlak-app.com -> http://127.0.0.1:8787
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_CANDIDATES=(
  "$ROOT_DIR/license-api-server/.env.production.local"
  "$ROOT_DIR/functions/.env"
  "$ROOT_DIR/.env.local"
)

load_env_file() {
  local f="$1"
  [[ -f "$f" ]] || return 0
  set -a
  # shellcheck disable=SC1090
  source "$f"
  set +a
  echo "Loaded env from $f"
}

for f in "${ENV_CANDIDATES[@]}"; do
  load_env_file "$f"
done

if [[ -z "${SALES_CONSOLE_PASSWORD:-}" && -n "${VITE_SALES_CONSOLE_PASSWORD:-}" ]]; then
  export SALES_CONSOLE_PASSWORD="$VITE_SALES_CONSOLE_PASSWORD"
fi

if [[ -z "${SALES_CONSOLE_PASSWORD:-}" ]]; then
  echo "Missing SALES_CONSOLE_PASSWORD." >&2
  echo "Run: ./scripts/prepare-license-env-mac-mini.sh" >&2
  echo "Or create license-api-server/.env.production.local" >&2
  exit 1
fi

if [[ ! -f "$ROOT_DIR/license-api-server/service-account.json" && -z "${FIREBASE_SERVICE_ACCOUNT_JSON:-}" ]]; then
  echo "Missing Firebase Admin credentials." >&2
  echo "Copy license-api-server/service-account.json from the Windows laptop." >&2
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
