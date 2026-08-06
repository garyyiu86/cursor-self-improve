#!/usr/bin/env python3
"""
Merge peft LoRA adapter into base HF weights.

  .\\.venv-lora\\Scripts\\python.exe training\\merge_lora_peft.py ^
    --adapter training\\out\\eva-lora-peft ^
    --out training\\out\\eva-lora-merged
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path


def main() -> None:
    parser = argparse.ArgumentParser(description="Merge Eva peft LoRA -> full HF model")
    parser.add_argument("--adapter", default="training/out/eva-lora-peft")
    parser.add_argument("--base", default="", help="Override base model id (else read adapter_config)")
    parser.add_argument("--out", default="training/out/eva-lora-merged")
    args = parser.parse_args()

    adapter = Path(args.adapter)
    cfg_path = adapter / "adapter_config.json"
    if not cfg_path.is_file():
        raise SystemExit(f"Missing {cfg_path}")

    cfg = json.loads(cfg_path.read_text(encoding="utf-8"))
    base = (args.base or cfg.get("base_model_name_or_path") or "").strip()
    if not base:
        raise SystemExit("No base model in adapter_config; pass --base")

    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)

    import torch
    from peft import PeftModel
    from transformers import AutoModelForCausalLM, AutoTokenizer

    print(f"base={base}")
    print(f"adapter={adapter}")
    print(f"out={out}")

    tokenizer = AutoTokenizer.from_pretrained(adapter, trust_remote_code=True)
    model = AutoModelForCausalLM.from_pretrained(
        base,
        trust_remote_code=True,
        dtype=torch.float32,
        low_cpu_mem_usage=True,
    )
    model = PeftModel.from_pretrained(model, str(adapter))
    print("Merging…")
    merged = model.merge_and_unload()
    print("Saving…")
    merged.save_pretrained(str(out), safe_serialization=True)
    tokenizer.save_pretrained(str(out))
    meta = {
        "base": base,
        "adapter": str(adapter.resolve()),
        "out": str(out.resolve()),
    }
    (out / "eva-merge-meta.json").write_text(json.dumps(meta, indent=2), encoding="utf-8")
    print(f"OK merged -> {out}")


if __name__ == "__main__":
    main()
