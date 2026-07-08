#!/usr/bin/env bash
# Create license-api-server/.env.production.local on the Mac mini from known values / prompts.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT="$ROOT_DIR/license-api-server/.env.production.local"
SA="$ROOT_DIR/license-api-server/service-account.json"
FUNCS_ENV="$ROOT_DIR/functions/.env"

if [[ -f "$OUT" ]]; then
  echo "Already exists: $OUT"
  echo "Edit it if needed, then run ./scripts/start-license-api-mac-mini.sh"
  exit 0
fi

PASSWORD=""
if [[ -f "$FUNCS_ENV" ]]; then
  # shellcheck disable=SC1090
  PASSWORD="$(grep -E '^SALES_CONSOLE_PASSWORD=' "$FUNCS_ENV" | head -1 | cut -d= -f2- | tr -d '\r' | sed -e 's/^["'\'']//' -e 's/["'\'']$//')"
fi

if [[ -z "$PASSWORD" ]]; then
  read -r -s -p "SALES_CONSOLE_PASSWORD: " PASSWORD
  echo
fi

cat > "$OUT" <<EOF
NODE_ENV=production
PORT=8787
SALES_CONSOLE_PASSWORD=${PASSWORD}
LICENSE_CORS_ORIGINS=https://amlak-app.com,https://www.amlak-app.com
EOF

chmod 600 "$OUT"
echo "Wrote $OUT"

if [[ ! -f "$SA" ]]; then
  echo
  echo "WARNING: missing $SA"
  echo "Copy service-account.json from the Windows laptop:"
  echo "  license-api-server/service-account.json"
  echo "Or set FIREBASE_SERVICE_ACCOUNT_JSON in $OUT"
else
  echo "Found service-account.json — good."
fi
