# Register fine-tuned GGUF as Ollama model companion-min
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

if (-not (Get-Command ollama -ErrorAction SilentlyContinue)) {
  Write-Error "ollama not found in PATH. Install from https://ollama.com/download"
}

$gguf = $null
foreach ($name in @("companion-min-q8_0.gguf", "companion-min-q4_k_m.gguf", "companion-min-f16.gguf")) {
  if (Test-Path ".\$name") { $gguf = $name; break }
}
if (-not $gguf) {
  Write-Error "Missing GGUF. Put companion-min-q8_0.gguf (or q4/f16) in this folder."
}

@"
FROM ./$gguf

SYSTEM """You are a friendly desktop companion. Keep replies short and warm."""

PARAMETER temperature 0.7
PARAMETER top_p 0.9
PARAMETER stop "<|im_end|>"
PARAMETER stop "<|endoftext|>"
"@ | Set-Content -Path .\Modelfile -Encoding utf8

Write-Host "Creating Ollama model: companion-min (FROM $gguf)"
ollama create companion-min -f .\Modelfile
Write-Host "Testing..."
ollama run companion-min "Hi"
Write-Host "Done. Ensure .env has:`nOLLAMA_MODEL=companion-min`nOLLAMA_HOST=http://127.0.0.1:11434"
