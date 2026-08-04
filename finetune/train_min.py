"""
Minimum QLoRA fine-tune for ~8GB VRAM notebooks.

Default model: Qwen2.5-1.5B-Instruct (4-bit) — safer than 7B on 8GB.
Needs: NVIDIA GPU + CUDA PyTorch. AMD / Intel iGPU will not work with this script.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DEFAULT_DATA = ROOT / "data" / "min_chat.jsonl"
DEFAULT_OUT = ROOT / "output" / "min-qlora"


def check_cuda() -> None:
    import torch

    print(f"PyTorch: {torch.__version__}")
    if not torch.cuda.is_available():
        print(
            "\nNo CUDA GPU detected.\n"
            "This minimum fine-tune needs an NVIDIA GPU with CUDA PyTorch.\n"
            "If your notebook only has Intel/AMD graphics, use cloud GPU (Colab) or skip fine-tuning.\n"
        )
        sys.exit(1)

    props = torch.cuda.get_device_properties(0)
    total_gb = props.total_memory / (1024**3)
    print(f"GPU: {props.name}")
    print(f"VRAM: {total_gb:.1f} GB")
    if total_gb < 5.5:
        print("Warning: <6GB VRAM — training may OOM. Try a cloud GPU.")
    elif total_gb < 8.5:
        print("8GB-class GPU detected — using tiny 1.5B QLoRA settings.")


def load_rows(path: Path) -> list[dict]:
    rows = []
    with path.open(encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            rows.append(json.loads(line))
    if not rows:
        raise SystemExit(f"No training rows in {path}")
    return rows


def main() -> None:
    parser = argparse.ArgumentParser(description="Minimum 8GB-friendly QLoRA fine-tune")
    parser.add_argument(
        "--model",
        default="Qwen/Qwen2.5-1.5B-Instruct",
        help="HF model id (keep 1.5B–3B for 8GB)",
    )
    parser.add_argument("--data", type=Path, default=DEFAULT_DATA)
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT)
    parser.add_argument("--epochs", type=float, default=1.0)
    parser.add_argument("--max-seq-len", type=int, default=512)
    parser.add_argument("--check-only", action="store_true", help="Only check GPU and exit")
    args = parser.parse_args()

    check_cuda()
    if args.check_only:
        return

    import torch
    from datasets import Dataset
    from peft import LoraConfig, TaskType
    from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig
    from trl import SFTConfig, SFTTrainer

    # T4 / older GPUs: avoid fp16 GradScaler + bf16 weights crash
    use_bf16 = torch.cuda.get_device_capability(0)[0] >= 8
    compute_dtype = torch.bfloat16 if use_bf16 else torch.float16
    print(f"use_bf16={use_bf16} compute_dtype={compute_dtype}")

    rows = load_rows(args.data)
    print(f"Examples: {len(rows)} from {args.data}")

    bnb = BitsAndBytesConfig(
        load_in_4bit=True,
        bnb_4bit_quant_type="nf4",
        bnb_4bit_use_double_quant=True,
        bnb_4bit_compute_dtype=compute_dtype,
    )

    tokenizer = AutoTokenizer.from_pretrained(args.model, trust_remote_code=True)
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token

    model = AutoModelForCausalLM.from_pretrained(
        args.model,
        quantization_config=bnb,
        device_map="auto",
        trust_remote_code=True,
        torch_dtype=compute_dtype,
    )
    model.config.use_cache = False

    def to_text(example: dict) -> dict:
        text = tokenizer.apply_chat_template(
            example["messages"],
            tokenize=False,
            add_generation_prompt=False,
        )
        return {"text": text}

    dataset = Dataset.from_list(rows).map(to_text)

    peft_config = LoraConfig(
        r=8,
        lora_alpha=16,
        lora_dropout=0.05,
        bias="none",
        task_type=TaskType.CAUSAL_LM,
        target_modules=["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"],
    )

    import inspect

    args.out.mkdir(parents=True, exist_ok=True)

    # Newer TRL uses max_length; older used max_seq_length
    sft_kwargs = dict(
        output_dir=str(args.out),
        num_train_epochs=args.epochs,
        per_device_train_batch_size=1,
        gradient_accumulation_steps=4,
        learning_rate=2e-4,
        logging_steps=1,
        save_strategy="epoch",
        fp16=False,
        bf16=use_bf16,
        optim="paged_adamw_8bit",
        warmup_ratio=0.03,
        lr_scheduler_type="cosine",
        report_to=[],
        dataset_text_field="text",
        packing=False,
    )
    sig = inspect.signature(SFTConfig.__init__).parameters
    if "max_length" in sig:
        sft_kwargs["max_length"] = args.max_seq_len
    elif "max_seq_length" in sig:
        sft_kwargs["max_seq_length"] = args.max_seq_len

    sft_args = SFTConfig(**sft_kwargs)

    trainer_kwargs = dict(
        model=model,
        args=sft_args,
        train_dataset=dataset,
        peft_config=peft_config,
    )
    trainer_sig = inspect.signature(SFTTrainer.__init__).parameters
    if "processing_class" in trainer_sig:
        trainer_kwargs["processing_class"] = tokenizer
    else:
        trainer_kwargs["tokenizer"] = tokenizer

    trainer = SFTTrainer(**trainer_kwargs)

    if not use_bf16:
        for _, p in trainer.model.named_parameters():
            if p.requires_grad and p.dtype == torch.bfloat16:
                p.data = p.data.to(torch.float32)

    print("Starting minimum training...")
    trainer.train()
    trainer.save_model(str(args.out))
    tokenizer.save_pretrained(str(args.out))
    print(f"\nDone. LoRA adapter saved to: {args.out}")
    print("Next: merge/export for Ollama later (not included in this minimum step).")


if __name__ == "__main__":
    main()
