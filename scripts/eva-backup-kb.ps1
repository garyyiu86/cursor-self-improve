# Backup Eva Postgres KB into repo and push to remote.
# Retries automatically until success (no interactive RETRY prompts).
#
#   npm run eva:backup-kb
#   npm run eva:schedule-kb-backup
#
# Env:
#   EVA_KB_BACKUP_RETRIES=12          - max attempts (default 12)
#   EVA_KB_BACKUP_RETRY_SEC=30        - seconds between attempts
#   EVA_KB_BACKUP_PUSH=0              - skip git push
#   EVA_KB_BACKUP_COMMIT=0            - skip git commit

$ErrorActionPreference = "Stop"
$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $RepoRoot

# Never prompt for credentials / confirmations in scheduled runs
$env:GIT_TERMINAL_PROMPT = "0"
$env:GCM_INTERACTIVE = "never"

$LogDir = Join-Path $RepoRoot "backups\kb\logs"
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$LogFile = Join-Path $LogDir "kb-backup-$stamp.log"

$maxAttempts = [int]($(if ($env:EVA_KB_BACKUP_RETRIES) { $env:EVA_KB_BACKUP_RETRIES } else { 12 }))
$retrySec = [int]($(if ($env:EVA_KB_BACKUP_RETRY_SEC) { $env:EVA_KB_BACKUP_RETRY_SEC } else { 30 }))
if ($maxAttempts -lt 1) { $maxAttempts = 1 }
if ($retrySec -lt 5) { $retrySec = 5 }

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

function Invoke-BackupOnce {
  Load-DotEnv
  # Re-apply non-interactive after dotenv
  $env:GIT_TERMINAL_PROMPT = "0"
  $env:GCM_INTERACTIVE = "never"

  Write-Log "=== Eva KB backup attempt ==="

  $kbUp = if ($env:EVA_KB_BACKUP_KB_UP) { $env:EVA_KB_BACKUP_KB_UP } else { "1" }
  if ($kbUp -ne "0") {
    Write-Log "docker compose up -d..."
    $prevEap = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    & docker compose up -d 2>&1 | ForEach-Object { Write-Log "  $_" }
    $ErrorActionPreference = $prevEap
    Start-Sleep -Seconds 3
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
    return "unchanged"
  }

  if ($skipCommit) {
    Write-Log "Commit skipped (EVA_KB_BACKUP_COMMIT=0)"
    return "files-only"
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
    return "committed"
  }

  Write-Log "git push..."
  $prevEap = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  & git push 2>&1 | ForEach-Object { Write-Log "  $_" }
  $pushCode = $LASTEXITCODE
  $ErrorActionPreference = $prevEap
  if ($pushCode -ne 0) { throw "git push failed exit=$pushCode" }
  Write-Log "Pushed OK"
  return "pushed"
}

Write-Log "=== Eva KB backup start (maxAttempts=$maxAttempts retrySec=$retrySec) ==="

$lastErr = $null
for ($attempt = 1; $attempt -le $maxAttempts; $attempt++) {
  try {
    Write-Log "--- attempt $attempt / $maxAttempts ---"
    $result = Invoke-BackupOnce
    Write-Log "=== Eva KB backup done ($result) ==="
    exit 0
  } catch {
    $lastErr = $_.Exception.Message
    Write-Log "ERROR attempt $attempt : $lastErr"
    if ($attempt -ge $maxAttempts) { break }
    Write-Log "Auto-retry in ${retrySec}s (no prompt)..."
    Start-Sleep -Seconds $retrySec
  }
}

Write-Log "ERROR: gave up after $maxAttempts attempts: $lastErr"
Write-Log "=== Eva KB backup FAILED ==="
exit 1
