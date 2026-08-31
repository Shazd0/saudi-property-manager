#!/usr/bin/env bash
set -euo pipefail

echo "=== Amlak Mac Mini decommission checklist ==="
echo "Run only after 48h stable Firebase production."
echo ""
echo "1. Final backup:"
echo "   pg_dump \"\$DATABASE_URL\" > amlak-final-\$(date +%Y%m%d).sql"
echo ""
echo "2. Stop services:"
echo "   docker compose -f docker-compose.mac-mini.yml down"
echo ""
echo "3. Disable LaunchAgents / cloudflared tunnel for api.amlak-app.com"
echo ""
echo "4. Keep saleapi.amlak-app.com (License API) running until license server is migrated"
echo ""
echo "Archive the SQL dump to cold storage before removing the Mac."
