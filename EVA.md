# Eva — PC BE + shared FE (Electron / Android)

Shared architecture:

- **`eva-core`** — ask pipeline + HTTP/SSE API on `:8787` (WebSocket `/api/ws` for live chat-history sync + keep-alive reconnect)
- **`eva-web`** — Vite chat UI (PC + Android)
- **`overlay/`** — Electron shell (mascot, tray, drag; nightly auto-evolve)
- **`eva-mobile/`** — Capacitor Android APK

```
Electron / Android APK
        │  HTTP + SSE (+ Bearer token)
        ▼
   eva-core :8787  →  Eva LLM (Ollama / OpenRouter / …)  或  騰訊雲 ADP
```

UI 右上角可切 **Eva** / **騰訊雲**。聊天輸入框：**Enter** 或 **Ctrl/Cmd+Enter** 送出訊息，**Shift+Enter** 換行（IME 組字中唔會誤送）。Eva 回覆右上角有 **↻** 掣，可以重新生成最後一輪回覆（`/api/chat` 亦支援 `{ regenerate: true }` 剝走尾端 assistant 再問）。騰訊雲模式會把最新一句 user 訊息送到 `https://wss.lke.tencentcloud.com/adp/v2/chat`，並每次帶上 Eva 人設（`SystemRole`）。事實題會先查本地 Postgres KB（miss 再 Tavily），把命中資料一併塞進 `SystemRole` 畀 ADP。ConversationId 由本機持久化；Clear 會開新會話。

模型 API 餘額不足（`code:460032`）時，唔會再爆 raw error——`eva-core/fallback-messages.cjs` 統一返回星野玲語氣嘅 fallback 訊息；`chat-service.cjs` / `server.cjs` / `api.js` 會當正常回覆顯示，console 仍保留原始錯誤供 debug。

連續重複相同問候（例如連續三次「hi」）時，`eva-core/dialogue-service.cjs` 會喺 LLM 之前識別模式，第 2 次起改用分層引導回覆（唔再重複自我介紹），引導用戶講今日想傾啲咩；一般非重複對話不受影響。

### 自動進化（騰訊雲想 → Cursor 改）

Chatbox **冇** Apply / 自動進化掣。**而家冇開每晚自動進化**（token 唔夠）；排程 `EvaNightlyEvolve` 已取消。想再開：`npm run eva:schedule-evolve`。手動跑仍可用 `npm run eva:evolve`。

PC overlay 只有 **傾偈 + 角色**（500×420）。健身／心情／Live 頁面係 Android／完整 web 路由，唔好塞入 overlay 主畫面（會變成白畫面）。Overlay 閒置或睡眠喚醒會自動重載 UI。

每輪可以係一個完整改進（幾個相關檔、必要時開新檔），預設最多 **4** 輪。騰訊雲只准出 **JSON 方案**（唔會當自己寫 code）；超時唔會把 thinking 旁白當答案。唔會 commit；唔准改 `.env`、`overlay/data`、`sample/`、secrets。

完成紀錄寫入：

- `overlay/data/evolve-log.md` — 騰訊原文／指定檔、Cursor 任務、實現唔到原因、diff
- `overlay/data/evolve-log.json` — 同樣資料（機器讀；diff 正文只留 md）
- `overlay/data/evolve-nightly-logs/` — 每晚排程 stdout

```bash
npm run eva:evolve
npm run eva:evolve -- --rounds 4
npm run eva:nightly-evolve          # 同排程一樣嘅腳本，即刻試跑
npm run eva:schedule-evolve         # 註冊每晚 00:00
# npm run eva:schedule-evolve -- -Unregister
```

需要 `.env` 裏同時有 `TENCENT_LKE_APP_KEY` 同 `CURSOR_API_KEY`。Node 連 Cursor 若出現 `UNABLE_TO_VERIFY_LEAF_SIGNATURE`（公司 SSL 掃描），要用系統 CA：`overlay` / `eva:evolve` / `eva:cursor-smoke` 已加 `--use-system-ca`。測 API：`npm run eva:cursor-smoke -- --api-only`。**午夜請唔好喺同一個 repo 開住 Agent 對話**，否則 Cursor 執行器會排隊／冇進度。

Cursor 改 code 用 **本地 SDK 執行器**，同 Cursor IDE 裏面嘅 Agent 對話共用。**只開 IDE 睇檔／手打 code 唔會阻。** 失敗唔會再盲試三輪。可調 `EVA_EVOLVE_CURSOR_GRACE_MS`；唔好隨便開 `EVA_EVOLVE_CURSOR_FORCE=1`（會踢走而家呢個對話）。午夜 PC 要開機（或之後醒返：`StartWhenAvailable`）。想嘗試由睡眠喚醒：`npm run eva:schedule-evolve -- -WakeToRun`。

