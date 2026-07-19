# AGENTS.md

## Cursor Cloud specific instructions

Amlak ("saudi-property-manager") is a Vite + React 19 property‑management app that also
ships as an Electron desktop app. Dependencies are installed by the startup update script
(`npm install` at the repo root plus `npm install --prefix fcm-server` and
`npm install --prefix license-api-server`). Node 22 works fine.

### Services

- Main app — Vite dev server. Serves all three portals (`index.html` = staff, `owner.html`,
  `tenant.html`). Fixed port `5200` (`strictPort: true`, host `0.0.0.0`), see `vite.config.ts`.
  This is the only service required to view/use the app.
- ZATCA e‑invoicing service (optional) — `node fcm-server/zatca-service.js`, port `3002`.
  Starts in COMPLIANCE/SANDBOX mode without certs; only VAT sign/report endpoints need
  `ZATCA_*` credentials.
- License / sales API (optional) — `node license-api-server/index.js`, port `8787`. Only
  powers the separate sales/licensing/gift‑link console; the staff/owner/tenant portals do
  not call it.

### Running

- Prefer running the main app directly: `npx vite --force` (serves on `http://localhost:5200`).
- Gotcha: `npm run dev` currently fails at the `predev` step because it runs
  `node tools/free-license-api-port.cjs`, and that file does not exist in the repo. To run the
  full dev stack, either add that helper or start the three processes individually
  (`npx vite --force`, `node fcm-server/zatca-service.js`, `node license-api-server/index.js`).
- The browser loads React and several libs at runtime from `aistudiocdn.com` via an importmap
  in the HTML entry files, so the browser needs network egress to that CDN (and to Firebase).

### Backend / data (important)

- Firebase is hard‑coded in `firebase.ts` to the LIVE production project
  `saudi-property-manager`, and Firestore is effectively open (login goes through `mockLogin`
  in `services/firestoreService.ts`, which reads/writes Firestore directly — no Firebase Auth
  sign‑in). There is NO local emulator wired into the dev flow.
- Because it targets the real production database with real customer data, do NOT create test
  records (users, buildings, transactions) through the running app. `mockLogin` only
  auto‑creates an admin when NO admin exists, which is not the case on production.
- No staff/owner/tenant login credentials are available in this environment, so logging in to
  exercise post‑login features requires the user to supply a test account. A safe smoke test is
  to submit the login form and confirm the live backend responds ("Invalid ID or Password").

### Test / lint / build

- Tests: `npx vitest run`. Pre‑existing failures: the 4 tests in
  `tests/reportHelpers.test.ts` fail because they `vi.spyOn` a module export (`getTransactions`)
  that the report helpers call internally — an ESM limitation, unrelated to environment setup.
  `tests/transactionUtils.test.ts` passes.
- Lint: none configured (no ESLint, no `lint` script).
- Types: `npx tsc --noEmit` reports pre‑existing type errors, but `tsc` is NOT part of the
  build. The build is `vite build` (esbuild transpile, no type‑check), so these do not block
  dev or build.
