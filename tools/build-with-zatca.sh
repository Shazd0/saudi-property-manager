#!/usr/bin/env bash
# Build Amlak with ZATCA URL baked in (Vite). Usage from repo root:
#   chmod +x tools/build-with-zatca.sh
#   ./tools/build-with-zatca.sh https://zatca-api.yourdomain.com
#   ./tools/build-with-zatca.sh https://zatca-api.yourdomain.com --web
#   ./tools/build-with-zatca.sh https://zatca-api.yourdomain.com --desktop
set -euo pipefail
URL="${1:-}"
if [[ -z "$URL" ]] || [[ "$URL" != http* ]]; then
  echo "Usage: $0 <https://zatca-api.yourdomain.com> [--web|--desktop]" >&2
  exit 1
fi
# trim trailing slash
URL="${URL%/}"
shift || true
MODE="${1:-}"
export VITE_ZATCA_SERVICE_URL="$URL"
echo "VITE_ZATCA_SERVICE_URL=$VITE_ZATCA_SERVICE_URL"
cd "$(dirname "$0")/.."
if [[ "$MODE" == "--desktop" ]]; then
  npm run desktop:build
elif [[ "$MODE" == "--web" ]]; then
  npm run build
else
  npm run build
  echo "Web build done. For Electron: ./tools/build-with-zatca.sh '$URL' --desktop"
fi
