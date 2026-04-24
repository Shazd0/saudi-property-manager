# ZATCA API on a VPS (Docker + HTTPS + Amlak build)

This service signs VAT invoices and can report to ZATCA (`POST /zatca/sign-and-report`). The Amlak app **does not** embed this logic; it calls your public URL, set at **build time** as `VITE_ZATCA_SERVICE_URL`.

## 1. Copy ZATCA files to the server

On your dev machine you have a folder `zatca-cert/` at the repo root (certificates, keys, `pih.txt`, `counter.txt`, etc.). Copy that entire folder to the VPS, e.g.:

`scp -r zatca-cert/ user@your-vps:/opt/amlak/zatca-cert/`

The Docker setup expects the same layout under the mount path (`/app/zatca-cert` inside the container).

## 2. Deploy the API with Docker

From the **repository root** on a machine that has this repo (or clone it on the VPS):

```bash
# HTTP on host port 3002 (add Nginx/Caddy yourself) — see nginx-zatca.example.conf
export ZATCA_CORS_ORIGINS="https://app.yourdomain.com,https://yourdomain.com"
docker compose -f fcm-server/docker-compose.yml up -d --build
```

Or with an env file:

```bash
cp fcm-server/compose.env.example fcm-server/compose.env
# edit compose.env, then:
docker compose -f fcm-server/docker-compose.yml --env-file fcm-server/compose.env up -d --build
```

Check health: `curl -s http://127.0.0.1:3002/zatca/health`

## 3. HTTPS

**Option A — existing Nginx on the host:** proxy to `127.0.0.1:3002` using `fcm-server/nginx-zatca.example.conf` (edit domain and SSL).

**Option B — Caddy in Docker (automatic Let’s Encrypt):**

1. Edit `fcm-server/Caddyfile.docker` — set your real hostname (must resolve to this server).
2. Set `ZATCA_CORS_ORIGINS` in the environment to your **Amlak** web origin(s).
3. From repo root:

```bash
export ZATCA_CORS_ORIGINS="https://app.yourdomain.com"
docker compose -f fcm-server/docker-compose.https.yml up -d --build
```

4. Public URL will be `https://<the-hostname-in-Caddyfile.docker>` (port 443).

## 4. Build the Amlak app with the live ZATCA URL

On your **build machine** (no trailing slash):

```bash
export VITE_ZATCA_SERVICE_URL="https://zatca-api.yourdomain.com"
npm run build
# or Windows PowerShell:  .\tools\build-with-zatca.ps1 -ZatcaServiceUrl "https://zatca-api.yourdomain.com" -WebOnly
# Electron installer:
npm run desktop:build
# or:  .\tools\build-with-zatca.ps1 -ZatcaServiceUrl "https://zatca-api.yourdomain.com" -Desktop
```

Or add the same line to `.env.local` in the project root, then run `npm run build` / `npm run desktop:build`.

Vite inlines the variable at build time: every user who installs that build will call the URL you set.

## 5. CORS

The API must allow your Amlak app **origin** (e.g. `https://app.yourdomain.com`). Set `ZATCA_CORS_ORIGINS` to a comma-separated list. If empty, the service allows all origins (fine for private testing; set explicit origins in production).

## 6. Firewall

- Open **80** and **443** on the VPS if using the Caddy stack or any reverse proxy.
- You do **not** need to expose **3002** publicly if the proxy runs on the same host.

## Troubleshooting

- **`ERR_CONNECTION_REFUSED` on clients:** the URL in the built app is wrong, or the container is not running, or the firewall blocks 443.
- **CORS errors in the browser:** add your exact SPA origin to `ZATCA_CORS_ORIGINS` and restart the container.
- **ZATCA reporting fails (Saudi network):** reporting calls Zatca’s gateway from the **VPS**; the VPS must reach `gw-fatoora.zatca.gov.sa` (usually requires hosting in an allowed network path; compliance mode still signs invoices locally).
