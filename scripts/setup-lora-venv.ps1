# Create / refresh .venv-lora (Python 3.12 + requirements-lora.txt)
$ErrorActionPreference = "Stop"
$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $RepoRoot

$py = $null
try { $py = & py -3.12 -c "import sys; print(sys.executable)" 2>$null } catch {}
if (-not $py) { throw "Python 3.12 not found. Install Python.Python.3.12 via winget first." }

Write-Host "Using $py"
& py -3.12 -m venv .venv-lora
$pip = Join-Path $RepoRoot ".venv-lora\Scripts\pip.exe"
$python = Join-Path $RepoRoot ".venv-lora\Scripts\python.exe"
& $python -m pip install -U pip
& $pip install -r (Join-Path $RepoRoot "training\requirements-lora.txt")
Write-Host "OK: $python"
Write-Host "Note: this PC needs NVIDIA for practical LoRA. Keep EVA_DAILY_TRAIN_LORA=0 unless you have CUDA."
Write-Host "Set EVA_DAILY_TRAIN_PYTHON=$python in .env if needed."
