# Register Windows Scheduled Task: Eva daily train at 06:00 local time.
# Usage (from repo root, PowerShell):
#   npm run eva:schedule-train
#   npm run eva:schedule-train -- -Time 06:00
#   npm run eva:schedule-train -- -Unregister

param(
  [string]$Time = "06:00",
  [switch]$Unregister,
  [switch]$WakeToRun
)

$ErrorActionPreference = "Stop"
$TaskName = "EvaDailyTrain"
$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$ScriptPath = Join-Path $RepoRoot "scripts\eva-daily-train.ps1"

if ($Unregister) {
  Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue
  Write-Host "Unregistered scheduled task: $TaskName"
  exit 0
}

if (-not (Test-Path $ScriptPath)) {
  throw "Missing $ScriptPath"
}

if ($Time -notmatch '^(\d{1,2}):(\d{2})$') {
  throw "Bad -Time '$Time' (use HH:mm, e.g. 06:00)"
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
  -Description "Eva daily KB export (+ optional LoRA)" `
  -Force | Out-Null

Write-Host "Registered: $TaskName daily at $Time"
Write-Host "Script: $ScriptPath"
Write-Host "Logs:   $RepoRoot\training\logs\"
Write-Host ""
Write-Host "Default = export only. To also LoRA, set in .env:"
Write-Host "  EVA_DAILY_TRAIN_LORA=1"
Write-Host "  (needs .venv-lora with Unsloth - see training/README.md)"
Write-Host ""
Write-Host "Test now:  npm run eva:daily-train"
Write-Host "Remove:    npm run eva:schedule-train -- -Unregister"
if (-not $WakeToRun) {
  Write-Host "Note: PC must be on at that time. Use -WakeToRun to try wake from sleep."
}
