# Merge peft adapter -> HF, convert GGUF, ollama create.
#   npm run eva:merge-lora
# Assumes adapter already trained (training/out/eva-lora-peft).
# Merged HF may already exist; pass -SkipMerge to only convert+ollama.
param(
  [string]$Adapter = "training\out\eva-lora-peft",
  [string]$Merged = "training\out\eva-lora-merged",
  [string]$Gguf = "training\out\eva-lora-f16.gguf",
  [string]$OllamaName = "eva-lora",
  [switch]$SkipMerge,
  [switch]$SkipOllama
)

$ErrorActionPreference = "Stop"
$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $RepoRoot

$py = Join-Path $RepoRoot ".venv-lora\Scripts\python.exe"
if (-not (Test-Path $py)) { throw "Missing $py - run npm run eva:setup-lora-venv" }

$adapterPath = Join-Path $RepoRoot $Adapter
$mergedPath = Join-Path $RepoRoot $Merged
$ggufPath = Join-Path $RepoRoot $Gguf
$llamaCpp = Join-Path $RepoRoot "training\tools\llama.cpp"
$convertPy = Join-Path $llamaCpp "convert_hf_to_gguf.py"

if (-not $SkipMerge) {
  Write-Host "=== 1) Merge LoRA -> HF ==="
  & $py (Join-Path $RepoRoot "training\merge_lora_peft.py") --adapter $adapterPath --out $mergedPath
  if ($LASTEXITCODE -ne 0) { throw "merge failed" }
} else {
  Write-Host "=== 1) Skip merge (using $mergedPath) ==="
  if (-not (Test-Path (Join-Path $mergedPath "config.json"))) {
    throw "Merged model missing: $mergedPath"
  }
}

Write-Host "=== 2) Ensure llama.cpp convert script ==="
$needClone = -not (Test-Path $convertPy) -or -not (Test-Path (Join-Path $llamaCpp "conversion"))
if ($needClone) {
  New-Item -ItemType Directory -Force -Path (Join-Path $RepoRoot "training\tools") | Out-Null
  if (Test-Path $llamaCpp) { Remove-Item -Recurse -Force $llamaCpp }
  Write-Host "Cloning llama.cpp (shallow, full tree)..."
  git clone --depth 1 https://github.com/ggerganov/llama.cpp.git $llamaCpp
}

Write-Host "Installing convert deps into venv..."
& $py -m pip install -q "gguf>=0.10" sentencepiece protobuf
$env:PYTHONPATH = "$(Join-Path $llamaCpp 'gguf-py');$env:PYTHONPATH"

Write-Host "=== 3) Convert HF -> GGUF (f16) ==="
& $py $convertPy $mergedPath --outfile $ggufPath --outtype f16
if ($LASTEXITCODE -ne 0) { throw "GGUF convert failed" }

$modelfile = Join-Path $RepoRoot "training\out\Modelfile.eva-lora"
# Use forward slashes for Ollama Modelfile path compatibility on Windows
$ggufForModelfile = $ggufPath -replace '\\', '/'
@"
FROM $ggufForModelfile
PARAMETER temperature 0.6
PARAMETER top_p 0.9
PARAMETER num_ctx 4096
SYSTEM """你是 Eva，桌面／手機伴侶助手。用自然、口語化的繁體中文回答。回答要準確、簡潔；不確定時說明不確定。事實優先依據知識庫與搜尋結果。"""
"@ | Set-Content -Path $modelfile -Encoding ascii

if ($SkipOllama) {
  Write-Host "Skip ollama create. GGUF=$ggufPath Modelfile=$modelfile"
  exit 0
}

Write-Host "=== 4) ollama create $OllamaName ==="
$ollama = Get-Command ollama -ErrorAction SilentlyContinue
if (-not $ollama) { throw "ollama not in PATH" }
& ollama create $OllamaName -f $modelfile
if ($LASTEXITCODE -ne 0) { throw "ollama create failed" }

Write-Host "OK: ollama model '$OllamaName'"
Write-Host "Set in .env: OLLAMA_MODEL=$OllamaName"
Write-Host "Then restart eva:server / overlay"