`.env` 需要：

```env
TENCENT_LKE_APP_KEY=your_app_key
TENCENT_LKE_VISITOR_ID=your_visitor_id
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

Postgres + `TAVILY_API_KEY` 要就緒（Eva 模式）。Eva 會由種子題／主題 **自問**，用 Tavily **查證後寫入 KB**：

```bash
npm run kb:up
npm run kb:init
npm run eva:self-drill
# 騰訊雲出題＋作答（Tavily 有就一併查證；唔強制）:
# npm run eva:self-drill -- --mode tencent
# npm run eva:self-drill -- --mode tencent --infinite
# 無限循環（每輪 LLM 出新題，Ctrl+C 停）:
# npm run eva:self-drill -- --infinite
# 一次過唔截斷 / 少啲題:
# npm run eva:self-drill -- --limit 0
# npm run eva:self-drill -- --limit 5 --no-llm
```

題庫：`overlay/data/self-drill-common-sense.txt`（冇檔會自動建立）。主題行畀 LLM／騰訊雲**自己出題**；`Q:` 係可選現成問題。

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

### 健身訓練計劃（Workout Planner）

Web UI 右上角 **健身** 連結，或 hash route `#/workout`，開啟每週訓練編排頁：

- **`eva-core/services/exerciseLibrary.js`** — 40+ 動作、7 大肌群（二頭／三頭／胸／背／肩／腿／核心），含 LUMINA 偶像 form tips
- **`eva-core/services/workoutPlanner.js`** — 產生 7 日 plan；`biceps` + `beginner` 同 chat 二頭肌線條表完全一致
- **`eva-web/src/pages/WorkoutPlanner.jsx`** — 肌群 selector、難度 toggle、7 日 card
- **`eva-core/services/progressCalculator.js`** — 從 localStorage sessions 計算 PR、重量／容量趨勢、成就、肌群平衡
- **`eva-web/src/pages/WorkoutProgress.jsx`** — `#/workout/progress`：4 張 PR 卡、canvas 重量／容量圖、成就徽章、肌群橫條
- **`eva-web/src/pages/WorkoutDashboard.jsx`** — 訓練紀錄摘要；有數據時連去進度頁
- **`eva-web/src/components/TrainingWeekView.tsx`** + **`TrainingDayCard.tsx`** + **`RestTimer.tsx`** — `#/workout/plans/:id` 訓練日追蹤：逐組 checkbox、日／週進度條；勾選一組後自動開始組間休息計時（預設 60s，±15s 調整）；離開頁面或切換訓練日會暫停；進度存 `localStorage`（`eva-training-day-progress:*`）
- **`#/workout/play`** — 引導式訓練 session（`SessionPlayer.tsx`）：任何訓練日撳「開始訓練 ▶」進入；顯示動作名、第 X/Y 組、「完成呢組」；組間圓形倒數（用該動作 `restSeconds`）+ 蜂鳴；Eva 開場／中場／收工應援；完結 summary（總時長、動作數、Eva 結語）；session 寫入 `eva-workout-sessions`
- API：`GET /api/workout/library`、`GET /api/workout/plan?muscleGroup=biceps&difficulty=beginner`

### 訓練連續打卡（Workout Streak Tracker）

主頁 chat 下方 **`WorkoutTracker`**：顯示今日日期、打勾「完成今日訓練」、`StreakBadge` 火焰連續日數；3／7／14／30 日 milestone 彈 Eva 粵語鼓勵。資料存 `localStorage`（`eva-workout-streak-v1`），刷新唔會丟。

- **`eva-web/src/utils/workoutStorage.ts`** — 日曆 key、streak 計算、milestone 偵測
- **`eva-web/src/components/WorkoutTracker.tsx`** + **`StreakBadge.tsx`** + **`styles/workout.css`**

### 心情日記（Mood & Journal）

Web UI 右上角 **心情** 連結，或 hash route `#/mood`，開啟每日心情打卡同 timeline：

- **`eva-core/services/mood-journal.js`** — localStorage 持久化；`logMood` / `getMoodHistory` / streak / stats / Eva 粵語鼓勵 / 偶像活動建議
- **`eva-web/src/hooks/useMoodJournal.js`** — React state + 每日自動彈 check-in（未打卡時）
- **`eva-web/src/components/MoodCheckIn.jsx`** — 5 級 emoji 選擇、備註、活動 tag、提交後 Eva 回應
- **`eva-web/src/components/MoodTimeline.jsx`** + **`JournalEntry.jsx`** — 按週分組 timeline，「今個禮拜」櫻粉邊框
- **`eva-web/src/components/MoodStreak.jsx`** — 連續打卡、心情分佈、每週趨勢
- 聊天主頁（`#/``）每日首次開啟會自動彈 check-in modal

### Live 應援（Event Countdown & Setlist）

Web UI 右上角 **Live** 連結，或 hash route `#/live`，開啟 LUMINA 演出倒數、setlist 同應援指南：

