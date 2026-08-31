# Mac Mini — do this now (step by step)

## Step 1 — Get the scripts on the Mac

On **Windows** (already done if you asked Cursor to push), or on Mac:

```bash
cd ~/saudi-property-manager   # or your clone path
git fetch origin
git checkout cursor/staff-login-owner-redirect
git pull origin cursor/staff-login-owner-redirect
```

Confirm files exist:

```bash
ls mac-cloud/migrate/cutover.mjs mac-cloud/migrate/inventory.mjs
```

## Step 2 — Create `mac-cloud/.env`

```bash
bash mac-cloud/scripts/setup-migration-env.sh
```

Or manually: copy `mac-cloud/.env.example` and set `DATABASE_URL`, `FIREBASE_SERVICE_ACCOUNT_JSON`, `LICENSE_REGISTRY_SERVICE_ACCOUNT_JSON`, `BUYER_FIREBASE_PROJECTS_JSON`.

Registry SA file (if script can't find it):

```bash
export LICENSE_REGISTRY_SERVICE_ACCOUNT_JSON="$(cat ~/amlak-sale-product/license-api-server/service-account.json)"
```

## Step 3 — Install deps + inventory (read-only)

```bash
cd mac-cloud
npm install
npm run migrate:inventory
```

Open `mac-cloud/migration-report.json` and check:

- `buyerBookMap` — each license `teamCode` (this becomes `bookId`)
- Postgres `book_id` values (e.g. `6XwFZu6Tc7EMZNqDbe8u`) — **not** the same as teamCode unless inventory says so

## Step 4 — Install CLI tools (one time)

```bash
npm install -g firebase-tools
brew install --cask google-cloud-sdk
firebase login
gcloud auth login
gcloud config set project saudi-property-manager
```

## Step 5 — Backups (mandatory)

```bash
pg_dump "$DATABASE_URL" > ~/amlak-backup-$(date +%Y%m%d).sql
gcloud firestore export gs://saudi-property-manager-backups/pre-cutover-$(date +%Y%m%d) --project=saudi-property-manager
```

## Step 6 — Dry run

```bash
cd mac-cloud
npm run migrate:cutover:dry
```

Fix any errors before live cutover.

## Step 7 — Live cutover (maintenance window)

1. Stop Mac API: `docker compose -f docker-compose.mac-mini.yml stop amlak-api`
2. Run: `npm run migrate:cutover`
3. Must pass: `npm run migrate:validate`
4. Deploy rules from repo root:

```bash
cd ..
firebase deploy --only firestore:rules,firestore:indexes,storage
```

5. Restart license API with **saudi-property-manager** service account (see amlak-sale-product `license-api-server/DEPLOY.md`)
6. Deploy **amlak-app.com** + **amlakrrgroup.netlify.app** (Firebase-only builds)

## Step 8 — After 48h stable

```bash
bash mac-cloud/scripts/decommission-mac.sh
```

## teamCode vs Postgres book_id

- **teamCode** = 14-char code in buyer URL `?teamCode=...` → target `book_{teamCode}_*`
- **Postgres book_id** like `6XwFZu6Tc7EMZNqDbe8u` may be an old internal id — inventory report maps licenses to the correct teamCode before cutover.
