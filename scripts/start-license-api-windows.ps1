# Start Product License API on Windows (default :8787).
# Cloudflare Tunnel should point saleapi.amlak-app.com -> http://127.0.0.1:8787
$ErrorActionPreference = "Stop"

$RootDir = Split-Path -Parent $PSScriptRoot
$EnvCandidates = @(
  (Join-Path $RootDir "license-api-server\.env.production.local"),
  (Join-Path $RootDir "functions\.env"),
  (Join-Path $RootDir ".env.local")
)

function Import-DotEnvFile {
  param([string]$Path)
  if (-not (Test-Path $Path)) { return }
  Get-Content $Path | ForEach-Object {
    $line = $_.Trim()
    if (-not $line -or $line.StartsWith("#")) { return }
    $eq = $line.IndexOf("=")
    if ($eq -lt 1) { return }
    $key = $line.Substring(0, $eq).Trim()
    $val = $line.Substring($eq + 1).Trim()
    if (($val.StartsWith('"') -and $val.EndsWith('"')) -or ($val.StartsWith("'") -and $val.EndsWith("'"))) {
      $val = $val.Substring(1, $val.Length - 2)
    }
    if ($key -and -not [string]::IsNullOrWhiteSpace($val)) {
      Set-Item -Path "Env:$key" -Value $val
    }
  }
  Write-Host "Loaded env from $Path"
}

foreach ($f in $EnvCandidates) { Import-DotEnvFile $f }

if (-not $env:SALES_CONSOLE_PASSWORD -and $env:VITE_SALES_CONSOLE_PASSWORD) {
  $env:SALES_CONSOLE_PASSWORD = $env:VITE_SALES_CONSOLE_PASSWORD
}

if (-not $env:SALES_CONSOLE_PASSWORD) {
  throw "Missing SALES_CONSOLE_PASSWORD. Set it in functions\.env or license-api-server\.env.production.local"
}

if (-not $env:LICENSE_CORS_ORIGINS) {
  $env:LICENSE_CORS_ORIGINS = "https://amlak-app.com,https://www.amlak-app.com"
  Write-Host "LICENSE_CORS_ORIGINS defaulted to $($env:LICENSE_CORS_ORIGINS)"
}

$env:NODE_ENV = if ($env:NODE_ENV) { $env:NODE_ENV } else { "production" }
$env:PORT = if ($env:PORT) { $env:PORT } else { "8787" }

Set-Location $RootDir
Write-Host "License API listening on http://127.0.0.1:$($env:PORT)"
node license-api-server\index.js
