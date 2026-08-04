"""
Convert merged HF model to GGUF for Ollama.

Requires llama.cpp convert script. Example:

  git clone --depth 1 https://github.com/ggerganov/llama.cpp
  pip install -r llama.cpp/requirements.txt
  py convert_gguf.py --merged ./output/merged-hf --llama-cpp ./llama.cpp

Or use export_gguf_colab.ipynb (easier — runs on Colab and downloads the .gguf).
"""

from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--merged", type=Path, default=ROOT / "output" / "merged-hf")
    parser.add_argument("--llama-cpp", type=Path, required=True, help="Path to llama.cpp repo")
    parser.add_argument("--out", type=Path, default=ROOT / "ollama" / "companion-min-q4_k_m.gguf")
    parser.add_argument("--outtype", default="q4_k_m")
    args = parser.parse_args()

    convert = args.llama_cpp / "convert_hf_to_gguf.py"
    if not convert.exists():
        # older layouts
        alt = args.llama_cpp / "convert_hf_to_gguf.py"
        convert = alt if alt.exists() else convert
    if not convert.exists():
        raise SystemExit(f"convert_hf_to_gguf.py not found under {args.llama_cpp}")

    if not args.merged.exists():
        raise SystemExit(f"Merged model not found: {args.merged}")

    args.out.parent.mkdir(parents=True, exist_ok=True)
    cmd = [
        sys.executable,
        str(convert),
        str(args.merged),
        "--outfile",
        str(args.out),
        "--outtype",
        args.outtype,
    ]
    print("Running:", " ".join(cmd))
    subprocess.check_call(cmd)
    print("GGUF written to", args.out)
    print("Next: .\\register_ollama.ps1")


if __name__ == "__main__":
    main()
