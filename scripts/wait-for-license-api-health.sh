#!/usr/bin/env bash
# Wait until License API responds on :8787 (used before cloudflared starts).
set -euo pipefail

HOST="${LICENSE_API_HEALTH_HOST:-127.0.0.1}"
PORT="${LICENSE_API_HEALTH_PORT:-8787}"
TRIES="${LICENSE_API_HEALTH_TRIES:-90}"

for ((i = 1; i <= TRIES; i++)); do
  if curl -sf "http://${HOST}:${PORT}/health" >/dev/null 2>&1; then
    exit 0
  fi
  sleep 1
done

echo "License API not healthy on http://${HOST}:${PORT}/health after ${TRIES}s" >&2
exit 1