- **`eva-core/services/event-service.js`** — mock 3–4 場 LUMINA 演出；`getUpcomingEvents` / `getEventById` / `getCountdown` / `getSetlist` / `getCheeringGuide` / `formatCountdownString`（粵語倒數文案）
- **`eva-web/src/hooks/useLiveEvent.js`** — 每秒更新倒數；`selectEvent()` / `refreshCountdown()`
- **`eva-web/src/components/LiveCountdown.jsx`** — flip-card 倒數；今日櫻粉 glow；已過期應援訊息
- **`eva-web/src/components/SetlistViewer.jsx`** — 曲目表（penlight 色、難度、call timing、Encore 分段、應援指南）
- **`eva-web/src/components/EventCard.jsx`** — 演出選擇卡（票務狀態 badge）
- **`eva-web/src/styles/live-event.css`** — 櫻粉 × 星光銀主題
- API：`GET /api/events`、`GET /api/events/:id`

### 推し配對分析（Oshi Match Analyzer）

Web UI 右上角 **配對** 連結，或 hash route `#/oshi`，開啟 LUMINA 偶像配對測驗：

- **`eva-core/services/oshi-matcher.js`** — 5 題粵語 quiz、`LUMINA_MEMBERS`（5 位虛構 member）、`GENRES` / `CHEER_STYLES`；`calculateMatch(answers)` 計 member／genre／style 配對度；`generateOshiCertificate()` 出粵語認證書
- **`eva-core/oshi-match.cjs`** — chat intent「推し配對分析」等關鍵字；回覆 `:::oshi-match:::` 嵌入 CTA
- **`eva-web/src/hooks/useOshiMatch.js`** — quiz state：intro → 5 題 → 計算 → 結果
- **`eva-web/src/components/OshiQuiz.jsx`** — intro 星光動畫、進度條、選項卡 slide 過場、計算中畫面
- **`eva-web/src/components/OshiResult.jsx`** + **`OshiProfileCard.jsx`** — 認證書、profile 卡、genre／style 配對、完整排名
- **`eva-web/src/styles/oshi-match.css`** — 櫻粉 × 星光銀主題

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
5. **儲存** → chat + history sync with the PC (WebSocket with auto-reconnect; falls back to polling if the socket drops)

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
| GET | `/api/health` | `{ ok, kb, chatMode, tencent }` |
| POST | `/api/chat` | body `{ messages }`, SSE stages: kb/search/think/stream → `answer` → `done` |
| GET/PUT/DELETE | `/api/history` | shared server-side history |
| GET/PATCH | `/api/prefs` | e.g. `{ replyLanguage, chatMode }` (`eva` \| `tencent`) |

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
| `npm run eva:evolve` | 騰訊雲出方案 → Cursor 落地（每輪可多數個檔，預設 4 輪） |
| `npm run eva:nightly-evolve` | 即刻跑同午夜排程一樣嘅大型進化 |
| `npm run eva:schedule-evolve` | 註冊／取消每晚 **00:00** 進化排程（而家已取消） |
| `npm run eva:mobile:sync` | Build web + Capacitor sync |
| `npm run eva:mobile:open` | Open Android Studio project |
| `npm run eva:tunnel` | Cloudflare quick tunnel → local `:8787` |
| `npm run eva:self-drill` | 常識自問 → Tavily 查證 → 寫入 KB |
| `npm run eva:export-train` | 匯出 JSONL（`--mode personal` 偏人設） |
| `npm run eva:train-lora` | peft LoRA 訓練 |
| `npm run eva:merge-lora` | Merge LoRA → GGUF → ollama create |
| `npm run kb:up` | Start local Postgres (`eva_kb` on `:5433`) |
| `npm run kb:restore` | Restore `backups/kb/eva_kb_latest.json` into Postgres |
| `npm run eva:backup-kb` | Dump KB → `backups/kb/` + commit + push |
| `npm run eva:schedule-kb-backup` | 註冊／取消每日 **21:00** KB backup 排程 |
| `npm run eva:daily-train` | 每日腳本：export（+ 可選 LoRA） |
| `npm run eva:schedule-train` | 註冊／取消 Windows 06:00 排程 |

## Out of scope (this phase)

- Browser / PWA as the primary mobile UX
- Cloud-hosted BE / on-phone Ollama
- Apply-with-Cursor on Android
- Play Store release
