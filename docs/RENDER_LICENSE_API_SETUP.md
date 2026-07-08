# Always-on License API on Render (saleapi.amlak-app.com)

Cloudflare Tunnel keeps `saleapi` online **only while your laptop/Mac mini runs**.  
Render hosts the same `license-api-server` in the cloud so buyers work when your PC is off.

Your repo already has [`render.yaml`](../render.yaml). Live app builds use `https://saleapi.amlak-app.com`.

## Before you start

1. A [Render](https://dashboard.render.com) account (GitHub login recommended).
2. This GitHub repo connected: `https://github.com/Shazd0/saudi-property-manager` (push latest code if `render.yaml` is only local).
3. Values ready (do not commit them):
   - `SALES_CONSOLE_PASSWORD` — same as Sales Console / `VITE_SALES_CONSOLE_PASSWORD`
   - `FIREBASE_SERVICE_ACCOUNT_JSON` — full contents of `license-api-server/service-account.json` as one JSON line
   - optional ZATCA secrets if you use signing from the license API

Helper on Windows (copies service-account JSON to clipboard + checklist):

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\prepare-render-license-env.ps1
```

## 1. Create the Blueprint on Render

1. Open [https://dashboard.render.com/blueprints](https://dashboard.render.com/blueprints)
2. **New Blueprint Instance** → select this GitHub repo → branch `main`
3. Render reads `render.yaml`
4. For **amlak-license-api**, fill secrets when prompted:
   - `SALES_CONSOLE_PASSWORD`
   - `FIREBASE_SERVICE_ACCOUNT_JSON` (paste entire service account JSON)
   - `ZATCA_CREDENTIALS_SECRET` (long random string — required if you save buyer ZATCA configs)
   - ZATCA URL/key — leave blank for now if ZATCA stays on a tunnel later
5. You can **skip / postpone** the `amlak-zatca` service if you only need license activation today (delete that service from the Blueprint apply, or disable it after create)
6. Use **Starter** (not Free) so the API does not sleep after idle
7. Apply / Create

Wait until deploy is **Live**. Test:

```text
https://amlak-license-api.onrender.com/health
```

Expect `{"ok":true,"service":"license-api-server",...}`.

## 2. Attach custom domain `saleapi.amlak-app.com`

If Blueprint already listed `domains: saleapi.amlak-app.com`, open the service → **Settings → Custom Domains** and follow Render’s DNS instructions.

### Cloudflare DNS (critical)

1. **Stop** laptop/Mac mini `cloudflared` for `amlak-saleapi` first (tunnel must not own the hostname).
2. In Cloudflare → **DNS** for `amlak-app.com`:
   - Find `saleapi` (often CNAME to `*.cfargotunnel.com` or similar)
   - Change to:

| Type  | Name    | Target                         | Proxy status      |
|-------|---------|--------------------------------|-------------------|
| CNAME | saleapi | `amlak-license-api.onrender.com` | **DNS only** (grey cloud) first |

3. In Render, wait until the domain shows **Verified** / certificate issued.
4. After it works, you may set Cloudflare proxy to **Proxied** (orange) if you want CF in front — if HTTPS fails, leave **DNS only**.

## 3. Verify (laptop can be off)

```bash
curl -sS -i https://saleapi.amlak-app.com/health
```

No Error 1033. CORS check:

```bash
curl -sS -i -X OPTIONS https://saleapi.amlak-app.com/productLicenseResolveJoin \
  -H "Origin: https://amlak-app.com" \
  -H "Access-Control-Request-Method: POST"
```

Then open a buyer link:

```text
https://amlak-app.com/app/?licenseSetup=1&teamCode=YOUR_CODE
```

## 4. Netlify (only if needed)

Production JS already points at `saleapi.amlak-app.com` if that was baked into the build.  
If you ever pointed Netlify at a raw `*.onrender.com` URL, set:

```env
VITE_PRODUCT_LICENSE_API_BASE=https://saleapi.amlak-app.com
```

and **redeploy** the static site.

Keep:

```env
LICENSE_CORS_ORIGINS=https://amlak-app.com,https://www.amlak-app.com
```

on the Render service (Blueprint defaults this).

## 5. After cutover checklist

- [ ] `https://saleapi.amlak-app.com/health` → 200 from phone / another network
- [ ] Buyer activation works with laptop **powered off**
- [ ] Laptop `cloudflared` and local `:8787` **stopped** (optional for local dev only)
- [ ] Render plan is **Starter+** (not Free sleep)

## Cost note

Render **Free** web services spin down when idle — activation can fail or feel broken.  
**Starter** (~$7/mo) keeps the license API always on, which is what you want for buyers.
