# Paste this into Cursor on the Mac Mini (Agent mode)

```
Open ~/saudi-property-manager (or clone from https://github.com/Shazd0/saudi-property-manager branch cursor/staff-login-owner-redirect).

1. git pull origin cursor/staff-login-owner-redirect
2. bash mac-cloud/scripts/setup-migration-env.sh
3. cd mac-cloud && npm install && npm run migrate:inventory
4. Show me migration-report.json buyerBookMap and postgres book_ids — confirm teamCode mapping for all buyers before cutover.
5. pg_dump backup + gcloud firestore export (see docs/MAC_MINI_MIGRATION_STEPS.md)
6. npm run migrate:cutover:dry — fix errors
7. STOP and ask me to say "proceed with cutover" before npm run migrate:cutover
8. After cutover: firebase deploy --only firestore:rules,firestore:indexes,storage from repo root
9. Restart license-api with saudi-property-manager FIREBASE_SERVICE_ACCOUNT_JSON

Do not commit mac-cloud/.env. Report every command exit code.
```
