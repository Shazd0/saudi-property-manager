#!/bin/zsh
set -u

PROJECT_DIR="/Users/shahzad/Downloads/My Projects 3/saudi-property-manager"
LOG_DIR="$PROJECT_DIR/mac-cloud/logs"
mkdir -p "$LOG_DIR"

echo "$(date '+%Y-%m-%dT%H:%M:%S%z') starting Amlak Mac cloud" >> "$LOG_DIR/startup.log"

open -ga Docker || true

for i in {1..90}; do
  if /usr/local/bin/docker info >/dev/null 2>&1 || /opt/homebrew/bin/docker info >/dev/null 2>&1; then
    break
  fi
  sleep 2
done

cd "$PROJECT_DIR" || exit 1

DOCKER_BIN="/usr/local/bin/docker"
if [ ! -x "$DOCKER_BIN" ]; then
  DOCKER_BIN="/opt/homebrew/bin/docker"
fi

"$DOCKER_BIN" compose --env-file "$PROJECT_DIR/.env.mac.local" -f "$PROJECT_DIR/docker-compose.mac-mini.yml" up -d postgres amlak-api backup >> "$LOG_DIR/startup.log" 2>&1

echo "$(date '+%Y-%m-%dT%H:%M:%S%z') startup command finished" >> "$LOG_DIR/startup.log"
