#!/bin/zsh
set -euo pipefail

PROJECT_DIR="${AMLAK_PROJECT_DIR:-/Users/shahzad/Downloads/My Projects 3/saudi-property-manager}"
LOG_DIR="$PROJECT_DIR/mac-cloud/logs"
ENV_FILE="$PROJECT_DIR/.env"
if [[ ! -f "$ENV_FILE" && -f "$PROJECT_DIR/.env.mac.local" ]]; then
  ENV_FILE="$PROJECT_DIR/.env.mac.local"
fi

mkdir -p "$LOG_DIR"
echo "$(date '+%Y-%m-%dT%H:%M:%S%z') starting Amlak Mac cloud" >> "$LOG_DIR/startup.log"

open -ga Docker || true

for _ in {1..90}; do
  if /usr/local/bin/docker info >/dev/null 2>&1 || /opt/homebrew/bin/docker info >/dev/null 2>&1; then
    break
  fi
  sleep 2
done

cd "$PROJECT_DIR" || exit 1
[[ -f "$ENV_FILE" ]] || { echo "Missing $ENV_FILE" >&2; exit 1; }

DOCKER_BIN="/usr/local/bin/docker"
[[ -x "$DOCKER_BIN" ]] || DOCKER_BIN="/opt/homebrew/bin/docker"

"$DOCKER_BIN" compose --env-file "$ENV_FILE" -f "$PROJECT_DIR/docker-compose.mac-mini.yml" \
  up -d postgres amlak-api fcm-push mcp automation-worker zatca >> "$LOG_DIR/startup.log" 2>&1

echo "$(date '+%Y-%m-%dT%H:%M:%S%z') startup command finished" >> "$LOG_DIR/startup.log"
