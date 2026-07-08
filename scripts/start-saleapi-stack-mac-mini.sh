#!/usr/bin/env bash
# Start Product License API + Cloudflare Tunnel on the Mac mini.
# IMPORTANT: stop cloudflared on the Windows laptop first so only one machine owns the tunnel.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "=== 1/2 License API ==="
chmod +x "$ROOT_DIR/scripts/start-license-api-mac-mini.sh"

# Start API in background if port free; otherwise assume already running.
if lsof -iTCP:8787 -sTCP:LISTEN >/dev/null 2>&1; then
  echo "Port 8787 already in use — assuming License API is running."
else
  "$ROOT_DIR/scripts/start-license-api-mac-mini.sh" &
  API_PID=$!
  echo "License API starting (pid $API_PID)..."
  sleep 2
fi

echo
echo "Local health:"
curl -sS "http://127.0.0.1:8787/health" || {
  echo "License API not healthy on :8787 — fix env / service-account.json first." >&2
  exit 1
}
echo
echo

echo "=== 2/2 Cloudflare Tunnel ==="
if [[ ! -f "$HOME/.cloudflared/config.yml" ]]; then
  echo "Missing ~/.cloudflared/config.yml" >&2
  echo "Copy tunnel credentials from the Windows laptop, or run scripts/setup-saleapi-tunnel-mac-mini.sh" >&2
  exit 1
fi

echo "Using $HOME/.cloudflared/config.yml"
echo "Keep this Terminal open. Ctrl+C stops the tunnel (buyers get Error 1033)."
exec cloudflared tunnel run
