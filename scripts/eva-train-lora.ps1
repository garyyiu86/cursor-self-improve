# Short / manual LoRA run via peft (CPU-ok smoke).
#   npm run eva:train-lora
#   npm run eva:train-lora -- -MaxSteps 5 -Fast
#   npm run eva:train-lora -- -MaxSteps 10 -Threads 2   # leave CPU free (slower)
#   npm run eva:train-lora -- -MaxSteps 10 -Threads 0   # use most cores (faster, PC laggy)
param(
  [int]$MaxSteps = 10,
  [string]$Base = "Qwen/Qwen2.5-0.5B-Instruct",
  [string]$Data = "",
  [int]$Threads = -1,
  [switch]$Fast,
  [switch]$LowPriority
)

$ErrorActionPreference = "Stop"
$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $RepoRoot

$py = Join-Path $RepoRoot ".venv-lora\Scripts\python.exe"
$script = Join-Path $RepoRoot "training\train_lora_peft.py"
if (-not (Test-Path $py)) { throw "Missing $py - run npm run eva:setup-lora-venv" }

if (-not $Data) {
  $meta = Join-Path $RepoRoot "training\data\eva-export-meta.json"
  if (Test-Path $meta) {
    $Data = (Get-Content $meta -Raw -Encoding UTF8 | ConvertFrom-Json).alpaca
  }
}
if (-not $Data -or -not (Test-Path $Data)) {
  Write-Host "Exporting KB first..."
  & npm.cmd run eva:export-train
  if ($LASTEXITCODE -ne 0) { throw "export failed" }
  $Data = (Get-Content (Join-Path $RepoRoot "training\data\eva-export-meta.json") -Raw -Encoding UTF8 | ConvertFrom-Json).alpaca
}

if ($Threads -lt 0) {
  if ($env:EVA_LORA_THREADS) { $Threads = [int]$env:EVA_LORA_THREADS }
  else { $Threads = 0 }  # 0 = script auto (cpu-2)
}

$argList = @(
  $script,
  "--data", $Data,
  "--base", $Base,
  "--max-steps", "$MaxSteps",
  "--threads", "$Threads",
  "--out", (Join-Path $RepoRoot "training\out\eva-lora-peft")
)
if ($Fast) { $argList += "--fast" }

Write-Host "Train: base=$Base steps=$MaxSteps threads=$Threads fast=$Fast data=$Data"
Write-Host "NOTE: fewer threads = smoother desktop, slower train. GPU would be real speedup."

$p = Start-Process -FilePath $py -ArgumentList $argList -WorkingDirectory $RepoRoot -PassThru -NoNewWindow
if ($LowPriority -or $env:EVA_LORA_LOW_PRIORITY -eq "1") {
  try { $p.PriorityClass = "BelowNormal" } catch {}
}
Wait-Process -Id $p.Id
exit $p.ExitCode
