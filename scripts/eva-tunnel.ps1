# Quick Cloudflare Tunnel → local Eva API (http://127.0.0.1:8787)
# Usage: npm run eva:tunnel
# Requires: cloudflared in PATH, and eva:server / overlay already running.

$ErrorActionPreference = "Stop"
$port = if ($env:EVA_API_PORT) { $env:EVA_API_PORT } else { "8787" }
$target = "http://127.0.0.1:$port"

$cf = Get-Command cloudflared -ErrorAction SilentlyContinue
if (-not $cf) {
  Write-Host @"
cloudflared not found.

Install (pick one):
  winget install --id Cloudflare.cloudflared -e
  # or: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/

Then reopen this terminal and run: npm run eva:tunnel
"@
  exit 1
}

Write-Host "[Eva][Tunnel] Forwarding public HTTPS → $target"
Write-Host "[Eva][Tunnel] Keep this window open. Copy the https://….trycloudflare.com URL into phone Settings."
Write-Host "[Eva][Tunnel] Token must match EVA_API_TOKEN in .env"
Write-Host ""

& cloudflared tunnel --url $target
