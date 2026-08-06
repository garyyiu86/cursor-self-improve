# Eva local LoRA pipeline (KB + fine-tune)

Eva **同時**用兩層：

1. **KB / RAG**（即時）— `eva:self-drill`、傾偈寫入 Postgres  
2. **LoRA**（批次）— 由 KB 匯出 → 訓練 adapter → 轉 GGUF → `ollama create`

日常答問題仍然會查 KB；LoRA 主要學語氣／答法習慣，唔好指望單靠 LoRA 記晒所有事實。

## 匯出訓練集（可偏個性化）

```bash
npm run eva:export-train -- --mode personal   # 預設：persona + chat + style seeds
npm run eva:export-train -- --mode mixed      # 個性為主 + 少量 KB 事實
npm run eva:export-train -- --mode kb         # 淨知識庫
```

資料來源：`overlay/data/persona.txt`（或 seed）、chat history、`training/data/eva-style-seeds.jsonl`。

## Google Colab（免費 GPU）

1. 本機先：`npm run eva:export-train` → 得到 `training/data/eva-kb-alpaca-*.jsonl`
2. 開 [Google Colab](https://colab.research.google.com/)（要 Google 帳戶）
3. **Runtime → Change runtime type → Hardware accelerator → T4 GPU（或 GPU）→ Save**
4. 上傳 repo 入面 `training/colab_eva_lora.ipynb`，或 File → Upload notebook
5. 跑完 cell，下載 `eva-lora-peft.zip`
6. 解壓到本機 `training/out/eva-lora-peft/`，再 `npm run eva:merge-lora`

### 免費額注意
- GPU **唔保證**每次都有；繁忙可能變成 CPU／要等
- 閒置會斷線；長 train 要留意 session
- 有每日／週配額限制（官方唔公開精確數字，用盡會提示）
- **唔好**上傳含私隱嘅 chat；只用 KB export 嘅常識題較安全
- 想穩陣啲可考慮 Colab Pro（月費）

詳細步驟同 notebook：`training/colab_eva_lora.ipynb`


匯出檔：

- `training/data/eva-kb-alpaca-YYYYMMDD.jsonl` — Alpaca  
- `training/data/eva-kb-alpaca-YYYYMMDD.sharegpt.jsonl` — ShareGPT  
- `training/data/eva-export-meta.json`

## 1. 訓練 LoRA（另開 Python venv）

已可用一鍵建 venv（Python 3.12 + torch/peft/transformers；**唔包 Unsloth**）：

```bash
npm run eva:setup-lora-venv
```

路徑：`.venv-lora\Scripts\python.exe`（daily script 預設會搵呢個）。

**硬件：** Unsloth／實用 8B LoRA 需要 **NVIDIA CUDA**。若只有 Intel UHD，請保持 `EVA_DAILY_TRAIN_LORA=0`（每日只 export）；LoRA 留待有獨顯／雲端 GPU／WSL+CUDA 先開。

手動：

```bash
# WSL2 或獨立環境
python -m venv .venv-lora
source .venv-lora/bin/activate   # Windows: .venv-lora\Scripts\activate
pip install -U pip
pip install -r training/requirements-lora.txt
# NVIDIA + Unsloth：跟官方 install 指示另裝
```

把 `training/train_lora_peft.py` 用（唔使 Unsloth）：

```bash
npm run eva:export-train
npm run eva:train-lora -- -MaxSteps 10
# 更大（好慢，CPU）：
# npm run eva:train-lora -- -MaxSteps 30 -Base Qwen/Qwen2.5-3B-Instruct
```

產出：`training/out/eva-lora-peft/`

亦可用舊 Unsloth 模板 `training/train_lora.example.py`（要 NVIDIA）。

## 2. 合併／轉 GGUF → Ollama

```bash
npm run eva:merge-lora
# 若 HF 已 merge 好，只轉 GGUF + ollama：
# npm run eva:merge-lora -- -SkipMerge
```

會產出：

- `training/out/eva-lora-merged/`（HF）
- `training/out/eva-lora-f16.gguf`
- Ollama 模型 **`eva-lora`**

然後 `.env`：

```env
EVA_LLM=ollama
OLLAMA_MODEL=eva-lora
```

重開 `eva:server`／`overlay`。保持 `EVA_USE_KB=1`。

亦可用 [LLaMA-Factory](https://github.com/hiyouga/LLaMA-Factory) 做訓練；merge 仍可用上面指令。

## 3. 指 Eva 用新 model

`.env`：

```env
EVA_LLM=ollama
OLLAMA_MODEL=eva-lora
```

重開 `npm run eva:server` / `overlay`。  
**KB 繼續開住**（`EVA_USE_KB=1`）— 兩層一齊先係設計目標。

## 4. 建議節奏

| 頻率 | 做咩 |
|------|------|
| 每日／背景 | `eva:self-drill`、正常傾偈 → 充 KB |
| 每週／有幾百新樣本 | `eva:export-train` → LoRA → 換 `OLLAMA_MODEL` |
| 永遠 | 事實以 KB／搜尋為準；LoRA 唔好學冇查證嘅幻覺 |

## 5. 每日自動（Windows 06:00）

```bash
# 註冊工作排程（每日 06:00）
npm run eva:schedule-train

# 改時間／喚醒睡眠中嘅 PC：
# npm run eva:schedule-train -- -Time 06:00 -WakeToRun

# 即刻試跑一次
npm run eva:daily-train

# 取消排程
npm run eva:schedule-train -- -Unregister
```

預設每日只做 **export**（唔自動 LoRA，慳電、亦唔使裝好 Python）。要一併 train：

```env
EVA_DAILY_TRAIN_LORA=1
EVA_DAILY_TRAIN_MIN_EXAMPLES=50
# EVA_DAILY_TRAIN_PYTHON=C:\path\to\.venv-lora\Scripts\python.exe
```

日誌：`training/logs/daily-train-*.log`  
注意：merge → GGUF → `ollama create` **未**自動；LoRA adapter 出嚟後仍要跟上面第 2–3 步（或之後再加）。PC 要喺 6 點開住（或加 `-WakeToRun`）。

## 安全

- `training/data/*.jsonl`、`training/out/` 可能含私人對話摘要 — 已喺 `.gitignore`  
- 唔好把未清洗嘅 raw chat 直接 fine-tune
