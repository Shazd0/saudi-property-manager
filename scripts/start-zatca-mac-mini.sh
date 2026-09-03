#!/bin/zsh
# Start ZATCA signer on the Mac mini (Docker) so Netlify users can Send to ZATCA.
# Requires zatca-cert/*.pem + secret files in the project (gitignored — copy from Windows).
set -euo pipefail

PROJECT_DIR="${AMLAK_PROJECT_DIR:-/Users/shahzad/Downloads/My Projects 3/saudi-property-manager}"
CERT_DIR="$PROJECT_DIR/zatca-cert"

if [[ ! -f "$CERT_DIR/cert.pem" && ! -f "$CERT_DIR/production-cert.pem" ]]; then
  echo "Missing ZATCA certificates in $CERT_DIR" >&2
  echo "Copy cert.pem, production-cert.pem, private_key_*.pem, secret.txt, production-api-secret.txt from the Windows zatca-cert folder." >&2
  exit 1
fi

DOCKER_BIN="/usr/local/bin/docker"
[[ -x "$DOCKER_BIN" ]] || DOCKER_BIN="/opt/homebrew/bin/docker"

ENV_FILE="$PROJECT_DIR/.env"
[[ -f "$ENV_FILE" ]] || ENV_FILE="$PROJECT_DIR/.env.mac.local"
[[ -f "$ENV_FILE" ]] || { echo "Missing $PROJECT_DIR/.env" >&2; exit 1; }

cd "$PROJECT_DIR"
"$DOCKER_BIN" compose --env-file "$ENV_FILE" -f "$PROJECT_DIR/docker-compose.mac-mini.yml" up -d --build zatca amlak-api

echo "Local health:"
curl -sS http://127.0.0.1:3022/zatca/health || true
echo
echo "Via Mac API proxy:"
curl -sS http://127.0.0.1:8787/zatca/health || true
echo
echo "Public (needs Cloudflare tunnel for api.amlak-app.com):"
curl -sS https://api.amlak-app.com/zatca/health || true
echo
