# One-shot setup for amlak-owner MCP across Cursor, VS Code/Hermes, and Hermes CLI.
# Uses local mcp-remote stdio bridge so Cloudflare bot checks see your PC, not a cloud agent.
# Run: powershell -ExecutionPolicy Bypass -File scripts/setup-amlak-mcp-clients.ps1

$ErrorActionPreference = 'Stop'

$McpUrl = 'https://mcp.amlak-app.com/mcp'
$HeadersFile = Join-Path $env:USERPROFILE '.hermes\amlak-owner.headers'
$HermesConfig = Join-Path $env:USERPROFILE '.hermes\config.yaml'
$CursorConfig = Join-Path $env:USERPROFILE '.cursor\mcp.json'
$VsCodeConfig = Join-Path $env:APPDATA 'Code\User\globalStorage\mcp-config.json'

if (-not (Test-Path $HeadersFile)) {
  Write-Error "Missing $HeadersFile — create it first with Authorization + CF-Access headers."
}

$bridgeArgs = @(
  '-y', 'mcp-remote@latest', $McpUrl,
  '--header-file', $HeadersFile
)

function Write-JsonFile([string]$Path, [object]$Data) {
  $dir = Split-Path $Path -Parent
  if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
  $json = $Data | ConvertTo-Json -Depth 10
  Set-Content -Path $Path -Value $json -Encoding UTF8
  Write-Host "Wrote $Path"
}

# Cursor — keep cua-driver; bridge amlak-owner
$cursor = @{ mcpServers = @{} }
if (Test-Path $CursorConfig) {
  try { $cursor = Get-Content $CursorConfig -Raw | ConvertFrom-Json -AsHashtable } catch { }
}
if ($cursor.mcpServers -isnot [hashtable]) { $cursor.mcpServers = @{} }
$cursor.mcpServers['amlak-owner'] = @{
  command = 'npx'
  args    = $bridgeArgs
}
if ($cursor.mcpServers.ContainsKey('cua-driver')) {
  # preserve existing cua-driver entry from file if present
  $existing = Get-Content $CursorConfig -Raw | ConvertFrom-Json
  if ($existing.mcpServers.'cua-driver') {
    $cursor.mcpServers['cua-driver'] = @{
      command = $existing.mcpServers.'cua-driver'.command
      args    = @($existing.mcpServers.'cua-driver'.args)
      type    = 'stdio'
    }
  }
}
Write-JsonFile $CursorConfig $cursor

# VS Code / Hermes extension globalStorage
$vscode = @{
  mcpServers = @{
    'amlak-owner' = @{
      command = 'npx'
      args    = $bridgeArgs
    }
  }
}
Write-JsonFile $VsCodeConfig $vscode

# Hermes CLI config.yaml
$hermesDir = Split-Path $HermesConfig -Parent
if (-not (Test-Path $hermesDir)) { New-Item -ItemType Directory -Path $hermesDir -Force | Out-Null }
$yaml = @"
mcp_servers:
  amlak-owner:
    command: "npx"
    args:
      - "-y"
      - "mcp-remote@latest"
      - "$McpUrl"
      - "--header-file"
      - "$($HeadersFile -replace '\\','/')"
    enabled: true
    timeout: 120
    connect_timeout: 60
    trust: untrusted
    tools:
      resources: false
      prompts: false
"@
Set-Content -Path $HermesConfig -Value $yaml.TrimEnd() -Encoding UTF8
Write-Host "Wrote $HermesConfig"

# Lock down headers file (current user only)
icacls $HeadersFile /inheritance:r /grant:r "$($env:USERNAME):(R)" | Out-Null
Write-Host "Locked down $HeadersFile"

Write-Host ""
Write-Host "=== Local MCP clients configured ===" -ForegroundColor Green
Write-Host "1. Reload Cursor: Ctrl+Shift+P -> Developer: Reload Window"
Write-Host "2. Reload VS Code if open"
Write-Host "3. Hermes CLI: hermes chat then /reload-mcp"
Write-Host ""
Write-Host "=== Cloudflare (one-time, in browser) ===" -ForegroundColor Yellow
Write-Host "Open: https://dash.cloudflare.com"
Write-Host "Zone amlak-app.com -> Security -> Settings -> Bot traffic"
Write-Host "  - Turn OFF 'Bot Fight Mode' (Free plan cannot skip it for API clients)"
Write-Host "  - Turn OFF 'Block AI bots' if enabled"
Write-Host "If Pro+: Security rules -> Custom rule -> Skip Super Bot Fight Mode when:"
Write-Host "  (http.host eq `"mcp.amlak-app.com`" and starts_with(http.request.uri.path, `"/mcp`"))"
Write-Host ""
Write-Host "Access app for /mcp must still have Service Auth policy with your service token."
