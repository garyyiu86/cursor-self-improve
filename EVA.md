# Eva — PC BE + shared FE (Electron / Android)

Shared architecture:

- **`eva-core`** — ask pipeline + HTTP/SSE API on `:8787`
- **`eva-web`** — Vite chat UI (PC + Android)
- **`overlay/`** — Electron shell (mascot, tray, drag, Apply with Cursor)
- **`eva-mobile/`** — Capacitor Android APK

```
Electron / Android APK
        │  HTTP + SSE (+ Bearer token)
        ▼
   eva-core :8787  →  Ollama (127.0.0.1) / Postgres KB / Tavily
```

## Quick start (PC)

1. Copy `.env.example` → `.env` and set keys. **Set a stable token:**

```env
EVA_API_TOKEN=change-me-local-token
EVA_API_PORT=8787
EVA_API_HOST=0.0.0.0
```

2. Start KB (optional) and build the web UI:

```bash
npm run kb:up
npm run kb:init
npm run eva:web:build
```

3. Run the desktop companion (embeds API + loads `eva-web/dist`):

```bash
npm run overlay
```

Or run API alone (phone / headless):

```bash
npm run eva:server
```

### 常識自問自答（擴 KB，唔 fine-tune）

Postgres + `TAVILY_API_KEY` 要就緒。Eva 會由種子題／主題 **自問**，用 Tavily **查證後寫入 KB**：

```bash
npm run kb:up
npm run kb:init
npm run eva:self-drill
# 無限循環（每輪 LLM 出新題，Ctrl+C 停）:
# npm run eva:self-drill -- --infinite
# 一次過唔截斷 / 少啲題:
# npm run eva:self-drill -- --limit 0
# npm run eva:self-drill -- --limit 5 --no-llm
```

題庫：`overlay/data/self-drill-common-sense.txt`（`Q:` = 現成問題；其他行 = 主題畀 LLM 擴）。

### KB + LoRA（兩層同時）

1. 充 KB：`npm run eva:self-drill -- --infinite`
2. 匯出訓練集：`npm run eva:export-train` → `training/data/*.jsonl`
3. 另開 Python venv 做 LoRA（見 [`training/README.md`](training/README.md)）
4. `ollama create` 後設 `OLLAMA_MODEL=eva-lora`，**保持** `EVA_USE_KB=1`

每日 06:00 自動 export（可選 LoRA）：

```bash
npm run eva:schedule-train
# 試跑：npm run eva:daily-train
```

詳見 [`training/README.md`](training/README.md) §5。

Dev hot-reload for UI:

```bash
npm run eva:web:dev
# other terminal:
# set EVA_WEB_URL=http://127.0.0.1:5173 && npm run overlay
```

## Android APK (local install)

### Prerequisites

- Android Studio (SDK + platform tools)
- JDK 17+
- Phone and PC on the **same Wi‑Fi**
- Windows Firewall: allow inbound **TCP 8787** (Private networks)

Find your PC LAN IP (PowerShell):

```powershell
Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -notlike '127.*' }
```

### Build & install

```bash
npm run eva:web:build
npm run eva:mobile:sync
npm run eva:mobile:open
```

In Android Studio:

1. Connect the phone (USB debugging on) or pick an emulator
2. **Run** ▸ app, or **Build** ▸ Build Bundle(s) / APK(s) ▸ Build APK(s)
3. Install the APK (USB or copy `android/app/build/outputs/apk/...`)

Cleartext HTTP to the PC is enabled via `android:usesCleartextTraffic` + `network_security_config.xml` (LAN-only; not for Play Store).

### First launch (in-app settings)

1. Open **設定**
2. Base URL: `http://<PC-LAN-IP>:8787`
3. Token: same as `EVA_API_TOKEN` in `.env`
4. Tap **測試連線** → should show `OK`
5. **儲存** → chat + history sync with the PC

## Cloudflare Tunnel (public HTTPS → your PC)

Use this when the phone is **not** on the same Wi‑Fi (or you want HTTPS). The API still runs on your PC; Cloudflare only forwards traffic. Ollama / Postgres stay local.

### One-time install

```powershell
winget install --id Cloudflare.cloudflared -e
```

Reopen the terminal after install so `cloudflared` is on `PATH`.

### Run

1. Start the API (keep it running):

```bash
npm run eva:server
# or: npm run overlay
```

2. In another terminal:

```bash
npm run eva:tunnel
```

3. Copy the printed URL, e.g. `https://xxxx.trycloudflare.com` (no trailing path).

4. On the phone → **設定**:
   - PC 位址: that `https://….trycloudflare.com` URL
   - Token: same as `EVA_API_TOKEN` in `.env`
   - **測試連線** → OK → **儲存**

Quick tunnels give a **new URL each time** you restart `eva:tunnel`. Keep the tunnel window open while chatting.

### Security

- Use a strong, stable `EVA_API_TOKEN` (anyone with the URL + token can call your API).
- Stop the tunnel when you are done.
- For a fixed hostname, create a named tunnel in the Cloudflare Zero Trust dashboard (optional; needs a Cloudflare account + domain).

## API (Bearer)

All routes require `Authorization: Bearer <EVA_API_TOKEN>`.

| Method | Path | Notes |
|--------|------|--------|
| GET | `/api/health` | `{ ok, kb }` |
| POST | `/api/chat` | body `{ messages }`, SSE stages: kb/search/think/stream → `answer` → `done` |
| GET/PUT/DELETE | `/api/history` | shared server-side history |
| GET/PATCH | `/api/prefs` | e.g. `{ replyLanguage }` |

Example health check:

```powershell
$token = "change-me-local-token"
Invoke-RestMethod -Headers @{ Authorization = "Bearer $token" } http://127.0.0.1:8787/api/health
```

## Verify chat / history / stream

1. Start `npm run eva:server` (or `npm run overlay`)
2. PC: open Eva overlay → send a message → watch streamed progress, then final reply
3. Phone: same Wi‑Fi + settings → send another message
4. Confirm **history** matches on both (Clear on one clears the shared server file under `overlay/data/chat-history.json`)
5. Confirm SSE progress tips appear while thinking/streaming

## Scripts

| Script | Purpose |
|--------|---------|
| `npm run eva:server` | HTTP API only |
| `npm run eva:web:build` | Build shared UI → `eva-web/dist` |
| `npm run eva:web:dev` | Vite dev server |
| `npm run overlay` | Electron + embedded API + eva-web |
| `npm run eva:mobile:sync` | Build web + Capacitor sync |
| `npm run eva:mobile:open` | Open Android Studio project |
| `npm run eva:tunnel` | Cloudflare quick tunnel → local `:8787` |
| `npm run eva:self-drill` | 常識自問 → Tavily 查證 → 寫入 KB |
| `npm run eva:export-train` | 匯出 JSONL（`--mode personal` 偏人設） |
| `npm run eva:train-lora` | peft LoRA 訓練 |
| `npm run eva:merge-lora` | Merge LoRA → GGUF → ollama create |
| `npm run eva:backup-kb` | Dump KB → `backups/kb/` + commit + push |
| `npm run eva:schedule-kb-backup` | 註冊／取消每日 **16:00** KB backup 排程 |
| `npm run eva:daily-train` | 每日腳本：export（+ 可選 LoRA） |
| `npm run eva:schedule-train` | 註冊／取消 Windows 06:00 排程 |

## Out of scope (this phase)

- Browser / PWA as the primary mobile UX
- Cloud-hosted BE / on-phone Ollama
- Apply-with-Cursor on Android
- Play Store release
