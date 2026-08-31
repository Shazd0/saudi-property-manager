#!/usr/bin/env bash
# Creates mac-cloud/.env from repo root .env + license-api service account.
# Usage: bash mac-cloud/scripts/setup-migration-env.sh
set -euo pipefail

MAC_CLOUD="$(cd "$(dirname "$0")/.." && pwd)"
node "$MAC_CLOUD/scripts/setup-migration-env.mjs"
