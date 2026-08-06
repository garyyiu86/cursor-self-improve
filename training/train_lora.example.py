#!/usr/bin/env python3
"""
Example LoRA train script (Unsloth).

Install Unsloth + torch in a separate venv first (see training/README.md).
This file is a template — pin versions yourself; Unsloth APIs change often.

  python training/train_lora.example.py --data training/data/eva-kb-alpaca-YYYYMMDD.jsonl
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path


def load_alpaca_jsonl(path: Path) -> list[dict]:
    rows = []
    with path.open(encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            rows.append(json.loads(line))
    return rows


def main() -> None:
    parser = argparse.ArgumentParser(description="Eva KB → LoRA (Unsloth example)")
    parser.add_argument("--data", required=True, help="Alpaca JSONL from eva:export-train")
    parser.add_argument("--base", default="unsloth/Meta-Llama-3.1-8B-Instruct-bnb-4bit")
    parser.add_argument("--out", default="training/out/eva-lora")
    parser.add_argument("--max-steps", type=int, default=60)
    parser.add_argument("--lr", type=float, default=2e-4)
    args = parser.parse_args()

    data_path = Path(args.data)
    if not data_path.is_file():
        raise SystemExit(f"Missing data file: {data_path}")

    rows = load_alpaca_jsonl(data_path)
    if len(rows) < 20:
        print(f"WARNING: only {len(rows)} rows — LoRA may overfit or do nothing useful.")

    try:
        from unsloth import FastLanguageModel
        from datasets import Dataset
        from trl import SFTTrainer
        from transformers import TrainingArguments
    except ImportError as e:
        raise SystemExit(
            "Unsloth/trl/datasets not installed. Use a dedicated venv — see training/README.md\n"
            f"Import error: {e}"
        ) from e

    max_seq_length = 2048
    model, tokenizer = FastLanguageModel.from_pretrained(
        model_name=args.base,
        max_seq_length=max_seq_length,
        load_in_4bit=True,
    )
    model = FastLanguageModel.get_peft_model(
        model,
        r=16,
        target_modules=[
            "q_proj",
            "k_proj",
            "v_proj",
            "o_proj",
            "gate_proj",
            "up_proj",
            "down_proj",
        ],
        lora_alpha=16,
        lora_dropout=0,
        bias="none",
        use_gradient_checkpointing="unsloth",
    )

    def fmt(example: dict) -> dict:
        system = example.get("system") or ""
        instruction = example.get("instruction") or ""
        output = example.get("output") or ""
        text = (
            f"<|begin_of_text|><|start_header_id|>system<|end_header_id|>\n\n"
            f"{system}<|eot_id|><|start_header_id|>user<|end_header_id|>\n\n"
            f"{instruction}<|eot_id|><|start_header_id|>assistant<|end_header_id|>\n\n"
            f"{output}<|eot_id|>"
        )
        return {"text": text}

    ds = Dataset.from_list(rows).map(fmt)

    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)

    trainer = SFTTrainer(
        model=model,
        tokenizer=tokenizer,
        train_dataset=ds,
        dataset_text_field="text",
        max_seq_length=max_seq_length,
        packing=False,
        args=TrainingArguments(
            per_device_train_batch_size=2,
            gradient_accumulation_steps=4,
            warmup_steps=5,
            max_steps=args.max_steps,
            learning_rate=args.lr,
            fp16=True,
            logging_steps=1,
            output_dir=str(out_dir),
            optim="adamw_8bit",
            seed=42,
        ),
    )
    trainer.train()
    model.save_pretrained(str(out_dir))
    tokenizer.save_pretrained(str(out_dir))
    print(f"Saved LoRA adapter → {out_dir}")
    print("Next: merge + convert to GGUF, then ollama create -f training/Modelfile.example")


if __name__ == "__main__":
    main()
