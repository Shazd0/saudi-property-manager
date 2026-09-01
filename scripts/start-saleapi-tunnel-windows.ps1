# Start Cloudflare Tunnel for saleapi.amlak-app.com on this Windows laptop.
# Requires: cloudflared installed, config at %USERPROFILE%\.cloudflared\config.yml
$ErrorActionPreference = "Stop"

$Config = Join-Path $env:USERPROFILE ".cloudflared\config.yml"
if (-not (Test-Path $Config)) {
  throw "Missing $Config. Expected ingress for saleapi.amlak-app.com -> http://127.0.0.1:8787"
}

Write-Host "Using config: $Config"
Write-Host "Ensure License API is running on http://127.0.0.1:8787 first."
Write-Host "Starting cloudflared tunnel..."
& cloudflared tunnel run
