#!/usr/bin/env python3
"""
LoRA via peft + transformers + trl (no Unsloth / NVIDIA optional).

Smoke on CPU with 0.5B; full 3B needs patience or a CUDA GPU.

  .\\.venv-lora\\Scripts\\python.exe training\\train_lora_peft.py ^
    --data training\\data\\eva-kb-alpaca-YYYYMMDD.jsonl ^
    --max-steps 10
"""
from __future__ import annotations

import argparse
import json
import os
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
    parser = argparse.ArgumentParser(description="Eva KB -> LoRA (peft, CPU-ok)")
    parser.add_argument("--data", required=True, help="Alpaca JSONL from eva:export-train")
    parser.add_argument(
        "--base",
        default=os.environ.get("EVA_LORA_BASE", "Qwen/Qwen2.5-0.5B-Instruct"),
        help="HF model id (0.5B recommended on CPU)",
    )
    parser.add_argument("--out", default="training/out/eva-lora-peft")
    parser.add_argument("--max-steps", type=int, default=10)
    parser.add_argument("--lr", type=float, default=2e-4)
    parser.add_argument(
        "--max-seq-length",
        type=int,
        default=int(os.environ.get("EVA_LORA_MAX_SEQ", "512")),
    )
    parser.add_argument(
        "--threads",
        type=int,
        default=int(os.environ.get("EVA_LORA_THREADS", "0")),
        help="Limit CPU threads (0=auto). Lower = PC more usable, slower train.",
    )
    parser.add_argument(
        "--fast",
        action="store_true",
        help="Shorter sequences (256) for quicker CPU smoke runs",
    )
    args = parser.parse_args()
    if args.fast and args.max_seq_length > 256:
        args.max_seq_length = 256

    data_path = Path(args.data)
    if not data_path.is_file():
        raise SystemExit(f"Missing data file: {data_path}")

    rows = load_alpaca_jsonl(data_path)
    if len(rows) < 5:
        raise SystemExit(f"Need at least 5 examples, got {len(rows)}")
    if len(rows) < 50:
        print(f"WARNING: only {len(rows)} rows — expect weak / overfit LoRA.")

    import torch
    from datasets import Dataset
    from peft import LoraConfig, get_peft_model
    from transformers import AutoModelForCausalLM, AutoTokenizer
    from trl import SFTConfig, SFTTrainer

    # Cap threads so Eva / desktop stay responsive (trades speed).
    n_threads = args.threads
    if n_threads <= 0:
        # leave ~2 logical cores free when possible
        cpu = os.cpu_count() or 4
        n_threads = max(1, cpu - 2)
    torch.set_num_threads(n_threads)
    torch.set_num_interop_threads(max(1, min(2, n_threads)))
    os.environ.setdefault("OMP_NUM_THREADS", str(n_threads))
    os.environ.setdefault("MKL_NUM_THREADS", str(n_threads))

    use_cuda = torch.cuda.is_available()
    dtype = torch.float16 if use_cuda else torch.float32
    print(
        f"device cuda={use_cuda} base={args.base} steps={args.max_steps} "
        f"n={len(rows)} seq={args.max_seq_length} threads={n_threads}"
    )

    tokenizer = AutoTokenizer.from_pretrained(args.base, trust_remote_code=True)
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token

    model = AutoModelForCausalLM.from_pretrained(
        args.base,
        trust_remote_code=True,
        dtype=dtype,
        low_cpu_mem_usage=True,
    )
    if not use_cuda:
        model = model.to("cpu")

    peft_config = LoraConfig(
        r=8,
        lora_alpha=16,
        lora_dropout=0.05,
        bias="none",
        task_type="CAUSAL_LM",
        target_modules=["q_proj", "k_proj", "v_proj", "o_proj"],
    )
    model = get_peft_model(model, peft_config)
    model.print_trainable_parameters()

    def to_text(example: dict) -> dict:
        system = str(example.get("system") or "")
        instruction = str(example.get("instruction") or "")
        output = str(example.get("output") or "")
        return {
            "text": f"System: {system}\nUser: {instruction}\nAssistant: {output}"
        }

    ds = Dataset.from_list(rows).map(to_text, remove_columns=list(rows[0].keys()))

    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)

    sft_args = SFTConfig(
        output_dir=str(out_dir),
        per_device_train_batch_size=1,
        gradient_accumulation_steps=4,
        learning_rate=args.lr,
        max_steps=args.max_steps,
        logging_steps=1,
        save_steps=max(args.max_steps, 1),
        bf16=False,
        fp16=bool(use_cuda),
        optim="adamw_torch",
        report_to=[],
        seed=42,
        dataset_text_field="text",
        max_length=args.max_seq_length,
        packing=False,
        remove_unused_columns=False,
    )

    trainer = SFTTrainer(
        model=model,
        args=sft_args,
        train_dataset=ds,
        processing_class=tokenizer,
    )

    trainer.train()
    trainer.model.save_pretrained(str(out_dir))
    tokenizer.save_pretrained(str(out_dir))
    print(f"Saved LoRA adapter -> {out_dir}")
    print("Next: merge/GGUF/ollama still manual — see training/README.md")


if __name__ == "__main__":
    main()
