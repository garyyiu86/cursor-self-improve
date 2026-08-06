# Register Windows Scheduled Task: Eva KB backup at 16:00 local time.
#   npm run eva:schedule-kb-backup
#   npm run eva:schedule-kb-backup -- -Time 16:00
#   npm run eva:schedule-kb-backup -- -Unregister

param(
  [string]$Time = "16:00",
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
  -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$ScriptPath`"" `
  -WorkingDirectory "$RepoRoot"

$trigger = New-ScheduledTaskTrigger -Daily -At ([datetime]::Today.AddHours($hour).AddMinutes($minute).ToString("HH:mm"))

$settings = New-ScheduledTaskSettingsSet `
  -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries `
  -StartWhenAvailable `
  -MultipleInstances IgnoreNew

if ($WakeToRun) {
  $settings.WakeToRun = $true
}

$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Limited

Register-ScheduledTask `
  -TaskName $TaskName `
  -Action $action `
  -Trigger $trigger `
  -Settings $settings `
  -Principal $principal `
  -Description "Eva: daily KB backup to git + push" `
  -Force | Out-Null

Write-Host "Registered: $TaskName daily at $Time"
Write-Host "Script: $ScriptPath"
Write-Host "Files:  backups/kb/eva_kb_latest.json (+ .sql)"
Write-Host "Test:   npm run eva:backup-kb"
Write-Host "Remove: npm run eva:schedule-kb-backup -- -Unregister"
if (-not $WakeToRun) {
  Write-Host "Note: PC must be on at that time. Use -WakeToRun to try wake from sleep."
}
