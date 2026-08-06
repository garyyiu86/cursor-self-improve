# Eva daily train: export KB JSONL (+ optional LoRA).
# Intended for Windows Task Scheduler ~06:00.
#
# Env (optional, from repo .env or system):
#   EVA_DAILY_TRAIN_MIN_EXAMPLES=50   - skip if export count below this
#   EVA_DAILY_TRAIN_LORA=0|1          - run Python LoRA after export (default 0)
#   EVA_DAILY_TRAIN_PYTHON=...        - python.exe (default: .venv-lora\Scripts\python.exe)
#   EVA_DAILY_TRAIN_SCRIPT=...        - train script (default: training\train_lora_peft.py)
#   EVA_DAILY_TRAIN_MAX_STEPS=60
#   EVA_DAILY_TRAIN_KB_UP=1           - try docker compose up -d before export
#
# ASCII-only file: Windows PowerShell may mis-parse UTF-8 punctuation.

$ErrorActionPreference = "Stop"
$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $RepoRoot

$LogDir = Join-Path $RepoRoot "training\logs"
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$LogFile = Join-Path $LogDir "daily-train-$stamp.log"

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
  Write-Log "=== Eva daily train start ==="
  Write-Log "repo=$RepoRoot log=$LogFile"

  $kbUp = if ($env:EVA_DAILY_TRAIN_KB_UP) { $env:EVA_DAILY_TRAIN_KB_UP } else { "1" }
  if ($kbUp -ne "0") {
    Write-Log "docker compose up -d (KB)..."
    try {
      & docker compose up -d 2>&1 | ForEach-Object { Write-Log "  $_" }
    } catch {
      Write-Log "WARN: docker compose failed (continue): $($_.Exception.Message)"
    }
    Start-Sleep -Seconds 3
  }

  Write-Log "export-train..."
  $exportOut = & npm.cmd run eva:export-train 2>&1
  $exportOut | ForEach-Object { Write-Log "  $_" }
  if ($LASTEXITCODE -ne 0) {
    throw "eva:export-train failed exit=$LASTEXITCODE"
  }

  $metaPath = Join-Path $RepoRoot "training\data\eva-export-meta.json"
  $count = 0
  $alpaca = ""
  if (Test-Path $metaPath) {
    $meta = Get-Content $metaPath -Raw -Encoding UTF8 | ConvertFrom-Json
    $count = [int]$meta.count
    $alpaca = [string]$meta.alpaca
    Write-Log "export count=$count alpaca=$alpaca"
  } else {
    Write-Log "WARN: meta missing; cannot verify example count"
  }

  $minEx = [int]($(if ($env:EVA_DAILY_TRAIN_MIN_EXAMPLES) { $env:EVA_DAILY_TRAIN_MIN_EXAMPLES } else { 50 }))
  if ($count -gt 0 -and $count -lt $minEx) {
    Write-Log "SKIP LoRA: examples $count < min $minEx (export kept)"
    Write-Log "=== Eva daily train done (export only) ==="
    exit 0
  }

  $doLora = if ($env:EVA_DAILY_TRAIN_LORA) { $env:EVA_DAILY_TRAIN_LORA } else { "0" }
  if ($doLora -ne "1") {
    Write-Log "LoRA skipped (set EVA_DAILY_TRAIN_LORA=1 in .env to enable)"
    Write-Log "=== Eva daily train done (export only) ==="
    exit 0
  }

  $pyDefault = Join-Path $RepoRoot ".venv-lora\Scripts\python.exe"
  $py = if ($env:EVA_DAILY_TRAIN_PYTHON) { $env:EVA_DAILY_TRAIN_PYTHON } else { $pyDefault }
  $scriptDefault = Join-Path $RepoRoot "training\train_lora_peft.py"
  $trainScript = if ($env:EVA_DAILY_TRAIN_SCRIPT) { $env:EVA_DAILY_TRAIN_SCRIPT } else { $scriptDefault }
  $maxSteps = if ($env:EVA_DAILY_TRAIN_MAX_STEPS) { $env:EVA_DAILY_TRAIN_MAX_STEPS } else { "60" }

  if (-not (Test-Path $py)) {
    throw "Python not found: $py - create .venv-lora or set EVA_DAILY_TRAIN_PYTHON"
  }
  if (-not (Test-Path $trainScript)) {
    throw "Train script missing: $trainScript"
  }
  if (-not $alpaca -or -not (Test-Path $alpaca)) {
    throw "Alpaca JSONL missing after export"
  }

  Write-Log "LoRA train: $py $trainScript --data $alpaca --max-steps $maxSteps"
  & $py $trainScript --data $alpaca --max-steps $maxSteps 2>&1 | ForEach-Object { Write-Log "  $_" }
  if ($LASTEXITCODE -ne 0) {
    throw "LoRA train failed exit=$LASTEXITCODE"
  }

  Write-Log "NOTE: merge/GGUF/ollama create still manual - see training/README.md"
  Write-Log "=== Eva daily train done (export + LoRA) ==="
  exit 0
}
catch {
  Write-Log "ERROR: $($_.Exception.Message)"
  Write-Log "=== Eva daily train FAILED ==="
  exit 1
}
