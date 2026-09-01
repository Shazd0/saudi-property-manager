# Unblock MCP clients from Cloudflare error 1010 (browser_signature_banned)

Hermes and other non-browser MCP clients get **403 / 1010** when Cloudflare Bot Fight Mode
or Block AI bots treats their HTTP fingerprint as automated traffic. Cursor from your PC
may still work; cloud agents will not until Cloudflare is adjusted.

## One-time Cloudflare fix (5 minutes)

1. Open [Cloudflare dashboard](https://dash.cloudflare.com) → zone **amlak-app.com**
2. **Security** → **Settings** → filter **Bot traffic**
3. Turn **OFF**:
   - **Bot Fight Mode** (required on Free plan — cannot be bypassed with WAF rules)
   - **Block AI bots** (if enabled)
4. **Zero Trust** → **Access** → application for `mcp.amlak-app.com/mcp`:
   - Policy **Service Auth** → **Include** → your **Service Token** (same as Cursor)
5. Wait 1–2 minutes, then reload the MCP client.

### Pro+ only (optional extra)

**Security** → **Security rules** → **Create** → **Custom rule**:

- **Expression:** `(http.host eq "mcp.amlak-app.com" and starts_with(http.request.uri.path, "/mcp"))`
- **Action:** Skip → **Super Bot Fight Mode**

## Local client setup (already applied on this machine)

| Client | Config path |
|--------|-------------|
| Cursor | `%USERPROFILE%\.cursor\mcp.json` (direct HTTP — working) |
| VS Code / Hermes ext | `%APPDATA%\Code\User\globalStorage\mcp-config.json` (mcp-remote bridge) |
| Hermes CLI | `%USERPROFILE%\.hermes\config.yaml` (mcp-remote bridge) |
| Shared secrets | `%USERPROFILE%\.hermes\amlak-owner.headers` |

Re-run anytime:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/setup-amlak-mcp-clients.ps1
```

Then **Developer: Reload Window** in Cursor/VS Code, or `/reload-mcp` in Hermes.

## Verify

```powershell
curl.exe -sS https://mcp.amlak-app.com/health
```

Should return JSON `"ok":true`. If `/mcp` returns HTML or 1010, Cloudflare bot settings still need step 3 above.
