# ZATCA on Mac Mini (anyone can Send from the website)

Staff on https://amlakrrgroup.netlify.app call **same-origin** `/zatca-api/...`.
Netlify proxies that to `https://api.amlak-app.com/zatca/...`.
The Mac API forwards to the **zatca** Docker container, which signs and reports to Fatoora.

## One-time on the Mac mini

1. Copy `zatca-cert/` certificates from the Windows PC (pem + secret files are gitignored).
2. From the project folder:

```bash
chmod +x scripts/start-zatca-mac-mini.sh
./scripts/start-zatca-mac-mini.sh
```

Or with the rest of the stack:

```bash
./scripts/start-mac-cloud.sh
```

3. Confirm:

```bash
curl -sS http://127.0.0.1:3022/zatca/health
curl -sS http://127.0.0.1:8787/zatca/health
curl -sS https://api.amlak-app.com/zatca/health
```

The Cloudflare tunnel for **api.amlak-app.com → 127.0.0.1:8787** must stay running (`cloudflared tunnel run amlak-mac`). No extra hostname is required.

## Netlify

`netlify.toml` already sets `VITE_ZATCA_SERVICE_URL=/zatca-api` and the `/zatca-api/*` proxy. Redeploy after these files change.
