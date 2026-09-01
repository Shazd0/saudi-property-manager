# Prepare secrets for Render "amlak-license-api" (does not upload anything).
# Copies FIREBASE_SERVICE_ACCOUNT_JSON to the clipboard and prints a paste checklist.
$ErrorActionPreference = "Stop"

$RootDir = Split-Path -Parent $PSScriptRoot
$SaPath = Join-Path $RootDir "license-api-server\service-account.json"
$EnvCandidates = @(
  (Join-Path $RootDir "functions\.env"),
  (Join-Path $RootDir "license-api-server\.env.production.local"),
  (Join-Path $RootDir ".env.local")
)

function Get-DotEnvValue {
  param([string]$Key)
  foreach ($path in $EnvCandidates) {
    if (-not (Test-Path $path)) { continue }
    foreach ($line in Get-Content $path) {
      $t = $line.Trim()
      if (-not $t -or $t.StartsWith("#")) { continue }
      $eq = $t.IndexOf("=")
      if ($eq -lt 1) { continue }
      $k = $t.Substring(0, $eq).Trim()
      if ($k -ne $Key) { continue }
      $v = $t.Substring($eq + 1).Trim()
      if (($v.StartsWith('"') -and $v.EndsWith('"')) -or ($v.StartsWith("'") -and $v.EndsWith("'"))) {
        $v = $v.Substring(1, $v.Length - 2)
      }
      if ($v) { return $v }
    }
  }
  return $null
}

Write-Host ""
Write-Host "=== Render License API env checklist ==="
Write-Host ""

$pwdVal = Get-DotEnvValue "SALES_CONSOLE_PASSWORD"
if (-not $pwdVal) { $pwdVal = Get-DotEnvValue "VITE_SALES_CONSOLE_PASSWORD" }
if ($pwdVal) {
  $mask = if ($pwdVal.Length -le 4) { "****" } else { $pwdVal.Substring(0, 2) + ("*" * [Math]::Min(12, $pwdVal.Length - 2)) }
  Write-Host "SALES_CONSOLE_PASSWORD : found locally ($mask) — paste the real value in Render"
} else {
  Write-Host "SALES_CONSOLE_PASSWORD : NOT FOUND — enter the same password Sales Console uses"
}

Write-Host "LICENSE_CORS_ORIGINS   : https://amlak-app.com,https://www.amlak-app.com"
Write-Host "NODE_ENV               : production"

if (-not (Test-Path $SaPath)) {
  Write-Host ""
  Write-Host "MISSING $SaPath"
  Write-Host "Put the Firebase service account JSON there, or paste it manually into Render as FIREBASE_SERVICE_ACCOUNT_JSON."
  exit 1
}

$raw = Get-Content -Raw $SaPath
# Compact to one line for easier paste into Render
$json = ($raw | ConvertFrom-Json) | ConvertTo-Json -Compress -Depth 20
Set-Clipboard -Value $json
Write-Host ""
Write-Host "FIREBASE_SERVICE_ACCOUNT_JSON : COPIED TO CLIPBOARD (one-line JSON)."
Write-Host "In Render → amlak-license-api → Environment → paste into FIREBASE_SERVICE_ACCOUNT_JSON."
Write-Host ""
Write-Host "Optional:"
Write-Host "  ZATCA_CREDENTIALS_SECRET = long random string (needed to save buyer ZATCA configs)"
Write-Host "  ZATCA_SIGNING_SERVICE_URL / KEY = leave empty until ZATCA is hosted"
Write-Host ""
Write-Host "Next:"
Write-Host "  1. Open https://dashboard.render.com/blueprints"
Write-Host "  2. Follow docs/RENDER_LICENSE_API_SETUP.md"
Write-Host "  3. After Live: point Cloudflare saleapi CNAME → amlak-license-api.onrender.com (DNS only)"
Write-Host "  4. Stop cloudflared on this laptop"
Write-Host ""

Start-Process "https://dashboard.render.com/blueprints"
