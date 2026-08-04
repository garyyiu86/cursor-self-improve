"""
Merge a downloaded min-qlora LoRA adapter into Qwen2.5-1.5B-Instruct.

Usage:
  py merge_adapter.py --zip "C:\\Users\\...\\Downloads\\min-qlora.zip"
  py merge_adapter.py --adapter "./output/min-qlora"

Output:
  finetune/output/merged-hf/   (Hugging Face weights for GGUF conversion)
"""

from __future__ import annotations

import argparse
import shutil
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DEFAULT_OUT = ROOT / "output" / "merged-hf"
BASE_MODEL = "Qwen/Qwen2.5-1.5B-Instruct"


def unzip_adapter(zip_path: Path, dest: Path) -> Path:
    if dest.exists():
        shutil.rmtree(dest)
    dest.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(zip_path, "r") as zf:
        zf.extractall(dest)

    # Handle zip that contains files at root or one top folder
    adapter_cfg = list(dest.rglob("adapter_config.json"))
    if not adapter_cfg:
        raise SystemExit(f"No adapter_config.json found inside {zip_path}")
    return adapter_cfg[0].parent


def merge(adapter_dir: Path, out_dir: Path, base_model: str) -> None:
    try:
        import torch
        from peft import PeftModel
        from transformers import AutoModelForCausalLM, AutoTokenizer
    except ModuleNotFoundError as e:
        raise SystemExit(
            "\nMissing ML packages (torch/transformers/peft).\n\n"
            "Your PC only has Python 3.14 — PyTorch usually needs 3.11 or 3.12.\n"
            "Easiest path (recommended): use Colab export instead:\n"
            "  1) Open finetune/export_gguf_colab.ipynb in Google Colab\n"
            "  2) Upload min-qlora.zip\n"
            "  3) Download companion-min-q4_k_m.gguf\n"
            "  4) Put it in finetune/ollama and run register_ollama.ps1\n\n"
            "Or install Python 3.12, then:\n"
            "  py -3.12 -m venv finetune/.venv\n"
            "  .\\finetune\\.venv\\Scripts\\Activate.ps1\n"
            "  pip install -r finetune/requirements-merge.txt\n"
            "  py merge_adapter.py --zip ...\\min-qlora.zip\n"
            f"\nOriginal error: {e}\n"
        ) from e

    print(f"Base: {base_model}")
    print(f"Adapter: {adapter_dir}")
    print(f"Out: {out_dir}")

    tokenizer = AutoTokenizer.from_pretrained(base_model, trust_remote_code=True)
    # CPU merge is fine for 1.5B; use GPU if available
    device_map = "auto" if torch.cuda.is_available() else "cpu"
    dtype = torch.float16 if torch.cuda.is_available() else torch.float32

    base = AutoModelForCausalLM.from_pretrained(
        base_model,
        torch_dtype=dtype,
        device_map=device_map,
        trust_remote_code=True,
    )
    model = PeftModel.from_pretrained(base, str(adapter_dir))
    merged = model.merge_and_unload()

    out_dir.mkdir(parents=True, exist_ok=True)
    merged.save_pretrained(str(out_dir), safe_serialization=True)
    tokenizer.save_pretrained(str(out_dir))
    print("Merged HF model saved.")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--zip", type=Path, help="Path to min-qlora.zip")
    parser.add_argument("--adapter", type=Path, help="Path to extracted adapter folder")
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT)
    parser.add_argument("--base", default=BASE_MODEL)
    args = parser.parse_args()

    if args.zip:
        extract_root = ROOT / "output" / "_unzipped_adapter"
        adapter_dir = unzip_adapter(args.zip, extract_root)
    elif args.adapter:
        adapter_dir = args.adapter
        if not (adapter_dir / "adapter_config.json").exists():
            found = list(adapter_dir.rglob("adapter_config.json"))
            if not found:
                raise SystemExit("adapter_config.json not found")
            adapter_dir = found[0].parent
    else:
        raise SystemExit("Provide --zip or --adapter")

    merge(adapter_dir, args.out, args.base)
    print("\nNext: convert to GGUF (see export_gguf_colab.ipynb or convert_gguf.py)")


if __name__ == "__main__":
    main()
