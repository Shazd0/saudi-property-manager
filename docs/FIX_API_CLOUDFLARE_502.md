# Fix api.amlak-app.com Cloudflare 502 (Bad Gateway)

**Error 502** on `https://amlakrrgroup.netlify.app/api/...` means Netlify is proxying correctly, but **Cloudflare cannot reach your Mac mini** behind `api.amlak-app.com`.

This is **not a CORS bug in the frontend**. The hosted app already calls `/api` on the same Netlify origin. The upstream Mac API tunnel or Docker stack is down.

## Quick check

From any machine:

```bash
curl -sS -o /dev/null -w "%{http_code}\n" https://api.amlak-app.com/api/health
```

- `200` → API is up; reload the Netlify site.
- `502` / `503` → Mac mini API or Cloudflare tunnel is offline (follow steps below).

## On the Mac mini

### 1. Start Docker API + Postgres

```bash
cd "/Users/shahzad/Downloads/My Projects 3/saudi-property-manager"
./scripts/start-mac-cloud.sh
# or manually:
docker compose -f docker-compose.mac-mini.yml up -d postgres amlak-api fcm-push
```

Verify locally:

```bash
curl -sS http://127.0.0.1:8787/api/health
```

### 2. Start Cloudflare Tunnel for `api.amlak-app.com`

Your tunnel name is usually `amlak-mac` (see `TAILSCALE_SETUP.md`).

```bash
cloudflared tunnel list
cat ~/.cloudflared/config.yml
cloudflared tunnel run amlak-mac
```

Config should include:

```yaml
ingress:
  - hostname: api.amlak-app.com
    service: http://127.0.0.1:8787
  - service: http_status:404
```

### 3. Verify public health

```bash
curl -sS https://api.amlak-app.com/api/health
```

### 4. Netlify env (already in `netlify.toml`)

```bash
VITE_DATA_BACKEND=mac
VITE_MAC_API_URL=/
VITE_MAC_PROXY_TARGET=https://api.amlak-app.com
VITE_MAC_API_TOKEN=<same as AMLAK_API_TOKEN on Mac mini>
```

Redeploy Netlify after changing env vars.

## CORS vs 502

| Symptom | Cause |
|--------|--------|
| Browser blocks `api.amlak-app.com` (CORS) | Old build or direct API URL — fixed by `VITE_MAC_API_URL=/` + Netlify `/api` proxy |
| `amlakrrgroup.netlify.app/api/...` returns **502** | Mac mini API or tunnel offline |
| WebSocket to `wss://api.amlak-app.com` fails | Tunnel down **or** API not listening on `:8787` |

Voice WebSockets cannot use Netlify proxy; they connect directly to `api.amlak-app.com`. The tunnel must be healthy for calls.

## Common causes

| Issue | Fix |
|-------|-----|
| Mac mini asleep | Wake Mac, disable sleep on power adapter |
| Docker not running | Open Docker Desktop, rerun `start-mac-cloud.sh` |
| `cloudflared` not running | `cloudflared tunnel run amlak-mac` or install LaunchAgent |
| Wrong port in tunnel config | Must be `http://127.0.0.1:8787` |
| API container crashed | `docker logs amlak-api` |

## After recovery

Reload https://amlakrrgroup.netlify.app — the red **Mac Mini API is offline** banner should disappear and History/Dashboard should load data.
