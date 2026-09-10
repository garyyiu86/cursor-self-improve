# Register Windows Scheduled Task: Eva nightly evolve at 00:00 local time.
#   npm run eva:schedule-evolve
#   npm run eva:schedule-evolve -- -Time 00:00
#   npm run eva:schedule-evolve -- -Unregister
#   npm run eva:schedule-evolve -- -WakeToRun

param(
  [string]$Time = "00:00",
  [switch]$Unregister,
  [switch]$WakeToRun
)

$ErrorActionPreference = "Stop"
$TaskName = "EvaNightlyEvolve"
$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$ScriptPath = Join-Path $RepoRoot "scripts\eva-nightly-evolve.ps1"

if ($Unregister) {
  Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue
  Write-Host "Unregistered scheduled task: $TaskName"
  exit 0
}

if (-not (Test-Path $ScriptPath)) {
  throw "Missing $ScriptPath"
}

if ($Time -notmatch '^(\d{1,2}):(\d{2})$') {
  throw "Bad -Time '$Time' (use HH:mm, e.g. 00:00)"
}
$hour = [int]$Matches[1]
$minute = [int]$Matches[2]
if ($hour -gt 23 -or $minute -gt 59) { throw "Invalid clock time" }

$action = New-ScheduledTaskAction `
  -Execute "powershell.exe" `
  -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$ScriptPath`"" `
  -WorkingDirectory "$RepoRoot"

$trigger = New-ScheduledTaskTrigger -Daily -At ([datetime]::Today.AddHours($hour).AddMinutes($minute).ToString("HH:mm"))

$settings = New-ScheduledTaskSettingsSet `
  -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries `
  -StartWhenAvailable `
  -MultipleInstances IgnoreNew `
  -RestartCount 2 `
  -RestartInterval (New-TimeSpan -Minutes 15)

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
  -Description "Eva: nightly Tencent+Cursor evolve (no commit)" `
  -Force | Out-Null

Write-Host "Registered: $TaskName daily at $Time"
Write-Host "Script: $ScriptPath"
Write-Host "Logs:   $RepoRoot\overlay\data\evolve-nightly-logs\"
Write-Host "Test:   npm run eva:nightly-evolve"
Write-Host "Remove: npm run eva:schedule-evolve -- -Unregister"
if (-not $WakeToRun) {
  Write-Host "Note: PC must be on (or recently wake). Use -WakeToRun to try wake from sleep."
  Write-Host "      StartWhenAvailable=on: if midnight is missed, it runs next time the PC is on."
}
