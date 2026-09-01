#!/usr/bin/env bash
# Remove saleapi LaunchAgents (stop auto-start on login).
set -euo pipefail

UID_NUM="$(id -u)"
AGENTS_DIR="${HOME}/Library/LaunchAgents"
LICENSE_LABEL="com.amlak.license-api"
TUNNEL_LABEL="com.amlak.saleapi-tunnel"

for label in "$TUNNEL_LABEL" "$LICENSE_LABEL"; do
  launchctl bootout "gui/${UID_NUM}/${label}" 2>/dev/null || true
  launchctl unload "${AGENTS_DIR}/${label}.plist" 2>/dev/null || true
  rm -f "${AGENTS_DIR}/${label}.plist"
done

echo "Removed LaunchAgents for ${LICENSE_LABEL} and ${TUNNEL_LABEL}."
echo "Manual start: ./scripts/start-saleapi-stack-mac-mini.sh"
