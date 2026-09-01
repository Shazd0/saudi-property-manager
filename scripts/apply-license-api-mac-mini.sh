#!/usr/bin/env bash
# Run on Mac mini after copying amlak-license-api-mac-transfer to Desktop.
set -euo pipefail

PACK="${1:-$HOME/Desktop/amlak-license-api-mac-transfer}"
REPO="${2:-$HOME/amlak-sale-product}"

if [[ ! -d "$PACK/license-api-server" ]]; then
  echo "Transfer pack not found at: $PACK" >&2
  exit 1
fi
if [[ ! -d "$REPO" ]]; then
  echo "Repo not found at: $REPO" >&2
  exit 1
fi

echo "Applying transfer pack from $PACK -> $REPO"
cp "$PACK/license-api-server/index.js" "$REPO/license-api-server/"
cp "$PACK/license-api-server/corsAllowlist.js" "$REPO/license-api-server/"
cp "$PACK/license-api-server/package.json" "$REPO/license-api-server/"
cp "$PACK/license-api-server/package-lock.json" "$REPO/license-api-server/"
cp "$PACK/functions/"*.js "$REPO/functions/"

cd "$REPO"
npm install --prefix license-api-server

if [[ -f docker-compose.mac-mini.yml && -f .env.mac-mini ]]; then
  echo "Rebuilding Docker license API on :8788..."
  docker compose -f docker-compose.mac-mini.yml --env-file .env.mac-mini up -d --build
  sleep 3
  echo "Local health (:8788):"
  curl -sS http://127.0.0.1:8788/health || true
else
  echo "No docker-compose.mac-mini.yml — restart with ./scripts/start-license-api-mac-mini.sh"
fi

echo "Public health:"
curl -sS https://saleapi.amlak-app.com/health || true
echo
