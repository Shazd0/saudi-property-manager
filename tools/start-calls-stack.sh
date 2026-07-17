#!/bin/sh
# Run on Mac Mini from project root:
#   chmod +x tools/start-calls-stack.sh
#   ./tools/start-calls-stack.sh

set -e
cd "$(dirname "$0")/.."

echo "==> Checking Firebase service account for call push..."
if [ ! -f "fcm-server/fcm-service-account.json" ]; then
  echo "MISSING: fcm-server/fcm-service-account.json"
  echo "1) Open Firebase Console → Project Settings → Service Accounts"
  echo "2) Generate new private key"
  echo "3) Save as fcm-server/fcm-service-account.json"
  echo "Then run this script again."
  exit 1
fi

if [ ! -f ".env" ] && [ ! -f "mac-cloud/.env" ]; then
  echo "Creating .env from mac-cloud/.env.example ..."
  cp mac-cloud/.env.example .env
  echo "EDIT .env now: set AMLAK_API_TOKEN and POSTGRES_PASSWORD, then re-run."
  exit 1
fi

echo "==> Starting Postgres + API + FCM push..."
docker compose -f docker-compose.mac-mini.yml up -d --build postgres amlak-api fcm-push

echo "==> Waiting for API health..."
sleep 3
curl -sf "http://127.0.0.1:${AMLAK_API_PORT:-8787}/api/health" && echo "" || echo "API not ready yet — check: docker logs amlak-api"

echo "==> Waiting for FCM push health..."
curl -sf "http://127.0.0.1:${FCM_PUSH_PORT:-3200}/health" && echo "" || echo "FCM not ready yet — check: docker logs amlak-fcm-push"

echo ""
echo "DONE. Keep Cloudflare tunnel running for api.amlak-app.com"
echo "Then on Netlify set:"
echo "  VITE_DATA_BACKEND=mac"
echo "  VITE_MAC_API_URL=/"
echo "  VITE_MAC_PROXY_TARGET=https://api.amlak-app.com"
echo "  VITE_MAC_API_TOKEN=<same as AMLAK_API_TOKEN>"
echo "Redeploy website. Each staff must login + Allow Notifications."
