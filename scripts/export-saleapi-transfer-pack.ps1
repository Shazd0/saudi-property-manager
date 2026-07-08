# Run THIS on the Windows laptop when you are ready to copy secrets to the Mac mini.
# Creates: Desktop\amlak-saleapi-mac-transfer\  (keep private — delete after Mac setup)
$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $PSScriptRoot
$Pack = Join-Path $env:USERPROFILE "Desktop\amlak-saleapi-mac-transfer"
$CfSrc = Join-Path $env:USERPROFILE ".cloudflared"
$TunnelId = "cf968696-8198-487e-a62b-e83c6318a6a8"

New-Item -ItemType Directory -Force -Path "$Pack\cloudflared","$Pack\license-api-server","$Pack\functions" | Out-Null

$cred = Join-Path $CfSrc "$TunnelId.json"
if (-not (Test-Path $cred)) { throw "Missing $cred" }
Copy-Item $cred "$Pack\cloudflared\" -Force
if (Test-Path (Join-Path $CfSrc "cert.pem")) {
  Copy-Item (Join-Path $CfSrc "cert.pem") "$Pack\cloudflared\" -Force
}
if (Test-Path (Join-Path $CfSrc "config.yml")) {
  Copy-Item (Join-Path $CfSrc "config.yml") "$Pack\cloudflared\" -Force
}

$sa = Join-Path $Root "license-api-server\service-account.json"
if (-not (Test-Path $sa)) { throw "Missing $sa" }
Copy-Item $sa "$Pack\license-api-server\" -Force

$fe = Join-Path $Root "functions\.env"
if (Test-Path $fe) { Copy-Item $fe "$Pack\functions\" -Force }

@'
AMLAK saleapi → Mac mini (PRIVATE — do not upload to GitHub)

On Mac mini:
  cd ~
  git clone https://github.com/Shazd0/saudi-property-manager.git amlak-sale-product
  cd amlak-sale-product && git pull
  npm install && npm install --prefix license-api-server

  mkdir -p ~/.cloudflared
  # Copy from this folder (USB / AirDrop / shared drive):
  cp cloudflared/*.json ~/.cloudflared/
  cp cloudflared/cert.pem ~/.cloudflared/ 2>/dev/null || true
  cp license-api-server/service-account.json ~/amlak-sale-product/license-api-server/
  mkdir -p ~/amlak-sale-product/functions
  cp functions/.env ~/amlak-sale-product/functions/ 2>/dev/null || true

  brew install cloudflared
  chmod +x scripts/*.sh
  ./scripts/prepare-license-env-mac-mini.sh
  ./scripts/setup-saleapi-tunnel-mac-mini.sh cf968696-8198-487e-a62b-e83c6318a6a8 amlak-saleapi
  sudo pmset -a sleep 0 displaysleep 0 disksleep 0

STOP cloudflared on Windows, then on Mac:
  ./scripts/start-saleapi-stack-mac-mini.sh

Verify:
  curl -sS https://saleapi.amlak-app.com/health
'@ | Set-Content "$Pack\README-MAC-MINI.txt" -Encoding UTF8

Write-Host ""
Write-Host "Created: $Pack"
Write-Host "Copy that folder to the Mac mini (USB/AirDrop), then follow README-MAC-MINI.txt"
Write-Host "Delete the folder after setup."
Write-Host ""
Get-ChildItem -Recurse $Pack | Select-Object FullName, Length | Format-Table -AutoSize
Start-Process explorer.exe $Pack
