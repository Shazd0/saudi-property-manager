# Move saleapi from Windows laptop → Mac mini

Buyers keep using `https://saleapi.amlak-app.com`.  
You only change **which machine** runs License API + `cloudflared`.

**Rule:** only **one** machine may run the tunnel at a time. Stop the laptop before starting the Mac mini.

---

## A. On the Windows laptop (copy these files)

**Easiest:** run this once on the laptop (builds a private folder on Desktop):

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\export-saleapi-transfer-pack.ps1
```

That creates `Desktop\amlak-saleapi-mac-transfer\` with tunnel credentials + `service-account.json` + password env.  
Copy that folder to the Mac (USB / AirDrop). **Delete it after setup.** Do not commit it.

Or copy manually:

| From Windows | To Mac mini |
|--------------|-------------|
| Whole project folder (or `git pull` on Mac) | e.g. `~/amlak-sale-product` |
| `license-api-server\service-account.json` | same path under the project (**required**) |
| `functions\.env` (has `SALES_CONSOLE_PASSWORD`) | same path, or recreate with the script |
| `C:\Users\Asus\.cloudflared\cf968696-8198-487e-a62b-e83c6318a6a8.json` | `~/.cloudflared/cf968696-8198-487e-a62b-e83c6318a6a8.json` |
| `C:\Users\Asus\.cloudflared\cert.pem` (optional) | `~/.cloudflared/cert.pem` |

Tunnel identity (reuse — do **not** create a new tunnel unless the copy fails):

- Name: `amlak-saleapi`
- UUID: `cf968696-8198-487e-a62b-e83c6318a6a8`

**When Mac is ready**, stop the laptop stack:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\stop-saleapi-stack-windows.ps1
```

---

## B. On the Mac mini (one-time)

### 1. Install tools

```bash
# Node 20+
node -v

# cloudflared
brew install cloudflared
# or: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/

cloudflared --version
```

### 2. Get the project

```bash
cd ~
git clone https://github.com/Shazd0/saudi-property-manager.git amlak-sale-product
cd amlak-sale-product
git pull

npm install
npm install --prefix license-api-server
```

If you already have the folder under Downloads, `cd` there instead and `git pull`.

### 3. Place secrets

```bash
# service-account.json must exist:
ls -la license-api-server/service-account.json

chmod +x scripts/*.sh
./scripts/prepare-license-env-mac-mini.sh
```

### 4. Install tunnel config (same tunnel as Windows)

```bash
mkdir -p ~/.cloudflared
# After copying the .json from Windows:
./scripts/setup-saleapi-tunnel-mac-mini.sh cf968696-8198-487e-a62b-e83c6318a6a8 amlak-saleapi
```

### 5. Keep Mac awake

```bash
sudo pmset -a sleep 0 displaysleep 0 disksleep 0
```

---

## C. Cutover (order matters)

### 1. Stop on Windows laptop

In Task Manager, end **cloudflared** and the **node** process on port **8787**,  
or close the two PowerShell windows that run them.

Confirm (from any PC):

```bash
curl -sS -i https://saleapi.amlak-app.com/health
```

You should briefly see **Error 1033** / tunnel down — that means the laptop released the tunnel.

### 2. Start on Mac mini

```bash
cd ~/amlak-sale-product   # or your real path
./scripts/start-saleapi-stack-mac-mini.sh
```

Or two Terminal tabs:

```bash
./scripts/start-license-api-mac-mini.sh
# other tab:
cloudflared tunnel run
```

### 3. Verify

```bash
curl -sS http://127.0.0.1:8787/health
curl -sS -i https://saleapi.amlak-app.com/health
```

Expect JSON `{"ok":true,...}` — **not** Error 1033.

Buyer test:

```text
https://amlak-app.com/app/?licenseSetup=1&teamCode=YOUR_CODE
```

---

## D. Survive reboot (recommended)

Create LaunchAgents later so API + tunnel restart after login. Until then, leave Terminal open or re-run `./scripts/start-saleapi-stack-mac-mini.sh` after each reboot.

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Error 1033 | `cloudflared` not running on Mac, or laptop still connected |
| Local `:8787` fails | Missing `service-account.json` or password env |
| CORS in browser | API up but check `LICENSE_CORS_ORIGINS` includes `https://amlak-app.com` |
| Tunnel UUID missing | Re-copy `.json` from Windows; don’t invent a new tunnel if DNS already points at the old one |

DNS for `saleapi` should stay as the **Cloudflare Tunnel** CNAME (unchanged). You only move which computer runs `cloudflared`.
