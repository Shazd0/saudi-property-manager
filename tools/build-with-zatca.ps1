# Build Amlak (Vite) with a fixed ZATCA API URL baked into the bundle.
# Usage:
#   .\tools\build-with-zatca.ps1 -ZatcaServiceUrl "https://zatca-api.yourdomain.com"
#   .\tools\build-with-zatca.ps1 -ZatcaServiceUrl "https://zatca-api.yourdomain.com" -WebOnly
#   .\tools\build-with-zatca.ps1 -ZatcaServiceUrl "https://zatca-api.yourdomain.com" -Desktop

param(
  [Parameter(Mandatory = $true)]
  [string] $ZatcaServiceUrl,
  [switch] $WebOnly,
  [switch] $Desktop
)

$ErrorActionPreference = "Stop"
$u = $ZatcaServiceUrl.Trim().TrimEnd('/')
if ($u -notmatch '^https?://') {
  Write-Error "ZatcaServiceUrl must start with http:// or https:// (got: $ZatcaServiceUrl)"
}

$env:VITE_ZATCA_SERVICE_URL = $u
Write-Host "VITE_ZATCA_SERVICE_URL=$u" -ForegroundColor Cyan

$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $root

if ($Desktop) {
  npm run desktop:build
} elseif ($WebOnly) {
  npm run build
} else {
  npm run build
  Write-Host "Web build done. For Electron installer, run: npm run desktop:build (with same env), or: .\tools\build-with-zatca.ps1 -Desktop -ZatcaServiceUrl '$u'" -ForegroundColor Yellow
}
