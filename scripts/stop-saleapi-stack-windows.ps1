# Stop saleapi on THIS Windows laptop so the Mac mini can take over the tunnel.
# Run only AFTER Mac mini License API is ready and you are about to start cloudflared there.
$ErrorActionPreference = "Continue"

Write-Host "Stopping cloudflared..."
Get-Process cloudflared -ErrorAction SilentlyContinue | ForEach-Object {
  Write-Host "  Kill cloudflared PID $($_.Id)"
  Stop-Process -Id $_.Id -Force
}

Write-Host "Finding node listeners on :8787..."
$conns = Get-NetTCPConnection -LocalPort 8787 -State Listen -ErrorAction SilentlyContinue
foreach ($c in $conns) {
  $pid = $c.OwningProcess
  if ($pid) {
    $p = Get-Process -Id $pid -ErrorAction SilentlyContinue
    Write-Host "  Kill $($p.ProcessName) PID $pid (port 8787)"
    Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
  }
}

Start-Sleep -Seconds 1
Write-Host ""
Write-Host "Local :8787 should be free. Public saleapi may show Error 1033 until Mac tunnel starts."
try {
  curl.exe -sS -o NUL -w "public=%{http_code}`n" --connect-timeout 8 https://saleapi.amlak-app.com/health
} catch {}
Write-Host "Done. On Mac mini run: ./scripts/start-saleapi-stack-mac-mini.sh"
