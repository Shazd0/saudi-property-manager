#!/usr/bin/env bash
# Install macOS LaunchAgents so saleapi auto-starts after login / reboot.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
USER_HOME="${HOME}"
UID_NUM="$(id -u)"
AGENTS_DIR="${USER_HOME}/Library/LaunchAgents"
LOG_DIR="${USER_HOME}/Library/Logs/amlak"
LICENSE_LABEL="com.amlak.license-api"
TUNNEL_LABEL="com.amlak.saleapi-tunnel"

LICENSE_SCRIPT="${ROOT_DIR}/scripts/start-license-api-mac-mini.sh"
TUNNEL_SCRIPT="${ROOT_DIR}/scripts/start-saleapi-tunnel-mac-mini.sh"
LICENSE_PLIST="${AGENTS_DIR}/${LICENSE_LABEL}.plist"
TUNNEL_PLIST="${AGENTS_DIR}/${TUNNEL_LABEL}.plist"

if [[ ! -f "${ROOT_DIR}/license-api-server/service-account.json" ]]; then
  echo "Missing ${ROOT_DIR}/license-api-server/service-account.json" >&2
  exit 1
fi

if [[ ! -f "${USER_HOME}/.cloudflared/config.yml" ]]; then
  echo "Missing ~/.cloudflared/config.yml — run ./scripts/setup-saleapi-tunnel-mac-mini.sh first." >&2
  exit 1
fi

chmod +x "${ROOT_DIR}/scripts/start-license-api-mac-mini.sh" \
  "${ROOT_DIR}/scripts/start-saleapi-tunnel-mac-mini.sh" \
  "${ROOT_DIR}/scripts/wait-for-license-api-health.sh"

mkdir -p "$AGENTS_DIR" "$LOG_DIR"

cat > "$LICENSE_PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${LICENSE_LABEL}</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>${LICENSE_SCRIPT}</string>
  </array>
  <key>WorkingDirectory</key>
  <string>${ROOT_DIR}</string>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>ThrottleInterval</key>
  <integer>10</integer>
  <key>StandardOutPath</key>
  <string>${LOG_DIR}/license-api.log</string>
  <key>StandardErrorPath</key>
  <string>${LOG_DIR}/license-api.err.log</string>
</dict>
</plist>
EOF

cat > "$TUNNEL_PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${TUNNEL_LABEL}</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>${TUNNEL_SCRIPT}</string>
  </array>
  <key>WorkingDirectory</key>
  <string>${ROOT_DIR}</string>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>ThrottleInterval</key>
  <integer>15</integer>
  <key>StandardOutPath</key>
  <string>${LOG_DIR}/saleapi-tunnel.log</string>
  <key>StandardErrorPath</key>
  <string>${LOG_DIR}/saleapi-tunnel.err.log</string>
</dict>
</plist>
EOF

unload_agent() {
  local label="$1"
  launchctl bootout "gui/${UID_NUM}/${label}" 2>/dev/null || true
  launchctl unload "${AGENTS_DIR}/${label}.plist" 2>/dev/null || true
}

load_agent() {
  local label="$1"
  if launchctl bootstrap "gui/${UID_NUM}" "${AGENTS_DIR}/${label}.plist" 2>/dev/null; then
    launchctl kickstart -k "gui/${UID_NUM}/${label}" 2>/dev/null || true
  else
    launchctl load -w "${AGENTS_DIR}/${label}.plist"
  fi
}

unload_agent "$LICENSE_LABEL"
unload_agent "$TUNNEL_LABEL"
load_agent "$LICENSE_LABEL"
sleep 2
load_agent "$TUNNEL_LABEL"

echo ""
echo "Installed LaunchAgents:"
echo "  ${LICENSE_PLIST}"
echo "  ${TUNNEL_PLIST}"
echo ""
echo "Logs:"
echo "  ${LOG_DIR}/license-api.log"
echo "  ${LOG_DIR}/saleapi-tunnel.log"
echo ""
echo "They start automatically when you log in (after reboot)."
echo ""
echo "Check status:"
echo "  launchctl print gui/${UID_NUM}/${LICENSE_LABEL} | head"
echo "  launchctl print gui/${UID_NUM}/${TUNNEL_LABEL} | head"
echo "  curl -sS http://127.0.0.1:8787/health"
echo "  curl -sS https://saleapi.amlak-app.com/health"
echo ""
echo "Stop auto-start:"
echo "  ./scripts/uninstall-saleapi-launchagents-mac-mini.sh"
