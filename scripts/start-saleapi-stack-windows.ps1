# Opens two windows: License API (:8787) + Cloudflare Tunnel (saleapi.amlak-app.com).
# Keep this laptop awake and online while buyers need live activation.
$ErrorActionPreference = "Stop"
$Scripts = $PSScriptRoot

Write-Host "Starting License API window..."
Start-Process powershell -ArgumentList @(
  "-NoExit",
  "-ExecutionPolicy", "Bypass",
  "-File", (Join-Path $Scripts "start-license-api-windows.ps1")
)

Start-Sleep -Seconds 2

Write-Host "Starting Cloudflare Tunnel window..."
Start-Process powershell -ArgumentList @(
  "-NoExit",
  "-ExecutionPolicy", "Bypass",
  "-File", (Join-Path $Scripts "start-saleapi-tunnel-windows.ps1")
)

Write-Host ""
Write-Host "Both windows launched."
Write-Host "Check: https://saleapi.amlak-app.com/health"
Write-Host "Keep laptop awake — sleep/lid-close will bring Error 1033 back."
