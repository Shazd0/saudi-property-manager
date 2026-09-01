#!/usr/bin/env bash
# Start cloudflared for saleapi after License API is healthy.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CFG="${HOME}/.cloudflared/config.yml"

if [[ ! -f "$CFG" ]]; then
  echo "Missing $CFG — run ./scripts/setup-saleapi-tunnel-mac-mini.sh first." >&2
  exit 1
fi

"$ROOT_DIR/scripts/wait-for-license-api-health.sh"

if command -v cloudflared >/dev/null 2>&1; then
  CF="$(command -v cloudflared)"
elif [[ -x /opt/homebrew/bin/cloudflared ]]; then
  CF=/opt/homebrew/bin/cloudflared
elif [[ -x /usr/local/bin/cloudflared ]]; then
  CF=/usr/local/bin/cloudflared
else
  echo "cloudflared not found in PATH" >&2
  exit 1
fi

exec "$CF" tunnel run
