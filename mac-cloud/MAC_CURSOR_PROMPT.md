# Paste into Mac Cursor

```
Pull latest cursor/staff-login-owner-redirect from Shazd0/saudi-property-manager.

1. node mac-cloud/scripts/setup-migration-env.mjs
2. cd mac-cloud && npm install
3. npm run migrate:resolve-book-map — show evidence and envLine
4. Add POSTGRES_BOOK_ID_MAP to root .env (confirm mapping), set SKIP_BUYER_FIREBASE_IMPORT=1
5. Re-run node scripts/setup-migration-env.mjs
6. npm run migrate:inventory — show postgresBookIdMap + postgresBooks
7. npm run migrate:cutover:dry — must pass all steps
8. STOP before npm run migrate:cutover until I say "proceed with cutover"

Blockers resolved in latest pull:
- POSTGRES_BOOK_ID_MAP remaps legacy Postgres book_ids to teamCodes
- setup-migration-env.mjs writes JSON safely (no bash mangling)
- SKIP_BUYER_FIREBASE_IMPORT=1 skips missing buyer Firebase SAs when Postgres is authoritative

Still manual:
- Enable billing on saudi-property-manager for gcloud firestore export
- Buyer Firebase SAs optional if SKIP_BUYER_FIREBASE_IMPORT=1

Follow docs/MAC_MINI_MIGRATION_STEPS.md
```
