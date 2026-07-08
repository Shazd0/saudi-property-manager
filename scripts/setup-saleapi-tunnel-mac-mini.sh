#!/usr/bin/env bash
# One-time: write ~/.cloudflared/config.yml for saleapi.amlak-app.com on this Mac mini.
# Prefer copying credentials from the Windows laptop (same tunnel) over creating a new one.
set -euo pipefail

CFG_DIR="${HOME}/.cloudflared"
mkdir -p "$CFG_DIR"

TUNNEL_ID="${1:-}"
TUNNEL_NAME="${2:-amlak-saleapi}"

if [[ -z "$TUNNEL_ID" ]]; then
  echo "Usage:"
  echo "  $0 <TUNNEL_UUID> [tunnel-name]"
  echo
  echo "On the Windows laptop, the known saleapi tunnel is:"
  echo "  UUID: cf968696-8198-487e-a62b-e83c6318a6a8"
  echo "  Name: amlak-saleapi"
  echo
  echo "Best path — copy from Windows to Mac mini:"
  echo "  1. Copy C:\\Users\\Asus\\.cloudflared\\cf968696-8198-487e-a62b-e83c6318a6a8.json"
  echo "     to  ~/.cloudflared/cf968696-8198-487e-a62b-e83c6318a6a8.json"
  echo "  2. Copy C:\\Users\\Asus\\.cloudflared\\cert.pem to ~/.cloudflared/cert.pem (optional but useful)"
  echo "  3. Run: $0 cf968696-8198-487e-a62b-e83c6318a6a8 amlak-saleapi"
  echo
  echo "If you create a NEW tunnel instead:"
  echo "  cloudflared tunnel login"
  echo "  cloudflared tunnel create amlak-saleapi"
  echo "  cloudflared tunnel route dns amlak-saleapi saleapi.amlak-app.com"
  echo "  Then run this script with that new UUID."
  exit 1
fi

CRED="$CFG_DIR/${TUNNEL_ID}.json"
if [[ ! -f "$CRED" ]]; then
  echo "Missing credentials file: $CRED" >&2
  echo "Copy it from the Windows laptop first." >&2
  exit 1
fi

cat > "$CFG_DIR/config.yml" <<EOF
tunnel: ${TUNNEL_ID}
credentials-file: ${CRED}

ingress:
  - hostname: saleapi.amlak-app.com
    service: http://127.0.0.1:8787
  - service: http_status:404
EOF

echo "Wrote $CFG_DIR/config.yml"
echo "Tunnel: $TUNNEL_NAME ($TUNNEL_ID)"
echo "Ingress: saleapi.amlak-app.com -> http://127.0.0.1:8787"
echo
echo "Next:"
echo "  1. STOP cloudflared on the Windows laptop"
echo "  2. Start License API:  ./scripts/start-license-api-mac-mini.sh"
echo "  3. Start tunnel:       cloudflared tunnel run"
echo "  Or both:               ./scripts/start-saleapi-stack-mac-mini.sh"
