# Fix saleapi.amlak-app.com Cloudflare Error 1033

**Error 1033** means Cloudflare DNS for `saleapi.amlak-app.com` points at a Tunnel, but **no `cloudflared` process is connected** (Mac mini asleep, tunnel not running, or License API down so health checks fail after connect).

Buyers see CORS failures in the browser because Cloudflare’s HTML error page has no `Access-Control-Allow-Origin` headers. Fix the tunnel first — then CORS works again.

Production app calls: `https://saleapi.amlak-app.com`

## On this Windows laptop (already used successfully)

If the License API or tunnel stops (sleep, reboot, closed windows), from the project folder:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\start-saleapi-stack-windows.ps1
```

That opens two windows: License API (`:8787`) + `cloudflared` for `saleapi.amlak-app.com`.

Or start them separately:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\start-license-api-windows.ps1
powershell -ExecutionPolicy Bypass -File .\scripts\start-saleapi-tunnel-windows.ps1
```

Config lives at `%USERPROFILE%\.cloudflared\config.yml` (tunnel `amlak-saleapi`).

Keep the laptop awake and online. Sleep/lid-close brings Error 1033 back.

---

## On the Mac mini (run these in Terminal)

### 1. Keep the Mac awake

```bash
sudo pmset -a sleep 0 displaysleep 0 disksleep 0
caffeinate -dims &
```

### 2. Start the License API on port 8787

```bash
cd "/Users/shahzad/Downloads/My Projects 3/amlak-sale-product"
# Adjust path if your clone lives elsewhere.

chmod +x scripts/start-license-api-mac-mini.sh
./scripts/start-license-api-mac-mini.sh
```

Env file (create if missing): `license-api-server/.env.production.local`

```bash
export SALES_CONSOLE_PASSWORD='your-sales-password'
export LICENSE_CORS_ORIGINS='https://amlak-app.com,https://www.amlak-app.com'
export NODE_ENV=production
# Either:
export FIREBASE_SERVICE_ACCOUNT_JSON='{...full service account JSON...}'
# Or place license-api-server/service-account.json (gitignored)
```

Local health (new tab):

```bash
curl -sS http://127.0.0.1:8787/health
# expect {"ok":true} or similar
```

### 3. Start Cloudflare Tunnel for saleapi

```bash
# See existing tunnels / config
cloudflared tunnel list
cat ~/.cloudflared/config.yml
ls ~/.cloudflared/*.json
```

If `config.yml` already maps `saleapi.amlak-app.com` → `http://127.0.0.1:8787`:

```bash
cloudflared tunnel run
# or:
cloudflared tunnel run YOUR_TUNNEL_NAME
```

If you need to create/route the tunnel (only once):

```bash
cloudflared tunnel login
cloudflared tunnel create amlak-saleapi
cloudflared tunnel route dns amlak-saleapi saleapi.amlak-app.com
```

Use `scripts/cloudflared-saleapi.config.example.yml` as a template for `~/.cloudflared/config.yml`.

### 4. Verify from any PC (including Windows)

```bash
curl -sS -i https://saleapi.amlak-app.com/health
```

You must **not** see “Error 1033” or “Cloudflare Tunnel error”.

CORS check:

```bash
curl -sS -i -X OPTIONS https://saleapi.amlak-app.com/productLicenseResolveJoin \
  -H "Origin: https://amlak-app.com" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: content-type"
```

Look for `access-control-allow-origin: https://amlak-app.com`.

### 5. Retest the buyer link

Open:

```text
https://amlak-app.com/app/?licenseSetup=1&teamCode=3TAJ3ZWQBSETPR
```

Activation should reach the API without CORS / tunnel errors.

## Make it survive reboot (LaunchAgents)

After the two processes work by hand, install launch agents so they restart after login:

1. License API → run `scripts/start-license-api-mac-mini.sh`
2. Cloudflare Tunnel → `cloudflared tunnel run …`

Keep the Mac plugged in, screen lock OK, sleep **off**.

## If tunnel runs but /health still fails

| Check | Action |
|-------|--------|
| API not on 8787 | `lsof -iTCP:8787 -sTCP:LISTEN` |
| Wrong ingress host | hostname in config must be exactly `saleapi.amlak-app.com` |
| Wrong service port | must be `http://127.0.0.1:8787` |
| DNS wrong | Cloudflare Zero Trust → Networks → Tunnels → Public Hostname = saleapi |

## Note on hostname names

Docs sometimes say `license.amlak-app.com`. Live Netlify build uses **`saleapi.amlak-app.com`**. Prefer fixing `saleapi` rather than changing the frontend unless you redeploy with a new `VITE_PRODUCT_LICENSE_API_BASE`.
