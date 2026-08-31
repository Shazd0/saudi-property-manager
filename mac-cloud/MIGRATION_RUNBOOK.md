# Firebase migration (Mac Mini Postgres + buyer projects → saudi-property-manager)

## Prerequisites

Set these in `mac-cloud/.env` (never commit):

```bash
DATABASE_URL=postgres://amlak:***@localhost:5432/amlak
FIREBASE_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"saudi-property-manager",...}
LICENSE_REGISTRY_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"amlak-sales-main",...}
BUYER_FIREBASE_PROJECTS_JSON={"buyer-project-id":{"serviceAccount":{...}}}
```

## Phase 0 — Inventory

```bash
cd mac-cloud
npm run migrate:inventory
```

Outputs `migration-report.json` with Postgres counts, license buyer map, and storage sizes.

## Phase 3 — Staging dry-run

```bash
npm run migrate:cutover:dry
```

## Phase 4 — Production cutover

1. Enable maintenance banner in both apps
2. Stop Mac API writes
3. Export Firebase + `pg_dump` backups
4. Run:

```bash
npm run migrate:cutover
```

5. Deploy both apps (Firebase-only env)
6. Remove maintenance banner

## Phase 8 — Decommission Mac Mini

```bash
bash scripts/decommission-mac.sh
```

Archives final Postgres dump and documents stopped services.
