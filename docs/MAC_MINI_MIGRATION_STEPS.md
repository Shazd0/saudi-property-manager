# Mac Mini — do this now (step by step)

## Step 1 — Get the scripts on the Mac

```bash
cd ~/saudi-property-manager
git fetch origin
git checkout cursor/staff-login-owner-redirect
git pull origin cursor/staff-login-owner-redirect
```

## Step 2 — Create `mac-cloud/.env` (JSON-safe)

```bash
node mac-cloud/scripts/setup-migration-env.mjs
# or: bash mac-cloud/scripts/setup-migration-env.sh
```

Do **not** hand-edit `FIREBASE_SERVICE_ACCOUNT_JSON` in bash — use the Node script above.

## Step 3 — Resolve Postgres book_id → teamCode map

```bash
cd mac-cloud
npm install
npm run migrate:resolve-book-map
```

Open `postgres-book-id-map.json` and copy `envLine` into **root** `.env`, then re-run setup:

```bash
# Example (confirm against evidence in the JSON file):
POSTGRES_BOOK_ID_MAP={"6XwFZu6Tc7EMZNqDbe8u":"P25Y3RHH5GGAZ8","ZkxIzLH6YgvcFIA1j8Mq":"3TAJ3ZWQBSETPR"}
SKIP_BUYER_FIREBASE_IMPORT=1

node scripts/setup-migration-env.mjs
```

| Postgres `book_id` | Likely buyer | teamCode |
|--------------------|--------------|----------|
| `6XwFZu6Tc7EMZNqDbe8u` (519 docs) | RR MILLENNIUM | `P25Y3RHH5GGAZ8` |
| `ZkxIzLH6YgvcFIA1j8Mq` (370 docs) | Duyoof Al Kiram | `3TAJ3ZWQBSETPR` |
| `default` (7098 docs) | amlakrrgroup internal | stays `default` |

**Confirm** with `npm run migrate:resolve-book-map` evidence before cutover.

## Step 4 — Inventory

```bash
npm run migrate:inventory
```

Check `migration-report.json`:

- `postgresBookIdMap.suggested` / `configured`
- `buyerBookMap` — license teamCodes
- `postgresBooks` — doc counts per legacy book_id

## Step 5 — Backups

```bash
pg_dump "$DATABASE_URL" > ~/amlak-backup-$(date +%Y%m%d).sql
```

If `api_audit_log` TOAST is corrupt, exclude it:

```bash
pg_dump "$DATABASE_URL" --exclude-table=api_audit_log > ~/amlak-backup-$(date +%Y%m%d).sql
```

Firestore export (requires billing on `saudi-property-manager`):

```bash
gcloud firestore export gs://saudi-property-manager-backups/pre-cutover-$(date +%Y%m%d) --project=saudi-property-manager
```

Enable billing: https://console.developers.google.com/billing/enable?project=saudi-property-manager

## Step 6 — Dry run

```bash
npm run migrate:cutover:dry
```

With `SKIP_BUYER_FIREBASE_IMPORT=1`, missing buyer Firebase SAs are warnings, not failures.

Optional — import gaps from buyer Firebase projects later:

```json
BUYER_FIREBASE_PROJECTS_JSON={
  "tandeel": { "serviceAccount": { ... } },
  "amlak-demo-5ee30": { "serviceAccount": { ... } }
}
```

Download SAs: Firebase Console → Project → Project settings → Service accounts → Generate new private key.

## Step 7 — Live cutover (maintenance window)

1. Stop Mac API: `docker compose -f docker-compose.mac-mini.yml stop amlak-api`
2. `npm run migrate:cutover`
3. `npm run migrate:validate`
4. Deploy rules from repo root:

```bash
cd ..
firebase deploy --only firestore:rules,firestore:indexes,storage
```

5. Restart license API with **saudi-property-manager** service account
6. Deploy **amlak-app.com** + **amlakrrgroup.netlify.app**

## Step 8 — After 48h stable

```bash
bash mac-cloud/scripts/decommission-mac.sh
```

## teamCode vs Postgres book_id

- **teamCode** = 14-char buyer URL code → target `book_{teamCode}_*`
- **Postgres book_id** = legacy 20-char Firestore `books` doc id — must be in `POSTGRES_BOOK_ID_MAP`
- Without the map, cutover writes to `book_6XwFZu6..._*` (wrong) instead of `book_P25Y3R..._*`
