#!/bin/zsh
set -euo pipefail

PROJECT_DIR="${AMLAK_PROJECT_DIR:-/Users/shahzad/Downloads/My Projects 3/saudi-property-manager}"
exec "$PROJECT_DIR/scripts/start-mac-cloud.sh"
