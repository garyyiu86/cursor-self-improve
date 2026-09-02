# Register Windows Scheduled Task: Eva KB backup at 21:00 local time.
# Auto-restarts on failure (no user RETRY prompt).
#   npm run eva:schedule-kb-backup
#   npm run eva:schedule-kb-backup -- -Time 21:00
#   npm run eva:schedule-kb-backup -- -Unregister

param(
  [string]$Time = "21:00",
  [switch]$Unregister,
  [switch]$WakeToRun
)

$ErrorActionPreference = "Stop"
$TaskName = "EvaKbBackup"
$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$ScriptPath = Join-Path $RepoRoot "scripts\eva-backup-kb.ps1"

if ($Unregister) {
  Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue
  Write-Host "Unregistered scheduled task: $TaskName"
  exit 0
}

if (-not (Test-Path $ScriptPath)) {
  throw "Missing $ScriptPath"
}

if ($Time -notmatch '^(\d{1,2}):(\d{2})$') {
  throw "Bad -Time '$Time' (use HH:mm, e.g. 16:00)"
}
$hour = [int]$Matches[1]
$minute = [int]$Matches[2]
if ($hour -gt 23 -or $minute -gt 59) { throw "Invalid clock time" }

$action = New-ScheduledTaskAction `
  -Execute "powershell.exe" `
  -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$ScriptPath`"" `
  -WorkingDirectory "$RepoRoot"

$trigger = New-ScheduledTaskTrigger -Daily -At ([datetime]::Today.AddHours($hour).AddMinutes($minute).ToString("HH:mm"))

# Restart up to 5 times, every 5 minutes, if the whole task process fails
$settings = New-ScheduledTaskSettingsSet `
  -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries `
  -StartWhenAvailable `
  -MultipleInstances IgnoreNew `
  -RestartCount 5 `
  -RestartInterval (New-TimeSpan -Minutes 5)

if ($WakeToRun) {
  $settings.WakeToRun = $true
}

# S4U / password-less: runs whether user is logged on or not is harder;
# Interactive avoids credential dialog at register time. Script itself never prompts.
$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Limited

Register-ScheduledTask `
  -TaskName $TaskName `
  -Action $action `
  -Trigger $trigger `
  -Settings $settings `
  -Principal $principal `
  -Description "Eva: daily KB backup to git + push (auto-retry)" `
  -Force | Out-Null

Write-Host "Registered: $TaskName daily at $Time"
Write-Host "Script: $ScriptPath"
Write-Host "Retry:  script up to 12x/30s + Task Scheduler restart 5x/5min"
Write-Host "Test:   npm run eva:backup-kb"
Write-Host "Remove: npm run eva:schedule-kb-backup -- -Unregister"
if (-not $WakeToRun) {
  Write-Host "Note: PC must be on at that time. Use -WakeToRun to try wake from sleep."
}
