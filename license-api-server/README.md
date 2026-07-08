# Product license API (standalone)

Same logic as `functions/licenseApi.js`, served over **Express** so you can run it on **Render**, **Fly.io**, a VPS, etc. **No Firebase Blaze** and **no Cloud Functions deploy** required.

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SALES_CONSOLE_PASSWORD` | Yes | Same string as `VITE_SALES_CONSOLE_PASSWORD` / Sales unlock phrase. |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | No if file present | Full JSON of a Firebase **service account** key. **Or** place `service-account.json` next to `index.js` (gitignored — never commit). |
| `LICENSE_CORS_ORIGINS` | Yes in production | Comma-separated origins, e.g. `https://your-app.web.app,https://your-domain.com` |
| `NODE_ENV` | Set to `production` on host | Enforces password + CORS allowlist |
| `PORT` | No | Defaults to `8787`. Render sets `PORT` automatically. |

On your laptop, if you use `gcloud auth application-default login` or a JSON key file, you can omit `FIREBASE_SERVICE_ACCOUNT_JSON` and set `GOOGLE_APPLICATION_CREDENTIALS` to the file path instead (Admin SDK default).

## Dependencies

`firebase-admin` is installed at the **repo root** (`package.json`) so `functions/licenseApi.js` and this server share **one** Admin SDK instance. Do not reinstall a second copy under `functions/node_modules` (it breaks `initializeApp` / `getFirestore`).

## Local run

From repo root:

```bash
npm install
npm install --prefix license-api-server
set SALES_CONSOLE_PASSWORD=your_secret
set FIREBASE_SERVICE_ACCOUNT_JSON={"type":"service_account",...}
node license-api-server/index.js
```

Then in `.env.local` (Vite / Sales app):

```env
VITE_PRODUCT_LICENSE_API_BASE=http://127.0.0.1:8787
```

Restart `npm run dev`.

## Render (always-on — recommended for buyers)

Full steps (custom domain `saleapi.amlak-app.com`, Cloudflare DNS): see **`docs/RENDER_LICENSE_API_SETUP.md`**.

Quick path:

1. Push this repo to GitHub, then Render → **Blueprints** → apply root **`render.yaml`**.
2. Fill secrets: `SALES_CONSOLE_PASSWORD`, `FIREBASE_SERVICE_ACCOUNT_JSON` (Windows helper: `scripts/prepare-render-license-env.ps1`).
3. Use **Starter** plan (Free sleeps and breaks buyers).
4. Point Cloudflare `saleapi` CNAME → `amlak-license-api.onrender.com` (**DNS only** first), stop local `cloudflared`.

Or manual Web Service:

1. **Build:** `npm install --omit=dev && npm install --prefix license-api-server --omit=dev`
2. **Start:** `node license-api-server/index.js`
3. **Health:** `/health`
4. Env: `NODE_ENV=production`, `SALES_CONSOLE_PASSWORD`, `FIREBASE_SERVICE_ACCOUNT_JSON`, `LICENSE_CORS_ORIGINS=https://amlak-app.com,https://www.amlak-app.com`

Keep production Vite as:

```env
VITE_PRODUCT_LICENSE_API_BASE=https://saleapi.amlak-app.com
```

(No trailing slash.) Redeploy the static app only if this env was pointed at a laptop tunnel / wrong host.

## Health check

`GET /health` — use for Render **Health Check Path** if you want.
