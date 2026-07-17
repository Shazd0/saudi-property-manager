# Cloudflare Tunnel Setup For Amlak Mac Mini Cloud

This guide exposes only the Amlak API from the Mac mini through Cloudflare Tunnel. Your landing page can stay on the root domain, while the backend uses a subdomain such as `api.yourdomain.com`.

## Recommended Domain Layout

Keep your existing landing page unchanged:

```text
yourdomain.com      -> existing landing page
www.yourdomain.com  -> existing landing page
api.yourdomain.com  -> Mac mini Amlak API through Cloudflare Tunnel
```

Do not point the root domain to the Mac mini unless you want to replace the landing page.

## 1. Add Your Domain To Cloudflare

1. Create or log in to your Cloudflare account:

   https://dash.cloudflare.com

2. Add your domain to Cloudflare.
3. Follow Cloudflare's nameserver instructions at your domain registrar.
4. Keep your existing landing page DNS records for `yourdomain.com` and `www`.

Only the new `api` subdomain will be used for the Mac mini backend.

## 2. Install `cloudflared` On The Mac Mini

Using Homebrew:

```bash
brew install cloudflared
```

Check it installed:

```bash
cloudflared --version
```

## 3. Login To Cloudflare

Run:

```bash
cloudflared tunnel login
```

A browser window opens. Choose your Cloudflare domain and authorize the Mac mini.

## 4. Create The Tunnel

```bash
cloudflared tunnel create amlak-mac
```

Cloudflare creates a credentials JSON file under:

```text
/Users/shahzad/.cloudflared/
```

The command output will show the exact credentials file name. Keep it private.

## 5. Create The Tunnel Config

Create the config file:

```bash
mkdir -p ~/.cloudflared
nano ~/.cloudflared/config.yml
```

Use this template and replace the domain and credentials file name:

```yaml
tunnel: amlak-mac
credentials-file: /Users/shahzad/.cloudflared/PASTE-CREDENTIALS-FILE-NAME.json

ingress:
  - hostname: api.yourdomain.com
    service: http://localhost:8787
  - service: http_status:404
```

Example:

```yaml
tunnel: amlak-mac
credentials-file: /Users/shahzad/.cloudflared/12345678-abcd-1234-abcd-1234567890ab.json

ingress:
  - hostname: api.amlak.com
    service: http://localhost:8787
  - service: http_status:404
```

## 6. Create The DNS Route

Replace `api.yourdomain.com` with your real API subdomain:

```bash
cloudflared tunnel route dns amlak-mac api.yourdomain.com
```

This creates the Cloudflare DNS record for the API subdomain.

## 7. Start The Amlak Mac Backend

From the Amlak project folder:

```bash
docker compose -f docker-compose.mac-mini.yml up -d postgres amlak-api
```

Check the local API:

```bash
curl http://127.0.0.1:8787/api/health
```

You should see JSON with `"ok": true`.

## 8. Run The Tunnel

```bash
cloudflared tunnel run amlak-mac
```

In another terminal, test the public API:

```bash
curl https://api.yourdomain.com/api/health
```

You should see JSON with `"ok": true`.

## 9. Run Cloudflare Tunnel On Startup

Install it as a launch service:

```bash
sudo cloudflared service install
```

Then start it:

```bash
sudo launchctl start com.cloudflare.cloudflared
```

If you need to update the config later, edit:

```text
/Users/shahzad/.cloudflared/config.yml
```

Then restart the service.

## 10. Point The Amlak App To The Public API

Use these environment variables when you want the app to use the Mac mini backend:

```bash
VITE_DATA_BACKEND=mac
VITE_MAC_API_URL=https://api.yourdomain.com
```

Then run the app:

```bash
npm run dev
```

Firebase remains the default unless `VITE_DATA_BACKEND=mac` is set.

## 11. Transfer Firebase Data To The Mac Mini

Dry-run first:

```bash
docker compose -f docker-compose.mac-mini.yml --profile migration run --rm migration node migrate/firebase-to-postgres.mjs --dry-run --all
```

Then transfer:

```bash
docker compose -f docker-compose.mac-mini.yml --profile migration run --rm migration node migrate/firebase-to-postgres.mjs --all --include-deleted
```

## 12. Keep PostgreSQL Private

Do not expose PostgreSQL publicly:

```text
5432
```

Only expose the API through Cloudflare Tunnel:

```text
8787 -> https://api.yourdomain.com
```

## 13. Optional API Token

Set an API token so only your app can call write endpoints:

```bash
AMLAK_API_TOKEN=change-this-to-a-long-secret
```

Then set the same token in the frontend environment:

```bash
VITE_MAC_API_TOKEN=change-this-to-a-long-secret
```

Use a long random value. Do not commit real secrets into git.

## 14. Stop Services

Stop the Mac backend:

```bash
docker compose -f docker-compose.mac-mini.yml down
```

Stop the tunnel if running manually:

```bash
control + c
```

## 15. Optional Daily Backups

```bash
docker compose -f docker-compose.mac-mini.yml --profile backup up -d backup
```

Backups are written to:

```text
mac-cloud/backups/
```

## Troubleshooting

If the API does not work:

1. Confirm Docker is running.
2. Confirm the Amlak API is running:

   ```bash
   docker compose -f docker-compose.mac-mini.yml ps
   ```

3. Test locally:

   ```bash
   curl http://127.0.0.1:8787/api/health
   ```

4. Test Cloudflare:

   ```bash
   curl https://api.yourdomain.com/api/health
   ```

5. Check tunnel logs:

   ```bash
   cloudflared tunnel run amlak-mac
   ```

6. Make sure `api.yourdomain.com` is the subdomain routed to the tunnel, not the root landing page domain.

### CORS errors from Netlify or another hosted frontend

Browsers show a CORS error when the API preflight does not return `Access-Control-Allow-Origin`. Two common causes:

1. **The API is down behind Cloudflare** — a `502 Bad Gateway` from Cloudflare also appears as a CORS failure in the browser. Test first:

   ```bash
   curl https://api.yourdomain.com/api/health
   ```

   If you get `502`, restart Docker and the Cloudflare tunnel on the Mac mini before changing CORS settings.

2. **The hosted site origin is not allowed** — set `CORS_ORIGIN` on the Mac mini API to include every frontend origin, comma-separated:

   ```bash
   CORS_ORIGIN=https://amlakrrgroup.netlify.app,https://your-other-site.com
   ```

   Or allow all origins during testing:

   ```bash
   CORS_ORIGIN=*
   ```

   Then restart the API container:

   ```bash
   docker compose -f docker-compose.mac-mini.yml up -d --build amlak-api
   ```

### Netlify proxy (recommended for hosted sites)

This repo includes a Netlify rewrite in `netlify.toml` that proxies `/api/*` to `https://api.amlak-app.com`. That lets the browser call the API on the same origin and avoids CORS entirely.

Set these Netlify environment variables before building:

```bash
VITE_DATA_BACKEND=mac
VITE_MAC_API_URL=/
VITE_MAC_PROXY_TARGET=https://api.amlak-app.com
VITE_MAC_API_TOKEN=your-api-token
```

On the Mac mini API, allow the Netlify origin (needed for direct WebSocket to `wss://api.amlak-app.com`):

```bash
CORS_ORIGIN=https://amlakrrgroup.netlify.app
```

Redeploy Netlify after changing env vars. The API tunnel must still be healthy; the proxy only removes CORS for REST. Voice calls use WebSocket directly to `api.amlak-app.com` because Netlify cannot proxy WebSocket upgrades.
