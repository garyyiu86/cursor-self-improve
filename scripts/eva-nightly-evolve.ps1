# Eva nightly evolve: Tencent plans, Cursor implements (no commit).
# Intended for Windows Task Scheduler at 00:00 local time.
#
# Env (optional, from repo .env or system):
#   EVA_EVOLVE_MAX_ROUNDS=4
#   EVA_EVOLVE_CURSOR_FAST=0
#   EVA_EVOLVE_CURSOR_TIMEOUT_MS=900000
#   EVA_EVOLVE_CURSOR_GRACE_MS=360000
#   EVA_EVOLVE_CURSOR_IDLE_MS=240000
#
# ASCII-only file: Windows PowerShell may mis-parse UTF-8 punctuation.

$ErrorActionPreference = "Stop"
$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $RepoRoot

$LogDir = Join-Path $RepoRoot "overlay\data\evolve-nightly-logs"
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$LogFile = Join-Path $LogDir "evolve-$stamp.log"

function Write-Log([string]$msg) {
  $line = "[{0}] {1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $msg
  Write-Host $line
  Add-Content -Path $LogFile -Value $line -Encoding UTF8
}

function Load-DotEnv {
  $envPath = Join-Path $RepoRoot ".env"
  if (-not (Test-Path $envPath)) { return }
  Get-Content $envPath -Encoding UTF8 | ForEach-Object {
    $line = $_.Trim()
    if (-not $line -or $line.StartsWith("#")) { return }
    $i = $line.IndexOf("=")
    if ($i -le 0) { return }
    $key = $line.Substring(0, $i).Trim()
    $val = $line.Substring($i + 1).Trim()
    if (($val.StartsWith('"') -and $val.EndsWith('"')) -or ($val.StartsWith("'") -and $val.EndsWith("'"))) {
      $val = $val.Substring(1, $val.Length - 2)
    }
    if (-not [string]::IsNullOrEmpty($key) -and -not (Test-Path "Env:$key")) {
      Set-Item -Path "Env:$key" -Value $val
    }
  }
}

function Set-DefaultEnv([string]$key, [string]$value) {
  if (-not (Test-Path "Env:$key") -or [string]::IsNullOrWhiteSpace((Get-Item "Env:$key").Value)) {
    Set-Item -Path "Env:$key" -Value $value
  }
}

try {
  Load-DotEnv
  Set-DefaultEnv "EVA_EVOLVE_MAX_ROUNDS" "4"
  Set-DefaultEnv "EVA_EVOLVE_CURSOR_FAST" "0"
  Set-DefaultEnv "EVA_EVOLVE_CURSOR_TIMEOUT_MS" "900000"
  Set-DefaultEnv "EVA_EVOLVE_CURSOR_GRACE_MS" "360000"
  Set-DefaultEnv "EVA_EVOLVE_CURSOR_IDLE_MS" "240000"

  $rounds = $env:EVA_EVOLVE_MAX_ROUNDS
  Write-Log "=== Eva nightly evolve start ==="
  Write-Log "repo=$RepoRoot log=$LogFile rounds=$rounds fast=$($env:EVA_EVOLVE_CURSOR_FAST)"

  if ([string]::IsNullOrWhiteSpace($env:TENCENT_LKE_APP_KEY)) {
    throw "TENCENT_LKE_APP_KEY missing"
  }
  if ([string]::IsNullOrWhiteSpace($env:CURSOR_API_KEY)) {
    throw "CURSOR_API_KEY missing"
  }

  Write-Log "npm run eva:evolve -- --rounds $rounds"
  $out = & npm.cmd run eva:evolve -- --rounds $rounds 2>&1
  $out | ForEach-Object { Write-Log "  $_" }
  if ($LASTEXITCODE -ne 0) {
    throw "eva:evolve failed exit=$LASTEXITCODE"
  }

  Write-Log "=== Eva nightly evolve done ==="
  Write-Log "detail: overlay\data\evolve-log.md"
  exit 0
}
catch {
  Write-Log "ERROR: $($_.Exception.Message)"
  Write-Log "=== Eva nightly evolve FAILED ==="
  exit 1
}
