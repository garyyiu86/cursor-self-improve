# Backup Eva Postgres KB into repo and push to remote.
# Intended for Windows Task Scheduler at 16:00.
#
#   npm run eva:backup-kb
#   npm run eva:schedule-kb-backup

$ErrorActionPreference = "Stop"
$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $RepoRoot

$LogDir = Join-Path $RepoRoot "backups\kb\logs"
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$LogFile = Join-Path $LogDir "kb-backup-$stamp.log"

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

try {
  Load-DotEnv
  Write-Log "=== Eva KB backup start ==="

  $kbUp = if ($env:EVA_KB_BACKUP_KB_UP) { $env:EVA_KB_BACKUP_KB_UP } else { "1" }
  if ($kbUp -ne "0") {
    Write-Log "docker compose up -d..."
    try {
      & docker compose up -d 2>&1 | ForEach-Object { Write-Log "  $_" }
      Start-Sleep -Seconds 2
    } catch {
      Write-Log "WARN: docker compose: $($_.Exception.Message)"
    }
  }

  Write-Log "export KB..."
  $dumpScript = Join-Path $RepoRoot "overlay\scripts\eva-backup-kb.cjs"
  $prevEap = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  & node $dumpScript 2>&1 | ForEach-Object { Write-Log "  $_" }
  $dumpCode = $LASTEXITCODE
  $ErrorActionPreference = $prevEap
  if ($dumpCode -ne 0) { throw "backup dump failed exit=$dumpCode" }

  $skipPush = $env:EVA_KB_BACKUP_PUSH -eq "0"
  $skipCommit = $env:EVA_KB_BACKUP_COMMIT -eq "0"

  & git add -f -- "backups/kb/eva_kb_latest.json" "backups/kb/eva_kb_latest.sql" "backups/kb/backup-meta.json" "backups/kb/.gitkeep"
  if ($LASTEXITCODE -ne 0) { throw "git add failed" }

  $porcelain = & git status --porcelain -- "backups/kb"
  if (-not $porcelain) {
    Write-Log "No KB file changes; skip commit/push"
    Write-Log "=== Eva KB backup done (unchanged) ==="
    exit 0
  }

  if ($skipCommit) {
    Write-Log "Commit skipped (EVA_KB_BACKUP_COMMIT=0)"
    Write-Log "=== Eva KB backup done (files only) ==="
    exit 0
  }

  $count = "?"
  $metaPath = Join-Path $RepoRoot "backups\kb\backup-meta.json"
  if (Test-Path $metaPath) {
    try { $count = (Get-Content $metaPath -Raw -Encoding UTF8 | ConvertFrom-Json).count } catch {}
  }

  $msg = "Backup Eva KB ($count entries)."
  & git commit -m $msg
  if ($LASTEXITCODE -ne 0) { throw "git commit failed" }
  Write-Log "Committed: $msg"

  if ($skipPush) {
    Write-Log "Push skipped (EVA_KB_BACKUP_PUSH=0)"
  } else {
    Write-Log "git push..."
    & git push
    if ($LASTEXITCODE -ne 0) { throw "git push failed" }
    Write-Log "Pushed OK"
  }

  Write-Log "=== Eva KB backup done ==="
  exit 0
}
catch {
  Write-Log "ERROR: $($_.Exception.Message)"
  Write-Log "=== Eva KB backup FAILED ==="
  exit 1
}
