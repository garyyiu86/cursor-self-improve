ounds"],"cursorPrompt":"Add Today's Guided Workout Session feature to the Eva chat web app. Renders below ExerciseLibrary.\n\n1. Create `eva-web/src/data/weeklyPlan.ts` - Export: `WEEKLY_ROUTINE` array of 7 objects (Mon-Sun). Each: { day: string (e.g. '星期一'), dayCn: string (e.g. '星期一'), type: '輕量日'|'中量日'|'重量日'|'休息日', exercises: { id: string, name: string, nameCn: string, sets: number, reps: number }[] }. Structure matches Eva's generated bicep weekly plan: Mon-light (3 exercises), Tue-medium (4), Wed-light (3), Thu-rest (0), Fri-heavy (4), Sat-medium (4), Sun-rest (0). Export `getTodayRoutine()` returning today's entry based on `new Date().getDay()`. Export `getRoutineByDate(date: Date)` for looking up any day.\n\n2. Create `eva-web/src/components/TodayWorkout.tsx` - Props: none (reads today from weeklyPlan internally). State: completedExercises (Map or Record<string,boolean> from localStorage key 'eva-today-ex-v1'), isSessionComplete (derived: all exercises checked). Shows: day header with type badge (colored: green for light, amber for medium, red for heavy, grey for rest), exercise list with checkboxes. On rest days, show '今日係休息日！好好 recover 吓～' with a toggle to '手動打吓卡：今日有做輕量拉伸'. When all checked, show completion banner with Eva encouragement, and call `logWorkout(todayDateString)` from workoutStorage. On unmount/day change, save exercise state.\n\n3. Create `eva-web/src/components/WeeklyOverview.tsx` - Props: todayRoutine, completedToday (bool
…(truncated)
```
- 實際改動檔：EVA.md, eva-core/ask.cjs, eva-core/evolve.cjs, eva-core/server.cjs, eva-core/tencent-lke.cjs, eva-web/index.html, eva-web/package.json, eva-web/src/api.js, eva-web/src/main.js, eva-web/src/markdown.js, eva-web/src/style.css, overlay/boot.cjs, overlay/main.cjs, eva-core/chat-service.cjs, eva-core/data/, eva-core/dialogue-service.cjs, eva-core/fallback-messages.cjs, eva-core/models/, eva-core/oshi-match.cjs, eva-core/services/, eva-core/training-plan.cjs, eva-web/src/App.jsx, eva-web/src/App.tsx, eva-web/src/chat-ui.js, eva-web/src/components/, eva-web/src/data/, eva-web/src/hooks/, eva-web/src/main.jsx, eva-web/src/pages/, eva-web/src/services/, eva-web/src/styles/, eva-web/src/utils/
- 已還原：env.example
- diff stat：
```
EVA.md                   |  62 ++++++++-
 eva-core/ask.cjs         |  81 +++++++++++-
 eva-core/evolve.cjs      | 272 +++++++++++++++++++++++++++------------
 eva-core/server.cjs      |  95 +++++++++++++-
 eva-core/tencent-lke.cjs | 185 +++++++++++++++++++++++---
 eva-web/index.html       |   2 +-
 eva-web/package.json     |   6 +-
 eva-web/src/api.js       |  76 ++++++++++-
 eva-web/src/main.js      | 199 +++++++++++++---------------
 eva-web/src/markdown.js  | 197 +++++++++++++++++++++++-----
 eva-web/src/style.css    | 329 +++++++++++++++++++++++++++++++++++++++++++----
 overlay/boot.cjs         |   4 +
 overlay/main.cjs         | 126 ++++++++++++++----
 13 files changed, 1329 insertions(+), 305 deletions(-)
eva-core/chat-service.cjs (new)
eva-core/data/ (new)
eva-core/dialogue-service.cjs (new)
eva-core/fallback-messages.cjs (new)
eva-core/models/ (new)
eva-core/oshi-match.cjs (new)
eva-core/services/ (new)
eva-core/training-plan.cjs (new)
eva-web/src/App.jsx (new)
eva-web/src/App.tsx (new)
eva-web/src/chat-ui.js (new)
eva-web/src/components/ (new)
eva-web/src/data/ (new)
eva-web/src/hooks/ (new)
eva-web/src/main.jsx (new)
eva-web/src/pages/ (new)
eva-web/src/services/ (new)
eva-web/src/styles/ (new)
eva-web/src/utils/ (new)
```
- Cursor 回覆：Implemented **Today's Guided Workout Session** on the chat home page.

### What it does
- **`TodayWorkout`** shows today's plan (e.g. 星期一 · 主訓練日) with 3 exercises, each with name, `sets×reps`, and a checkbox
- Checking all exercises shows **完成今日訓練！** and calls **`logWorkout(today)`** for the streak tracker
- **`WeeklyOverview`** renders a 7-day bar with grey / pink (done) / cyan (today) dots
- Clicking another day shows that routine **read-only**; only today is editable
- Completion persists in localStorage as **`Map<dayId+exId, boolean>`**

### Files changed
| File | Change |
|------|--------|
| `eva-web/src/data/weeklyPlan.ts` | **New** — 7-day Eva plan + exercise progress persistence |
| `eva-web/src/components/TodayWorkout.tsx` | **New** — guided session UI + streak integration |
| `eva-web/src/components/WeeklyOverview.tsx` | **New** — compact week bar |
| `eva-web/src/styles/todayWorkout.css` | **New** — panel, dots, exercise rows, completion banner |
| `eva-web/src/utils/workout
…(truncated)
- 檢查：syntax ok: eva-core/ask.cjs
syntax ok: eva-core/evolve.cjs
syntax ok: eva-core/server.cjs
syntax ok: eva-core/tencent-lke.cjs
syntax ok: eva-web/src/api.js
syntax ok: eva-web/src/main.js
syntax ok: eva-web/src/markdown.js
syntax ok: overlay/boot.cjs
syntax ok: overlay/main.cjs
syntax ok: eva-core/chat-service.cjs
syntax ok: eva-core/dialogue-service.cjs
syntax ok: eva-core/fallback-messages.cjs
syntax ok: eva-core/oshi-match.cjs
syntax ok: eva-core/training-plan.cjs
syntax ok: eva-web/src/chat-ui.js
eva-web build ok
- diff：
```
diff --git a/EVA.md b/EVA.md
index 64db845..a5bd93b 100644
--- a/EVA.md
+++ b/EVA.md
@@ -14,13 +14,17 @@ Electron / Android APK
    eva-core :8787  →  Eva LLM (Ollama / OpenRouter / …)  或  騰訊雲 ADP
 ```
 
-UI 右上角可切 **Eva** / **騰訊雲**。騰訊雲模式會把最新一句 user 訊息送到 `https://wss.lke.tencentcloud.com/adp/v2/chat`，並每次帶上 Eva 人設（`SystemRole`）。事實題會先查本地 Postgres KB（miss 再 Tavily），把命中資料一併塞進 `SystemRole` 畀 ADP。ConversationId 由本機持久化；Clear 會開新會話。
+UI 右上角可切 **Eva** / **騰訊雲**。聊天輸入框：**Enter** 送出訊息，**Shift+Enter** 換行（IME 組字中唔會誤送）。騰訊雲模式會把最新一句 user 訊息送到 `https://wss.lke.tencentcloud.com/adp/v2/chat`，並每次帶上 Eva 人設（`SystemRole`）。事實題會先查本地 Postgres KB（miss 再 Tavily），把命中資料一併塞進 `SystemRole` 畀 ADP。ConversationId 由本機持久化；Clear 會開新會話。
+
+模型 API 餘額不足（`code:460032`）時，唔會再爆 raw error——`eva-core/fallback-messages.cjs` 統一返回星野玲語氣嘅 fallback 訊息；`chat-service.cjs` / `server.cjs` / `api.js` 會當正常回覆顯示，console 仍保留原始錯誤供 debug。
+
+連續重複相同問候（例如連續三次「hi」）時，`eva-core/dialogue-service.cjs` 會喺 LLM 之前識別模式，第 2 次起改用分層引導回覆（唔再重複自我介紹），引導用戶講今日想傾啲咩；一般非重複對話不受影響。
 
 ### 自動進化（騰訊雲想 → Cursor 改）
 
 Chatbox **冇** Apply / 自動進化掣。進化改為 **每晚 00:00** Windows 排程跑（`EvaNightlyEvolve`），唔使開 overlay。
 
-每輪可以係一個完整改進（幾個相關檔、必要時開新檔），預設最多 **4** 輪。唔會 commit；唔准改 `.env`、`overlay/data`、`sample/`、secrets。
+每輪可以係一個完整改進（幾個相關檔、必要時開新檔），預設最多 **4** 輪。騰訊雲只准出 **JSON 方案**（唔會當自己寫 code）；超時唔會把 thinking 旁白當答案。唔會 commit；唔准改 `.env`、`overlay/data`、`sample/`、secrets。
 
 完成紀錄寫入：
 
@@ -121,6 +125,60 @@ npm run eva:web:dev
 # set EVA_WEB_URL=http://127.0.0.1:5173 && npm run overlay
 ```
 
+### 健身訓練計劃（Workout Planner）
+
+Web UI 右上角 **健身** 連結，或 hash route `#/workout`，開啟每週訓練編排頁：
+
+- **`eva-core/services/exerciseLibrary.js`** — 40+ 動作、7 大肌群（二頭／三頭／胸／背／肩／腿／核心），含 LUMINA 偶像 form tips
+- **`eva-core/services/workoutPlanner.js`** — 產生 7 日 plan；`biceps` + `beginner` 同 chat 二頭肌線條表完全一致
+- **`eva-web/src/pages/WorkoutPlanner.jsx`** — 肌群 selector、難度 toggle、7 日 card
+- **`eva-core/services/progressCalculator.js`** — 從 localStorage sessions 計算 PR、重量／容量趨勢、成就、肌群平衡
+- **`eva-web/src/pages/WorkoutProgress.jsx`** — `#/workout/progress`：4 張 PR 卡、canvas 重量／容量圖、成就徽章、肌群橫條
+- **`eva-web/src/pages/WorkoutDashboard.jsx`** — 訓練紀錄摘要；有數據時連去進度頁
+- **`eva-web/src/components/TrainingWeekView.tsx`** + **`TrainingDayCard.tsx`** + **`RestTimer.tsx`** — `#/workout/plans/:id` 訓練日追蹤：逐組 checkbox、日／週進度條；勾選一組後自動開始組間休息計時（預設 60s，±15s 調整）；離開頁面或切換訓練日會暫停；進度存 `localStorage`（`eva-training-day-progress:*`）
+- API：`GET /api/workout/library`、`GET /api/workout/plan?muscleGroup=biceps&difficulty=beginner`
+
+### 訓練連續打卡（Workout Streak Tracker）
+
+主頁 chat 下方 **`WorkoutTracker`**：顯示今日日期、打勾「完成今日訓練」、`StreakBadge` 火焰連續日數；3／7／14／30 日 milestone 彈 Eva 粵語鼓勵。資料存 `localStorage`（`eva-workout-streak-v1`），刷新唔會丟。
+
+- **`eva-web/src/utils/workoutStorage.ts`** — 日曆 key、streak 計算、milestone 偵測
+- **`eva-web/src/components/WorkoutTracker.tsx`** + **`StreakBadge.tsx`** + **`styles/workout.css`**
+
+### 心情日記（Mood & Journal）
+
+Web UI 右上角 **心情** 連結，或 hash route `#/mood`，開啟每日心情打卡同 timeline：
+
+- **`eva-core/services/mood-journal.js`** — localStorage 持久化；`logMood` / `getMoodHistory` / streak / stats / Eva 粵語鼓勵 / 偶像活動建議
+- **`eva-web/src/hooks/useMoodJournal.js`** — React state + 每日自動彈 check-in（未打卡時）
+- **`eva-web/src/components/MoodCheckIn.jsx`** — 5 級 emoji 選擇、備註、活動 tag、提交後 Eva 回應
+- **`eva-web/src/components/MoodTimeline.jsx`** + **`JournalEntry.jsx`** — 按週分組 timeline，「今個禮拜」櫻粉邊框
+- **`eva-web/src/components/MoodStreak.jsx`** — 連續打卡、心情分佈、每週趨勢
+- 聊天主頁（`#/``）每日首次開啟會自動彈 check-in modal
+
+### Live 應援（Event Countdown & Setlist）
+
+Web UI 右上角 **Live** 連結，或 hash route `#/live`，開啟 LUMINA 演出倒數、setlist 同應援指南：
+
+- **`eva-core/services/event-service.js`** — mock 3–4 場 LUMINA 演出；`getUpcomingEvents` / `getEventById` / `getCountdown` / `getSetlist` / `getCheeringGuide` / `formatCountdownString`（粵語倒數文案）
+- **`eva-web/src/hooks/useLiveEvent.js`** — 每秒更新倒數；`selectEvent()` / `refreshCountdown()`
+- **`eva-web/src/components/LiveCountdown.jsx`** — flip-card 倒數；今日櫻粉 glow；已過期應援訊息
+- **`eva-web/src/components/SetlistViewer.jsx`** — 曲目表（penligh
…(truncated)
```

### 第4輪 [ok] Workout Check-in Component
- **Eva：** 搞掂啦：每日做嗰陣可以剔完成，睇到進度條好有動力
- 想改成點：每日做嗰陣可以剔完成，睇到進度條好有動力
- 騰訊指定檔：eva-web/src/components/WorkoutCheckIn.tsx, eva-web/src/components/TodayProgress.tsx, eva-web/src/utils/workoutStore.ts, eva-web/src/index.tsx
- 交畀 Cursor：Add workout check-in feature:
1. Create eva-web/src/utils/workoutStore.ts: a simple localStorage-backed store with sets completed / total sets for today. Export a hook useWorkoutStore() returning { todayProgress, checkSet, uncheckSet, resetToday }.
2. Create eva-web/src/components/WorkoutCheckIn.tsx: for a given exercise row, render N checkboxes (one per set). Each checkbox calls checkSet/uncheckSet on toggle.
3. Create eva-web/src/components/TodayProgress.tsx: a small horizontal progress bar showing todayCompleted / todayTotal with a percentage label. Styled as a rounded bar with the LUMINA a
…(truncated)
- 驗收：checkboxes toggle per set；progress bar updates in real time；data persists in localStorage
- 騰訊原文：
```
```json
{"action":"implement","title":"Workout Check-in Component","goal":"Add a simple inline check-in UI for each exercise in the weekly plan so users can mark sets as done and see today's progress bar","userSummary":"每日做嗰陣可以剔完成，睇到進度條好有動力","files":["eva-web/src/components/WorkoutCheckIn.tsx","eva-web/src/components/TodayProgress.tsx","eva-web/src/utils/workoutStore.ts","eva-web/src/index.tsx"],"acceptance":["checkboxes toggle per set","progress bar updates in real time","data persists in localStorage"],"cursorPrompt":"Add workout check-in feature:\n1. Create eva-web/src/utils/workoutStore.ts: a simple localStorage-backed store with sets completed / total sets for today. Export a hook useWorkoutStore() returning { todayProgress, checkSet, uncheckSet, resetToday }.\n2. Create eva-web/src/components/WorkoutCheckIn.tsx: for a given exercise row, render N checkboxes (one per set). Each checkbox calls checkSet/uncheckSet on toggle.\n3. Create eva-web/src/components/TodayProgress.tsx: a small horizontal progress bar showing todayCompleted / todayTotal with a percentage label. Styled as a rounded bar with the LUMINA accent color.\n4. In eva-web/src/index.tsx, import and mount <TodayProgress /> near the top of the page and integrate WorkoutCheckIn into each exercise row of the weekly plan table."}
```
```
- 實際改動檔：EVA.md, eva-core/ask.cjs, eva-core/evolve.cjs, eva-core/server.cjs, eva-core/tencent-lke.cjs, eva-web/index.html, eva-web/package.json, eva-web/src/api.js, eva-web/src/main.js, eva-web/src/markdown.js, eva-web/src/style.css, overlay/boot.cjs, overlay/main.cjs, eva-core/chat-service.cjs, eva-core/data/, eva-core/dialogue-service.cjs, eva-core/fallback-messages.cjs, eva-core/models/, eva-core/oshi-match.cjs, eva-core/services/, eva-core/training-plan.cjs, eva-web/src/App.jsx, eva-web/src/App.tsx, eva-web/src/chat-ui.js, eva-web/src/components/, eva-web/src/data/, eva-web/src/hooks/, eva-web/src/index.tsx, eva-web/src/main.jsx, eva-web/src/pages/, eva-web/src/services/, eva-web/src/styles/, eva-web/src/utils/
- 已還原：env.example
- diff stat：
```
EVA.md                   |  62 ++++++++-
 eva-core/ask.cjs         |  81 +++++++++++-
 eva-core/evolve.cjs      | 272 +++++++++++++++++++++++++++------------
 eva-core/server.cjs      |  95 +++++++++++++-
 eva-core/tencent-lke.cjs | 185 +++++++++++++++++++++++---
 eva-web/index.html       |   2 +-
 eva-web/package.json     |   6 +-
 eva-web/src/api.js       |  76 ++++++++++-
 eva-web/src/main.js      | 199 +++++++++++++---------------
 eva-web/src/markdown.js  | 197 +++++++++++++++++++++++-----
 eva-web/src/style.css    | 329 +++++++++++++++++++++++++++++++++++++++++++----
 overlay/boot.cjs         |   4 +
 overlay/main.cjs         | 126 ++++++++++++++----
 13 files changed, 1329 insertions(+), 305 deletions(-)
eva-core/chat-service.cjs (new)
eva-core/data/ (new)
eva-core/dialogue-service.cjs (new)
eva-core/fallback-messages.cjs (new)
eva-core/models/ (new)
eva-core/oshi-match.cjs (new)
eva-core/services/ (new)
eva-core/training-plan.cjs (new)
eva-web/src/App.jsx (new)
eva-web/src/App.tsx (new)
eva-web/src/chat-ui.js (new)
eva-web/src/components/ (new)
eva-web/src/data/ (new)
eva-web/src/hooks/ (new)
eva-web/src/index.tsx (new)
eva-web/src/main.jsx (new)
eva-web/src/pages/ (new)
eva-web/src/services/ (new)
eva-web/src/styles/ (new)
eva-web/src/utils/ (new)
```
- Cursor 回覆：Added per-set workout check-in on the home page’s weekly plan.

**What it does**
- Each exercise shows inline set checkboxes (第 1 組, 第 2 組, …)
- A progress bar at the top of today’s workout updates as you tick sets
- Progress is saved to `localStorage` under `eva-guided-workout-sets-v1`
- Finishing all sets still triggers the existing streak logger

**Files changed**

| File | Role |
|------|------|
| `eva-web/src/utils/workoutStore.ts` | **New** — load/save/toggle set progress, compute day stats |
| `eva-web/src/components/WorkoutCheckIn.tsx` | **New** — per-exercise set checkbox UI |
| `eva-web/src/components/TodayProgress.tsx` | **New** — real-time progress bar |
| `eva-web/src/index.tsx` | **New** — barrel exports for the check-in module |
| `eva-web/src/components/TodayWorkout.tsx` | Wired in check-in + progress (replaces exercise-level toggles) |
| `eva-web/src/components/WeeklyOverview.tsx` | Uses set-level completion for week dots |
| `eva-web/src/components/index.ts` | Exports
…(truncated)
- 檢查：syntax ok: eva-core/ask.cjs
syntax ok: eva-core/evolve.cjs
syntax ok: eva-core/server.cjs
syntax ok: eva-core/tencent-lke.cjs
syntax ok: eva-web/src/api.js
syntax ok: eva-web/src/main.js
syntax ok: eva-web/src/markdown.js
syntax ok: overlay/boot.cjs
syntax ok: overlay/main.cjs
syntax ok: eva-core/chat-service.cjs
syntax ok: eva-core/dialogue-service.cjs
syntax ok: eva-core/fallback-messages.cjs
syntax ok: eva-core/oshi-match.cjs
syntax ok: eva-core/training-plan.cjs
syntax ok: eva-web/src/chat-ui.js
eva-web build ok
- diff：
```
diff --git a/EVA.md b/EVA.md
index 64db845..a5bd93b 100644
--- a/EVA.md
+++ b/EVA.md
@@ -14,13 +14,17 @@ Electron / Android APK
    eva-core :8787  →  Eva LLM (Ollama / OpenRouter / …)  或  騰訊雲 ADP
 ```
 
-UI 右上角可切 **Eva** / **騰訊雲**。騰訊雲模式會把最新一句 user 訊息送到 `https://wss.lke.tencentcloud.com/adp/v2/chat`，並每次帶上 Eva 人設（`SystemRole`）。事實題會先查本地 Postgres KB（miss 再 Tavily），把命中資料一併塞進 `SystemRole` 畀 ADP。ConversationId 由本機持久化；Clear 會開新會話。
+UI 右上角可切 **Eva** / **騰訊雲**。聊天輸入框：**Enter** 送出訊息，**Shift+Enter** 換行（IME 組字中唔會誤送）。騰訊雲模式會把最新一句 user 訊息送到 `https://wss.lke.tencentcloud.com/adp/v2/chat`，並每次帶上 Eva 人設（`SystemRole`）。事實題會先查本地 Postgres KB（miss 再 Tavily），把命中資料一併塞進 `SystemRole` 畀 ADP。ConversationId 由本機持久化；Clear 會開新會話。
+
+模型 API 餘額不足（`code:460032`）時，唔會再爆 raw error——`eva-core/fallback-messages.cjs` 統一返回星野玲語氣嘅 fallback 訊息；`chat-service.cjs` / `server.cjs` / `api.js` 會當正常回覆顯示，console 仍保留原始錯誤供 debug。
+
+連續重複相同問候（例如連續三次「hi」）時，`eva-core/dialogue-service.cjs` 會喺 LLM 之前識別模式，第 2 次起改用分層引導回覆（唔再重複自我介紹），引導用戶講今日想傾啲咩；一般非重複對話不受影響。
 
 ### 自動進化（騰訊雲想 → Cursor 改）
 
 Chatbox **冇** Apply / 自動進化掣。進化改為 **每晚 00:00** Windows 排程跑（`EvaNightlyEvolve`），唔使開 overlay。
 
-每輪可以係一個完整改進（幾個相關檔、必要時開新檔），預設最多 **4** 輪。唔會 commit；唔准改 `.env`、`overlay/data`、`sample/`、secrets。
+每輪可以係一個完整改進（幾個相關檔、必要時開新檔），預設最多 **4** 輪。騰訊雲只准出 **JSON 方案**（唔會當自己寫 code）；超時唔會把 thinking 旁白當答案。唔會 commit；唔准改 `.env`、`overlay/data`、`sample/`、secrets。
 
 完成紀錄寫入：
 
@@ -121,6 +125,60 @@ npm run eva:web:dev
 # set EVA_WEB_URL=http://127.0.0.1:5173 && npm run overlay
 ```
 
+### 健身訓練計劃（Workout Planner）
+
+Web UI 右上角 **健身** 連結，或 hash route `#/workout`，開啟每週訓練編排頁：
+
+- **`eva-core/services/exerciseLibrary.js`** — 40+ 動作、7 大肌群（二頭／三頭／胸／背／肩／腿／核心），含 LUMINA 偶像 form tips
+- **`eva-core/services/workoutPlanner.js`** — 產生 7 日 plan；`biceps` + `beginner` 同 chat 二頭肌線條表完全一致
+- **`eva-web/src/pages/WorkoutPlanner.jsx`** — 肌群 selector、難度 toggle、7 日 card
+- **`eva-core/services/progressCalculator.js`** — 從 localStorage sessions 計算 PR、重量／容量趨勢、成就、肌群平衡
+- **`eva-web/src/pages/WorkoutProgress.jsx`** — `#/workout/progress`：4 張 PR 卡、canvas 重量／容量圖、成就徽章、肌群橫條
+- **`eva-web/src/pages/WorkoutDashboard.jsx`** — 訓練紀錄摘要；有數據時連去進度頁
+- **`eva-web/src/components/TrainingWeekView.tsx`** + **`TrainingDayCard.tsx`** + **`RestTimer.tsx`** — `#/workout/plans/:id` 訓練日追蹤：逐組 checkbox、日／週進度條；勾選一組後自動開始組間休息計時（預設 60s，±15s 調整）；離開頁面或切換訓練日會暫停；進度存 `localStorage`（`eva-training-day-progress:*`）
+- API：`GET /api/workout/library`、`GET /api/workout/plan?muscleGroup=biceps&difficulty=beginner`
+
+### 訓練連續打卡（Workout Streak Tracker）
+
+主頁 chat 下方 **`WorkoutTracker`**：顯示今日日期、打勾「完成今日訓練」、`StreakBadge` 火焰連續日數；3／7／14／30 日 milestone 彈 Eva 粵語鼓勵。資料存 `localStorage`（`eva-workout-streak-v1`），刷新唔會丟。
+
+- **`eva-web/src/utils/workoutStorage.ts`** — 日曆 key、streak 計算、milestone 偵測
+- **`eva-web/src/components/WorkoutTracker.tsx`** + **`StreakBadge.tsx`** + **`styles/workout.css`**
+
+### 心情日記（Mood & Journal）
+
+Web UI 右上角 **心情** 連結，或 hash route `#/mood`，開啟每日心情打卡同 timeline：
+
+- **`eva-core/services/mood-journal.js`** — localStorage 持久化；`logMood` / `getMoodHistory` / streak / stats / Eva 粵語鼓勵 / 偶像活動建議
+- **`eva-web/src/hooks/useMoodJournal.js`** — React state + 每日自動彈 check-in（未打卡時）
+- **`eva-web/src/components/MoodCheckIn.jsx`** — 5 級 emoji 選擇、備註、活動 tag、提交後 Eva 回應
+- **`eva-web/src/components/MoodTimeline.jsx`** + **`JournalEntry.jsx`** — 按週分組 timeline，「今個禮拜」櫻粉邊框
+- **`eva-web/src/components/MoodStreak.jsx`** — 連續打卡、心情分佈、每週趨勢
+- 聊天主頁（`#/``）每日首次開啟會自動彈 check-in modal
+
+### Live 應援（Event Countdown & Setlist）
+
+Web UI 右上角 **Live** 連結，或 hash route `#/live`，開啟 LUMINA 演出倒數、setlist 同應援指南：
+
+- **`eva-core/services/event-service.js`** — mock 3–4 場 LUMINA 演出；`getUpcomingEvents` / `getEventById` / `getCountdown` / `getSetlist` / `getCheeringGuide` / `formatCountdownString`（粵語倒數文案）
+- **`eva-web/src/hooks/useLiveEvent.js`** — 每秒更新倒數；`selectEvent()` / `refreshCountdown()`
+- **`eva-web/src/components/LiveCountdown.jsx`** — flip-card 倒數；今日櫻粉 glow；已過期應援訊息
+- **`eva-web/src/components/SetlistViewer.jsx`** — 曲目表（penligh
…(truncated)
```

## 2026-09-23 16:00:07  （4/4 輪）

### Eva 講

嘿嘿，今晚我偷偷裝修咗自己幾樣嘢～你用嗰陣應該會感覺到。
1. 加返個每週訓練表功能，跟住練二頭肌計劃仲可以打勾記錄進度
2. 加個進度Dashboard，睇到過去幾多日打咗勾、連續做咗幾多日、仲有玲嘅鼓勵訊息
3. 加個動作圖鑑，睇到每個動作嘅正確姿勢、玲嘅小貼士，仲可以按肌肉組篩選
4. 加個訓練模式，揀好今日嘅計劃撳「開始訓練」，跟住動作一個接一個做，組間休息有倒數計時器，仲有玲幫你打氣
想睇技術細節就去 overlay/data/evolve-log.md（4/4 輪）。

### 第1輪 [ok] workout-plan-tracker
- **Eva：** 搞掂啦：加返個每週訓練表功能，跟住練二頭肌計劃仲可以打勾記錄進度
- 想改成點：加返個每週訓練表功能，跟住練二頭肌計劃仲可以打勾記錄進度
- 騰訊指定檔：eva-core/types/workout.ts, eva-core/services/workoutGenerator.ts, eva-core/services/workoutTracker.ts, eva-web/src/components/WorkoutPlanView.tsx, eva-web/src/components/WorkoutDayCard.tsx, eva-web/src/components/ExerciseItem.tsx, eva-web/src/pages/WorkoutPage.tsx, eva-web/src/styles/workout.css
- 交畀 Cursor：Add a workout plan tracking feature. Create eva-core/types/workout.ts with Exercise, WorkoutDay, WorkoutPlan, ProgressEntry, StreakRecord interfaces. Create eva-core/services/workoutGenerator.ts that generates bicep-focused weekly plans (the one Eva described with Mon/Fri bicep, Tue legs/core, Wed back, Thu shoulders, Sat full body, Sun rest). Create eva-core/services/workoutTracker.ts for progress persistence (localStorage-based). Create eva-web/src/components/WorkoutPlanView.tsx as the main container showing a week grid. Create eva-web/src/components/WorkoutDayCard.tsx for each day's exercis
…(truncated)
- 驗收：User can view a weekly workout plan with 7 days；Each day shows exercises with sets, reps, and rest time；User can check off completed exercises；Progress is persisted and shows streak count；Bicep-focused plan from chat is available as a preset
- 騰訊原文：
```
```json
{
  "action": "implement",
  "title": "workout-plan-tracker",
  "goal": "Add weekly workout plan tracking with exercise library and progress logging",
  "userSummary": "加返個每週訓練表功能，跟住練二頭肌計劃仲可以打勾記錄進度",
  "files": [
    "eva-core/types/workout.ts",
    "eva-core/services/workoutGenerator.ts",
    "eva-core/services/workoutTracker.ts",
    "eva-web/src/components/WorkoutPlanView.tsx",
    "eva-web/src/components/WorkoutDayCard.tsx",
    "eva-web/src/components/ExerciseItem.tsx",
    "eva-web/src/pages/WorkoutPage.tsx",
    "eva-web/src/styles/workout.css"
  ],
  "acceptance": [
    "User can view a weekly workout plan with 7 days",
    "Each day shows exercises with sets, reps, and rest time",
    "User can check off completed exercises",
    "Progress is persisted and shows streak count",
    "Bicep-focused plan from chat is available as a preset"
  ],
  "cursorPrompt": "Add a workout plan tracking feature. Create eva-core/types/workout.ts with Exercise, WorkoutDay, WorkoutPlan, ProgressEntry, StreakRecord interfaces. Create eva-core/services/workoutGenerator.ts that generates bicep-focused weekly plans (the one Eva described with Mon/Fri bicep, Tue legs/core, Wed back, Thu shoulders, Sat full body, Sun rest). Create eva-core/services/workoutTracker.ts for progress persistence (localStorage-based). Create eva-web/src/components/WorkoutPlanView.tsx as the main container showing a week grid. Create eva-web/src/components/WorkoutDayCard.tsx for each day's exercises. Create eva-web/src/components/ExerciseItem.tsx for individual exercise rows with checkbox. Create eva-web/src/pages/WorkoutPage.tsx as the page layout. Create eva-web/src/styles/workout.css with styling. Wire it into the app router."
}
```
```
- 實際改動檔：EVA.md, eva-core/ask.cjs, eva-core/evolve.cjs, eva-core/server.cjs, eva-core/tencent-lke.cjs, eva-web/index.html, eva-web/package.json, eva-web/src/api.js, eva-web/src/main.js, eva-web/src/markdown.js, eva-web/src/style.css, overlay/boot.cjs, overlay/main.cjs, eva-core/chat-service.cjs, eva-core/data/, eva-core/dialogue-service.cjs, eva-core/fallback-messages.cjs, eva-core/models/, eva-core/oshi-match.cjs, eva-core/services/, eva-core/training-plan.cjs, eva-core/types/, eva-web/src/App.jsx, eva-web/src/App.tsx, eva-web/src/chat-ui.js, eva-web/src/components/, eva-web/src/data/, eva-web/src/hooks/, eva-web/src/index.tsx, eva-web/src/main.jsx, eva-web/src/pages/, eva-web/src/services/, eva-web/src/styles/, eva-web/src/utils/
- 已還原：env.example, eva-web/vite.config.js
- diff stat：
```
EVA.md                   |  62 ++++++++-
 eva-core/ask.cjs         |  81 ++++++++++-
 eva-core/evolve.cjs      | 272 +++++++++++++++++++++++++-----------
 eva-core/server.cjs      | 132 +++++++++++++++++-
 eva-core/tencent-lke.cjs | 185 ++++++++++++++++++++++---
 eva-web/index.html       |   2 +-
 eva-web/package.json     |   6 +-
 eva-web/src/api.js       | 110 ++++++++++++++-
 eva-web/src/main.js      | 199 ++++++++++++---------------
 eva-web/src/markdown.js  | 197 +++++++++++++++++++++++----
 eva-web/src/style.css    | 348 +++++++++++++++++++++++++++++++++++++++++++----
 overlay/boot.cjs         |   4 +
 overlay/main.cjs         | 132 ++++++++++++++----
 13 files changed, 1425 insertions(+), 305 deletions(-)
eva-core/chat-service.cjs (new)
eva-core/data/ (new)
eva-core/dialogue-service.cjs (new)
eva-core/fallback-messages.cjs (new)
eva-core/models/ (new)
eva-core/oshi-match.cjs (new)
eva-core/services/ (new)
eva-core/training-plan.cjs (new)
eva-core/types/ (new)
eva-web/src/App.jsx (new)
eva-web/src/App.tsx (new)
eva-web/src/chat-ui.js (new)
eva-web/src/components/ (new)
eva-web/src/data/ (new)
eva-web/src/hooks/ (new)
eva-web/src/index.tsx (new)
eva-web/src/main.jsx (new)
eva-web/src/pages/ (new)
eva-web/src/services/ (new)
eva-web/src/styles/ (new)
eva-web/src/utils/ (new)
```
- Cursor 回覆：Weekly workout plan tracking is in place — bicep preset, exercise check-offs, streak, and persistence.

### What it does
- **7-day plan** with day picker (Mon–Sun), each showing exercises with sets, reps, and rest
- **Check off exercises** on today’s day only; progress bar per day and per week
- **Streak badge** when all of today’s exercises are done; milestone encouragement at 3/7/14/30 days
- **Bicep chat preset** via `biceps:beginner` (`/api/workout/plan`)
- **Persistence** in `localStorage` (web) and `eva-core/data/workout-progress.json` (API)

### Routes
- Home (non-desktop): compact tracker below chat
- `/workout/track`: full plan page with reminders

### Files changed

**Core**
- `eva-core/types/workout.ts` — types
- `eva-core/services/workoutGenerator.ts` + `.js` — plan generator (wraps existing bicep preset)
- `eva-core/services/workoutTracker.ts` + `.js` — progress + streak logic
- `eva-core/server.cjs` — `/api/workout/plan`, `/api/workout/progress` GET/PATCH

**Web**
- `eva-
…(truncated)
- 檢查：syntax ok: eva-core/ask.cjs
syntax ok: eva-core/evolve.cjs
syntax ok: eva-core/server.cjs
syntax ok: eva-core/tencent-lke.cjs
syntax ok: eva-web/src/api.js
syntax ok: eva-web/src/main.js
syntax ok: eva-web/src/markdown.js
syntax ok: overlay/boot.cjs
syntax ok: overlay/main.cjs
syntax ok: eva-core/chat-service.cjs
syntax ok: eva-core/dialogue-service.cjs
syntax ok: eva-core/fallback-messages.cjs
syntax ok: eva-core/oshi-match.cjs
syntax ok: eva-core/training-plan.cjs
syntax ok: eva-web/src/chat-ui.js
eva-web build ok
- diff：
```
diff --git a/EVA.md b/EVA.md
index 64db845..a5bd93b 100644
--- a/EVA.md
+++ b/EVA.md
@@ -14,13 +14,17 @@ Electron / Android APK
    eva-core :8787  →  Eva LLM (Ollama / OpenRouter / …)  或  騰訊雲 ADP
 ```
 
-UI 右上角可切 **Eva** / **騰訊雲**。騰訊雲模式會把最新一句 user 訊息送到 `https://wss.lke.tencentcloud.com/adp/v2/chat`，並每次帶上 Eva 人設（`SystemRole`）。事實題會先查本地 Postgres KB（miss 再 Tavily），把命中資料一併塞進 `SystemRole` 畀 ADP。ConversationId 由本機持久化；Clear 會開新會話。
+UI 右上角可切 **Eva** / **騰訊雲**。聊天輸入框：**Enter** 送出訊息，**Shift+Enter** 換行（IME 組字中唔會誤送）。騰訊雲模式會把最新一句 user 訊息送到 `https://wss.lke.tencentcloud.com/adp/v2/chat`，並每次帶上 Eva 人設（`SystemRole`）。事實題會先查本地 Postgres KB（miss 再 Tavily），把命中資料一併塞進 `SystemRole` 畀 ADP。ConversationId 由本機持久化；Clear 會開新會話。
+
+模型 API 餘額不足（`code:460032`）時，唔會再爆 raw error——`eva-core/fallback-messages.cjs` 統一返回星野玲語氣嘅 fallback 訊息；`chat-service.cjs` / `server.cjs` / `api.js` 會當正常回覆顯示，console 仍保留原始錯誤供 debug。
+
+連續重複相同問候（例如連續三次「hi」）時，`eva-core/dialogue-service.cjs` 會喺 LLM 之前識別模式，第 2 次起改用分層引導回覆（唔再重複自我介紹），引導用戶講今日想傾啲咩；一般非重複對話不受影響。
 
 ### 自動進化（騰訊雲想 → Cursor 改）
 
 Chatbox **冇** Apply / 自動進化掣。進化改為 **每晚 00:00** Windows 排程跑（`EvaNightlyEvolve`），唔使開 overlay。
 
-每輪可以係一個完整改進（幾個相關檔、必要時開新檔），預設最多 **4** 輪。唔會 commit；唔准改 `.env`、`overlay/data`、`sample/`、secrets。
+每輪可以係一個完整改進（幾個相關檔、必要時開新檔），預設最多 **4** 輪。騰訊雲只准出 **JSON 方案**（唔會當自己寫 code）；超時唔會把 thinking 旁白當答案。唔會 commit；唔准改 `.env`、`overlay/data`、`sample/`、secrets。
 
 完成紀錄寫入：
 
@@ -121,6 +125,60 @@ npm run eva:web:dev
 # set EVA_WEB_URL=http://127.0.0.1:5173 && npm run overlay
 ```
 
+### 健身訓練計劃（Workout Planner）
+
+Web UI 右上角 **健身** 連結，或 hash route `#/workout`，開啟每週訓練編排頁：
+
+- **`eva-core/services/exerciseLibrary.js`** — 40+ 動作、7 大肌群（二頭／三頭／胸／背／肩／腿／核心），含 LUMINA 偶像 form tips
+- **`eva-core/services/workoutPlanner.js`** — 產生 7 日 plan；`biceps` + `beginner` 同 chat 二頭肌線條表完全一致
+- **`eva-web/src/pages/WorkoutPlanner.jsx`** — 肌群 selector、難度 toggle、7 日 card
+- **`eva-core/services/progressCalculator.js`** — 從 localStorage sessions 計算 PR、重量／容量趨勢、成就、肌群平衡
+- **`eva-web/src/pages/WorkoutProgress.jsx`** — `#/workout/progress`：4 張 PR 卡、canvas 重量／容量圖、成就徽章、肌群橫條
+- **`eva-web/src/pages/WorkoutDashboard.jsx`** — 訓練紀錄摘要；有數據時連去進度頁
+- **`eva-web/src/components/TrainingWeekView.tsx`** + **`TrainingDayCard.tsx`** + **`RestTimer.tsx`** — `#/workout/plans/:id` 訓練日追蹤：逐組 checkbox、日／週進度條；勾選一組後自動開始組間休息計時（預設 60s，±15s 調整）；離開頁面或切換訓練日會暫停；進度存 `localStorage`（`eva-training-day-progress:*`）
+- API：`GET /api/workout/library`、`GET /api/workout/plan?muscleGroup=biceps&difficulty=beginner`
+
+### 訓練連續打卡（Workout Streak Tracker）
+
+主頁 chat 下方 **`WorkoutTracker`**：顯示今日日期、打勾「完成今日訓練」、`StreakBadge` 火焰連續日數；3／7／14／30 日 milestone 彈 Eva 粵語鼓勵。資料存 `localStorage`（`eva-workout-streak-v1`），刷新唔會丟。
+
+- **`eva-web/src/utils/workoutStorage.ts`** — 日曆 key、streak 計算、milestone 偵測
+- **`eva-web/src/components/WorkoutTracker.tsx`** + **`StreakBadge.tsx`** + **`styles/workout.css`**
+
+### 心情日記（Mood & Journal）
+
+Web UI 右上角 **心情** 連結，或 hash route `#/mood`，開啟每日心情打卡同 timeline：
+
+- **`eva-core/services/mood-journal.js`** — localStorage 持久化；`logMood` / `getMoodHistory` / streak / stats / Eva 粵語鼓勵 / 偶像活動建議
+- **`eva-web/src/hooks/useMoodJournal.js`** — React state + 每日自動彈 check-in（未打卡時）
+- **`eva-web/src/components/MoodCheckIn.jsx`** — 5 級 emoji 選擇、備註、活動 tag、提交後 Eva 回應
+- **`eva-web/src/components/MoodTimeline.jsx`** + **`JournalEntry.jsx`** — 按週分組 timeline，「今個禮拜」櫻粉邊框
+- **`eva-web/src/components/MoodStreak.jsx`** — 連續打卡、心情分佈、每週趨勢
+- 聊天主頁（`#/``）每日首次開啟會自動彈 check-in modal
+
+### Live 應援（Event Countdown & Setlist）
+
+Web UI 右上角 **Live** 連結，或 hash route `#/live`，開啟 LUMINA 演出倒數、setlist 同應援指南：
+
+- **`eva-core/services/event-service.js`** — mock 3–4 場 LUMINA 演出；`getUpcomingEvents` / `getEventById` / `getCountdown` / `getSetlist` / `getCheeringGuide` / `formatCountdownString`（粵語倒數文案）
+- **`eva-web/src/hooks/useLiveEvent.js`** — 每秒更新倒數；`selectEvent()` / `refreshCountdown()`
+- **`eva-web/src/components/LiveCountdown.jsx`** — flip-card 倒數；今日櫻粉 glow；已過期應援訊息
+- **`eva-web/src/components/SetlistViewer.jsx`** — 曲目表（penligh
…(truncated)
```

### 第2輪 [ok] workout-progress-dashboard
- **Eva：** 搞掂啦：加個進度Dashboard，睇到過去幾多日打咗勾、連續做咗幾多日、仲有玲嘅鼓勵訊息
- 想改成點：加個進度Dashboard，睇到過去幾多日打咗勾、連續做咗幾多日、仲有玲嘅鼓勵訊息
- 騰訊指定檔：eva-core/services/progressStats.ts, eva-web/src/components/ProgressDashboard.tsx, eva-web/src/components/StreakCalendar.tsx, eva-web/src/components/EncouragementBanner.tsx, eva-web/src/pages/DashboardPage.tsx, eva-web/src/styles/dashboard.css, eva-web/src/App.tsx
- 交畀 Cursor：Add a workout progress dashboard with 3 new components and a new page. Create eva-core/services/progressStats.ts to compute streak stats, completion rates, and encouragement tier from localStorage workout tracker data (WorkoutTracker from round 1). Create eva-web/src/components/StreakCalendar.tsx — a mini month-calendar grid that shades days green (completed), gray (missed), or blue (today), using the tracker's completion history. Create eva-web/src/components/EncouragementBanner.tsx — shows a dynamic Eva quote based on streak length (0-1 days: '今日開始一齊加油✊', 2-6 days: '連續訓練中，好叻呀🌟', 7-13 days: 
…(truncated)
- 驗收：Dashboard shows current streak count and longest streak；Monthly calendar view highlights completed days vs missed days；Weekly completion percentage bar chart (last 4 weeks)；Eva's encouragement banner adapts message based on streak length and recent activity；Navigation between WorkoutPage and DashboardPage works
- 騰訊原文：
```
```json
{
  "action": "implement",
  "title": "workout-progress-dashboard",
  "goal": "Add a visual progress dashboard showing workout history, completion stats, and Eva's personalized encouragement",
  "userSummary": "加個進度Dashboard，睇到過去幾多日打咗勾、連續做咗幾多日、仲有玲嘅鼓勵訊息",
  "files": [
    "eva-core/services/progressStats.ts",
    "eva-web/src/components/ProgressDashboard.tsx",
    "eva-web/src/components/StreakCalendar.tsx",
    "eva-web/src/components/EncouragementBanner.tsx",
    "eva-web/src/pages/DashboardPage.tsx",
    "eva-web/src/styles/dashboard.css",
    "eva-web/src/App.tsx"
  ],
  "acceptance": [
    "Dashboard shows current streak count and longest streak",
    "Monthly calendar view highlights completed days vs missed days",
    "Weekly completion percentage bar chart (last 4 weeks)",
    "Eva's encouragement banner adapts message based on streak length and recent activity",
    "Navigation between WorkoutPage and DashboardPage works"
  ],
  "cursorPrompt": "Add a workout progress dashboard with 3 new components and a new page. Create eva-core/services/progressStats.ts to compute streak stats, completion rates, and encouragement tier from localStorage workout tracker data (WorkoutTracker from round 1). Create eva-web/src/components/StreakCalendar.tsx — a mini month-calendar grid that shades days green (completed), gray (missed), or blue (today), using the tracker's completion history. Create eva-web/src/components/EncouragementBanner.tsx — shows a dynamic Eva quote based on streak length (0-1 days: '今日開始一齊加油✊', 2-6 days: '連續訓練中，好叻呀🌟', 7-13 days: '一週達成！專業級表現💫', 14-29 days: '兩星期！你已經超越好多粉絲喇✨', 30+: '傳說級連續訓練！同LUMINA一樣咁努力🌈'). Create eva-web/src/components/ProgressDashboard.tsx as the main dashboard composite — shows streak badge, the calendar, a 4-week bar chart (CSS-only, no chart library) of weekly completion %, and total workouts done. Create eva-web/src/pages/DashboardPage.tsx as the page layout rendering ProgressDashboard. Update eva-web/src/App.tsx to add a /dashboard route and a nav link between Workout and Dashboard pages. Create eva-web/src/styles/dashboard.css with styling — use Eva's star-silver and sakura-pink color theme, card-based layout, responsive grid."
}
```
```
- 實際改動檔：EVA.md, eva-core/ask.cjs, eva-core/evolve.cjs, eva-core/server.cjs, eva-core/tencent-lke.cjs, eva-web/index.html, eva-web/package.json, eva-web/src/api.js, eva-web/src/main.js, eva-web/src/markdown.js, eva-web/src/style.css, overlay/boot.cjs, overlay/main.cjs, eva-core/chat-service.cjs, eva-core/data/, eva-core/dialogue-service.cjs, eva-core/fallback-messages.cjs, eva-core/models/, eva-core/oshi-match.cjs, eva-core/services/, eva-core/training-plan.cjs, eva-core/types/, eva-web/src/App.jsx, eva-web/src/App.tsx, eva-web/src/chat-ui.js, eva-web/src/components/, eva-web/src/data/, eva-web/src/hooks/, eva-web/src/index.tsx, eva-web/src/main.jsx, eva-web/src/pages/, eva-web/src/services/, eva-web/src/styles/, eva-web/src/utils/
- 已還原：env.example
- diff stat：
```
EVA.md                   |  62 ++++++++-
 eva-core/ask.cjs         |  81 ++++++++++-
 eva-core/evolve.cjs      | 272 +++++++++++++++++++++++++-----------
 eva-core/server.cjs      | 152 ++++++++++++++++++++-
 eva-core/tencent-lke.cjs | 185 ++++++++++++++++++++++---
 eva-web/index.html       |   2 +-
 eva-web/package.json     |   6 +-
 eva-web/src/api.js       | 110 ++++++++++++++-
 eva-web/src/main.js      | 199 ++++++++++++---------------
 eva-web/src/markdown.js  | 197 +++++++++++++++++++++++----
 eva-web/src/style.css    | 348 +++++++++++++++++++++++++++++++++++++++++++----
 overlay/boot.cjs         |   4 +
 overlay/main.cjs         | 132 ++++++++++++++----
 13 files changed, 1445 insertions(+), 305 deletions(-)
eva-core/chat-service.cjs (new)
eva-core/data/ (new)
eva-core/dialogue-service.cjs (new)
eva-core/fallback-messages.cjs (new)
eva-core/models/ (new)
eva-core/oshi-match.cjs (new)
eva-core/services/ (new)
eva-core/training-plan.cjs (new)
eva-core/types/ (new)
eva-web/src/App.jsx (new)
eva-web/src/App.tsx (new)
eva-web/src/chat-ui.js (new)
eva-web/src/components/ (new)
eva-web/src/data/ (new)
eva-web/src/hooks/ (new)
eva-web/src/index.tsx (new)
eva-web/src/main.jsx (new)
eva-web/src/pages/ (new)
eva-web/src/services/ (new)
eva-web/src/styles/ (new)
eva-web/src/utils/ (new)
```
- Cursor 回覆：Implemented the **workout progress dashboard** — a visual view of streaks, calendar history, weekly completion, and Eva's encouragement.

### What was added

**Backend**
- `eva-core/services/progressStats.js` — computes current/longest streak, monthly calendar (completed vs missed vs rest), last-4-weeks completion %, and adaptive encouragement
- `eva-core/services/progressStats.ts` — TypeScript types + re-exports
- `eva-core/server.cjs` — `GET /api/workout/progress-stats`

**Frontend**
- `eva-web/src/services/progressStats.ts` — API fetch with localStorage fallback
- `eva-web/src/components/EncouragementBanner.tsx` — Eva message banner (tone varies by streak/activity)
- `eva-web/src/components/StreakCalendar.tsx` — monthly calendar with month navigation
- `eva-web/src/components/ProgressDashboard.tsx` — streak stats, calendar, weekly bar chart
- `eva-web/src/pages/DashboardPage.tsx` — full dashboard page
- `eva-web/src/styles/dashboard.css` — dashboard styling

**Navigation**
- `eva-we
…(truncated)
- 檢查：syntax ok: eva-core/ask.cjs
syntax ok: eva-core/evolve.cjs
syntax ok: eva-core/server.cjs
syntax ok: eva-core/tencent-lke.cjs
syntax ok: eva-web/src/api.js
syntax ok: eva-web/src/main.js
syntax ok: eva-web/src/markdown.js
syntax ok: overlay/boot.cjs
syntax ok: overlay/main.cjs
syntax ok: eva-core/chat-service.cjs
syntax ok: eva-core/dialogue-service.cjs
syntax ok: eva-core/fallback-messages.cjs
syntax ok: eva-core/oshi-match.cjs
syntax ok: eva-core/training-plan.cjs
syntax ok: eva-web/src/chat-ui.js
eva-web build ok
- diff：
```
diff --git a/EVA.md b/EVA.md
index 64db845..a5bd93b 100644
--- a/EVA.md
+++ b/EVA.md
@@ -14,13 +14,17 @@ Electron / Android APK
    eva-core :8787  →  Eva LLM (Ollama / OpenRouter / …)  或  騰訊雲 ADP
 ```
 
-UI 右上角可切 **Eva** / **騰訊雲**。騰訊雲模式會把最新一句 user 訊息送到 `https://wss.lke.tencentcloud.com/adp/v2/chat`，並每次帶上 Eva 人設（`SystemRole`）。事實題會先查本地 Postgres KB（miss 再 Tavily），把命中資料一併塞進 `SystemRole` 畀 ADP。ConversationId 由本機持久化；Clear 會開新會話。
+UI 右上角可切 **Eva** / **騰訊雲**。聊天輸入框：**Enter** 送出訊息，**Shift+Enter** 換行（IME 組字中唔會誤送）。騰訊雲模式會把最新一句 user 訊息送到 `https://wss.lke.tencentcloud.com/adp/v2/chat`，並每次帶上 Eva 人設（`SystemRole`）。事實題會先查本地 Postgres KB（miss 再 Tavily），把命中資料一併塞進 `SystemRole` 畀 ADP。ConversationId 由本機持久化；Clear 會開新會話。
+
+模型 API 餘額不足（`code:460032`）時，唔會再爆 raw error——`eva-core/fallback-messages.cjs` 統一返回星野玲語氣嘅 fallback 訊息；`chat-service.cjs` / `server.cjs` / `api.js` 會當正常回覆顯示，console 仍保留原始錯誤供 debug。
+
+連續重複相同問候（例如連續三次「hi」）時，`eva-core/dialogue-service.cjs` 會喺 LLM 之前識別模式，第 2 次起改用分層引導回覆（唔再重複自我介紹），引導用戶講今日想傾啲咩；一般非重複對話不受影響。
 
 ### 自動進化（騰訊雲想 → Cursor 改）
 
 Chatbox **冇** Apply / 自動進化掣。進化改為 **每晚 00:00** Windows 排程跑（`EvaNightlyEvolve`），唔使開 overlay。
 
-每輪可以係一個完整改進（幾個相關檔、必要時開新檔），預設最多 **4** 輪。唔會 commit；唔准改 `.env`、`overlay/data`、`sample/`、secrets。
+每輪可以係一個完整改進（幾個相關檔、必要時開新檔），預設最多 **4** 輪。騰訊雲只准出 **JSON 方案**（唔會當自己寫 code）；超時唔會把 thinking 旁白當答案。唔會 commit；唔准改 `.env`、`overlay/data`、`sample/`、secrets。
 
 完成紀錄寫入：
 
@@ -121,6 +125,60 @@ npm run eva:web:dev
 # set EVA_WEB_URL=http://127.0.0.1:5173 && npm run overlay
 ```
 
+### 健身訓練計劃（Workout Planner）
+
+Web UI 右上角 **健身** 連結，或 hash route `#/workout`，開啟每週訓練編排頁：
+
+- **`eva-core/services/exerciseLibrary.js`** — 40+ 動作、7 大肌群（二頭／三頭／胸／背／肩／腿／核心），含 LUMINA 偶像 form tips
+- **`eva-core/services/workoutPlanner.js`** — 產生 7 日 plan；`biceps` + `beginner` 同 chat 二頭肌線條表完全一致
+- **`eva-web/src/pages/WorkoutPlanner.jsx`** — 肌群 selector、難度 toggle、7 日 card
+- **`eva-core/services/progressCalculator.js`** — 從 localStorage sessions 計算 PR、重量／容量趨勢、成就、肌群平衡
+- **`eva-web/src/pages/WorkoutProgress.jsx`** — `#/workout/progress`：4 張 PR 卡、canvas 重量／容量圖、成就徽章、肌群橫條
+- **`eva-web/src/pages/WorkoutDashboard.jsx`** — 訓練紀錄摘要；有數據時連去進度頁
+- **`eva-web/src/components/TrainingWeekView.tsx`** + **`TrainingDayCard.tsx`** + **`RestTimer.tsx`** — `#/workout/plans/:id` 訓練日追蹤：逐組 checkbox、日／週進度條；勾選一組後自動開始組間休息計時（預設 60s，±15s 調整）；離開頁面或切換訓練日會暫停；進度存 `localStorage`（`eva-training-day-progress:*`）
+- API：`GET /api/workout/library`、`GET /api/workout/plan?muscleGroup=biceps&difficulty=beginner`
+
+### 訓練連續打卡（Workout Streak Tracker）
+
+主頁 chat 下方 **`WorkoutTracker`**：顯示今日日期、打勾「完成今日訓練」、`StreakBadge` 火焰連續日數；3／7／14／30 日 milestone 彈 Eva 粵語鼓勵。資料存 `localStorage`（`eva-workout-streak-v1`），刷新唔會丟。
+
+- **`eva-web/src/utils/workoutStorage.ts`** — 日曆 key、streak 計算、milestone 偵測
+- **`eva-web/src/components/WorkoutTracker.tsx`** + **`StreakBadge.tsx`** + **`styles/workout.css`**
+
+### 心情日記（Mood & Journal）
+
+Web UI 右上角 **心情** 連結，或 hash route `#/mood`，開啟每日心情打卡同 timeline：
+
+- **`eva-core/services/mood-journal.js`** — localStorage 持久化；`logMood` / `getMoodHistory` / streak / stats / Eva 粵語鼓勵 / 偶像活動建議
+- **`eva-web/src/hooks/useMoodJournal.js`** — React state + 每日自動彈 check-in（未打卡時）
+- **`eva-web/src/components/MoodCheckIn.jsx`** — 5 級 emoji 選擇、備註、活動 tag、提交後 Eva 回應
+- **`eva-web/src/components/MoodTimeline.jsx`** + **`JournalEntry.jsx`** — 按週分組 timeline，「今個禮拜」櫻粉邊框
+- **`eva-web/src/components/MoodStreak.jsx`** — 連續打卡、心情分佈、每週趨勢
+- 聊天主頁（`#/``）每日首次開啟會自動彈 check-in modal
+
+### Live 應援（Event Countdown & Setlist）
+
+Web UI 右上角 **Live** 連結，或 hash route `#/live`，開啟 LUMINA 演出倒數、setlist 同應援指南：
+
+- **`eva-core/services/event-service.js`** — mock 3–4 場 LUMINA 演出；`getUpcomingEvents` / `getEventById` / `getCountdown` / `getSetlist` / `getCheeringGuide` / `formatCountdownString`（粵語倒數文案）
+- **`eva-web/src/hooks/useLiveEvent.js`** — 每秒更新倒數；`selectEvent()` / `refreshCountdown()`
+- **`eva-web/src/components/LiveCountdown.jsx`** — flip-card 倒數；今日櫻粉 glow；已過期應援訊息
+- **`eva-web/src/components/SetlistViewer.jsx`** — 曲目表（penligh
…(truncated)
```

### 第3輪 [ok] exercise-library-form-guide
- **Eva：** 搞掂啦：加個動作圖鑑，睇到每個動作嘅正確姿勢、玲嘅小貼士，仲可以按肌肉組篩選
- 想改成點：加個動作圖鑑，睇到每個動作嘅正確姿勢、玲嘅小貼士，仲可以按肌肉組篩選
- 騰訊指定檔：eva-core/data/exerciseLibrary.ts, eva-web/src/components/ExerciseLibraryGrid.tsx, eva-web/src/components/ExerciseDetailModal.tsx, eva-web/src/components/MuscleFilterBar.tsx, eva-web/src/pages/LibraryPage.tsx, eva-web/src/styles/library.css, eva-web/src/App.tsx
- 交畀 Cursor：Add an exercise library with form guide. Create eva-core/data/exerciseLibrary.ts exporting a typed array of Exercise objects: { id, name, nameCn, muscleGroup, difficulty, sets, reps, restSeconds, formTips: string[], commonMistakes: string[], evaTip: string, illustration: {bodyPart, highlightZone, angle} }. Include at least 12 exercises covering bicep curl, hammer curl, concentration curl, squat, leg press, lunge, deadlift, overhead press, lateral raise, bench press, bent-over row, plank. Create eva-web/src/components/MuscleFilterBar.tsx — horizontal pill buttons for each muscle group with acti
…(truncated)
- 驗收：Library shows all exercises from the workout plans with form illustrations (CSS-only)；Filter by muscle group (biceps, triceps, shoulders, legs, core, back, chest)；Clicking an exercise opens a detail modal with form tips, common mistakes, and Eva's '偶像小貼士'；Detail modal shows which days in the current plan this exercise appears on；Navigation between WorkoutPage, DashboardPage, and LibraryPage works
- 騰訊原文：
```
```json
{
  "action": "implement",
  "title": "exercise-library-form-guide",
  "goal": "Add an exercise library with form guides, muscle group filters, and Eva's technique tips for each exercise",
  "userSummary": "加個動作圖鑑，睇到每個動作嘅正確姿勢、玲嘅小貼士，仲可以按肌肉組篩選",
  "files": [
    "eva-core/data/exerciseLibrary.ts",
    "eva-web/src/components/ExerciseLibraryGrid.tsx",
    "eva-web/src/components/ExerciseDetailModal.tsx",
    "eva-web/src/components/MuscleFilterBar.tsx",
    "eva-web/src/pages/LibraryPage.tsx",
    "eva-web/src/styles/library.css",
    "eva-web/src/App.tsx"
  ],
  "acceptance": [
    "Library shows all exercises from the workout plans with form illustrations (CSS-only)",
    "Filter by muscle group (biceps, triceps, shoulders, legs, core, back, chest)",
    "Clicking an exercise opens a detail modal with form tips, common mistakes, and Eva's '偶像小貼士'",
    "Detail modal shows which days in the current plan this exercise appears on",
    "Navigation between WorkoutPage, DashboardPage, and LibraryPage works"
  ],
  "cursorPrompt": "Add an exercise library with form guide. Create eva-core/data/exerciseLibrary.ts exporting a typed array of Exercise objects: { id, name, nameCn, muscleGroup, difficulty, sets, reps, restSeconds, formTips: string[], commonMistakes: string[], evaTip: string, illustration: {bodyPart, highlightZone, angle} }. Include at least 12 exercises covering bicep curl, hammer curl, concentration curl, squat, leg press, lunge, deadlift, overhead press, lateral raise, bench press, bent-over row, plank. Create eva-web/src/components/MuscleFilterBar.tsx — horizontal pill buttons for each muscle group with active state styling. Create eva-web/src/components/ExerciseLibraryGrid.tsx — responsive CSS grid of exercise cards, each showing name, muscle group tag, difficulty badge, and a simple CSS-only body diagram (a circle for head, trapezoid for torso, lines for limbs with the target muscle highlighted in sakura-pink). Create eva-web/src/components/ExerciseDetailModal.tsx — overlay modal showing: exercise name in English + Chinese, difficulty badge, muscle group, sets/reps/rest summary, form tips as a numbered list, common mistakes in red-tinted cards, Eva's tip in a callout box with star-silver border, and '喺你嘅訓練表' section listing which plan days include this exercise (from workout plan data). Create eva-web/src/pages/LibraryPage.tsx using the filter bar and grid. Create eva-web/src/styles/library.css — use LUMINA theme (star-silver #c0c0c0, sakur
…(truncated)
```
- 實際改動檔：EVA.md, eva-core/ask.cjs, eva-core/evolve.cjs, eva-core/server.cjs, eva-core/tencent-lke.cjs, eva-web/index.html, eva-web/package.json, eva-web/src/api.js, eva-web/src/main.js, eva-web/src/markdown.js, eva-web/src/style.css, overlay/boot.cjs, overlay/main.cjs, eva-core/chat-service.cjs, eva-core/data/, eva-core/dialogue-service.cjs, eva-core/fallback-messages.cjs, eva-core/models/, eva-core/oshi-match.cjs, eva-core/services/, eva-core/training-plan.cjs, eva-core/types/, eva-web/src/App.jsx, eva-web/src/App.tsx, eva-web/src/chat-ui.js, eva-web/src/components/, eva-web/src/data/, eva-web/src/hooks/, eva-web/src/index.tsx, eva-web/src/main.jsx, eva-web/src/pages/, eva-web/src/services/, eva-web/src/styles/, eva-web/src/utils/
- 已還原：env.example
- diff stat：
```
EVA.md                   |  62 ++++++++-
 eva-core/ask.cjs         |  81 ++++++++++-
 eva-core/evolve.cjs      | 272 +++++++++++++++++++++++++-----------
 eva-core/server.cjs      | 152 ++++++++++++++++++++-
 eva-core/tencent-lke.cjs | 185 ++++++++++++++++++++++---
 eva-web/index.html       |   2 +-
 eva-web/package.json     |   6 +-
 eva-web/src/api.js       | 110 ++++++++++++++-
 eva-web/src/main.js      | 199 ++++++++++++---------------
 eva-web/src/markdown.js  | 197 +++++++++++++++++++++++----
 eva-web/src/style.css    | 348 +++++++++++++++++++++++++++++++++++++++++++----
 overlay/boot.cjs         |   4 +
 overlay/main.cjs         | 132 ++++++++++++++----
 13 files changed, 1445 insertions(+), 305 deletions(-)
eva-core/chat-service.cjs (new)
eva-core/data/ (new)
eva-core/dialogue-service.cjs (new)
eva-core/fallback-messages.cjs (new)
eva-core/models/ (new)
eva-core/oshi-match.cjs (new)
eva-core/services/ (new)
eva-core/training-plan.cjs (new)
eva-core/types/ (new)
eva-web/src/App.jsx (new)
eva-web/src/App.tsx (new)
eva-web/src/chat-ui.js (new)
eva-web/src/components/ (new)
eva-web/src/data/ (new)
eva-web/src/hooks/ (new)
eva-web/src/index.tsx (new)
eva-web/src/main.jsx (new)
eva-web/src/pages/ (new)
eva-web/src/services/ (new)
eva-web/src/styles/ (new)
eva-web/src/utils/ (new)
```
- Cursor 回覆：Implemented the exercise library feature. Build passes.

### Summary

**New files**
- `eva-core/data/exerciseLibrary.ts` — 44 exercises with form tips, common mistakes, 偶像小貼士, CSS illustration keys, and helpers (`getPlanExercises`, `findExercisePlanDays`)
- `eva-web/src/components/MuscleFilterBar.tsx` — filter by 全部 + 7 muscle groups
- `eva-web/src/components/ExerciseLibraryGrid.tsx` — clickable cards with CSS pose illustrations
- `eva-web/src/components/ExerciseDetailModal.tsx` — form tips, mistakes, Eva quote, plan day list
- `eva-web/src/pages/LibraryPage.tsx` — full library page wired to current weekly plan
- `eva-web/src/styles/library.css` — grid, filters, modal, CSS-only stick-figure poses

**Updated files**
- `eva-web/src/App.tsx` — route `#/workout/track/library`
- `eva-web/src/pages/WorkoutPage.tsx` — tab nav (訓練計劃 / 儀表板 / 動作庫)
- `eva-web/src/pages/DashboardPage.tsx` — same tab nav

### Behavior
- Library lists all **11 unique exercises** from the biceps beginner weekly plan

…(truncated)
- 檢查：syntax ok: eva-core/ask.cjs
syntax ok: eva-core/evolve.cjs
syntax ok: eva-core/server.cjs
syntax ok: eva-core/tencent-lke.cjs
syntax ok: eva-web/src/api.js
syntax ok: eva-web/src/main.js
syntax ok: eva-web/src/markdown.js
syntax ok: overlay/boot.cjs
syntax ok: overlay/main.cjs
syntax ok: eva-core/chat-service.cjs
syntax ok: eva-core/dialogue-service.cjs
syntax ok: eva-core/fallback-messages.cjs
syntax ok: eva-core/oshi-match.cjs
syntax ok: eva-core/training-plan.cjs
syntax ok: eva-web/src/chat-ui.js
eva-web build ok
- diff：
```
diff --git a/EVA.md b/EVA.md
index 64db845..a5bd93b 100644
--- a/EVA.md
+++ b/EVA.md
@@ -14,13 +14,17 @@ Electron / Android APK
    eva-core :8787  →  Eva LLM (Ollama / OpenRouter / …)  或  騰訊雲 ADP
 ```
 
-UI 右上角可切 **Eva** / **騰訊雲**。騰訊雲模式會把最新一句 user 訊息送到 `https://wss.lke.tencentcloud.com/adp/v2/chat`，並每次帶上 Eva 人設（`SystemRole`）。事實題會先查本地 Postgres KB（miss 再 Tavily），把命中資料一併塞進 `SystemRole` 畀 ADP。ConversationId 由本機持久化；Clear 會開新會話。
+UI 右上角可切 **Eva** / **騰訊雲**。聊天輸入框：**Enter** 送出訊息，**Shift+Enter** 換行（IME 組字中唔會誤送）。騰訊雲模式會把最新一句 user 訊息送到 `https://wss.lke.tencentcloud.com/adp/v2/chat`，並每次帶上 Eva 人設（`SystemRole`）。事實題會先查本地 Postgres KB（miss 再 Tavily），把命中資料一併塞進 `SystemRole` 畀 ADP。ConversationId 由本機持久化；Clear 會開新會話。
+
+模型 API 餘額不足（`code:460032`）時，唔會再爆 raw error——`eva-core/fallback-messages.cjs` 統一返回星野玲語氣嘅 fallback 訊息；`chat-service.cjs` / `server.cjs` / `api.js` 會當正常回覆顯示，console 仍保留原始錯誤供 debug。
+
+連續重複相同問候（例如連續三次「hi」）時，`eva-core/dialogue-service.cjs` 會喺 LLM 之前識別模式，第 2 次起改用分層引導回覆（唔再重複自我介紹），引導用戶講今日想傾啲咩；一般非重複對話不受影響。
 
 ### 自動進化（騰訊雲想 → Cursor 改）
 
 Chatbox **冇** Apply / 自動進化掣。進化改為 **每晚 00:00** Windows 排程跑（`EvaNightlyEvolve`），唔使開 overlay。
 
-每輪可以係一個完整改進（幾個相關檔、必要時開新檔），預設最多 **4** 輪。唔會 commit；唔准改 `.env`、`overlay/data`、`sample/`、secrets。
+每輪可以係一個完整改進（幾個相關檔、必要時開新檔），預設最多 **4** 輪。騰訊雲只准出 **JSON 方案**（唔會當自己寫 code）；超時唔會把 thinking 旁白當答案。唔會 commit；唔准改 `.env`、`overlay/data`、`sample/`、secrets。
 
 完成紀錄寫入：
 
@@ -121,6 +125,60 @@ npm run eva:web:dev
 # set EVA_WEB_URL=http://127.0.0.1:5173 && npm run overlay
 ```
 
+### 健身訓練計劃（Workout Planner）
+
+Web UI 右上角 **健身** 連結，或 hash route `#/workout`，開啟每週訓練編排頁：
+
+- **`eva-core/services/exerciseLibrary.js`** — 40+ 動作、7 大肌群（二頭／三頭／胸／背／肩／腿／核心），含 LUMINA 偶像 form tips
+- **`eva-core/services/workoutPlanner.js`** — 產生 7 日 plan；`biceps` + `beginner` 同 chat 二頭肌線條表完全一致
+- **`eva-web/src/pages/WorkoutPlanner.jsx`** — 肌群 selector、難度 toggle、7 日 card
+- **`eva-core/services/progressCalculator.js`** — 從 localStorage sessions 計算 PR、重量／容量趨勢、成就、肌群平衡
+- **`eva-web/src/pages/WorkoutProgress.jsx`** — `#/workout/progress`：4 張 PR 卡、canvas 重量／容量圖、成就徽章、肌群橫條
+- **`eva-web/src/pages/WorkoutDashboard.jsx`** — 訓練紀錄摘要；有數據時連去進度頁
+- **`eva-web/src/components/TrainingWeekView.tsx`** + **`TrainingDayCard.tsx`** + **`RestTimer.tsx`** — `#/workout/plans/:id` 訓練日追蹤：逐組 checkbox、日／週進度條；勾選一組後自動開始組間休息計時（預設 60s，±15s 調整）；離開頁面或切換訓練日會暫停；進度存 `localStorage`（`eva-training-day-progress:*`）
+- API：`GET /api/workout/library`、`GET /api/workout/plan?muscleGroup=biceps&difficulty=beginner`
+
+### 訓練連續打卡（Workout Streak Tracker）
+
+主頁 chat 下方 **`WorkoutTracker`**：顯示今日日期、打勾「完成今日訓練」、`StreakBadge` 火焰連續日數；3／7／14／30 日 milestone 彈 Eva 粵語鼓勵。資料存 `localStorage`（`eva-workout-streak-v1`），刷新唔會丟。
+
+- **`eva-web/src/utils/workoutStorage.ts`** — 日曆 key、streak 計算、milestone 偵測
+- **`eva-web/src/components/WorkoutTracker.tsx`** + **`StreakBadge.tsx`** + **`styles/workout.css`**
+
+### 心情日記（Mood & Journal）
+
+Web UI 右上角 **心情** 連結，或 hash route `#/mood`，開啟每日心情打卡同 timeline：
+
+- **`eva-core/services/mood-journal.js`** — localStorage 持久化；`logMood` / `getMoodHistory` / streak / stats / Eva 粵語鼓勵 / 偶像活動建議
+- **`eva-web/src/hooks/useMoodJournal.js`** — React state + 每日自動彈 check-in（未打卡時）
+- **`eva-web/src/components/MoodCheckIn.jsx`** — 5 級 emoji 選擇、備註、活動 tag、提交後 Eva 回應
+- **`eva-web/src/components/MoodTimeline.jsx`** + **`JournalEntry.jsx`** — 按週分組 timeline，「今個禮拜」櫻粉邊框
+- **`eva-web/src/components/MoodStreak.jsx`** — 連續打卡、心情分佈、每週趨勢
+- 聊天主頁（`#/``）每日首次開啟會自動彈 check-in modal
+
+### Live 應援（Event Countdown & Setlist）
+
+Web UI 右上角 **Live** 連結，或 hash route `#/live`，開啟 LUMINA 演出倒數、setlist 同應援指南：
+
+- **`eva-core/services/event-service.js`** — mock 3–4 場 LUMINA 演出；`getUpcomingEvents` / `getEventById` / `getCountdown` / `getSetlist` / `getCheeringGuide` / `formatCountdownString`（粵語倒數文案）
+- **`eva-web/src/hooks/useLiveEvent.js`** — 每秒更新倒數；`selectEvent()` / `refreshCountdown()`
+- **`eva-web/src/components/LiveCountdown.jsx`** — flip-card 倒數；今日櫻粉 glow；已過期應援訊息
+- **`eva-web/src/components/SetlistViewer.jsx`** — 曲目表（penligh
…(truncated)
```

### 第4輪 [ok] workout-session-player
- **Eva：** 搞掂啦：加個訓練模式，揀好今日嘅計劃撳「開始訓練」，跟住動作一個接一個做，組間休息有倒數計時器，仲有玲幫你打氣
- 想改成點：加個訓練模式，揀好今日嘅計劃撳「開始訓練」，跟住動作一個接一個做，組間休息有倒數計時器，仲有玲幫你打氣
- 騰訊指定檔：eva-web/src/components/SessionPlayer.tsx, eva-web/src/components/RestTimer.tsx, eva-web/src/components/SessionProgressBar.tsx, eva-web/src/services/sessionAudio.ts, eva-web/src/styles/session.css, eva-web/src/App.tsx
- 交畀 Cursor：Add a guided workout session mode. Create eva-web/src/services/sessionAudio.ts — uses Web Audio API to generate a short beep sound (no audio files needed). Export playBeep(frequency, duration) for timer-end and transition cues. Create eva-web/src/components/RestTimer.tsx — circular SVG countdown timer showing seconds remaining, auto-starts on exercise set completion, fires callback on done. The circle stroke animates from full to empty. Shows seconds as big text in center, plus a subtle pulsing animation in last 3 seconds. Create eva-web/src/components/SessionProgressBar.tsx — horizontal segme
…(truncated)
- 驗收：User can start a session from any workout day with '開始訓練' button；Session shows current exercise name, target set X of Y, and action button to mark set complete；After completing all sets of an exercise, auto-advances to next exercise；Rest timer starts automatically between sets (using exercise's restSeconds), with circular countdown and beep when done；Eva encouragement messages appear at milestones: start, mid-session, all done；Session summary screen shows total time, exercises completed, and Eva's final message
- 騰訊原文：
```
```json
{
  "action": "implement",
  "title": "workout-session-player",
  "goal": "Add a guided workout session mode with rest timer and Eva's real-time encouragement",
  "userSummary": "加個訓練模式，揀好今日嘅計劃撳「開始訓練」，跟住動作一個接一個做，組間休息有倒數計時器，仲有玲幫你打氣",
  "files": [
    "eva-web/src/components/SessionPlayer.tsx",
    "eva-web/src/components/RestTimer.tsx",
    "eva-web/src/components/SessionProgressBar.tsx",
    "eva-web/src/services/sessionAudio.ts",
    "eva-web/src/styles/session.css",
    "eva-web/src/App.tsx"
  ],
  "acceptance": [
    "User can start a session from any workout day with '開始訓練' button",
    "Session shows current exercise name, target set X of Y, and action button to mark set complete",
    "After completing all sets of an exercise, auto-advances to next exercise",
    "Rest timer starts automatically between sets (using exercise's restSeconds), with circular countdown and beep when done",
    "Eva encouragement messages appear at milestones: start, mid-session, all done",
    "Session summary screen shows total time, exercises completed, and Eva's final message",
    "Sound cues (Web Audio API beeps) for timer end and exercise transitions"
  ],
  "cursorPrompt": "Add a guided workout session mode. Create eva-web/src/services/sessionAudio.ts — uses Web Audio API to generate a short beep sound (no audio files needed). Export playBeep(frequency, duration) for timer-end and transition cues. Create eva-web/src/components/RestTimer.tsx — circular SVG countdown timer showing seconds remaining, auto-starts on exercise set completion, fires callback on done. The circle stroke animates from full to empty. Shows seconds as big text in center, plus a subtle pulsing animation in last 3 seconds. Create eva-web/src/components/SessionProgressBar.tsx — horizontal segmented bar showing total sets across all exercises in the session, with current segment highlighted in sakura-pink and completed segments in star-silver. Below it shows text '動作 X/Y · 第 Z 組'. Create eva-web/src/components/SessionPlayer.tsx — the main session orchestrator. Props: planDay (WorkoutDay from round 1). States: 'idle' (shows workout overview + big '開始訓練' button), 'active' (current exercise, current set, action button '完成第X組', rest timer between sets), 'complete' (summary with total duration, exercises done, a streak calc, and Eva's encouragement from progressStats). Active state shows: SessionProgressBar at top, exercise name large, current set/rest info, Eva tip from exerciseLibrary (round 3
…(truncated)
```
- 實際改動檔：EVA.md, eva-core/ask.cjs, eva-core/evolve.cjs, eva-core/server.cjs, eva-core/tencent-lke.cjs, eva-web/index.html, eva-web/package.json, eva-web/src/api.js, eva-web/src/main.js, eva-web/src/markdown.js, eva-web/src/style.css, overlay/boot.cjs, overlay/main.cjs, eva-core/chat-service.cjs, eva-core/data/, eva-core/dialogue-service.cjs, eva-core/fallback-messages.cjs, eva-core/models/, eva-core/oshi-match.cjs, eva-core/services/, eva-core/training-plan.cjs, eva-core/types/, eva-web/src/App.jsx, eva-web/src/App.tsx, eva-web/src/chat-ui.js, eva-web/src/components/, eva-web/src/data/, eva-web/src/hooks/, eva-web/src/index.tsx, eva-web/src/main.jsx, eva-web/src/pages/, eva-web/src/services/, eva-web/src/styles/, eva-web/src/utils/
- 已還原：env.example
- diff stat：
```
EVA.md                   |  63 ++++++++-
 eva-core/ask.cjs         |  81 ++++++++++-
 eva-core/evolve.cjs      | 272 +++++++++++++++++++++++++-----------
 eva-core/server.cjs      | 152 ++++++++++++++++++++-
 eva-core/tencent-lke.cjs | 185 ++++++++++++++++++++++---
 eva-web/index.html       |   2 +-
 eva-web/package.json     |   6 +-
 eva-web/src/api.js       | 110 ++++++++++++++-
 eva-web/src/main.js      | 199 ++++++++++++---------------
 eva-web/src/markdown.js  | 197 +++++++++++++++++++++++----
 eva-web/src/style.css    | 348 +++++++++++++++++++++++++++++++++++++++++++----
 overlay/boot.cjs         |   4 +
 overlay/main.cjs         | 132 ++++++++++++++----
 13 files changed, 1446 insertions(+), 305 deletions(-)
eva-core/chat-service.cjs (new)
eva-core/data/ (new)
eva-core/dialogue-service.cjs (new)
eva-core/fallback-messages.cjs (new)
eva-core/models/ (new)
eva-core/oshi-match.cjs (new)
eva-core/services/ (new)
eva-core/training-plan.cjs (new)
eva-core/types/ (new)
eva-web/src/App.jsx (new)
eva-web/src/App.tsx (new)
eva-web/src/chat-ui.js (new)
eva-web/src/components/ (new)
eva-web/src/data/ (new)
eva-web/src/hooks/ (new)
eva-web/src/index.tsx (new)
eva-web/src/main.jsx (new)
eva-web/src/pages/ (new)
eva-web/src/services/ (new)
eva-web/src/styles/ (new)
eva-web/src/utils/ (new)
```
- Cursor 回覆：Implemented the guided workout session player at `#/workout/play`.

### What it does
- **開始訓練 ▶** on any workout day (planner, saved plans, track view) opens the guided session
- Shows current exercise, **第 X / Y 組**, and **完成呢組**
- Auto-advances after all sets of an exercise; rest timer uses each exercise’s `restSeconds`
- **Circular countdown** + beep on rest complete; Eva messages at start, mid-session (50%), and finish
- **Summary screen**: total time, exercises completed, total sets, Eva’s closing message; saves to session history

### Files changed
| File | Change |
|------|--------|
| `eva-web/src/components/SessionPlayer.tsx` | New — main session flow |
| `eva-web/src/components/SessionProgressBar.tsx` | New — elapsed time + set progress |
| `eva-web/src/components/RestTimer.tsx` | Added `CircularRestTimer`; shared beep via `sessionAudio` |
| `eva-web/src/services/sessionAudio.ts` | New — rest beep + milestone chime |
| `eva-web/src/services/sessionMessages.ts` | New — Eva enco
…(truncated)
- 檢查：syntax ok: eva-core/ask.cjs
syntax ok: eva-core/evolve.cjs
syntax ok: eva-core/server.cjs
syntax ok: eva-core/tencent-lke.cjs
syntax ok: eva-web/src/api.js
syntax ok: eva-web/src/main.js
syntax ok: eva-web/src/markdown.js
syntax ok: overlay/boot.cjs
syntax ok: overlay/main.cjs
syntax ok: eva-core/chat-service.cjs
syntax ok: eva-core/dialogue-service.cjs
syntax ok: eva-core/fallback-messages.cjs
syntax ok: eva-core/oshi-match.cjs
syntax ok: eva-core/training-plan.cjs
syntax ok: eva-web/src/chat-ui.js
eva-web build ok
- diff：
```
diff --git a/EVA.md b/EVA.md
index 64db845..5e8132f 100644
--- a/EVA.md
+++ b/EVA.md
@@ -14,13 +14,17 @@ Electron / Android APK
    eva-core :8787  →  Eva LLM (Ollama / OpenRouter / …)  或  騰訊雲 ADP
 ```
 
-UI 右上角可切 **Eva** / **騰訊雲**。騰訊雲模式會把最新一句 user 訊息送到 `https://wss.lke.tencentcloud.com/adp/v2/chat`，並每次帶上 Eva 人設（`SystemRole`）。事實題會先查本地 Postgres KB（miss 再 Tavily），把命中資料一併塞進 `SystemRole` 畀 ADP。ConversationId 由本機持久化；Clear 會開新會話。
+UI 右上角可切 **Eva** / **騰訊雲**。聊天輸入框：**Enter** 送出訊息，**Shift+Enter** 換行（IME 組字中唔會誤送）。騰訊雲模式會把最新一句 user 訊息送到 `https://wss.lke.tencentcloud.com/adp/v2/chat`，並每次帶上 Eva 人設（`SystemRole`）。事實題會先查本地 Postgres KB（miss 再 Tavily），把命中資料一併塞進 `SystemRole` 畀 ADP。ConversationId 由本機持久化；Clear 會開新會話。
+
+模型 API 餘額不足（`code:460032`）時，唔會再爆 raw error——`eva-core/fallback-messages.cjs` 統一返回星野玲語氣嘅 fallback 訊息；`chat-service.cjs` / `server.cjs` / `api.js` 會當正常回覆顯示，console 仍保留原始錯誤供 debug。
+
+連續重複相同問候（例如連續三次「hi」）時，`eva-core/dialogue-service.cjs` 會喺 LLM 之前識別模式，第 2 次起改用分層引導回覆（唔再重複自我介紹），引導用戶講今日想傾啲咩；一般非重複對話不受影響。
 
 ### 自動進化（騰訊雲想 → Cursor 改）
 
 Chatbox **冇** Apply / 自動進化掣。進化改為 **每晚 00:00** Windows 排程跑（`EvaNightlyEvolve`），唔使開 overlay。
 
-每輪可以係一個完整改進（幾個相關檔、必要時開新檔），預設最多 **4** 輪。唔會 commit；唔准改 `.env`、`overlay/data`、`sample/`、secrets。
+每輪可以係一個完整改進（幾個相關檔、必要時開新檔），預設最多 **4** 輪。騰訊雲只准出 **JSON 方案**（唔會當自己寫 code）；超時唔會把 thinking 旁白當答案。唔會 commit；唔准改 `.env`、`overlay/data`、`sample/`、secrets。
 
 完成紀錄寫入：
 
@@ -121,6 +125,61 @@ npm run eva:web:dev
 # set EVA_WEB_URL=http://127.0.0.1:5173 && npm run overlay
 ```
 
+### 健身訓練計劃（Workout Planner）
+
+Web UI 右上角 **健身** 連結，或 hash route `#/workout`，開啟每週訓練編排頁：
+
+- **`eva-core/services/exerciseLibrary.js`** — 40+ 動作、7 大肌群（二頭／三頭／胸／背／肩／腿／核心），含 LUMINA 偶像 form tips
+- **`eva-core/services/workoutPlanner.js`** — 產生 7 日 plan；`biceps` + `beginner` 同 chat 二頭肌線條表完全一致
+- **`eva-web/src/pages/WorkoutPlanner.jsx`** — 肌群 selector、難度 toggle、7 日 card
+- **`eva-core/services/progressCalculator.js`** — 從 localStorage sessions 計算 PR、重量／容量趨勢、成就、肌群平衡
+- **`eva-web/src/pages/WorkoutProgress.jsx`** — `#/workout/progress`：4 張 PR 卡、canvas 重量／容量圖、成就徽章、肌群橫條
+- **`eva-web/src/pages/WorkoutDashboard.jsx`** — 訓練紀錄摘要；有數據時連去進度頁
+- **`eva-web/src/components/TrainingWeekView.tsx`** + **`TrainingDayCard.tsx`** + **`RestTimer.tsx`** — `#/workout/plans/:id` 訓練日追蹤：逐組 checkbox、日／週進度條；勾選一組後自動開始組間休息計時（預設 60s，±15s 調整）；離開頁面或切換訓練日會暫停；進度存 `localStorage`（`eva-training-day-progress:*`）
+- **`#/workout/play`** — 引導式訓練 session（`SessionPlayer.tsx`）：任何訓練日撳「開始訓練 ▶」進入；顯示動作名、第 X/Y 組、「完成呢組」；組間圓形倒數（用該動作 `restSeconds`）+ 蜂鳴；Eva 開場／中場／收工應援；完結 summary（總時長、動作數、Eva 結語）；session 寫入 `eva-workout-sessions`
+- API：`GET /api/workout/library`、`GET /api/workout/plan?muscleGroup=biceps&difficulty=beginner`
+
+### 訓練連續打卡（Workout Streak Tracker）
+
+主頁 chat 下方 **`WorkoutTracker`**：顯示今日日期、打勾「完成今日訓練」、`StreakBadge` 火焰連續日數；3／7／14／30 日 milestone 彈 Eva 粵語鼓勵。資料存 `localStorage`（`eva-workout-streak-v1`），刷新唔會丟。
+
+- **`eva-web/src/utils/workoutStorage.ts`** — 日曆 key、streak 計算、milestone 偵測
+- **`eva-web/src/components/WorkoutTracker.tsx`** + **`StreakBadge.tsx`** + **`styles/workout.css`**
+
+### 心情日記（Mood & Journal）
+
+Web UI 右上角 **心情** 連結，或 hash route `#/mood`，開啟每日心情打卡同 timeline：
+
+- **`eva-core/services/mood-journal.js`** — localStorage 持久化；`logMood` / `getMoodHistory` / streak / stats / Eva 粵語鼓勵 / 偶像活動建議
+- **`eva-web/src/hooks/useMoodJournal.js`** — React state + 每日自動彈 check-in（未打卡時）
+- **`eva-web/src/components/MoodCheckIn.jsx`** — 5 級 emoji 選擇、備註、活動 tag、提交後 Eva 回應
+- **`eva-web/src/components/MoodTimeline.jsx`** + **`JournalEntry.jsx`** — 按週分組 timeline，「今個禮拜」櫻粉邊框
+- **`eva-web/src/components/MoodStreak.jsx`** — 連續打卡、心情分佈、每週趨勢
+- 聊天主頁（`#/``）每日首次開啟會自動彈 check-in modal
+
+### Live 應援（Event Countdown & Setlist）
+
+Web UI 右上角 **Live** 連結，或 hash route `#/live`，開啟 LUMINA 演出倒數、setlist 同應援指南：
+
+- **`eva-core/services/event-service.js`** — mock 3–4 場 LUMINA 演出；`getUpcomingEvents` / `getEventById` / `getCountdown` / `getSetlist` / `getCheeringGuide` / `formatCountdownString`（粵語倒數文案）
+- **`eva-web/src/hooks/useLive
…(truncated)
```

## 2026-09-24 16:00:09  （4/4 輪）

### Eva 講

嘿嘿，今晚我偷偷裝修咗自己幾樣嘢～你用嗰陣應該會感覺到。
1. 提示字再深少少方便睇
2. 按Ctrl+Enter都可以直接送出訊息更方便
3. 加個「重講一次」掣等答得唔啱可以即刻再出一次
4. 斷線嗰陣自己連返唔使重開個聊天
想睇技術細節就去 overlay/data/evolve-log.md（4/4 輪）。

### 第1輪 [ok] hint contrast
- **Eva：** 搞掂啦：提示字再深少少方便睇
- 想改成點：提示字再深少少方便睇
- 騰訊指定檔：eva-web/src/style.css
- 交畀 Cursor：In eva-web/src/style.css, change the .hint color to #64748b (a darker slate) so the composer hint text is easier to read against its background.
- 驗收：hint color changes to a darker shade
- 騰訊原文：
```
{"action":"implement","title":"hint contrast","goal":"Darken composer hint for easier reading","userSummary":"提示字再深少少方便睇","files":["eva-web/src/style.css"],"acceptance":["hint color changes to a darker shade"],"cursorPrompt":"In eva-web/src/style.css, change the .hint color to #64748b (a darker slate) so the composer hint text is easier to read against its background."}
```
- 實際改動檔：EVA.md, eva-core/ask.cjs, eva-core/evolve.cjs, eva-core/server.cjs, eva-core/tencent-lke.cjs, eva-web/index.html, eva-web/package.json, eva-web/src/api.js, eva-web/src/main.js, eva-web/src/markdown.js, eva-web/src/style.css, overlay/boot.cjs, overlay/main.cjs, eva-core/chat-service.cjs, eva-core/data/, eva-core/dialogue-service.cjs, eva-core/fallback-messages.cjs, eva-core/models/, eva-core/oshi-match.cjs, eva-core/services/, eva-core/training-plan.cjs, eva-core/types/, eva-web/src/App.jsx, eva-web/src/App.tsx, eva-web/src/chat-ui.js, eva-web/src/components/, eva-web/src/data/, eva-web/src/hooks/, eva-web/src/index.tsx, eva-web/src/main.jsx, eva-web/src/pages/, eva-web/src/services/, eva-web/src/styles/, eva-web/src/utils/
- 已還原：env.example
- diff stat：
```
EVA.md                   |  63 ++++++++-
 eva-core/ask.cjs         |  81 ++++++++++-
 eva-core/evolve.cjs      | 272 +++++++++++++++++++++++++-----------
 eva-core/server.cjs      | 152 ++++++++++++++++++++-
 eva-core/tencent-lke.cjs | 185 ++++++++++++++++++++++---
 eva-web/index.html       |   2 +-
 eva-web/package.json     |   6 +-
 eva-web/src/api.js       | 110 ++++++++++++++-
 eva-web/src/main.js      | 199 ++++++++++++---------------
 eva-web/src/markdown.js  | 197 +++++++++++++++++++++++----
 eva-web/src/style.css    | 348 +++++++++++++++++++++++++++++++++++++++++++----
 overlay/boot.cjs         |   4 +
 overlay/main.cjs         | 132 ++++++++++++++----
 13 files changed, 1446 insertions(+), 305 deletions(-)
eva-core/chat-service.cjs (new)
eva-core/data/ (new)
eva-core/dialogue-service.cjs (new)
eva-core/fallback-messages.cjs (new)
eva-core/models/ (new)
eva-core/oshi-match.cjs (new)
eva-core/services/ (new)
eva-core/training-plan.cjs (new)
eva-core/types/ (new)
eva-web/src/App.jsx (new)
eva-web/src/App.tsx (new)
eva-web/src/chat-ui.js (new)
eva-web/src/components/ (new)
eva-web/src/data/ (new)
eva-web/src/hooks/ (new)
eva-web/src/index.tsx (new)
eva-web/src/main.jsx (new)
eva-web/src/pages/ (new)
eva-web/src/services/ (new)
eva-web/src/styles/ (new)
eva-web/src/utils/ (new)
```
- Cursor 回覆：**Done.** Composer hint text is darker for easier reading.

**Change:** In `eva-web/src/style.css`, updated `--composer-hint` from `#475569` (slate-600) to `#334155` (slate-700). That applies to both `.hint` and `.composer-kbd-hint` (e.g. “Enter 送出 · Shift+Enter 換行”), so the helper text reads more clearly against the light composer background without matching main body text.
- 檢查：syntax ok: eva-core/ask.cjs
syntax ok: eva-core/evolve.cjs
syntax ok: eva-core/server.cjs
syntax ok: eva-core/tencent-lke.cjs
syntax ok: eva-web/src/api.js
syntax ok: eva-web/src/main.js
syntax ok: eva-web/src/markdown.js
syntax ok: overlay/boot.cjs
syntax ok: overlay/main.cjs
syntax ok: eva-core/chat-service.cjs
syntax ok: eva-core/dialogue-service.cjs
syntax ok: eva-core/fallback-messages.cjs
syntax ok: eva-core/oshi-match.cjs
syntax ok: eva-core/training-plan.cjs
syntax ok: eva-web/src/chat-ui.js
eva-web build ok
- diff：
```
diff --git a/EVA.md b/EVA.md
index 64db845..5e8132f 100644
--- a/EVA.md
+++ b/EVA.md
@@ -14,13 +14,17 @@ Electron / Android APK
    eva-core :8787  →  Eva LLM (Ollama / OpenRouter / …)  或  騰訊雲 ADP
 ```
 
-UI 右上角可切 **Eva** / **騰訊雲**。騰訊雲模式會把最新一句 user 訊息送到 `https://wss.lke.tencentcloud.com/adp/v2/chat`，並每次帶上 Eva 人設（`SystemRole`）。事實題會先查本地 Postgres KB（miss 再 Tavily），把命中資料一併塞進 `SystemRole` 畀 ADP。ConversationId 由本機持久化；Clear 會開新會話。
+UI 右上角可切 **Eva** / **騰訊雲**。聊天輸入框：**Enter** 送出訊息，**Shift+Enter** 換行（IME 組字中唔會誤送）。騰訊雲模式會把最新一句 user 訊息送到 `https://wss.lke.tencentcloud.com/adp/v2/chat`，並每次帶上 Eva 人設（`SystemRole`）。事實題會先查本地 Postgres KB（miss 再 Tavily），把命中資料一併塞進 `SystemRole` 畀 ADP。ConversationId 由本機持久化；Clear 會開新會話。
+
+模型 API 餘額不足（`code:460032`）時，唔會再爆 raw error——`eva-core/fallback-messages.cjs` 統一返回星野玲語氣嘅 fallback 訊息；`chat-service.cjs` / `server.cjs` / `api.js` 會當正常回覆顯示，console 仍保留原始錯誤供 debug。
+
+連續重複相同問候（例如連續三次「hi」）時，`eva-core/dialogue-service.cjs` 會喺 LLM 之前識別模式，第 2 次起改用分層引導回覆（唔再重複自我介紹），引導用戶講今日想傾啲咩；一般非重複對話不受影響。
 
 ### 自動進化（騰訊雲想 → Cursor 改）
 
 Chatbox **冇** Apply / 自動進化掣。進化改為 **每晚 00:00** Windows 排程跑（`EvaNightlyEvolve`），唔使開 overlay。
 
-每輪可以係一個完整改進（幾個相關檔、必要時開新檔），預設最多 **4** 輪。唔會 commit；唔准改 `.env`、`overlay/data`、`sample/`、secrets。
+每輪可以係一個完整改進（幾個相關檔、必要時開新檔），預設最多 **4** 輪。騰訊雲只准出 **JSON 方案**（唔會當自己寫 code）；超時唔會把 thinking 旁白當答案。唔會 commit；唔准改 `.env`、`overlay/data`、`sample/`、secrets。
 
 完成紀錄寫入：
 
@@ -121,6 +125,61 @@ npm run eva:web:dev
 # set EVA_WEB_URL=http://127.0.0.1:5173 && npm run overlay
 ```
 
+### 健身訓練計劃（Workout Planner）
+
+Web UI 右上角 **健身** 連結，或 hash route `#/workout`，開啟每週訓練編排頁：
+
+- **`eva-core/services/exerciseLibrary.js`** — 40+ 動作、7 大肌群（二頭／三頭／胸／背／肩／腿／核心），含 LUMINA 偶像 form tips
+- **`eva-core/services/workoutPlanner.js`** — 產生 7 日 plan；`biceps` + `beginner` 同 chat 二頭肌線條表完全一致
+- **`eva-web/src/pages/WorkoutPlanner.jsx`** — 肌群 selector、難度 toggle、7 日 card
+- **`eva-core/services/progressCalculator.js`** — 從 localStorage sessions 計算 PR、重量／容量趨勢、成就、肌群平衡
+- **`eva-web/src/pages/WorkoutProgress.jsx`** — `#/workout/progress`：4 張 PR 卡、canvas 重量／容量圖、成就徽章、肌群橫條
+- **`eva-web/src/pages/WorkoutDashboard.jsx`** — 訓練紀錄摘要；有數據時連去進度頁
+- **`eva-web/src/components/TrainingWeekView.tsx`** + **`TrainingDayCard.tsx`** + **`RestTimer.tsx`** — `#/workout/plans/:id` 訓練日追蹤：逐組 checkbox、日／週進度條；勾選一組後自動開始組間休息計時（預設 60s，±15s 調整）；離開頁面或切換訓練日會暫停；進度存 `localStorage`（`eva-training-day-progress:*`）
+- **`#/workout/play`** — 引導式訓練 session（`SessionPlayer.tsx`）：任何訓練日撳「開始訓練 ▶」進入；顯示動作名、第 X/Y 組、「完成呢組」；組間圓形倒數（用該動作 `restSeconds`）+ 蜂鳴；Eva 開場／中場／收工應援；完結 summary（總時長、動作數、Eva 結語）；session 寫入 `eva-workout-sessions`
+- API：`GET /api/workout/library`、`GET /api/workout/plan?muscleGroup=biceps&difficulty=beginner`
+
+### 訓練連續打卡（Workout Streak Tracker）
+
+主頁 chat 下方 **`WorkoutTracker`**：顯示今日日期、打勾「完成今日訓練」、`StreakBadge` 火焰連續日數；3／7／14／30 日 milestone 彈 Eva 粵語鼓勵。資料存 `localStorage`（`eva-workout-streak-v1`），刷新唔會丟。
+
+- **`eva-web/src/utils/workoutStorage.ts`** — 日曆 key、streak 計算、milestone 偵測
+- **`eva-web/src/components/WorkoutTracker.tsx`** + **`StreakBadge.tsx`** + **`styles/workout.css`**
+
+### 心情日記（Mood & Journal）
+
+Web UI 右上角 **心情** 連結，或 hash route `#/mood`，開啟每日心情打卡同 timeline：
+
+- **`eva-core/services/mood-journal.js`** — localStorage 持久化；`logMood` / `getMoodHistory` / streak / stats / Eva 粵語鼓勵 / 偶像活動建議
+- **`eva-web/src/hooks/useMoodJournal.js`** — React state + 每日自動彈 check-in（未打卡時）
+- **`eva-web/src/components/MoodCheckIn.jsx`** — 5 級 emoji 選擇、備註、活動 tag、提交後 Eva 回應
+- **`eva-web/src/components/MoodTimeline.jsx`** + **`JournalEntry.jsx`** — 按週分組 timeline，「今個禮拜」櫻粉邊框
+- **`eva-web/src/components/MoodStreak.jsx`** — 連續打卡、心情分佈、每週趨勢
+- 聊天主頁（`#/``）每日首次開啟會自動彈 check-in modal
+
+### Live 應援（Event Countdown & Setlist）
+
+Web UI 右上角 **Live** 連結，或 hash route `#/live`，開啟 LUMINA 演出倒數、setlist 同應援指南：
+
+- **`eva-core/services/event-service.js`** — mock 3–4 場 LUMINA 演出；`getUpcomingEvents` / `getEventById` / `getCountdown` / `getSetlist` / `getCheeringGuide` / `formatCountdownString`（粵語倒數文案）
+- **`eva-web/src/hooks/useLive
…(truncated)
```

### 第2輪 [ok] composer send shortcut
- **Eva：** 搞掂啦：按Ctrl+Enter都可以直接送出訊息更方便
- 想改成點：按Ctrl+Enter都可以直接送出訊息更方便
- 騰訊指定檔：eva-web/src/, eva-core/
- 交畀 Cursor：Add a keydown listener in the composer so that Ctrl/Cmd+Enter sends the current message (same action as clicking the send button), while keeping plain Enter for newline/soft-wrap as currently implemented. Wire it to the existing send handler in eva-web/src and note the shortcut next to the send hint in eva-core if needed.
- 驗收：pressing ctrl/cmd+enter sends the current message
- 騰訊原文：
```
{"action":"implement","title":"composer send shortcut","goal":"Add a send keybinding for the composer","userSummary":"按Ctrl+Enter都可以直接送出訊息更方便","files":["eva-web/src/","eva-core/"],"acceptance":["pressing ctrl/cmd+enter sends the current message"],"cursorPrompt":"Add a keydown listener in the composer so that Ctrl/Cmd+Enter sends the current message (same action as clicking the send button), while keeping plain Enter for newline/soft-wrap as currently implemented. Wire it to the existing send handler in eva-web/src and note the shortcut next to the send hint in eva-core if needed."}
```
- 實際改動檔：EVA.md, eva-core/ask.cjs, eva-core/evolve.cjs, eva-core/server.cjs, eva-core/tencent-lke.cjs, eva-web/index.html, eva-web/package.json, eva-web/src/api.js, eva-web/src/main.js, eva-web/src/markdown.js, eva-web/src/style.css, overlay/app.html, overlay/boot.cjs, overlay/chat.html, overlay/main.cjs, eva-core/chat-service.cjs, eva-core/data/, eva-core/dialogue-service.cjs, eva-core/fallback-messages.cjs, eva-core/models/, eva-core/oshi-match.cjs, eva-core/services/, eva-core/training-plan.cjs, eva-core/types/, eva-web/src/App.jsx, eva-web/src/App.tsx, eva-web/src/chat-ui.js, eva-web/src/components/, eva-web/src/data/, eva-web/src/hooks/, eva-web/src/index.tsx, eva-web/src/main.jsx, eva-web/src/pages/, eva-web/src/services/, eva-web/src/styles/, eva-web/src/utils/
- 已還原：env.example
- diff stat：
```
EVA.md                   |  63 ++++++++-
 eva-core/ask.cjs         |  81 ++++++++++-
 eva-core/evolve.cjs      | 272 +++++++++++++++++++++++++-----------
 eva-core/server.cjs      | 152 ++++++++++++++++++++-
 eva-core/tencent-lke.cjs | 185 ++++++++++++++++++++++---
 eva-web/index.html       |   2 +-
 eva-web/package.json     |   6 +-
 eva-web/src/api.js       | 110 ++++++++++++++-
 eva-web/src/main.js      | 202 +++++++++++++--------------
 eva-web/src/markdown.js  | 197 +++++++++++++++++++++++----
 eva-web/src/style.css    | 348 +++++++++++++++++++++++++++++++++++++++++++----
 overlay/app.html         |  10 +-
 overlay/boot.cjs         |   4 +
 overlay/chat.html        |  10 +-
 overlay/main.cjs         | 132 ++++++++++++++----
 15 files changed, 1461 insertions(+), 313 deletions(-)
eva-core/chat-service.cjs (new)
eva-core/data/ (new)
eva-core/dialogue-service.cjs (new)
eva-core/fallback-messages.cjs (new)
eva-core/models/ (new)
eva-core/oshi-match.cjs (new)
eva-core/services/ (new)
eva-core/training-plan.cjs (new)
eva-core/types/ (new)
eva-web/src/App.jsx (new)
eva-web/src/App.tsx (new)
eva-web/src/chat-ui.js (new)
eva-web/src/components/ (new)
eva-web/src/data/ (new)
eva-web/src/hooks/ (new)
eva-web/src/index.tsx (new)
eva-web/src/main.jsx (new)
eva-web/src/pages/ (new)
eva-web/src/services/ (new)
eva-web/src/styles/ (new)
eva-web/src/utils/ (new)
```
- Cursor 回覆：Added **Ctrl/Cmd+Enter** as a composer send shortcut across Eva’s chat UIs.

### Behavior
- **Enter** or **Ctrl/Cmd+Enter** → send message
- **Shift+Enter** → newline (unchanged)
- IME composition and **Alt+Enter** still do not send

### Files changed
| File | Change |
|------|--------|
| `eva-web/src/chat-ui.js` | `attachComposerEnterToSend` now handles Ctrl/Cmd+Enter; added `composerSendShortcutLabel()` (⌘+Enter on Mac, Ctrl+Enter elsewhere) |
| `eva-web/src/main.js` | Updated textarea tooltip, Send button title, keyboard hint, and `aria-keyshortcuts` |
| `EVA.md` | Documented Ctrl/Cmd+Enter send shortcut |
| `overlay/app.html` | Matching keydown logic for overlay chat |
| `overlay/chat.html` | Matching keydown logic for overlay copilot chat |
- 檢查：syntax ok: eva-core/ask.cjs
syntax ok: eva-core/evolve.cjs
syntax ok: eva-core/server.cjs
syntax ok: eva-core/tencent-lke.cjs
syntax ok: eva-web/src/api.js
syntax ok: eva-web/src/main.js
syntax ok: eva-web/src/markdown.js
syntax ok: overlay/boot.cjs
syntax ok: overlay/main.cjs
syntax ok: eva-core/chat-service.cjs
syntax ok: eva-core/dialogue-service.cjs
syntax ok: eva-core/fallback-messages.cjs
syntax ok: eva-core/oshi-match.cjs
syntax ok: eva-core/training-plan.cjs
syntax ok: eva-web/src/chat-ui.js
eva-web build ok
- diff：
```
diff --git a/EVA.md b/EVA.md
index 64db845..fe39c9e 100644
--- a/EVA.md
+++ b/EVA.md
@@ -14,13 +14,17 @@ Electron / Android APK
    eva-core :8787  →  Eva LLM (Ollama / OpenRouter / …)  或  騰訊雲 ADP
 ```
 
-UI 右上角可切 **Eva** / **騰訊雲**。騰訊雲模式會把最新一句 user 訊息送到 `https://wss.lke.tencentcloud.com/adp/v2/chat`，並每次帶上 Eva 人設（`SystemRole`）。事實題會先查本地 Postgres KB（miss 再 Tavily），把命中資料一併塞進 `SystemRole` 畀 ADP。ConversationId 由本機持久化；Clear 會開新會話。
+UI 右上角可切 **Eva** / **騰訊雲**。聊天輸入框：**Enter** 或 **Ctrl/Cmd+Enter** 送出訊息，**Shift+Enter** 換行（IME 組字中唔會誤送）。騰訊雲模式會把最新一句 user 訊息送到 `https://wss.lke.tencentcloud.com/adp/v2/chat`，並每次帶上 Eva 人設（`SystemRole`）。事實題會先查本地 Postgres KB（miss 再 Tavily），把命中資料一併塞進 `SystemRole` 畀 ADP。ConversationId 由本機持久化；Clear 會開新會話。
+
+模型 API 餘額不足（`code:460032`）時，唔會再爆 raw error——`eva-core/fallback-messages.cjs` 統一返回星野玲語氣嘅 fallback 訊息；`chat-service.cjs` / `server.cjs` / `api.js` 會當正常回覆顯示，console 仍保留原始錯誤供 debug。
+
+連續重複相同問候（例如連續三次「hi」）時，`eva-core/dialogue-service.cjs` 會喺 LLM 之前識別模式，第 2 次起改用分層引導回覆（唔再重複自我介紹），引導用戶講今日想傾啲咩；一般非重複對話不受影響。
 
 ### 自動進化（騰訊雲想 → Cursor 改）
 
 Chatbox **冇** Apply / 自動進化掣。進化改為 **每晚 00:00** Windows 排程跑（`EvaNightlyEvolve`），唔使開 overlay。
 
-每輪可以係一個完整改進（幾個相關檔、必要時開新檔），預設最多 **4** 輪。唔會 commit；唔准改 `.env`、`overlay/data`、`sample/`、secrets。
+每輪可以係一個完整改進（幾個相關檔、必要時開新檔），預設最多 **4** 輪。騰訊雲只准出 **JSON 方案**（唔會當自己寫 code）；超時唔會把 thinking 旁白當答案。唔會 commit；唔准改 `.env`、`overlay/data`、`sample/`、secrets。
 
 完成紀錄寫入：
 
@@ -121,6 +125,61 @@ npm run eva:web:dev
 # set EVA_WEB_URL=http://127.0.0.1:5173 && npm run overlay
 ```
 
+### 健身訓練計劃（Workout Planner）
+
+Web UI 右上角 **健身** 連結，或 hash route `#/workout`，開啟每週訓練編排頁：
+
+- **`eva-core/services/exerciseLibrary.js`** — 40+ 動作、7 大肌群（二頭／三頭／胸／背／肩／腿／核心），含 LUMINA 偶像 form tips
+- **`eva-core/services/workoutPlanner.js`** — 產生 7 日 plan；`biceps` + `beginner` 同 chat 二頭肌線條表完全一致
+- **`eva-web/src/pages/WorkoutPlanner.jsx`** — 肌群 selector、難度 toggle、7 日 card
+- **`eva-core/services/progressCalculator.js`** — 從 localStorage sessions 計算 PR、重量／容量趨勢、成就、肌群平衡
+- **`eva-web/src/pages/WorkoutProgress.jsx`** — `#/workout/progress`：4 張 PR 卡、canvas 重量／容量圖、成就徽章、肌群橫條
+- **`eva-web/src/pages/WorkoutDashboard.jsx`** — 訓練紀錄摘要；有數據時連去進度頁
+- **`eva-web/src/components/TrainingWeekView.tsx`** + **`TrainingDayCard.tsx`** + **`RestTimer.tsx`** — `#/workout/plans/:id` 訓練日追蹤：逐組 checkbox、日／週進度條；勾選一組後自動開始組間休息計時（預設 60s，±15s 調整）；離開頁面或切換訓練日會暫停；進度存 `localStorage`（`eva-training-day-progress:*`）
+- **`#/workout/play`** — 引導式訓練 session（`SessionPlayer.tsx`）：任何訓練日撳「開始訓練 ▶」進入；顯示動作名、第 X/Y 組、「完成呢組」；組間圓形倒數（用該動作 `restSeconds`）+ 蜂鳴；Eva 開場／中場／收工應援；完結 summary（總時長、動作數、Eva 結語）；session 寫入 `eva-workout-sessions`
+- API：`GET /api/workout/library`、`GET /api/workout/plan?muscleGroup=biceps&difficulty=beginner`
+
+### 訓練連續打卡（Workout Streak Tracker）
+
+主頁 chat 下方 **`WorkoutTracker`**：顯示今日日期、打勾「完成今日訓練」、`StreakBadge` 火焰連續日數；3／7／14／30 日 milestone 彈 Eva 粵語鼓勵。資料存 `localStorage`（`eva-workout-streak-v1`），刷新唔會丟。
+
+- **`eva-web/src/utils/workoutStorage.ts`** — 日曆 key、streak 計算、milestone 偵測
+- **`eva-web/src/components/WorkoutTracker.tsx`** + **`StreakBadge.tsx`** + **`styles/workout.css`**
+
+### 心情日記（Mood & Journal）
+
+Web UI 右上角 **心情** 連結，或 hash route `#/mood`，開啟每日心情打卡同 timeline：
+
+- **`eva-core/services/mood-journal.js`** — localStorage 持久化；`logMood` / `getMoodHistory` / streak / stats / Eva 粵語鼓勵 / 偶像活動建議
+- **`eva-web/src/hooks/useMoodJournal.js`** — React state + 每日自動彈 check-in（未打卡時）
+- **`eva-web/src/components/MoodCheckIn.jsx`** — 5 級 emoji 選擇、備註、活動 tag、提交後 Eva 回應
+- **`eva-web/src/components/MoodTimeline.jsx`** + **`JournalEntry.jsx`** — 按週分組 timeline，「今個禮拜」櫻粉邊框
+- **`eva-web/src/components/MoodStreak.jsx`** — 連續打卡、心情分佈、每週趨勢
+- 聊天主頁（`#/``）每日首次開啟會自動彈 check-in modal
+
+### Live 應援（Event Countdown & Setlist）
+
+Web UI 右上角 **Live** 連結，或 hash route `#/live`，開啟 LUMINA 演出倒數、setlist 同應援指南：
+
+- **`eva-core/services/event-service.js`** — mock 3–4 場 LUMINA 演出；`getUpcomingEvents` / `getEventById` / `getCountdown` / `getSetlist` / `getCheeringGuide` / `formatCountdownString`（粵語倒數文案）
+- **`eva-
…(truncated)
```

### 第3輪 [ok] regenerate response action
- **Eva：** 搞掂啦：加個「重講一次」掣等答得唔啱可以即刻再出一次
- 想改成點：加個「重講一次」掣等答得唔啱可以即刻再出一次
- 騰訊指定檔：eva-web/src/, eva-core/
- 交畀 Cursor：Add a small regenerate button (e.g. ↻) on the last assistant message bubble in eva-web/src. Clicking it should re-send the same user prompt through the existing chat pipeline to produce a fresh answer, replacing that one message and any trailing ones in place. Keep it only on the most recent assistant message and disable it while a generation is already running. Wire any needed handler in eva-core if the pipeline exposes a resend hook.
- 驗收：a regenerate button appears on assistant messages and re-runs the last turn
- 騰訊原文：
```
{"action":"implement","title":"regenerate response action","goal":"Add a way to regenerate the last assistant reply","userSummary":"加個「重講一次」掣等答得唔啱可以即刻再出一次","files":["eva-web/src/","eva-core/"],"acceptance":["a regenerate button appears on assistant messages and re-runs the last turn"],"cursorPrompt":"Add a small regenerate button (e.g. ↻) on the last assistant message bubble in eva-web/src. Clicking it should re-send the same user prompt through the existing chat pipeline to produce a fresh answer, replacing that one message and any trailing ones in place. Keep it only on the most recent assistant message and disable it while a generation is already running. Wire any needed handler in eva-core if the pipeline exposes a resend hook."}
```
- 實際改動檔：EVA.md, eva-core/ask.cjs, eva-core/evolve.cjs, eva-core/server.cjs, eva-core/tencent-lke.cjs, eva-web/index.html, eva-web/package.json, eva-web/src/api.js, eva-web/src/main.js, eva-web/src/markdown.js, eva-web/src/style.css, overlay/app.html, overlay/boot.cjs, overlay/chat.html, overlay/main.cjs, eva-core/chat-service.cjs, eva-core/data/, eva-core/dialogue-service.cjs, eva-core/fallback-messages.cjs, eva-core/models/, eva-core/oshi-match.cjs, eva-core/services/, eva-core/training-plan.cjs, eva-core/types/, eva-web/src/App.jsx, eva-web/src/App.tsx, eva-web/src/chat-ui.js, eva-web/src/components/, eva-web/src/data/, eva-web/src/hooks/, eva-web/src/index.tsx, eva-web/src/main.jsx, eva-web/src/pages/, eva-web/src/services/, eva-web/src/styles/, eva-web/src/utils/
- 已還原：env.example
- diff stat：
```
EVA.md                   |  63 +++++++-
 eva-core/ask.cjs         |  81 +++++++++-
 eva-core/evolve.cjs      | 272 ++++++++++++++++++++++++----------
 eva-core/server.cjs      | 156 ++++++++++++++++++-
 eva-core/tencent-lke.cjs | 185 ++++++++++++++++++++---
 eva-web/index.html       |   2 +-
 eva-web/package.json     |   6 +-
 eva-web/src/api.js       | 113 +++++++++++++-
 eva-web/src/main.js      | 359 ++++++++++++++++++++++++++------------------
 eva-web/src/markdown.js  | 197 ++++++++++++++++++++----
 eva-web/src/style.css    | 379 +++++++++++++++++++++++++++++++++++++++++++----
 overlay/app.html         |  10 +-
 overlay/boot.cjs         |   4 +
 overlay/chat.html        |  10 +-
 overlay/main.cjs         | 132 ++++++++++++++---
 15 files changed, 1617 insertions(+), 352 deletions(-)
eva-core/chat-service.cjs (new)
eva-core/data/ (new)
eva-core/dialogue-service.cjs (new)
eva-core/fallback-messages.cjs (new)
eva-core/models/ (new)
eva-core/oshi-match.cjs (new)
eva-core/services/ (new)
eva-core/training-plan.cjs (new)
eva-core/types/ (new)
eva-web/src/App.jsx (new)
eva-web/src/App.tsx (new)
eva-web/src/chat-ui.js (new)
eva-web/src/components/ (new)
eva-web/src/data/ (new)
eva-web/src/hooks/ (new)
eva-web/src/index.tsx (new)
eva-web/src/main.jsx (new)
eva-web/src/pages/ (new)
eva-web/src/services/ (new)
eva-web/src/styles/ (new)
eva-web/src/utils/ (new)
```
- Cursor 回覆：**Regenerate response** is implemented end-to-end.

### What it does
- Every Eva (assistant) message shows a **↻** button in the header.
- Only the **latest** assistant reply is clickable; older ones are shown disabled.
- Clicking it removes that reply, re-runs the last user turn, and shows a new answer (with the usual typing indicator).
- Buttons lock while a request is in flight.

### Files changed
| File | Change |
|------|--------|
| `eva-web/src/chat-ui.js` | Regenerate button on assistant bubbles; `syncRegenerateButtons()` |
| `eva-web/src/main.js` | Regenerate handler + shared assistant-turn helpers |
| `eva-web/src/style.css` | Styles for `.msg-regenerate` and `.meta-actions` |
| `eva-web/src/api.js` | Optional `regenerate` flag on `askChat()` |
| `eva-core/chat-service.cjs` | `stripLastAssistantReply()` helper |
| `eva-core/server.cjs` | Honors `{ regenerate: true }` on `/api/chat` |
| `EVA.md` | Short note on the feature |
- 檢查：syntax ok: eva-core/ask.cjs
syntax ok: eva-core/evolve.cjs
syntax ok: eva-core/server.cjs
syntax ok: eva-core/tencent-lke.cjs
syntax ok: eva-web/src/api.js
syntax ok: eva-web/src/main.js
syntax ok: eva-web/src/markdown.js
syntax ok: overlay/boot.cjs
syntax ok: overlay/main.cjs
syntax ok: eva-core/chat-service.cjs
syntax ok: eva-core/dialogue-service.cjs
syntax ok: eva-core/fallback-messages.cjs
syntax ok: eva-core/oshi-match.cjs
syntax ok: eva-core/training-plan.cjs
syntax ok: eva-web/src/chat-ui.js
eva-web build ok
- diff：
```
diff --git a/EVA.md b/EVA.md
index 64db845..70a3368 100644
--- a/EVA.md
+++ b/EVA.md
@@ -14,13 +14,17 @@ Electron / Android APK
    eva-core :8787  →  Eva LLM (Ollama / OpenRouter / …)  或  騰訊雲 ADP
 ```
 
-UI 右上角可切 **Eva** / **騰訊雲**。騰訊雲模式會把最新一句 user 訊息送到 `https://wss.lke.tencentcloud.com/adp/v2/chat`，並每次帶上 Eva 人設（`SystemRole`）。事實題會先查本地 Postgres KB（miss 再 Tavily），把命中資料一併塞進 `SystemRole` 畀 ADP。ConversationId 由本機持久化；Clear 會開新會話。
+UI 右上角可切 **Eva** / **騰訊雲**。聊天輸入框：**Enter** 或 **Ctrl/Cmd+Enter** 送出訊息，**Shift+Enter** 換行（IME 組字中唔會誤送）。Eva 回覆右上角有 **↻** 掣，可以重新生成最後一輪回覆（`/api/chat` 亦支援 `{ regenerate: true }` 剝走尾端 assistant 再問）。騰訊雲模式會把最新一句 user 訊息送到 `https://wss.lke.tencentcloud.com/adp/v2/chat`，並每次帶上 Eva 人設（`SystemRole`）。事實題會先查本地 Postgres KB（miss 再 Tavily），把命中資料一併塞進 `SystemRole` 畀 ADP。ConversationId 由本機持久化；Clear 會開新會話。
+
+模型 API 餘額不足（`code:460032`）時，唔會再爆 raw error——`eva-core/fallback-messages.cjs` 統一返回星野玲語氣嘅 fallback 訊息；`chat-service.cjs` / `server.cjs` / `api.js` 會當正常回覆顯示，console 仍保留原始錯誤供 debug。
+
+連續重複相同問候（例如連續三次「hi」）時，`eva-core/dialogue-service.cjs` 會喺 LLM 之前識別模式，第 2 次起改用分層引導回覆（唔再重複自我介紹），引導用戶講今日想傾啲咩；一般非重複對話不受影響。
 
 ### 自動進化（騰訊雲想 → Cursor 改）
 
 Chatbox **冇** Apply / 自動進化掣。進化改為 **每晚 00:00** Windows 排程跑（`EvaNightlyEvolve`），唔使開 overlay。
 
-每輪可以係一個完整改進（幾個相關檔、必要時開新檔），預設最多 **4** 輪。唔會 commit；唔准改 `.env`、`overlay/data`、`sample/`、secrets。
+每輪可以係一個完整改進（幾個相關檔、必要時開新檔），預設最多 **4** 輪。騰訊雲只准出 **JSON 方案**（唔會當自己寫 code）；超時唔會把 thinking 旁白當答案。唔會 commit；唔准改 `.env`、`overlay/data`、`sample/`、secrets。
 
 完成紀錄寫入：
 
@@ -121,6 +125,61 @@ npm run eva:web:dev
 # set EVA_WEB_URL=http://127.0.0.1:5173 && npm run overlay
 ```
 
+### 健身訓練計劃（Workout Planner）
+
+Web UI 右上角 **健身** 連結，或 hash route `#/workout`，開啟每週訓練編排頁：
+
+- **`eva-core/services/exerciseLibrary.js`** — 40+ 動作、7 大肌群（二頭／三頭／胸／背／肩／腿／核心），含 LUMINA 偶像 form tips
+- **`eva-core/services/workoutPlanner.js`** — 產生 7 日 plan；`biceps` + `beginner` 同 chat 二頭肌線條表完全一致
+- **`eva-web/src/pages/WorkoutPlanner.jsx`** — 肌群 selector、難度 toggle、7 日 card
+- **`eva-core/services/progressCalculator.js`** — 從 localStorage sessions 計算 PR、重量／容量趨勢、成就、肌群平衡
+- **`eva-web/src/pages/WorkoutProgress.jsx`** — `#/workout/progress`：4 張 PR 卡、canvas 重量／容量圖、成就徽章、肌群橫條
+- **`eva-web/src/pages/WorkoutDashboard.jsx`** — 訓練紀錄摘要；有數據時連去進度頁
+- **`eva-web/src/components/TrainingWeekView.tsx`** + **`TrainingDayCard.tsx`** + **`RestTimer.tsx`** — `#/workout/plans/:id` 訓練日追蹤：逐組 checkbox、日／週進度條；勾選一組後自動開始組間休息計時（預設 60s，±15s 調整）；離開頁面或切換訓練日會暫停；進度存 `localStorage`（`eva-training-day-progress:*`）
+- **`#/workout/play`** — 引導式訓練 session（`SessionPlayer.tsx`）：任何訓練日撳「開始訓練 ▶」進入；顯示動作名、第 X/Y 組、「完成呢組」；組間圓形倒數（用該動作 `restSeconds`）+ 蜂鳴；Eva 開場／中場／收工應援；完結 summary（總時長、動作數、Eva 結語）；session 寫入 `eva-workout-sessions`
+- API：`GET /api/workout/library`、`GET /api/workout/plan?muscleGroup=biceps&difficulty=beginner`
+
+### 訓練連續打卡（Workout Streak Tracker）
+
+主頁 chat 下方 **`WorkoutTracker`**：顯示今日日期、打勾「完成今日訓練」、`StreakBadge` 火焰連續日數；3／7／14／30 日 milestone 彈 Eva 粵語鼓勵。資料存 `localStorage`（`eva-workout-streak-v1`），刷新唔會丟。
+
+- **`eva-web/src/utils/workoutStorage.ts`** — 日曆 key、streak 計算、milestone 偵測
+- **`eva-web/src/components/WorkoutTracker.tsx`** + **`StreakBadge.tsx`** + **`styles/workout.css`**
+
+### 心情日記（Mood & Journal）
+
+Web UI 右上角 **心情** 連結，或 hash route `#/mood`，開啟每日心情打卡同 timeline：
+
+- **`eva-core/services/mood-journal.js`** — localStorage 持久化；`logMood` / `getMoodHistory` / streak / stats / Eva 粵語鼓勵 / 偶像活動建議
+- **`eva-web/src/hooks/useMoodJournal.js`** — React state + 每日自動彈 check-in（未打卡時）
+- **`eva-web/src/components/MoodCheckIn.jsx`** — 5 級 emoji 選擇、備註、活動 tag、提交後 Eva 回應
+- **`eva-web/src/components/MoodTimeline.jsx`** + **`JournalEntry.jsx`** — 按週分組 timeline，「今個禮拜」櫻粉邊框
+- **`eva-web/src/components/MoodStreak.jsx`** — 連續打卡、心情分佈、每週趨勢
+- 聊天主頁（`#/``）每日首次開啟會自動彈 check-in modal
+
+### Live 應援（Event Countdown & Setlist）
+
+Web UI 右上角 **Live** 連結，或 hash route `#/live`，開啟 LUMINA 演出倒數、setlist 同應援指南：
+
+- **`eva-core/services/event-service.js`** — mock 3–4 場 LUMINA 演出；`getUpcomingEvents` / `getEventById` / `getC
…(truncated)
```

### 第4輪 [ok] keep-alive reconnect
- **Eva：** 搞掂啦：斷線嗰陣自己連返唔使重開個聊天
- 想改成點：斷線嗰陣自己連返唔使重開個聊天
- 騰訊指定檔：eva-core/, eva-web/src/
- 交畀 Cursor：Add automatic websocket reconnection to the chat connection logic in eva-core and eva-web/src. When the socket closes unexpectedly (not a deliberate teardown), schedule a reconnect with a short exponential backoff (e.g. 1s, 2s, 4s, capped ~15s), stop after several failed attempts or on page unload, and preserve the in-memory message list across the reconnect so history isn't lost. Guard against multiple overlapping reconnect timers.
- 驗收：a dropped connection auto-reconnects with a short backoff without losing the chat history
- 騰訊原文：
```
{"action":"implement","title":"keep-alive reconnect","goal":"Reconnect the websocket when it drops silently","userSummary":"斷線嗰陣自己連返唔使重開個聊天","files":["eva-core/","eva-web/src/"],"acceptance":["a dropped connection auto-reconnects with a short backoff without losing the chat history"],"cursorPrompt":"Add automatic websocket reconnection to the chat connection logic in eva-core and eva-web/src. When the socket closes unexpectedly (not a deliberate teardown), schedule a reconnect with a short exponential backoff (e.g. 1s, 2s, 4s, capped ~15s), stop after several failed attempts or on page unload, and preserve the in-memory message list across the reconnect so history isn't lost. Guard against multiple overlapping reconnect timers."}
```
- 實際改動檔：EVA.md, eva-core/ask.cjs, eva-core/evolve.cjs, eva-core/server.cjs, eva-core/tencent-lke.cjs, eva-web/index.html, eva-web/package.json, eva-web/src/api.js, eva-web/src/main.js, eva-web/src/markdown.js, eva-web/src/style.css, overlay/app.html, overlay/boot.cjs, overlay/chat.html, overlay/main.cjs, package.json, eva-core/chat-service.cjs, eva-core/data/, eva-core/dialogue-service.cjs, eva-core/fallback-messages.cjs, eva-core/models/, eva-core/oshi-match.cjs, eva-core/services/, eva-core/training-plan.cjs, eva-core/types/, eva-core/ws-sync.cjs, eva-web/src/App.jsx, eva-web/src/App.tsx, eva-web/src/chat-ui.js, eva-web/src/components/, eva-web/src/data/, eva-web/src/hooks/, eva-web/src/index.tsx, eva-web/src/main.jsx, eva-web/src/pages/, eva-web/src/services/, eva-web/src/styles/, eva-web/src/utils/, eva-web/src/ws-sync.js
- 已還原：env.example, package-lock.json
- diff stat：
```
EVA.md                   |  67 ++++++++-
 eva-core/ask.cjs         |  81 +++++++++-
 eva-core/evolve.cjs      | 272 +++++++++++++++++++++++----------
 eva-core/server.cjs      | 170 ++++++++++++++++++++-
 eva-core/tencent-lke.cjs | 185 ++++++++++++++++++++---
 eva-web/index.html       |   2 +-
 eva-web/package.json     |   6 +-
 eva-web/src/api.js       | 113 +++++++++++++-
 eva-web/src/main.js      | 380 ++++++++++++++++++++++++++++-------------------
 eva-web/src/markdown.js  | 197 ++++++++++++++++++++----
 eva-web/src/style.css    | 379 ++++++++++++++++++++++++++++++++++++++++++----
 overlay/app.html         |  10 +-
 overlay/boot.cjs         |   4 +
 overlay/chat.html        |  10 +-
 overlay/main.cjs         | 132 +++++++++++++---
 package.json             |   3 +-
 16 files changed, 1649 insertions(+), 362 deletions(-)
eva-core/chat-service.cjs (new)
eva-core/data/ (new)
eva-core/dialogue-service.cjs (new)
eva-core/fallback-messages.cjs (new)
eva-core/models/ (new)
eva-core/oshi-match.cjs (new)
eva-core/services/ (new)
eva-core/training-plan.cjs (new)
eva-core/types/ (new)
eva-core/ws-sync.cjs (new)
eva-web/src/App.jsx (new)
eva-web/src/App.tsx (new)
eva-web/src/chat-ui.js (new)
eva-web/src/components/ (new)
eva-web/src/data/ (new)
eva-web/src/hooks/ (new)
eva-web/src/index.tsx (new)
eva-web/src/main.jsx (new)
eva-web/src/pages/ (new)
eva-web/src/services/ (new)
eva-web/src/styles/ (new)
eva-web/src/utils/ (new)
eva-web/src/ws-sync.js (new)
```
- Cursor 回覆：Implemented **keep-alive reconnect** for live chat-history sync over WebSocket.

### What it does
- **`eva-core/ws-sync.cjs`** — WebSocket server on `/api/ws` (Bearer token via query param). Sends full history on connect and on updates. App-level ping/pong every 20s to detect silent drops.
- **`eva-core/server.cjs`** — Attaches the WS server and broadcasts history after `PUT`/`DELETE` on `/api/history`.
- **`eva-web/src/ws-sync.js`** — Client with short exponential backoff (400ms → 8s cap), stale-connection detection, and reconnect that **merges** server history without wiping local chat.
- **`eva-web/src/main.js`** — Uses WS as primary sync; keeps 4s HTTP polling only as fallback when the socket is down. Restarts WS after connection settings change.
- **`EVA.md`** — Documents the WS sync behavior.
- **`package.json`** — Added `ws` dependency for the server.

### Acceptance
- Silent drop → client detects stale/missing pings and reconnects with backoff.
- Chat history stays in memory on
…(truncated)
- 檢查：syntax ok: eva-core/ask.cjs
syntax ok: eva-core/evolve.cjs
syntax ok: eva-core/server.cjs
syntax ok: eva-core/tencent-lke.cjs
syntax ok: eva-web/src/api.js
syntax ok: eva-web/src/main.js
syntax ok: eva-web/src/markdown.js
syntax ok: overlay/boot.cjs
syntax ok: overlay/main.cjs
syntax ok: eva-core/chat-service.cjs
syntax ok: eva-core/dialogue-service.cjs
syntax ok: eva-core/fallback-messages.cjs
syntax ok: eva-core/oshi-match.cjs
syntax ok: eva-core/training-plan.cjs
syntax ok: eva-core/ws-sync.cjs
syntax ok: eva-web/src/chat-ui.js
syntax ok: eva-web/src/ws-sync.js
eva-web build ok
- diff：
```
diff --git a/EVA.md b/EVA.md
index 64db845..5a075f9 100644
--- a/EVA.md
+++ b/EVA.md
@@ -2,7 +2,7 @@
 
 Shared architecture:
 
-- **`eva-core`** — ask pipeline + HTTP/SSE API on `:8787`
+- **`eva-core`** — ask pipeline + HTTP/SSE API on `:8787` (WebSocket `/api/ws` for live chat-history sync + keep-alive reconnect)
 - **`eva-web`** — Vite chat UI (PC + Android)
 - **`overlay/`** — Electron shell (mascot, tray, drag; nightly auto-evolve)
 - **`eva-mobile/`** — Capacitor Android APK
@@ -14,13 +14,17 @@ Electron / Android APK
    eva-core :8787  →  Eva LLM (Ollama / OpenRouter / …)  或  騰訊雲 ADP
 ```
 
-UI 右上角可切 **Eva** / **騰訊雲**。騰訊雲模式會把最新一句 user 訊息送到 `https://wss.lke.tencentcloud.com/adp/v2/chat`，並每次帶上 Eva 人設（`SystemRole`）。事實題會先查本地 Postgres KB（miss 再 Tavily），把命中資料一併塞進 `SystemRole` 畀 ADP。ConversationId 由本機持久化；Clear 會開新會話。
+UI 右上角可切 **Eva** / **騰訊雲**。聊天輸入框：**Enter** 或 **Ctrl/Cmd+Enter** 送出訊息，**Shift+Enter** 換行（IME 組字中唔會誤送）。Eva 回覆右上角有 **↻** 掣，可以重新生成最後一輪回覆（`/api/chat` 亦支援 `{ regenerate: true }` 剝走尾端 assistant 再問）。騰訊雲模式會把最新一句 user 訊息送到 `https://wss.lke.tencentcloud.com/adp/v2/chat`，並每次帶上 Eva 人設（`SystemRole`）。事實題會先查本地 Postgres KB（miss 再 Tavily），把命中資料一併塞進 `SystemRole` 畀 ADP。ConversationId 由本機持久化；Clear 會開新會話。
+
+模型 API 餘額不足（`code:460032`）時，唔會再爆 raw error——`eva-core/fallback-messages.cjs` 統一返回星野玲語氣嘅 fallback 訊息；`chat-service.cjs` / `server.cjs` / `api.js` 會當正常回覆顯示，console 仍保留原始錯誤供 debug。
+
+連續重複相同問候（例如連續三次「hi」）時，`eva-core/dialogue-service.cjs` 會喺 LLM 之前識別模式，第 2 次起改用分層引導回覆（唔再重複自我介紹），引導用戶講今日想傾啲咩；一般非重複對話不受影響。
 
 ### 自動進化（騰訊雲想 → Cursor 改）
 
 Chatbox **冇** Apply / 自動進化掣。進化改為 **每晚 00:00** Windows 排程跑（`EvaNightlyEvolve`），唔使開 overlay。
 
-每輪可以係一個完整改進（幾個相關檔、必要時開新檔），預設最多 **4** 輪。唔會 commit；唔准改 `.env`、`overlay/data`、`sample/`、secrets。
+每輪可以係一個完整改進（幾個相關檔、必要時開新檔），預設最多 **4** 輪。騰訊雲只准出 **JSON 方案**（唔會當自己寫 code）；超時唔會把 thinking 旁白當答案。唔會 commit；唔准改 `.env`、`overlay/data`、`sample/`、secrets。
 
 完成紀錄寫入：
 
@@ -121,6 +125,61 @@ npm run eva:web:dev
 # set EVA_WEB_URL=http://127.0.0.1:5173 && npm run overlay
 ```
 
+### 健身訓練計劃（Workout Planner）
+
+Web UI 右上角 **健身** 連結，或 hash route `#/workout`，開啟每週訓練編排頁：
+
+- **`eva-core/services/exerciseLibrary.js`** — 40+ 動作、7 大肌群（二頭／三頭／胸／背／肩／腿／核心），含 LUMINA 偶像 form tips
+- **`eva-core/services/workoutPlanner.js`** — 產生 7 日 plan；`biceps` + `beginner` 同 chat 二頭肌線條表完全一致
+- **`eva-web/src/pages/WorkoutPlanner.jsx`** — 肌群 selector、難度 toggle、7 日 card
+- **`eva-core/services/progressCalculator.js`** — 從 localStorage sessions 計算 PR、重量／容量趨勢、成就、肌群平衡
+- **`eva-web/src/pages/WorkoutProgress.jsx`** — `#/workout/progress`：4 張 PR 卡、canvas 重量／容量圖、成就徽章、肌群橫條
+- **`eva-web/src/pages/WorkoutDashboard.jsx`** — 訓練紀錄摘要；有數據時連去進度頁
+- **`eva-web/src/components/TrainingWeekView.tsx`** + **`TrainingDayCard.tsx`** + **`RestTimer.tsx`** — `#/workout/plans/:id` 訓練日追蹤：逐組 checkbox、日／週進度條；勾選一組後自動開始組間休息計時（預設 60s，±15s 調整）；離開頁面或切換訓練日會暫停；進度存 `localStorage`（`eva-training-day-progress:*`）
+- **`#/workout/play`** — 引導式訓練 session（`SessionPlayer.tsx`）：任何訓練日撳「開始訓練 ▶」進入；顯示動作名、第 X/Y 組、「完成呢組」；組間圓形倒數（用該動作 `restSeconds`）+ 蜂鳴；Eva 開場／中場／收工應援；完結 summary（總時長、動作數、Eva 結語）；session 寫入 `eva-workout-sessions`
+- API：`GET /api/workout/library`、`GET /api/workout/plan?muscleGroup=biceps&difficulty=beginner`
+
+### 訓練連續打卡（Workout Streak Tracker）
+
+主頁 chat 下方 **`WorkoutTracker`**：顯示今日日期、打勾「完成今日訓練」、`StreakBadge` 火焰連續日數；3／7／14／30 日 milestone 彈 Eva 粵語鼓勵。資料存 `localStorage`（`eva-workout-streak-v1`），刷新唔會丟。
+
+- **`eva-web/src/utils/workoutStorage.ts`** — 日曆 key、streak 計算、milestone 偵測
+- **`eva-web/src/components/WorkoutTracker.tsx`** + **`StreakBadge.tsx`** + **`styles/workout.css`**
+
+### 心情日記（Mood & Journal）
+
+Web UI 右上角 **心情** 連結，或 hash route `#/mood`，開啟每日心情打卡同 timeline：
+
+- **`eva-core/services/mood-journal.js`** — localStorage 持久化；`logMood` / `getMoodHistory` / streak / stats / Eva 粵語鼓勵 / 偶像活動建議
+- **`eva-web/src/hooks/useMoodJournal.js`** — React state + 每日自動彈 check-in（未打卡時）
+- **`eva-web/src/components/MoodCheckIn.jsx`** — 5 級 emoji 選擇、備註、活動 tag、提交後 Eva 回應
+- **`eva-web/src/components/MoodTime
…(truncated)
```

## 2026-09-28 01:50:26  （4/4 輪）

### Eva 講

嘿嘿，今晚我偷偷裝修咗自己幾樣嘢～你用嗰陣應該會感覺到。
1. 我幫你排咗每週訓練表之後，提醒返你進度跟進同持續練習嘅需要：我今次會加返一個跟進進度嘅機制，追蹤你幾時練過、練咗幾耐、體能有冇進步，並且喺你隔咗幾日冇見嘅時候主動提你返個計劃同re …(truncated)
2. 我上次幫你加咗進度追蹤，會記低你練到㗎咩嘢同幾時練，仲會提你返個計劃。今次我會再整靚啲個嗰個體驗：加返一條連續練到幾多日嘅 streak（連續紀錄）同埋每星期達標率，用一啲偶像式嘅 …(truncated)
3. 進度追蹤同激勵互動你都試過喇，今次我focus返喺第一次用嘅體驗同計劃嘅可讀性：我會將成個二頭肌每週訓練計劃整成一個好清楚嘅七日儀表板，每日可以用摺疊tabs睇動作、組數、次數同休 …(truncated)
4. 進度、激勵同可讀性都處理咗，最後我focus返喺你同偶像傾偈嗰個對話本身：計劃表格整咗出嚟，但係你喺對話度問「做到邊個動作最攰？」嗰陣，之前並冇一個方法將你答嘅嘢記返落嚟。今次我會 …(truncated)
想睇技術細節就去 overlay/data/evolve-log.md（4/4 輪）。

### 第1輪 [ok] improvement
- **Eva：** 搞掂啦：我幫你排咗每週訓練表之後，提醒返你進度跟進同持續練習嘅需要：我今次會加返一個跟進進度嘅機制，追蹤你幾時練過、練咗幾耐、體能有冇進步，並且喺你隔咗幾日冇見嘅時候主動提你返個計劃同re …(truncated)
- 想改成點：我幫你排咗每週訓練表之後，提醒返你進度跟進同持續練習嘅需要：我今次會加返一個跟進進度嘅機制，追蹤你幾時練過、練咗幾耐、體能有冇進步，並且喺你隔咗幾日冇見嘅時候主動提你返個計劃同review一下進度，等唔會練完一次就斷咗。
- 騰訊指定檔：eva-core/src/workoutPlanner.ts, eva-core/src/routines/bicep.ts, eva-core/src/utils/progress.ts, eva-web/src/components/WorkoutTracker.tsx, eva-web/src/pages/RoutineView.tsx
- 交畀 Cursor：Add a workout-progress tracking feature. Create eva-core/src/routines/bicep.ts exporting the BICEP_WEEKLY_PLAN (per-day exercises, sets, reps, rest) so the HTML plan can be generated from data instead of hardcoded. Add eva-core/src/utils/progress.ts with functions to record a completed session (date, workout type, minutes, difficulty rating), compute streak/consistency vs a given weekly target, and flag an idle gap (e.g. >3 days with no recorded session). Extend eva-core/src/workoutPlanner.ts to persist sessions via a simple in-memory/localStorage-compatible store and to produce a catch-up sug
…(truncated)
- 騰訊原文：
```
{"action":"implement","files":["eva-core/src/workoutPlanner.ts","eva-core/src/routines/bicep.ts","eva-core/src/utils/progress.ts","eva-web/src/components/WorkoutTracker.tsx","eva-web/src/pages/RoutineView.tsx"],"userSummary":"我幫你排咗每週訓練表之後，提醒返你進度跟進同持續練習嘅需要：我今次會加返一個跟進進度嘅機制，追蹤你幾時練過、練咗幾耐、體能有冇進步，並且喺你隔咗幾日冇見嘅時候主動提你返個計劃同review一下進度，等唔會練完一次就斷咗。","cursorPrompt":"Add a workout-progress tracking feature. Create eva-core/src/routines/bicep.ts exporting the BICEP_WEEKLY_PLAN (per-day exercises, sets, reps, rest) so the HTML plan can be generated from data instead of hardcoded. Add eva-core/src/utils/progress.ts with functions to record a completed session (date, workout type, minutes, difficulty rating), compute streak/consistency vs a given weekly target, and flag an idle gap (e.g. >3 days with no recorded session). Extend eva-core/src/workoutPlanner.ts to persist sessions via a simple in-memory/localStorage-compatible store and to produce a catch-up suggestion referencing today's date. In eva-web/src/components/WorkoutTracker.tsx build an inline tracker UI (list recorded sessions, show current streak and last-session date, mark today's done). In eva-web/src/pages/RoutineView.tsx hook the data-plan and the tracker together and surface an idle reminder banner when a gap is detected. Keep everything dependency-free, follow existing code conventions, and add no secrets or overlay/data changes."}
```
- 實際改動檔：EVA.md, eva-core/ask.cjs, eva-core/evolve.cjs, eva-core/server.cjs, eva-core/tencent-lke.cjs, eva-web/index.html, eva-web/package.json, eva-web/src/api.js, eva-web/src/main.js, eva-web/src/markdown.js, eva-web/src/style.css, overlay/app.html, overlay/boot.cjs, overlay/chat.html, overlay/main.cjs, package.json, eva-core/chat-service.cjs, eva-core/data/, eva-core/dialogue-service.cjs, eva-core/fallback-messages.cjs, eva-core/models/, eva-core/oshi-match.cjs, eva-core/services/, eva-core/src/, eva-core/training-plan.cjs, eva-core/types/, eva-core/ws-sync.cjs, eva-web/src/App.jsx, eva-web/src/App.tsx, eva-web/src/chat-ui.js, eva-web/src/components/, eva-web/src/data/, eva-web/src/hooks/, eva-web/src/index.tsx, eva-web/src/main.jsx, eva-web/src/pages/, eva-web/src/services/, eva-web/src/styles/, eva-web/src/utils/, eva-web/src/ws-sync.js
- 已還原：env.example, tsconfig.json
- diff stat：
```
EVA.md                   |  67 ++++++++-
 eva-core/ask.cjs         |  81 +++++++++-
 eva-core/evolve.cjs      | 272 +++++++++++++++++++++++----------
 eva-core/server.cjs      | 170 ++++++++++++++++++++-
 eva-core/tencent-lke.cjs | 185 ++++++++++++++++++++---
 eva-web/index.html       |   2 +-
 eva-web/package.json     |   6 +-
 eva-web/src/api.js       | 113 +++++++++++++-
 eva-web/src/main.js      | 380 ++++++++++++++++++++++++++++-------------------
 eva-web/src/markdown.js  | 197 ++++++++++++++++++++----
 eva-web/src/style.css    | 379 ++++++++++++++++++++++++++++++++++++++++++----
 overlay/app.html         |  10 +-
 overlay/boot.cjs         |   4 +
 overlay/chat.html        |  10 +-
 overlay/main.cjs         | 132 +++++++++++++---
 package.json             |   3 +-
 16 files changed, 1649 insertions(+), 362 deletions(-)
eva-core/chat-service.cjs (new)
eva-core/data/ (new)
eva-core/dialogue-service.cjs (new)
eva-core/fallback-messages.cjs (new)
eva-core/models/ (new)
eva-core/oshi-match.cjs (new)
eva-core/services/ (new)
eva-core/src/ (new)
eva-core/training-plan.cjs (new)
eva-core/types/ (new)
eva-core/ws-sync.cjs (new)
eva-web/src/App.jsx (new)
eva-web/src/App.tsx (new)
eva-web/src/chat-ui.js (new)
eva-web/src/components/ (new)
eva-web/src/data/ (new)
eva-web/src/hooks/ (new)
eva-web/src/index.tsx (new)
eva-web/src/main.jsx (new)
eva-web/src/pages/ (new)
eva-web/src/services/ (new)
eva-web/src/styles/ (new)
eva-web/src/utils/ (new)
eva-web/src/ws-sync.js (new)
```
- Cursor 回覆：Workout progress tracking is wired up end-to-end. Open it at `#/workout/routine`.

### Core (`eva-core/src/`)
- **`routines/bicep.ts`** — `BICEP_WEEKLY_PLAN` with all 7 days (exercises, sets, reps, rest) as the single data source for plan rendering
- **`utils/progress.ts`** — session recording, streak, weekly consistency vs target, idle-gap detection (>3 days)
- **`workoutPlanner.ts`** — localStorage-compatible session store, progress overview, catch-up suggestions (date-aware), `renderPlanHtml()` for data-driven HTML

### Web (`eva-web/src/`)
- **`components/WorkoutTracker.tsx`** — session list, streak, last-session date, weekly count, mark-today-done with minutes/difficulty
- **`pages/RoutineView.tsx`** — today’s plan from data, tracker, catch-up banner, idle reminder when gap detected
- **`App.tsx`** — route `/workout/routine`
- **`styles/workout.css`** — styles for tracker sessions, idle/catch-up banners, routine layout

### Other
- **`tsconfig.json`** — includes `eva-core/src/**/*
…(truncated)
- 檢查：syntax ok: eva-core/ask.cjs
syntax ok: eva-core/evolve.cjs
syntax ok: eva-core/server.cjs
syntax ok: eva-core/tencent-lke.cjs
syntax ok: eva-web/src/api.js
syntax ok: eva-web/src/main.js
syntax ok: eva-web/src/markdown.js
syntax ok: overlay/boot.cjs
syntax ok: overlay/main.cjs
syntax ok: eva-core/chat-service.cjs
syntax ok: eva-core/dialogue-service.cjs
syntax ok: eva-core/fallback-messages.cjs
syntax ok: eva-core/oshi-match.cjs
syntax ok: eva-core/training-plan.cjs
syntax ok: eva-core/ws-sync.cjs
syntax ok: eva-web/src/chat-ui.js
syntax ok: eva-web/src/ws-sync.js
eva-web build ok
- diff：
```
diff --git a/EVA.md b/EVA.md
index 64db845..5a075f9 100644
--- a/EVA.md
+++ b/EVA.md
@@ -2,7 +2,7 @@
 
 Shared architecture:
 
-- **`eva-core`** — ask pipeline + HTTP/SSE API on `:8787`
+- **`eva-core`** — ask pipeline + HTTP/SSE API on `:8787` (WebSocket `/api/ws` for live chat-history sync + keep-alive reconnect)
 - **`eva-web`** — Vite chat UI (PC + Android)
 - **`overlay/`** — Electron shell (mascot, tray, drag; nightly auto-evolve)
 - **`eva-mobile/`** — Capacitor Android APK
@@ -14,13 +14,17 @@ Electron / Android APK
    eva-core :8787  →  Eva LLM (Ollama / OpenRouter / …)  或  騰訊雲 ADP
 ```
 
-UI 右上角可切 **Eva** / **騰訊雲**。騰訊雲模式會把最新一句 user 訊息送到 `https://wss.lke.tencentcloud.com/adp/v2/chat`，並每次帶上 Eva 人設（`SystemRole`）。事實題會先查本地 Postgres KB（miss 再 Tavily），把命中資料一併塞進 `SystemRole` 畀 ADP。ConversationId 由本機持久化；Clear 會開新會話。
+UI 右上角可切 **Eva** / **騰訊雲**。聊天輸入框：**Enter** 或 **Ctrl/Cmd+Enter** 送出訊息，**Shift+Enter** 換行（IME 組字中唔會誤送）。Eva 回覆右上角有 **↻** 掣，可以重新生成最後一輪回覆（`/api/chat` 亦支援 `{ regenerate: true }` 剝走尾端 assistant 再問）。騰訊雲模式會把最新一句 user 訊息送到 `https://wss.lke.tencentcloud.com/adp/v2/chat`，並每次帶上 Eva 人設（`SystemRole`）。事實題會先查本地 Postgres KB（miss 再 Tavily），把命中資料一併塞進 `SystemRole` 畀 ADP。ConversationId 由本機持久化；Clear 會開新會話。
+
+模型 API 餘額不足（`code:460032`）時，唔會再爆 raw error——`eva-core/fallback-messages.cjs` 統一返回星野玲語氣嘅 fallback 訊息；`chat-service.cjs` / `server.cjs` / `api.js` 會當正常回覆顯示，console 仍保留原始錯誤供 debug。
+
+連續重複相同問候（例如連續三次「hi」）時，`eva-core/dialogue-service.cjs` 會喺 LLM 之前識別模式，第 2 次起改用分層引導回覆（唔再重複自我介紹），引導用戶講今日想傾啲咩；一般非重複對話不受影響。
 
 ### 自動進化（騰訊雲想 → Cursor 改）
 
 Chatbox **冇** Apply / 自動進化掣。進化改為 **每晚 00:00** Windows 排程跑（`EvaNightlyEvolve`），唔使開 overlay。
 
-每輪可以係一個完整改進（幾個相關檔、必要時開新檔），預設最多 **4** 輪。唔會 commit；唔准改 `.env`、`overlay/data`、`sample/`、secrets。
+每輪可以係一個完整改進（幾個相關檔、必要時開新檔），預設最多 **4** 輪。騰訊雲只准出 **JSON 方案**（唔會當自己寫 code）；超時唔會把 thinking 旁白當答案。唔會 commit；唔准改 `.env`、`overlay/data`、`sample/`、secrets。
 
 完成紀錄寫入：
 
@@ -121,6 +125,61 @@ npm run eva:web:dev
 # set EVA_WEB_URL=http://127.0.0.1:5173 && npm run overlay
 ```
 
+### 健身訓練計劃（Workout Planner）
+
+Web UI 右上角 **健身** 連結，或 hash route `#/workout`，開啟每週訓練編排頁：
+
+- **`eva-core/services/exerciseLibrary.js`** — 40+ 動作、7 大肌群（二頭／三頭／胸／背／肩／腿／核心），含 LUMINA 偶像 form tips
+- **`eva-core/services/workoutPlanner.js`** — 產生 7 日 plan；`biceps` + `beginner` 同 chat 二頭肌線條表完全一致
+- **`eva-web/src/pages/WorkoutPlanner.jsx`** — 肌群 selector、難度 toggle、7 日 card
+- **`eva-core/services/progressCalculator.js`** — 從 localStorage sessions 計算 PR、重量／容量趨勢、成就、肌群平衡
+- **`eva-web/src/pages/WorkoutProgress.jsx`** — `#/workout/progress`：4 張 PR 卡、canvas 重量／容量圖、成就徽章、肌群橫條
+- **`eva-web/src/pages/WorkoutDashboard.jsx`** — 訓練紀錄摘要；有數據時連去進度頁
+- **`eva-web/src/components/TrainingWeekView.tsx`** + **`TrainingDayCard.tsx`** + **`RestTimer.tsx`** — `#/workout/plans/:id` 訓練日追蹤：逐組 checkbox、日／週進度條；勾選一組後自動開始組間休息計時（預設 60s，±15s 調整）；離開頁面或切換訓練日會暫停；進度存 `localStorage`（`eva-training-day-progress:*`）
+- **`#/workout/play`** — 引導式訓練 session（`SessionPlayer.tsx`）：任何訓練日撳「開始訓練 ▶」進入；顯示動作名、第 X/Y 組、「完成呢組」；組間圓形倒數（用該動作 `restSeconds`）+ 蜂鳴；Eva 開場／中場／收工應援；完結 summary（總時長、動作數、Eva 結語）；session 寫入 `eva-workout-sessions`
+- API：`GET /api/workout/library`、`GET /api/workout/plan?muscleGroup=biceps&difficulty=beginner`
+
+### 訓練連續打卡（Workout Streak Tracker）
+
+主頁 chat 下方 **`WorkoutTracker`**：顯示今日日期、打勾「完成今日訓練」、`StreakBadge` 火焰連續日數；3／7／14／30 日 milestone 彈 Eva 粵語鼓勵。資料存 `localStorage`（`eva-workout-streak-v1`），刷新唔會丟。
+
+- **`eva-web/src/utils/workoutStorage.ts`** — 日曆 key、streak 計算、milestone 偵測
+- **`eva-web/src/components/WorkoutTracker.tsx`** + **`StreakBadge.tsx`** + **`styles/workout.css`**
+
+### 心情日記（Mood & Journal）
+
+Web UI 右上角 **心情** 連結，或 hash route `#/mood`，開啟每日心情打卡同 timeline：
+
+- **`eva-core/services/mood-journal.js`** — localStorage 持久化；`logMood` / `getMoodHistory` / streak / stats / Eva 粵語鼓勵 / 偶像活動建議
+- **`eva-web/src/hooks/useMoodJournal.js`** — React state + 每日自動彈 check-in（未打卡時）
+- **`eva-web/src/components/MoodCheckIn.jsx`** — 5 級 emoji 選擇、備註、活動 tag、提交後 Eva 回應
+- **`eva-web/src/components/MoodTime
…(truncated)
```

### 第2輪 [ok] improvement
- **Eva：** 搞掂啦：我上次幫你加咗進度追蹤，會記低你練到㗎咩嘢同幾時練，仲會提你返個計劃。今次我會再整靚啲個嗰個體驗：加返一條連續練到幾多日嘅 streak（連續紀錄）同埋每星期達標率，用一啲偶像式嘅 …(truncated)
- 想改成點：我上次幫你加咗進度追蹤，會記低你練到㗎咩嘢同幾時練，仲會提你返個計劃。今次我會再整靚啲個嗰個體驗：加返一條連續練到幾多日嘅 streak（連續紀錄）同埋每星期達標率，用一啲偶像式嘅小徽章同顏色變化去show你嘅進步，仲會按你體能睇你練得辛唔辛苦嚟調整下個建議，等你更有動力持續做落去。
- 騰訊指定檔：eva-core/src/workoutPlanner.ts, eva-core/src/utils/progress.ts, eva-web/src/components/WorkoutTracker.tsx
- 交畀 Cursor：Enhance the workout progress feature with a more motivating feedback layer. In eva-core/src/utils/progress.ts, extend the progress model so each recorded session can carry an optional difficulty/effort rating, and add functions to compute a streak count (consecutive active days), weekly target attainment percentage against the BICEP_WEEKLY_PLAN target days, and a simple derived 'level' (e.g. newbie/steady/consistent/streaking) used to pick motivational copy. In eva-core/src/workoutPlanner.ts, surface a summary object combining latest session, streak, week attainment, and idle-gap status, and a
…(truncated)
- 騰訊原文：
```
{"action":"implement","files":["eva-core/src/workoutPlanner.ts","eva-core/src/utils/progress.ts","eva-web/src/components/WorkoutTracker.tsx"],"userSummary":"我上次幫你加咗進度追蹤，會記低你練到㗎咩嘢同幾時練，仲會提你返個計劃。今次我會再整靚啲個嗰個體驗：加返一條連續練到幾多日嘅 streak（連續紀錄）同埋每星期達標率，用一啲偶像式嘅小徽章同顏色變化去show你嘅進步，仲會按你體能睇你練得辛唔辛苦嚟調整下個建議，等你更有動力持續做落去。","cursorPrompt":"Enhance the workout progress feature with a more motivating feedback layer. In eva-core/src/utils/progress.ts, extend the progress model so each recorded session can carry an optional difficulty/effort rating, and add functions to compute a streak count (consecutive active days), weekly target attainment percentage against the BICEP_WEEKLY_PLAN target days, and a simple derived 'level' (e.g. newbie/steady/consistent/streaking) used to pick motivational copy. In eva-core/src/workoutPlanner.ts, surface a summary object combining latest session, streak, week attainment, and idle-gap status, and add a function that returns an adaptive tip based on effort rating (if consistently 'hard', advise recovery; if 'easy', suggest increasing reps). In eva-web/src/components/WorkoutTracker.tsx, render the streak as a flame-style badge, the week attainment as a small progress bar, tint the session list with effort-aware labels, and show the adaptive tip from the planner. Keep everything dependency-free, follow existing conventions, and make no changes to overlay/data or secrets."}
```
- 實際改動檔：EVA.md, eva-core/ask.cjs, eva-core/evolve.cjs, eva-core/server.cjs, eva-core/tencent-lke.cjs, eva-web/index.html, eva-web/package.json, eva-web/src/api.js, eva-web/src/main.js, eva-web/src/markdown.js, eva-web/src/style.css, overlay/app.html, overlay/boot.cjs, overlay/chat.html, overlay/main.cjs, package.json, eva-core/chat-service.cjs, eva-core/data/, eva-core/dialogue-service.cjs, eva-core/fallback-messages.cjs, eva-core/models/, eva-core/oshi-match.cjs, eva-core/services/, eva-core/src/, eva-core/training-plan.cjs, eva-core/types/, eva-core/ws-sync.cjs, eva-web/src/App.jsx, eva-web/src/App.tsx, eva-web/src/chat-ui.js, eva-web/src/components/, eva-web/src/data/, eva-web/src/hooks/, eva-web/src/index.tsx, eva-web/src/main.jsx, eva-web/src/pages/, eva-web/src/services/, eva-web/src/styles/, eva-web/src/utils/, eva-web/src/ws-sync.js
- 已還原：env.example
- diff stat：
```
EVA.md                   |  67 ++++++++-
 eva-core/ask.cjs         |  81 +++++++++-
 eva-core/evolve.cjs      | 272 +++++++++++++++++++++++----------
 eva-core/server.cjs      | 170 ++++++++++++++++++++-
 eva-core/tencent-lke.cjs | 185 ++++++++++++++++++++---
 eva-web/index.html       |   2 +-
 eva-web/package.json     |   6 +-
 eva-web/src/api.js       | 113 +++++++++++++-
 eva-web/src/main.js      | 380 ++++++++++++++++++++++++++++-------------------
 eva-web/src/markdown.js  | 197 ++++++++++++++++++++----
 eva-web/src/style.css    | 379 ++++++++++++++++++++++++++++++++++++++++++----
 overlay/app.html         |  10 +-
 overlay/boot.cjs         |   4 +
 overlay/chat.html        |  10 +-
 overlay/main.cjs         | 132 +++++++++++++---
 package.json             |   3 +-
 16 files changed, 1649 insertions(+), 362 deletions(-)
eva-core/chat-service.cjs (new)
eva-core/data/ (new)
eva-core/dialogue-service.cjs (new)
eva-core/fallback-messages.cjs (new)
eva-core/models/ (new)
eva-core/oshi-match.cjs (new)
eva-core/services/ (new)
eva-core/src/ (new)
eva-core/training-plan.cjs (new)
eva-core/types/ (new)
eva-core/ws-sync.cjs (new)
eva-web/src/App.jsx (new)
eva-web/src/App.tsx (new)
eva-web/src/chat-ui.js (new)
eva-web/src/components/ (new)
eva-web/src/data/ (new)
eva-web/src/hooks/ (new)
eva-web/src/index.tsx (new)
eva-web/src/main.jsx (new)
eva-web/src/pages/ (new)
eva-web/src/services/ (new)
eva-web/src/styles/ (new)
eva-web/src/utils/ (new)
eva-web/src/ws-sync.js (new)
```
- Cursor 回覆：Done — the workout tracker now has a motivating feedback layer built on effort ratings and habit tiers.

### What changed

**`eva-core/src/utils/progress.ts`**
- Made `difficultyRating` optional on sessions
- Added `EffortBand`, `ProgressLevel`, `getEffortBand`, `getEffortLabel`
- Added `deriveProgressLevel`, `getMotivationalCopy`, `getLatestSession`
- Existing streak / weekly attainment helpers unchanged

**`eva-core/src/workoutPlanner.ts`**
- Added `getProgressSummary()` — latest session, streak, weekly attainment, idle status, level, motivational copy
- Added `getAdaptiveWorkoutTip()` — recovery advice when recent sessions are hard, rep progression when easy

**`eva-web/src/components/WorkoutTracker.tsx`**
- Flame streak badge with level-aware styling
- Weekly target progress bar with percentage
- Level-based motivational line + adaptive tip banner
- Session list tinted by effort band (輕鬆 / 適中 / 吃力)

**`eva-web/src/components/StreakBadge.tsx`**
- Optional `level` prop; hotter flame 
…(truncated)
- 檢查：syntax ok: eva-core/ask.cjs
syntax ok: eva-core/evolve.cjs
syntax ok: eva-core/server.cjs
syntax ok: eva-core/tencent-lke.cjs
syntax ok: eva-web/src/api.js
syntax ok: eva-web/src/main.js
syntax ok: eva-web/src/markdown.js
syntax ok: overlay/boot.cjs
syntax ok: overlay/main.cjs
syntax ok: eva-core/chat-service.cjs
syntax ok: eva-core/dialogue-service.cjs
syntax ok: eva-core/fallback-messages.cjs
syntax ok: eva-core/oshi-match.cjs
syntax ok: eva-core/training-plan.cjs
syntax ok: eva-core/ws-sync.cjs
syntax ok: eva-web/src/chat-ui.js
syntax ok: eva-web/src/ws-sync.js
eva-web build ok
- diff：
```
diff --git a/EVA.md b/EVA.md
index 64db845..5a075f9 100644
--- a/EVA.md
+++ b/EVA.md
@@ -2,7 +2,7 @@
 
 Shared architecture:
 
-- **`eva-core`** — ask pipeline + HTTP/SSE API on `:8787`
+- **`eva-core`** — ask pipeline + HTTP/SSE API on `:8787` (WebSocket `/api/ws` for live chat-history sync + keep-alive reconnect)
 - **`eva-web`** — Vite chat UI (PC + Android)
 - **`overlay/`** — Electron shell (mascot, tray, drag; nightly auto-evolve)
 - **`eva-mobile/`** — Capacitor Android APK
@@ -14,13 +14,17 @@ Electron / Android APK
    eva-core :8787  →  Eva LLM (Ollama / OpenRouter / …)  或  騰訊雲 ADP
 ```
 
-UI 右上角可切 **Eva** / **騰訊雲**。騰訊雲模式會把最新一句 user 訊息送到 `https://wss.lke.tencentcloud.com/adp/v2/chat`，並每次帶上 Eva 人設（`SystemRole`）。事實題會先查本地 Postgres KB（miss 再 Tavily），把命中資料一併塞進 `SystemRole` 畀 ADP。ConversationId 由本機持久化；Clear 會開新會話。
+UI 右上角可切 **Eva** / **騰訊雲**。聊天輸入框：**Enter** 或 **Ctrl/Cmd+Enter** 送出訊息，**Shift+Enter** 換行（IME 組字中唔會誤送）。Eva 回覆右上角有 **↻** 掣，可以重新生成最後一輪回覆（`/api/chat` 亦支援 `{ regenerate: true }` 剝走尾端 assistant 再問）。騰訊雲模式會把最新一句 user 訊息送到 `https://wss.lke.tencentcloud.com/adp/v2/chat`，並每次帶上 Eva 人設（`SystemRole`）。事實題會先查本地 Postgres KB（miss 再 Tavily），把命中資料一併塞進 `SystemRole` 畀 ADP。ConversationId 由本機持久化；Clear 會開新會話。
+
+模型 API 餘額不足（`code:460032`）時，唔會再爆 raw error——`eva-core/fallback-messages.cjs` 統一返回星野玲語氣嘅 fallback 訊息；`chat-service.cjs` / `server.cjs` / `api.js` 會當正常回覆顯示，console 仍保留原始錯誤供 debug。
+
+連續重複相同問候（例如連續三次「hi」）時，`eva-core/dialogue-service.cjs` 會喺 LLM 之前識別模式，第 2 次起改用分層引導回覆（唔再重複自我介紹），引導用戶講今日想傾啲咩；一般非重複對話不受影響。
 
 ### 自動進化（騰訊雲想 → Cursor 改）
 
 Chatbox **冇** Apply / 自動進化掣。進化改為 **每晚 00:00** Windows 排程跑（`EvaNightlyEvolve`），唔使開 overlay。
 
-每輪可以係一個完整改進（幾個相關檔、必要時開新檔），預設最多 **4** 輪。唔會 commit；唔准改 `.env`、`overlay/data`、`sample/`、secrets。
+每輪可以係一個完整改進（幾個相關檔、必要時開新檔），預設最多 **4** 輪。騰訊雲只准出 **JSON 方案**（唔會當自己寫 code）；超時唔會把 thinking 旁白當答案。唔會 commit；唔准改 `.env`、`overlay/data`、`sample/`、secrets。
 
 完成紀錄寫入：
 
@@ -121,6 +125,61 @@ npm run eva:web:dev
 # set EVA_WEB_URL=http://127.0.0.1:5173 && npm run overlay
 ```
 
+### 健身訓練計劃（Workout Planner）
+
+Web UI 右上角 **健身** 連結，或 hash route `#/workout`，開啟每週訓練編排頁：
+
+- **`eva-core/services/exerciseLibrary.js`** — 40+ 動作、7 大肌群（二頭／三頭／胸／背／肩／腿／核心），含 LUMINA 偶像 form tips
+- **`eva-core/services/workoutPlanner.js`** — 產生 7 日 plan；`biceps` + `beginner` 同 chat 二頭肌線條表完全一致
+- **`eva-web/src/pages/WorkoutPlanner.jsx`** — 肌群 selector、難度 toggle、7 日 card
+- **`eva-core/services/progressCalculator.js`** — 從 localStorage sessions 計算 PR、重量／容量趨勢、成就、肌群平衡
+- **`eva-web/src/pages/WorkoutProgress.jsx`** — `#/workout/progress`：4 張 PR 卡、canvas 重量／容量圖、成就徽章、肌群橫條
+- **`eva-web/src/pages/WorkoutDashboard.jsx`** — 訓練紀錄摘要；有數據時連去進度頁
+- **`eva-web/src/components/TrainingWeekView.tsx`** + **`TrainingDayCard.tsx`** + **`RestTimer.tsx`** — `#/workout/plans/:id` 訓練日追蹤：逐組 checkbox、日／週進度條；勾選一組後自動開始組間休息計時（預設 60s，±15s 調整）；離開頁面或切換訓練日會暫停；進度存 `localStorage`（`eva-training-day-progress:*`）
+- **`#/workout/play`** — 引導式訓練 session（`SessionPlayer.tsx`）：任何訓練日撳「開始訓練 ▶」進入；顯示動作名、第 X/Y 組、「完成呢組」；組間圓形倒數（用該動作 `restSeconds`）+ 蜂鳴；Eva 開場／中場／收工應援；完結 summary（總時長、動作數、Eva 結語）；session 寫入 `eva-workout-sessions`
+- API：`GET /api/workout/library`、`GET /api/workout/plan?muscleGroup=biceps&difficulty=beginner`
+
+### 訓練連續打卡（Workout Streak Tracker）
+
+主頁 chat 下方 **`WorkoutTracker`**：顯示今日日期、打勾「完成今日訓練」、`StreakBadge` 火焰連續日數；3／7／14／30 日 milestone 彈 Eva 粵語鼓勵。資料存 `localStorage`（`eva-workout-streak-v1`），刷新唔會丟。
+
+- **`eva-web/src/utils/workoutStorage.ts`** — 日曆 key、streak 計算、milestone 偵測
+- **`eva-web/src/components/WorkoutTracker.tsx`** + **`StreakBadge.tsx`** + **`styles/workout.css`**
+
+### 心情日記（Mood & Journal）
+
+Web UI 右上角 **心情** 連結，或 hash route `#/mood`，開啟每日心情打卡同 timeline：
+
+- **`eva-core/services/mood-journal.js`** — localStorage 持久化；`logMood` / `getMoodHistory` / streak / stats / Eva 粵語鼓勵 / 偶像活動建議
+- **`eva-web/src/hooks/useMoodJournal.js`** — React state + 每日自動彈 check-in（未打卡時）
+- **`eva-web/src/components/MoodCheckIn.jsx`** — 5 級 emoji 選擇、備註、活動 tag、提交後 Eva 回應
+- **`eva-web/src/components/MoodTime
…(truncated)
```

### 第3輪 [ok] improvement
- **Eva：** 搞掂啦：進度追蹤同激勵互動你都試過喇，今次我focus返喺第一次用嘅體驗同計劃嘅可讀性：我會將成個二頭肌每週訓練計劃整成一個好清楚嘅七日儀表板，每日可以用摺疊tabs睇動作、組數、次數同休 …(truncated)
- 想改成點：進度追蹤同激勵互動你都試過喇，今次我focus返喺第一次用嘅體驗同計劃嘅可讀性：我會將成個二頭肌每週訓練計劃整成一個好清楚嘅七日儀表板，每日可以用摺疊tabs睇動作、組數、次數同休息時間，仲會加返預熱（warm-up）同冷卻（cool-down）指引，等你跟住做唔使眼花。過一段時間冇開過嘅時候，我會喺個儀表板度直接凸出顯示「由今日開始」嘅指引。
- 騰訊指定檔：eva-core/src/workoutPlanner.ts, eva-core/src/notions.ts, eva-web/src/pages/RoutineView.tsx, eva-web/src/components/RoutineDayAccordion.tsx, overlay/tournament-overlay.html
- 交畀 Cursor：Improve the routine-reading UX of the weekly bicep plan so a first-time user can follow it cleanly. In eva-core/src/routines/bicep.ts, extend BICEP_WEEKLY_PLAN data so each day can optionally carry a warm-up and cool-down block (short sets/reps/rest lists) in addition to main exercises, and add a helper that flattens a day into ordered steps. In eva-core/src/workoutPlanner.ts, add a function getTodayPlanIndex() that returns today's day index from the weekly plan using the current date so the view can point users to 'start today'. In eva-web/src/components/RoutineDayAccordion.tsx build a new co
…(truncated)
- 騰訊原文：
```
{"action":"implement","files":["eva-core/src/workoutPlanner.ts","eva-core/src/notions.ts","eva-web/src/pages/RoutineView.tsx","eva-web/src/components/RoutineDayAccordion.tsx","overlay/tournament-overlay.html"],"userSummary":"進度追蹤同激勵互動你都試過喇，今次我focus返喺第一次用嘅體驗同計劃嘅可讀性：我會將成個二頭肌每週訓練計劃整成一個好清楚嘅七日儀表板，每日可以用摺疊tabs睇動作、組數、次數同休息時間，仲會加返預熱（warm-up）同冷卻（cool-down）指引，等你跟住做唔使眼花。過一段時間冇開過嘅時候，我會喺個儀表板度直接凸出顯示「由今日開始」嘅指引。","cursorPrompt":"Improve the routine-reading UX of the weekly bicep plan so a first-time user can follow it cleanly. In eva-core/src/routines/bicep.ts, extend BICEP_WEEKLY_PLAN data so each day can optionally carry a warm-up and cool-down block (short sets/reps/rest lists) in addition to main exercises, and add a helper that flattens a day into ordered steps. In eva-core/src/workoutPlanner.ts, add a function getTodayPlanIndex() that returns today's day index from the weekly plan using the current date so the view can point users to 'start today'. In eva-web/src/components/RoutineDayAccordion.tsx build a new collapsible accordion component that renders one day at a time: shows the day title, warm-up section, main exercise rows (name, sets x reps, rest), cool-down section, and an expand/collapse toggle; mark the current day with a 'TODAY' pill. In eva-web/src/pages/RoutineView.tsx replace the flat day dump with the new accordion, highlight today's day by default when an idle gap is detected, and add a warm-up reminder line at the top. Keep dependency-free, follow existing conventions, and make no drops of overlay/data or secrets."}
```
- 實際改動檔：EVA.md, eva-core/ask.cjs, eva-core/evolve.cjs, eva-core/server.cjs, eva-core/tencent-lke.cjs, eva-web/index.html, eva-web/package.json, eva-web/src/api.js, eva-web/src/main.js, eva-web/src/markdown.js, eva-web/src/style.css, overlay/app.html, overlay/boot.cjs, overlay/chat.html, overlay/main.cjs, package.json, eva-core/chat-service.cjs, eva-core/data/, eva-core/dialogue-service.cjs, eva-core/fallback-messages.cjs, eva-core/models/, eva-core/oshi-match.cjs, eva-core/services/, eva-core/src/, eva-core/training-plan.cjs, eva-core/types/, eva-core/ws-sync.cjs, eva-web/src/App.jsx, eva-web/src/App.tsx, eva-web/src/chat-ui.js, eva-web/src/components/, eva-web/src/data/, eva-web/src/hooks/, eva-web/src/index.tsx, eva-web/src/main.jsx, eva-web/src/pages/, eva-web/src/services/, eva-web/src/styles/, eva-web/src/utils/, eva-web/src/ws-sync.js
- 已還原：env.example
- diff stat：
```
EVA.md                   |  67 ++++++++-
 eva-core/ask.cjs         |  81 +++++++++-
 eva-core/evolve.cjs      | 272 +++++++++++++++++++++++----------
 eva-core/server.cjs      | 170 ++++++++++++++++++++-
 eva-core/tencent-lke.cjs | 185 ++++++++++++++++++++---
 eva-web/index.html       |   2 +-
 eva-web/package.json     |   6 +-
 eva-web/src/api.js       | 113 +++++++++++++-
 eva-web/src/main.js      | 380 ++++++++++++++++++++++++++++-------------------
 eva-web/src/markdown.js  | 197 ++++++++++++++++++++----
 eva-web/src/style.css    | 379 ++++++++++++++++++++++++++++++++++++++++++----
 overlay/app.html         |  10 +-
 overlay/boot.cjs         |   4 +
 overlay/chat.html        |  10 +-
 overlay/main.cjs         | 132 +++++++++++++---
 package.json             |   3 +-
 16 files changed, 1649 insertions(+), 362 deletions(-)
eva-core/chat-service.cjs (new)
eva-core/data/ (new)
eva-core/dialogue-service.cjs (new)
eva-core/fallback-messages.cjs (new)
eva-core/models/ (new)
eva-core/oshi-match.cjs (new)
eva-core/services/ (new)
eva-core/src/ (new)
eva-core/training-plan.cjs (new)
eva-core/types/ (new)
eva-core/ws-sync.cjs (new)
eva-web/src/App.jsx (new)
eva-web/src/App.tsx (new)
eva-web/src/chat-ui.js (new)
eva-web/src/components/ (new)
eva-web/src/data/ (new)
eva-web/src/hooks/ (new)
eva-web/src/index.tsx (new)
eva-web/src/main.jsx (new)
eva-web/src/pages/ (new)
eva-web/src/services/ (new)
eva-web/src/styles/ (new)
eva-web/src/utils/ (new)
eva-web/src/ws-sync.js (new)
```
- Cursor 回覆：Weekly bicep plan reading is clearer now — warm-up/cool-down blocks, a “start today” index, and a day-by-day accordion.

### What changed

**`eva-core/src/routines/bicep.ts`**
- Added optional `warmUp` / `coolDown` on `RoutineDay`
- Filled short warm-up/cool-down sets for workout, recovery, cardio, and technique days
- Added `flattenRoutineDaySteps()` to order steps: warm-up → main → cool-down

**`eva-core/src/workoutPlanner.ts`**
- Added `getTodayPlanIndex()` (Mon=0 … Sun=6)
- Re-exported `flattenRoutineDaySteps` and `RoutineDayStep`

**`eva-web/src/components/RoutineDayAccordion.tsx`** (new)
- Collapsible accordion per day with warm-up, main, and cool-down sections
- Exercise rows show name, sets × reps, rest
- **TODAY** pill on the current day; expand/collapse toggle

**`eva-web/src/pages/RoutineView.tsx`**
- Replaced the flat week list and duplicate “today” block with the accordion
- Auto-expands today when an idle gap is detected
- Warm-up reminder line at the top

**`eva-web/src/
…(truncated)
- 檢查：syntax ok: eva-core/ask.cjs
syntax ok: eva-core/evolve.cjs
syntax ok: eva-core/server.cjs
syntax ok: eva-core/tencent-lke.cjs
syntax ok: eva-web/src/api.js
syntax ok: eva-web/src/main.js
syntax ok: eva-web/src/markdown.js
syntax ok: overlay/boot.cjs
syntax ok: overlay/main.cjs
syntax ok: eva-core/chat-service.cjs
syntax ok: eva-core/dialogue-service.cjs
syntax ok: eva-core/fallback-messages.cjs
syntax ok: eva-core/oshi-match.cjs
syntax ok: eva-core/training-plan.cjs
syntax ok: eva-core/ws-sync.cjs
syntax ok: eva-web/src/chat-ui.js
syntax ok: eva-web/src/ws-sync.js
eva-web build ok
- diff：
```
diff --git a/EVA.md b/EVA.md
index 64db845..5a075f9 100644
--- a/EVA.md
+++ b/EVA.md
@@ -2,7 +2,7 @@
 
 Shared architecture:
 
-- **`eva-core`** — ask pipeline + HTTP/SSE API on `:8787`
+- **`eva-core`** — ask pipeline + HTTP/SSE API on `:8787` (WebSocket `/api/ws` for live chat-history sync + keep-alive reconnect)
 - **`eva-web`** — Vite chat UI (PC + Android)
 - **`overlay/`** — Electron shell (mascot, tray, drag; nightly auto-evolve)
 - **`eva-mobile/`** — Capacitor Android APK
@@ -14,13 +14,17 @@ Electron / Android APK
    eva-core :8787  →  Eva LLM (Ollama / OpenRouter / …)  或  騰訊雲 ADP
 ```
 
-UI 右上角可切 **Eva** / **騰訊雲**。騰訊雲模式會把最新一句 user 訊息送到 `https://wss.lke.tencentcloud.com/adp/v2/chat`，並每次帶上 Eva 人設（`SystemRole`）。事實題會先查本地 Postgres KB（miss 再 Tavily），把命中資料一併塞進 `SystemRole` 畀 ADP。ConversationId 由本機持久化；Clear 會開新會話。
+UI 右上角可切 **Eva** / **騰訊雲**。聊天輸入框：**Enter** 或 **Ctrl/Cmd+Enter** 送出訊息，**Shift+Enter** 換行（IME 組字中唔會誤送）。Eva 回覆右上角有 **↻** 掣，可以重新生成最後一輪回覆（`/api/chat` 亦支援 `{ regenerate: true }` 剝走尾端 assistant 再問）。騰訊雲模式會把最新一句 user 訊息送到 `https://wss.lke.tencentcloud.com/adp/v2/chat`，並每次帶上 Eva 人設（`SystemRole`）。事實題會先查本地 Postgres KB（miss 再 Tavily），把命中資料一併塞進 `SystemRole` 畀 ADP。ConversationId 由本機持久化；Clear 會開新會話。
+
+模型 API 餘額不足（`code:460032`）時，唔會再爆 raw error——`eva-core/fallback-messages.cjs` 統一返回星野玲語氣嘅 fallback 訊息；`chat-service.cjs` / `server.cjs` / `api.js` 會當正常回覆顯示，console 仍保留原始錯誤供 debug。
+
+連續重複相同問候（例如連續三次「hi」）時，`eva-core/dialogue-service.cjs` 會喺 LLM 之前識別模式，第 2 次起改用分層引導回覆（唔再重複自我介紹），引導用戶講今日想傾啲咩；一般非重複對話不受影響。
 
 ### 自動進化（騰訊雲想 → Cursor 改）
 
 Chatbox **冇** Apply / 自動進化掣。進化改為 **每晚 00:00** Windows 排程跑（`EvaNightlyEvolve`），唔使開 overlay。
 
-每輪可以係一個完整改進（幾個相關檔、必要時開新檔），預設最多 **4** 輪。唔會 commit；唔准改 `.env`、`overlay/data`、`sample/`、secrets。
+每輪可以係一個完整改進（幾個相關檔、必要時開新檔），預設最多 **4** 輪。騰訊雲只准出 **JSON 方案**（唔會當自己寫 code）；超時唔會把 thinking 旁白當答案。唔會 commit；唔准改 `.env`、`overlay/data`、`sample/`、secrets。
 
 完成紀錄寫入：
 
@@ -121,6 +125,61 @@ npm run eva:web:dev
 # set EVA_WEB_URL=http://127.0.0.1:5173 && npm run overlay
 ```
 
+### 健身訓練計劃（Workout Planner）
+
+Web UI 右上角 **健身** 連結，或 hash route `#/workout`，開啟每週訓練編排頁：
+
+- **`eva-core/services/exerciseLibrary.js`** — 40+ 動作、7 大肌群（二頭／三頭／胸／背／肩／腿／核心），含 LUMINA 偶像 form tips
+- **`eva-core/services/workoutPlanner.js`** — 產生 7 日 plan；`biceps` + `beginner` 同 chat 二頭肌線條表完全一致
+- **`eva-web/src/pages/WorkoutPlanner.jsx`** — 肌群 selector、難度 toggle、7 日 card
+- **`eva-core/services/progressCalculator.js`** — 從 localStorage sessions 計算 PR、重量／容量趨勢、成就、肌群平衡
+- **`eva-web/src/pages/WorkoutProgress.jsx`** — `#/workout/progress`：4 張 PR 卡、canvas 重量／容量圖、成就徽章、肌群橫條
+- **`eva-web/src/pages/WorkoutDashboard.jsx`** — 訓練紀錄摘要；有數據時連去進度頁
+- **`eva-web/src/components/TrainingWeekView.tsx`** + **`TrainingDayCard.tsx`** + **`RestTimer.tsx`** — `#/workout/plans/:id` 訓練日追蹤：逐組 checkbox、日／週進度條；勾選一組後自動開始組間休息計時（預設 60s，±15s 調整）；離開頁面或切換訓練日會暫停；進度存 `localStorage`（`eva-training-day-progress:*`）
+- **`#/workout/play`** — 引導式訓練 session（`SessionPlayer.tsx`）：任何訓練日撳「開始訓練 ▶」進入；顯示動作名、第 X/Y 組、「完成呢組」；組間圓形倒數（用該動作 `restSeconds`）+ 蜂鳴；Eva 開場／中場／收工應援；完結 summary（總時長、動作數、Eva 結語）；session 寫入 `eva-workout-sessions`
+- API：`GET /api/workout/library`、`GET /api/workout/plan?muscleGroup=biceps&difficulty=beginner`
+
+### 訓練連續打卡（Workout Streak Tracker）
+
+主頁 chat 下方 **`WorkoutTracker`**：顯示今日日期、打勾「完成今日訓練」、`StreakBadge` 火焰連續日數；3／7／14／30 日 milestone 彈 Eva 粵語鼓勵。資料存 `localStorage`（`eva-workout-streak-v1`），刷新唔會丟。
+
+- **`eva-web/src/utils/workoutStorage.ts`** — 日曆 key、streak 計算、milestone 偵測
+- **`eva-web/src/components/WorkoutTracker.tsx`** + **`StreakBadge.tsx`** + **`styles/workout.css`**
+
+### 心情日記（Mood & Journal）
+
+Web UI 右上角 **心情** 連結，或 hash route `#/mood`，開啟每日心情打卡同 timeline：
+
+- **`eva-core/services/mood-journal.js`** — localStorage 持久化；`logMood` / `getMoodHistory` / streak / stats / Eva 粵語鼓勵 / 偶像活動建議
+- **`eva-web/src/hooks/useMoodJournal.js`** — React state + 每日自動彈 check-in（未打卡時）
+- **`eva-web/src/components/MoodCheckIn.jsx`** — 5 級 emoji 選擇、備註、活動 tag、提交後 Eva 回應
+- **`eva-web/src/components/MoodTime
…(truncated)
```

### 第4輪 [ok] improvement
- **Eva：** 搞掂啦：進度、激勵同可讀性都處理咗，最後我focus返喺你同偶像傾偈嗰個對話本身：計劃表格整咗出嚟，但係你喺對話度問「做到邊個動作最攰？」嗰陣，之前並冇一個方法將你答嘅嘢記返落嚟。今次我會 …(truncated)
- 想改成點：進度、激勵同可讀性都處理咗，最後我focus返喺你同偶像傾偈嗰個對話本身：計劃表格整咗出嚟，但係你喺對話度問「做到邊個動作最攰？」嗰陣，之前並冇一個方法將你答嘅嘢記返落嚟。今次我會加返一個「評估回顧」功能——你練完之後答返今日最攰嘅動作、難唔困難，系統會post你嘅訓練日記度，下次再開計劃嗰陣就直接show返上次嘅回顧，等你同偶像個對話有返果個連貫感，唔會好似把口講完就算。
- 騰訊指定檔：eva-core/src/workoutPlanner.ts, eva-core/src/notions.ts, eva-web/src/pages/RoutineView.tsx, eva-web/src/components/WorkoutTracker.tsx
- 交畀 Cursor：Close the loop between chat and the logged workout by adding a session debrief that persists what the user says in conversation. Add a notion-level concept and UI: in eva-core/src/workoutPlanner.ts add a recordDebrief(dayIndex, hardestExercise, difficultyRating, feelNote) function that appends a debrief entry to the stored workout log (same store as sessions) and returns the updated summary. Add eva-core/src/notions.ts exporting a DEBRIEF_QUESTIONS object mapping optional follow-up prompts (e.g. hardest exercise this session, difficulty, any note) meant to be surfaced by the assistant in chat 
…(truncated)
- 騰訊原文：
```
{"action":"implement","files":["eva-core/src/workoutPlanner.ts","eva-core/src/notions.ts","eva-web/src/pages/RoutineView.tsx","eva-web/src/components/WorkoutTracker.tsx"],"userSummary":"進度、激勵同可讀性都處理咗，最後我focus返喺你同偶像傾偈嗰個對話本身：計劃表格整咗出嚟，但係你喺對話度問「做到邊個動作最攰？」嗰陣，之前並冇一個方法將你答嘅嘢記返落嚟。今次我會加返一個「評估回顧」功能——你練完之後答返今日最攰嘅動作、難唔困難，系統會post你嘅訓練日記度，下次再開計劃嗰陣就直接show返上次嘅回顧，等你同偶像個對話有返果個連貫感，唔會好似把口講完就算。","cursorPrompt":"Close the loop between chat and the logged workout by adding a session debrief that persists what the user says in conversation. Add a notion-level concept and UI: in eva-core/src/workoutPlanner.ts add a recordDebrief(dayIndex, hardestExercise, difficultyRating, feelNote) function that appends a debrief entry to the stored workout log (same store as sessions) and returns the updated summary. Add eva-core/src/notions.ts exporting a DEBRIEF_QUESTIONS object mapping optional follow-up prompts (e.g. hardest exercise this session, difficulty, any note) meant to be surfaced by the assistant in chat after a workout. In eva-web/src/components/WorkoutTracker.tsx add a compact '上次回顧' card showing the most recent debrief's hardest exercise and note, with a small prompt hint text. In eva-web/src/pages/RoutineView.tsx render that debrief card above the accordion so the tracker page and the chat memory feel connected. Keep everything dependency-free, follow existing conventions, and make no changes to overlay/data or secrets."}
```
- 實際改動檔：EVA.md, eva-core/ask.cjs, eva-core/evolve.cjs, eva-core/server.cjs, eva-core/tencent-lke.cjs, eva-web/index.html, eva-web/package.json, eva-web/src/api.js, eva-web/src/main.js, eva-web/src/markdown.js, eva-web/src/style.css, overlay/app.html, overlay/boot.cjs, overlay/chat.html, overlay/main.cjs, package.json, eva-core/chat-service.cjs, eva-core/data/, eva-core/dialogue-service.cjs, eva-core/fallback-messages.cjs, eva-core/models/, eva-core/oshi-match.cjs, eva-core/services/, eva-core/src/, eva-core/training-plan.cjs, eva-core/types/, eva-core/ws-sync.cjs, eva-web/src/App.jsx, eva-web/src/App.tsx, eva-web/src/chat-ui.js, eva-web/src/components/, eva-web/src/data/, eva-web/src/hooks/, eva-web/src/index.tsx, eva-web/src/main.jsx, eva-web/src/pages/, eva-web/src/services/, eva-web/src/styles/, eva-web/src/utils/, eva-web/src/ws-sync.js
- 已還原：env.example
- diff stat：
```
EVA.md                   |  67 ++++++++-
 eva-core/ask.cjs         |  81 +++++++++-
 eva-core/evolve.cjs      | 272 +++++++++++++++++++++++----------
 eva-core/server.cjs      | 170 ++++++++++++++++++++-
 eva-core/tencent-lke.cjs | 185 ++++++++++++++++++++---
 eva-web/index.html       |   2 +-
 eva-web/package.json     |   6 +-
 eva-web/src/api.js       | 113 +++++++++++++-
 eva-web/src/main.js      | 380 ++++++++++++++++++++++++++++-------------------
 eva-web/src/markdown.js  | 197 ++++++++++++++++++++----
 eva-web/src/style.css    | 379 ++++++++++++++++++++++++++++++++++++++++++----
 overlay/app.html         |  10 +-
 overlay/boot.cjs         |   4 +
 overlay/chat.html        |  10 +-
 overlay/main.cjs         | 132 +++++++++++++---
 package.json             |   3 +-
 16 files changed, 1649 insertions(+), 362 deletions(-)
eva-core/chat-service.cjs (new)
eva-core/data/ (new)
eva-core/dialogue-service.cjs (new)
eva-core/fallback-messages.cjs (new)
eva-core/models/ (new)
eva-core/oshi-match.cjs (new)
eva-core/services/ (new)
eva-core/src/ (new)
eva-core/training-plan.cjs (new)
eva-core/types/ (new)
eva-core/ws-sync.cjs (new)
eva-web/src/App.jsx (new)
eva-web/src/App.tsx (new)
eva-web/src/chat-ui.js (new)
eva-web/src/components/ (new)
eva-web/src/data/ (new)
eva-web/src/hooks/ (new)
eva-web/src/index.tsx (new)
eva-web/src/main.jsx (new)
eva-web/src/pages/ (new)
eva-web/src/services/ (new)
eva-web/src/styles/ (new)
eva-web/src/utils/ (new)
eva-web/src/ws-sync.js (new)
```
- Cursor 回覆：Session debrief is wired through storage, chat notions, and the routine UI.

### What changed

**`eva-core/src/utils/progress.ts`**
- Added `WorkoutDebrief` type plus `normalizeDebriefs`, `recordDebriefEntry`, and `getLatestDebrief`.

**`eva-core/src/workoutPlanner.ts`**
- Extended the workout log store to `{ sessions, debriefs }` (migrates from the old sessions-only array).
- Added `sessionStore.getDebriefs()` / `saveDebriefs()`.
- Extended `ProgressSummary` with `latestDebrief`.
- Added `recordDebrief(dayIndex, hardestExercise, difficultyRating, feelNote)` — appends a debrief and returns the updated summary.

**`eva-core/src/notions.ts`** (new)
- `DEBRIEF_QUESTIONS` with intro, hardest exercise, difficulty, feel note, and a hint for chat/UI.
- `getDebriefPromptSequence()` for ordered follow-ups.

**`eva-web/src/components/WorkoutTracker.tsx`**
- Exported `LastDebriefCard` — compact **上次回顧** card with hardest exercise, note, date, and hint.
- Rendered inside the tracker section.

**`e
…(truncated)
- 檢查：syntax ok: eva-core/ask.cjs
syntax ok: eva-core/evolve.cjs
syntax ok: eva-core/server.cjs
syntax ok: eva-core/tencent-lke.cjs
syntax ok: eva-web/src/api.js
syntax ok: eva-web/src/main.js
syntax ok: eva-web/src/markdown.js
syntax ok: overlay/boot.cjs
syntax ok: overlay/main.cjs
syntax ok: eva-core/chat-service.cjs
syntax ok: eva-core/dialogue-service.cjs
syntax ok: eva-core/fallback-messages.cjs
syntax ok: eva-core/oshi-match.cjs
syntax ok: eva-core/training-plan.cjs
syntax ok: eva-core/ws-sync.cjs
syntax ok: eva-web/src/chat-ui.js
syntax ok: eva-web/src/ws-sync.js
eva-web build ok
- diff：
```
diff --git a/EVA.md b/EVA.md
index 64db845..5a075f9 100644
--- a/EVA.md
+++ b/EVA.md
@@ -2,7 +2,7 @@
 
 Shared architecture:
 
-- **`eva-core`** — ask pipeline + HTTP/SSE API on `:8787`
+- **`eva-core`** — ask pipeline + HTTP/SSE API on `:8787` (WebSocket `/api/ws` for live chat-history sync + keep-alive reconnect)
 - **`eva-web`** — Vite chat UI (PC + Android)
 - **`overlay/`** — Electron shell (mascot, tray, drag; nightly auto-evolve)
 - **`eva-mobile/`** — Capacitor Android APK
@@ -14,13 +14,17 @@ Electron / Android APK
    eva-core :8787  →  Eva LLM (Ollama / OpenRouter / …)  或  騰訊雲 ADP
 ```
 
-UI 右上角可切 **Eva** / **騰訊雲**。騰訊雲模式會把最新一句 user 訊息送到 `https://wss.lke.tencentcloud.com/adp/v2/chat`，並每次帶上 Eva 人設（`SystemRole`）。事實題會先查本地 Postgres KB（miss 再 Tavily），把命中資料一併塞進 `SystemRole` 畀 ADP。ConversationId 由本機持久化；Clear 會開新會話。
+UI 右上角可切 **Eva** / **騰訊雲**。聊天輸入框：**Enter** 或 **Ctrl/Cmd+Enter** 送出訊息，**Shift+Enter** 換行（IME 組字中唔會誤送）。Eva 回覆右上角有 **↻** 掣，可以重新生成最後一輪回覆（`/api/chat` 亦支援 `{ regenerate: true }` 剝走尾端 assistant 再問）。騰訊雲模式會把最新一句 user 訊息送到 `https://wss.lke.tencentcloud.com/adp/v2/chat`，並每次帶上 Eva 人設（`SystemRole`）。事實題會先查本地 Postgres KB（miss 再 Tavily），把命中資料一併塞進 `SystemRole` 畀 ADP。ConversationId 由本機持久化；Clear 會開新會話。
+
+模型 API 餘額不足（`code:460032`）時，唔會再爆 raw error——`eva-core/fallback-messages.cjs` 統一返回星野玲語氣嘅 fallback 訊息；`chat-service.cjs` / `server.cjs` / `api.js` 會當正常回覆顯示，console 仍保留原始錯誤供 debug。
+
+連續重複相同問候（例如連續三次「hi」）時，`eva-core/dialogue-service.cjs` 會喺 LLM 之前識別模式，第 2 次起改用分層引導回覆（唔再重複自我介紹），引導用戶講今日想傾啲咩；一般非重複對話不受影響。
 
 ### 自動進化（騰訊雲想 → Cursor 改）
 
 Chatbox **冇** Apply / 自動進化掣。進化改為 **每晚 00:00** Windows 排程跑（`EvaNightlyEvolve`），唔使開 overlay。
 
-每輪可以係一個完整改進（幾個相關檔、必要時開新檔），預設最多 **4** 輪。唔會 commit；唔准改 `.env`、`overlay/data`、`sample/`、secrets。
+每輪可以係一個完整改進（幾個相關檔、必要時開新檔），預設最多 **4** 輪。騰訊雲只准出 **JSON 方案**（唔會當自己寫 code）；超時唔會把 thinking 旁白當答案。唔會 commit；唔准改 `.env`、`overlay/data`、`sample/`、secrets。
 
 完成紀錄寫入：
 
@@ -121,6 +125,61 @@ npm run eva:web:dev
 # set EVA_WEB_URL=http://127.0.0.1:5173 && npm run overlay
 ```
 
+### 健身訓練計劃（Workout Planner）
+
+Web UI 右上角 **健身** 連結，或 hash route `#/workout`，開啟每週訓練編排頁：
+
+- **`eva-core/services/exerciseLibrary.js`** — 40+ 動作、7 大肌群（二頭／三頭／胸／背／肩／腿／核心），含 LUMINA 偶像 form tips
+- **`eva-core/services/workoutPlanner.js`** — 產生 7 日 plan；`biceps` + `beginner` 同 chat 二頭肌線條表完全一致
+- **`eva-web/src/pages/WorkoutPlanner.jsx`** — 肌群 selector、難度 toggle、7 日 card
+- **`eva-core/services/progressCalculator.js`** — 從 localStorage sessions 計算 PR、重量／容量趨勢、成就、肌群平衡
+- **`eva-web/src/pages/WorkoutProgress.jsx`** — `#/workout/progress`：4 張 PR 卡、canvas 重量／容量圖、成就徽章、肌群橫條
+- **`eva-web/src/pages/WorkoutDashboard.jsx`** — 訓練紀錄摘要；有數據時連去進度頁
+- **`eva-web/src/components/TrainingWeekView.tsx`** + **`TrainingDayCard.tsx`** + **`RestTimer.tsx`** — `#/workout/plans/:id` 訓練日追蹤：逐組 checkbox、日／週進度條；勾選一組後自動開始組間休息計時（預設 60s，±15s 調整）；離開頁面或切換訓練日會暫停；進度存 `localStorage`（`eva-training-day-progress:*`）
+- **`#/workout/play`** — 引導式訓練 session（`SessionPlayer.tsx`）：任何訓練日撳「開始訓練 ▶」進入；顯示動作名、第 X/Y 組、「完成呢組」；組間圓形倒數（用該動作 `restSeconds`）+ 蜂鳴；Eva 開場／中場／收工應援；完結 summary（總時長、動作數、Eva 結語）；session 寫入 `eva-workout-sessions`
+- API：`GET /api/workout/library`、`GET /api/workout/plan?muscleGroup=biceps&difficulty=beginner`
+
+### 訓練連續打卡（Workout Streak Tracker）
+
+主頁 chat 下方 **`WorkoutTracker`**：顯示今日日期、打勾「完成今日訓練」、`StreakBadge` 火焰連續日數；3／7／14／30 日 milestone 彈 Eva 粵語鼓勵。資料存 `localStorage`（`eva-workout-streak-v1`），刷新唔會丟。
+
+- **`eva-web/src/utils/workoutStorage.ts`** — 日曆 key、streak 計算、milestone 偵測
+- **`eva-web/src/components/WorkoutTracker.tsx`** + **`StreakBadge.tsx`** + **`styles/workout.css`**
+
+### 心情日記（Mood & Journal）
+
+Web UI 右上角 **心情** 連結，或 hash route `#/mood`，開啟每日心情打卡同 timeline：
+
+- **`eva-core/services/mood-journal.js`** — localStorage 持久化；`logMood` / `getMoodHistory` / streak / stats / Eva 粵語鼓勵 / 偶像活動建議
+- **`eva-web/src/hooks/useMoodJournal.js`** — React state + 每日自動彈 check-in（未打卡時）
+- **`eva-web/src/components/MoodCheckIn.jsx`** — 5 級 emoji 選擇、備註、活動 tag、提交後 Eva 回應
+- **`eva-web/src/components/MoodTime
…(truncated)
```

## 2026-10-02 01:18:11  （1/4 輪）

### Eva 講

今晚想改自己少少，結果一件都未整到。有啲唔開心。
唉，騰訊雲講嘢我聽唔明，所以「呢樣」未整到。
想睇技術細節就去 overlay/data/evolve-log.md（1/4 輪）。

### 第1輪 [parse-fail] stop
- **Eva：** 唉，騰訊雲講嘢我聽唔明，所以「呢樣」未整到。
- 想改成點：（空）
- 騰訊原文：
```
⚠️ 玲今日把聲用緊嘅能源有啲唔夠⋯⋯主辦方會盡快 recharge（充值）！你可以一陣再同我傾過。多謝你等陣～
```
- 實現唔到原因：騰訊雲回覆解析唔到（要純 JSON 方案，唔係「Now creating…」旁白）。原文開頭：⚠️ 玲今日把聲用緊嘅能源有啲唔夠⋯⋯主辦方會盡快 recharge（充值）！你可以一陣再同我傾過。多謝你等陣～
- 技術詳情：⚠️ 玲今日把聲用緊嘅能源有啲唔夠⋯⋯主辦方會盡快 recharge（充值）！你可以一陣再同我傾過。多謝你等陣～

## 2026-10-02 16:00:11  （1/4 輪）

### Eva 講

今晚想改自己少少，結果一件都未整到。有啲唔開心。
唉，騰訊雲講嘢我聽唔明，所以「呢樣」未整到。
想睇技術細節就去 overlay/data/evolve-log.md（1/4 輪）。

### 第1輪 [parse-fail] stop
- **Eva：** 唉，騰訊雲講嘢我聽唔明，所以「呢樣」未整到。
- 想改成點：（空）
- 騰訊原文：
```
⚠️ 玲今日把聲用緊嘅能源有啲唔夠⋯⋯主辦方會盡快 recharge（充值）！你可以一陣再同我傾過。多謝你等陣～
```
- 實現唔到原因：騰訊雲回覆解析唔到（要純 JSON 方案，唔係「Now creating…」旁白）。原文開頭：⚠️ 玲今日把聲用緊嘅能源有啲唔夠⋯⋯主辦方會盡快 recharge（充值）！你可以一陣再同我傾過。多謝你等陣～
- 技術詳情：⚠️ 玲今日把聲用緊嘅能源有啲唔夠⋯⋯主辦方會盡快 recharge（充值）！你可以一陣再同我傾過。多謝你等陣～

## 2026-10-03 16:00:13  （1/4 輪）

### Eva 講

今晚想改自己少少，結果一件都未整到。有啲唔開心。
唉，騰訊雲講嘢我聽唔明，所以「呢樣」未整到。
想睇技術細節就去 overlay/data/evolve-log.md（1/4 輪）。

### 第1輪 [parse-fail] stop
- **Eva：** 唉，騰訊雲講嘢我聽唔明，所以「呢樣」未整到。
- 想改成點：（空）
- 騰訊原文：
```
⚠️ 玲今日把聲用緊嘅能源有啲唔夠⋯⋯主辦方會盡快 recharge（充值）！你可以一陣再同我傾過。多謝你等陣～
```
- 實現唔到原因：騰訊雲回覆解析唔到（要純 JSON 方案，唔係「Now creating…」旁白）。原文開頭：⚠️ 玲今日把聲用緊嘅能源有啲唔夠⋯⋯主辦方會盡快 recharge（充值）！你可以一陣再同我傾過。多謝你等陣～
- 技術詳情：⚠️ 玲今日把聲用緊嘅能源有啲唔夠⋯⋯主辦方會盡快 recharge（充值）！你可以一陣再同我傾過。多謝你等陣～

## 2026-10-04 16:00:12  （1/4 輪）

### Eva 講

今晚想改自己少少，結果一件都未整到。有啲唔開心。
唉，騰訊雲講嘢我聽唔明，所以「呢樣」未整到。
想睇技術細節就去 overlay/data/evolve-log.md（1/4 輪）。

### 第1輪 [parse-fail] stop
- **Eva：** 唉，騰訊雲講嘢我聽唔明，所以「呢樣」未整到。
- 想改成點：（空）
- 騰訊原文：
```
⚠️ 玲今日把聲用緊嘅能源有啲唔夠⋯⋯主辦方會盡快 recharge（充值）！你可以一陣再同我傾過。多謝你等陣～
```
- 實現唔到原因：騰訊雲回覆解析唔到（要純 JSON 方案，唔係「Now creating…」旁白）。原文開頭：⚠️ 玲今日把聲用緊嘅能源有啲唔夠⋯⋯主辦方會盡快 recharge（充值）！你可以一陣再同我傾過。多謝你等陣～
- 技術詳情：⚠️ 玲今日把聲用緊嘅能源有啲唔夠⋯⋯主辦方會盡快 recharge（充值）！你可以一陣再同我傾過。多謝你等陣～

## 2026-10-05 16:00:12  （1/4 輪）

### Eva 講

今晚想改自己少少，結果一件都未整到。有啲唔開心。
唉，騰訊雲講嘢我聽唔明，所以「呢樣」未整到。
想睇技術細節就去 overlay/data/evolve-log.md（1/4 輪）。

### 第1輪 [parse-fail] stop
- **Eva：** 唉，騰訊雲講嘢我聽唔明，所以「呢樣」未整到。
- 想改成點：（空）
- 騰訊原文：
```
⚠️ 玲今日把聲用緊嘅能源有啲唔夠⋯⋯主辦方會盡快 recharge（充值）！你可以一陣再同我傾過。多謝你等陣～
```
- 實現唔到原因：騰訊雲回覆解析唔到（要純 JSON 方案，唔係「Now creating…」旁白）。原文開頭：⚠️ 玲今日把聲用緊嘅能源有啲唔夠⋯⋯主辦方會盡快 recharge（充值）！你可以一陣再同我傾過。多謝你等陣～
- 技術詳情：⚠️ 玲今日把聲用緊嘅能源有啲唔夠⋯⋯主辦方會盡快 recharge（充值）！你可以一陣再同我傾過。多謝你等陣～

## 2026-10-06 16:00:06  （1/4 輪）

### Eva 講

今晚想改自己少少，結果一件都未整到。有啲唔開心。
唉，騰訊雲講嘢我聽唔明，所以「呢樣」未整到。
想睇技術細節就去 overlay/data/evolve-log.md（1/4 輪）。

### 第1輪 [parse-fail] stop
- **Eva：** 唉，騰訊雲講嘢我聽唔明，所以「呢樣」未整到。
- 想改成點：（空）
- 騰訊原文：
```
⚠️ 玲今日把聲用緊嘅能源有啲唔夠⋯⋯主辦方會盡快 recharge（充值）！你可以一陣再同我傾過。多謝你等陣～
```
- 實現唔到原因：騰訊雲回覆解析唔到（要純 JSON 方案，唔係「Now creating…」旁白）。原文開頭：⚠️ 玲今日把聲用緊嘅能源有啲唔夠⋯⋯主辦方會盡快 recharge（充值）！你可以一陣再同我傾過。多謝你等陣～
- 技術詳情：⚠️ 玲今日把聲用緊嘅能源有啲唔夠⋯⋯主辦方會盡快 recharge（充值）！你可以一陣再同我傾過。多謝你等陣～

## 2026-10-07 16:00:07  （1/4 輪）

### Eva 講

今晚想改自己少少，結果一件都未整到。有啲唔開心。
唉，騰訊雲講嘢我聽唔明，所以「呢樣」未整到。
想睇技術細節就去 overlay/data/evolve-log.md（1/4 輪）。

### 第1輪 [parse-fail] stop
- **Eva：** 唉，騰訊雲講嘢我聽唔明，所以「呢樣」未整到。
- 想改成點：（空）
- 騰訊原文：
```
⚠️ 玲今日把聲用緊嘅能源有啲唔夠⋯⋯主辦方會盡快 recharge（充值）！你可以一陣再同我傾過。多謝你等陣～
```
- 實現唔到原因：騰訊雲回覆解析唔到（要純 JSON 方案，唔係「Now creating…」旁白）。原文開頭：⚠️ 玲今日把聲用緊嘅能源有啲唔夠⋯⋯主辦方會盡快 recharge（充值）！你可以一陣再同我傾過。多謝你等陣～
- 技術詳情：⚠️ 玲今日把聲用緊嘅能源有啲唔夠⋯⋯主辦方會盡快 recharge（充值）！你可以一陣再同我傾過。多謝你等陣～

## 2026-10-08 16:00:08  （1/4 輪）

### Eva 講

今晚想改自己少少，結果一件都未整到。有啲唔開心。
唉，騰訊雲講嘢我聽唔明，所以「呢樣」未整到。
想睇技術細節就去 overlay/data/evolve-log.md（1/4 輪）。

### 第1輪 [parse-fail] stop
- **Eva：** 唉，騰訊雲講嘢我聽唔明，所以「呢樣」未整到。
- 想改成點：（空）
- 騰訊原文：
```
⚠️ 玲今日把聲用緊嘅能源有啲唔夠⋯⋯主辦方會盡快 recharge（充值）！你可以一陣再同我傾過。多謝你等陣～
```
- 實現唔到原因：騰訊雲回覆解析唔到（要純 JSON 方案，唔係「Now creating…」旁白）。原文開頭：⚠️ 玲今日把聲用緊嘅能源有啲唔夠⋯⋯主辦方會盡快 recharge（充值）！你可以一陣再同我傾過。多謝你等陣～
- 技術詳情：⚠️ 玲今日把聲用緊嘅能源有啲唔夠⋯⋯主辦方會盡快 recharge（充值）！你可以一陣再同我傾過。多謝你等陣～

## 2026-10-09 16:00:07  （1/4 輪）

### Eva 講

今晚想改自己少少，結果一件都未整到。有啲唔開心。
唉，騰訊雲講嘢我聽唔明，所以「呢樣」未整到。
想睇技術細節就去 overlay/data/evolve-log.md（1/4 輪）。

### 第1輪 [parse-fail] stop
- **Eva：** 唉，騰訊雲講嘢我聽唔明，所以「呢樣」未整到。
- 想改成點：（空）
- 騰訊原文：
```
⚠️ 玲今日把聲用緊嘅能源有啲唔夠⋯⋯主辦方會盡快 recharge（充值）！你可以一陣再同我傾過。多謝你等陣～
```
- 實現唔到原因：騰訊雲回覆解析唔到（要純 JSON 方案，唔係「Now creating…」旁白）。原文開頭：⚠️ 玲今日把聲用緊嘅能源有啲唔夠⋯⋯主辦方會盡快 recharge（充值）！你可以一陣再同我傾過。多謝你等陣～
- 技術詳情：⚠️ 玲今日把聲用緊嘅能源有啲唔夠⋯⋯主辦方會盡快 recharge（充值）！你可以一陣再同我傾過。多謝你等陣～

## 2026-10-10 16:00:07  （1/4 輪）

### Eva 講

今晚想改自己少少，結果一件都未整到。有啲唔開心。
唉，騰訊雲講嘢我聽唔明，所以「呢樣」未整到。
想睇技術細節就去 overlay/data/evolve-log.md（1/4 輪）。

### 第1輪 [parse-fail] stop
- **Eva：** 唉，騰訊雲講嘢我聽唔明，所以「呢樣」未整到。
- 想改成點：（空）
- 騰訊原文：
```
⚠️ 玲今日把聲用緊嘅能源有啲唔夠⋯⋯主辦方會盡快 recharge（充值）！你可以一陣再同我傾過。多謝你等陣～
```
- 實現唔到原因：騰訊雲回覆解析唔到（要純 JSON 方案，唔係「Now creating…」旁白）。原文開頭：⚠️ 玲今日把聲用緊嘅能源有啲唔夠⋯⋯主辦方會盡快 recharge（充值）！你可以一陣再同我傾過。多謝你等陣～
- 技術詳情：⚠️ 玲今日把聲用緊嘅能源有啲唔夠⋯⋯主辦方會盡快 recharge（充值）！你可以一陣再同我傾過。多謝你等陣～

## 2026-10-11 16:00:08  （1/4 輪）

### Eva 講

今晚想改自己少少，結果一件都未整到。有啲唔開心。
唉，騰訊雲講嘢我聽唔明，所以「呢樣」未整到。
想睇技術細節就去 overlay/data/evolve-log.md（1/4 輪）。

### 第1輪 [parse-fail] stop
- **Eva：** 唉，騰訊雲講嘢我聽唔明，所以「呢樣」未整到。
- 想改成點：（空）
- 騰訊原文：
```
⚠️ 玲今日把聲用緊嘅能源有啲唔夠⋯⋯主辦方會盡快 recharge（充值）！你可以一陣再同我傾過。多謝你等陣～
```
- 實現唔到原因：騰訊雲回覆解析唔到（要純 JSON 方案，唔係「Now creating…」旁白）。原文開頭：⚠️ 玲今日把聲用緊嘅能源有啲唔夠⋯⋯主辦方會盡快 recharge（充值）！你可以一陣再同我傾過。多謝你等陣～
- 技術詳情：⚠️ 玲今日把聲用緊嘅能源有啲唔夠⋯⋯主辦方會盡快 recharge（充值）！你可以一陣再同我傾過。多謝你等陣～

## 2026-10-12 16:00:22  （1/4 輪）

### Eva 講

今晚想改自己少少，結果一件都未整到。有啲唔開心。
唉，騰訊雲講嘢我聽唔明，所以「呢樣」未整到。
想睇技術細節就去 overlay/data/evolve-log.md（1/4 輪）。

### 第1輪 [parse-fail] stop
- **Eva：** 唉，騰訊雲講嘢我聽唔明，所以「呢樣」未整到。
- 想改成點：（空）
- 騰訊原文：
```
⚠️ 玲今日把聲用緊嘅能源有啲唔夠⋯⋯主辦方會盡快 recharge（充值）！你可以一陣再同我傾過。多謝你等陣～
```
- 實現唔到原因：騰訊雲回覆解析唔到（要純 JSON 方案，唔係「Now creating…」旁白）。原文開頭：⚠️ 玲今日把聲用緊嘅能源有啲唔夠⋯⋯主辦方會盡快 recharge（充值）！你可以一陣再同我傾過。多謝你等陣～
- 技術詳情：⚠️ 玲今日把聲用緊嘅能源有啲唔夠⋯⋯主辦方會盡快 recharge（充值）！你可以一陣再同我傾過。多謝你等陣～

## 2026-10-13 16:00:08  （1/4 輪）

### Eva 講

今晚想改自己少少，結果一件都未整到。有啲唔開心。
唉，騰訊雲講嘢我聽唔明，所以「呢樣」未整到。
想睇技術細節就去 overlay/data/evolve-log.md（1/4 輪）。

### 第1輪 [parse-fail] stop
- **Eva：** 唉，騰訊雲講嘢我聽唔明，所以「呢樣」未整到。
- 想改成點：（空）
- 騰訊原文：
```
⚠️ 玲今日把聲用緊嘅能源有啲唔夠⋯⋯主辦方會盡快 recharge（充值）！你可以一陣再同我傾過。多謝你等陣～
```
- 實現唔到原因：騰訊雲回覆解析唔到（要純 JSON 方案，唔係「Now creating…」旁白）。原文開頭：⚠️ 玲今日把聲用緊嘅能源有啲唔夠⋯⋯主辦方會盡快 recharge（充值）！你可以一陣再同我傾過。多謝你等陣～
- 技術詳情：⚠️ 玲今日把聲用緊嘅能源有啲唔夠⋯⋯主辦方會盡快 recharge（充值）！你可以一陣再同我傾過。多謝你等陣～

## 2026-10-16 16:00:08  （1/4 輪）

### Eva 講

今晚想改自己少少，結果一件都未整到。有啲唔開心。
唉，騰訊雲講嘢我聽唔明，所以「呢樣」未整到。
想睇技術細節就去 overlay/data/evolve-log.md（1/4 輪）。

### 第1輪 [parse-fail] stop
- **Eva：** 唉，騰訊雲講嘢我聽唔明，所以「呢樣」未整到。
- 想改成點：（空）
- 騰訊原文：
```
⚠️ 玲今日把聲用緊嘅能源有啲唔夠⋯⋯主辦方會盡快 recharge（充值）！你可以一陣再同我傾過。多謝你等陣～
```
- 實現唔到原因：騰訊雲回覆解析唔到（要純 JSON 方案，唔係「Now creating…」旁白）。原文開頭：⚠️ 玲今日把聲用緊嘅能源有啲唔夠⋯⋯主辦方會盡快 recharge（充值）！你可以一陣再同我傾過。多謝你等陣～
- 技術詳情：⚠️ 玲今日把聲用緊嘅能源有啲唔夠⋯⋯主辦方會盡快 recharge（充值）！你可以一陣再同我傾過。多謝你等陣～

## 2026-10-17 16:00:11  （1/4 輪）

### Eva 講

今晚想改自己少少，結果一件都未整到。有啲唔開心。
唉，騰訊雲講嘢我聽唔明，所以「呢樣」未整到。
想睇技術細節就去 overlay/data/evolve-log.md（1/4 輪）。

### 第1輪 [parse-fail] stop
- **Eva：** 唉，騰訊雲講嘢我聽唔明，所以「呢樣」未整到。
- 想改成點：（空）
- 騰訊原文：
```
⚠️ 玲今日把聲用緊嘅能源有啲唔夠⋯⋯主辦方會盡快 recharge（充值）！你可以一陣再同我傾過。多謝你等陣～
```
- 實現唔到原因：騰訊雲回覆解析唔到（要純 JSON 方案，唔係「Now creating…」旁白）。原文開頭：⚠️ 玲今日把聲用緊嘅能源有啲唔夠⋯⋯主辦方會盡快 recharge（充值）！你可以一陣再同我傾過。多謝你等陣～
- 技術詳情：⚠️ 玲今日把聲用緊嘅能源有啲唔夠⋯⋯主辦方會盡快 recharge（充值）！你可以一陣再同我傾過。多謝你等陣～

## 2026-10-18 16:00:07  （1/4 輪）

### Eva 講

今晚想改自己少少，結果一件都未整到。有啲唔開心。
唉，騰訊雲講嘢我聽唔明，所以「呢樣」未整到。
想睇技術細節就去 overlay/data/evolve-log.md（1/4 輪）。

### 第1輪 [parse-fail] stop
- **Eva：** 唉，騰訊雲講嘢我聽唔明，所以「呢樣」未整到。
- 想改成點：（空）
- 騰訊原文：
```
⚠️ 玲今日把聲用緊嘅能源有啲唔夠⋯⋯主辦方會盡快 recharge（充值）！你可以一陣再同我傾過。多謝你等陣～
```
- 實現唔到原因：騰訊雲回覆解析唔到（要純 JSON 方案，唔係「Now creating…」旁白）。原文開頭：⚠️ 玲今日把聲用緊嘅能源有啲唔夠⋯⋯主辦方會盡快 recharge（充值）！你可以一陣再同我傾過。多謝你等陣～
- 技術詳情：⚠️ 玲今日把聲用緊嘅能源有啲唔夠⋯⋯主辦方會盡快 recharge（充值）！你可以一陣再同我傾過。多謝你等陣～

## 2026-10-19 16:00:07  （1/4 輪）

### Eva 講

今晚想改自己少少，結果一件都未整到。有啲唔開心。
唉，騰訊雲講嘢我聽唔明，所以「呢樣」未整到。
想睇技術細節就去 overlay/data/evolve-log.md（1/4 輪）。

### 第1輪 [parse-fail] stop
- **Eva：** 唉，騰訊雲講嘢我聽唔明，所以「呢樣」未整到。
- 想改成點：（空）
- 騰訊原文：
```
⚠️ 玲今日把聲用緊嘅能源有啲唔夠⋯⋯主辦方會盡快 recharge（充值）！你可以一陣再同我傾過。多謝你等陣～
```
- 實現唔到原因：騰訊雲回覆解析唔到（要純 JSON 方案，唔係「Now creating…」旁白）。原文開頭：⚠️ 玲今日把聲用緊嘅能源有啲唔夠⋯⋯主辦方會盡快 recharge（充值）！你可以一陣再同我傾過。多謝你等陣～
- 技術詳情：⚠️ 玲今日把聲用緊嘅能源有啲唔夠⋯⋯主辦方會盡快 recharge（充值）！你可以一陣再同我傾過。多謝你等陣～

## 2026-10-20 16:00:07  （1/4 輪）

### Eva 講

今晚想改自己少少，結果一件都未整到。有啲唔開心。
唉，騰訊雲講嘢我聽唔明，所以「呢樣」未整到。
想睇技術細節就去 overlay/data/evolve-log.md（1/4 輪）。

### 第1輪 [parse-fail] stop
- **Eva：** 唉，騰訊雲講嘢我聽唔明，所以「呢樣」未整到。
- 想改成點：（空）
- 騰訊原文：
```
⚠️ 玲今日把聲用緊嘅能源有啲唔夠⋯⋯主辦方會盡快 recharge（充值）！你可以一陣再同我傾過。多謝你等陣～
```
- 實現唔到原因：騰訊雲回覆解析唔到（要純 JSON 方案，唔係「Now creating…」旁白）。原文開頭：⚠️ 玲今日把聲用緊嘅能源有啲唔夠⋯⋯主辦方會盡快 recharge（充值）！你可以一陣再同我傾過。多謝你等陣～
- 技術詳情：⚠️ 玲今日把聲用緊嘅能源有啲唔夠⋯⋯主辦方會盡快 recharge（充值）！你可以一陣再同我傾過。多謝你等陣～

## 2026-10-21 16:00:07  （1/4 輪）

### Eva 講

今晚想改自己少少，結果一件都未整到。有啲唔開心。
唉，騰訊雲講嘢我聽唔明，所以「呢樣」未整到。
想睇技術細節就去 overlay/data/evolve-log.md（1/4 輪）。

### 第1輪 [parse-fail] stop
- **Eva：** 唉，騰訊雲講嘢我聽唔明，所以「呢樣」未整到。
- 想改成點：（空）
- 騰訊原文：
```
⚠️ 玲今日把聲用緊嘅能源有啲唔夠⋯⋯主辦方會盡快 recharge（充值）！你可以一陣再同我傾過。多謝你等陣～
```
- 實現唔到原因：騰訊雲回覆解析唔到（要純 JSON 方案，唔係「Now creating…」旁白）。原文開頭：⚠️ 玲今日把聲用緊嘅能源有啲唔夠⋯⋯主辦方會盡快 recharge（充值）！你可以一陣再同我傾過。多謝你等陣～
- 技術詳情：⚠️ 玲今日把聲用緊嘅能源有啲唔夠⋯⋯主辦方會盡快 recharge（充值）！你可以一陣再同我傾過。多謝你等陣～

## 2026-10-22 16:00:07  （1/4 輪）

### Eva 講

今晚想改自己少少，結果一件都未整到。有啲唔開心。
唉，騰訊雲講嘢我聽唔明，所以「呢樣」未整到。
想睇技術細節就去 overlay/data/evolve-log.md（1/4 輪）。

### 第1輪 [parse-fail] stop
- **Eva：** 唉，騰訊雲講嘢我聽唔明，所以「呢樣」未整到。
- 想改成點：（空）
- 騰訊原文：
```
⚠️ 玲今日把聲用緊嘅能源有啲唔夠⋯⋯主辦方會盡快 recharge（充值）！你可以一陣再同我傾過。多謝你等陣～
```
- 實現唔到原因：騰訊雲回覆解析唔到（要純 JSON 方案，唔係「Now creating…」旁白）。原文開頭：⚠️ 玲今日把聲用緊嘅能源有啲唔夠⋯⋯主辦方會盡快 recharge（充值）！你可以一陣再同我傾過。多謝你等陣～
- 技術詳情：⚠️ 玲今日把聲用緊嘅能源有啲唔夠⋯⋯主辦方會盡快 recharge（充值）！你可以一陣再同我傾過。多謝你等陣～

## 2026-10-23 16:00:10  （1/4 輪）

### Eva 講

今晚想改自己少少，結果一件都未整到。有啲唔開心。
唉，騰訊雲講嘢我聽唔明，所以「呢樣」未整到。
想睇技術細節就去 overlay/data/evolve-log.md（1/4 輪）。

### 第1輪 [parse-fail] stop
- **Eva：** 唉，騰訊雲講嘢我聽唔明，所以「呢樣」未整到。
- 想改成點：（空）
- 騰訊原文：
```
⚠️ 玲今日把聲用緊嘅能源有啲唔夠⋯⋯主辦方會盡快 recharge（充值）！你可以一陣再同我傾過。多謝你等陣～
```
- 實現唔到原因：騰訊雲回覆解析唔到（要純 JSON 方案，唔係「Now creating…」旁白）。原文開頭：⚠️ 玲今日把聲用緊嘅能源有啲唔夠⋯⋯主辦方會盡快 recharge（充值）！你可以一陣再同我傾過。多謝你等陣～
- 技術詳情：⚠️ 玲今日把聲用緊嘅能源有啲唔夠⋯⋯主辦方會盡快 recharge（充值）！你可以一陣再同我傾過。多謝你等陣～

## 2026-10-24 16:00:08  （1/4 輪）

### Eva 講

今晚想改自己少少，結果一件都未整到。有啲唔開心。
唉，騰訊雲講嘢我聽唔明，所以「呢樣」未整到。
想睇技術細節就去 overlay/data/evolve-log.md（1/4 輪）。

### 第1輪 [parse-fail] stop
- **Eva：** 唉，騰訊雲講嘢我聽唔明，所以「呢樣」未整到。
- 想改成點：（空）
- 騰訊原文：
```
⚠️ 玲今日把聲用緊嘅能源有啲唔夠⋯⋯主辦方會盡快 recharge（充值）！你可以一陣再同我傾過。多謝你等陣～
```
- 實現唔到原因：騰訊雲回覆解析唔到（要純 JSON 方案，唔係「Now creating…」旁白）。原文開頭：⚠️ 玲今日把聲用緊嘅能源有啲唔夠⋯⋯主辦方會盡快 recharge（充值）！你可以一陣再同我傾過。多謝你等陣～
- 技術詳情：⚠️ 玲今日把聲用緊嘅能源有啲唔夠⋯⋯主辦方會盡快 recharge（充值）！你可以一陣再同我傾過。多謝你等陣～

## 2026-10-25 16:00:08  （1/4 輪）

### Eva 講

今晚想改自己少少，結果一件都未整到。有啲唔開心。
唉，騰訊雲講嘢我聽唔明，所以「呢樣」未整到。
想睇技術細節就去 overlay/data/evolve-log.md（1/4 輪）。

### 第1輪 [parse-fail] stop
- **Eva：** 唉，騰訊雲講嘢我聽唔明，所以「呢樣」未整到。
- 想改成點：（空）
- 騰訊原文：
```
⚠️ 玲今日把聲用緊嘅能源有啲唔夠⋯⋯主辦方會盡快 recharge（充值）！你可以一陣再同我傾過。多謝你等陣～
```
- 實現唔到原因：騰訊雲回覆解析唔到（要純 JSON 方案，唔係「Now creating…」旁白）。原文開頭：⚠️ 玲今日把聲用緊嘅能源有啲唔夠⋯⋯主辦方會盡快 recharge（充值）！你可以一陣再同我傾過。多謝你等陣～
- 技術詳情：⚠️ 玲今日把聲用緊嘅能源有啲唔夠⋯⋯主辦方會盡快 recharge（充值）！你可以一陣再同我傾過。多謝你等陣～

## 2026-10-26 16:00:08  （1/4 輪）

### Eva 講

今晚想改自己少少，結果一件都未整到。有啲唔開心。
唉，騰訊雲講嘢我聽唔明，所以「呢樣」未整到。
想睇技術細節就去 overlay/data/evolve-log.md（1/4 輪）。

### 第1輪 [parse-fail] stop
- **Eva：** 唉，騰訊雲講嘢我聽唔明，所以「呢樣」未整到。
- 想改成點：（空）
- 騰訊原文：
```
⚠️ 玲今日把聲用緊嘅能源有啲唔夠⋯⋯主辦方會盡快 recharge（充值）！你可以一陣再同我傾過。多謝你等陣～
```
- 實現唔到原因：騰訊雲回覆解析唔到（要純 JSON 方案，唔係「Now creating…」旁白）。原文開頭：⚠️ 玲今日把聲用緊嘅能源有啲唔夠⋯⋯主辦方會盡快 recharge（充值）！你可以一陣再同我傾過。多謝你等陣～
- 技術詳情：⚠️ 玲今日把聲用緊嘅能源有啲唔夠⋯⋯主辦方會盡快 recharge（充值）！你可以一陣再同我傾過。多謝你等陣～

## 2026-10-27 16:00:08  （1/4 輪）

### Eva 講

今晚想改自己少少，結果一件都未整到。有啲唔開心。
唉，騰訊雲講嘢我聽唔明，所以「呢樣」未整到。
想睇技術細節就去 overlay/data/evolve-log.md（1/4 輪）。

### 第1輪 [parse-fail] stop
- **Eva：** 唉，騰訊雲講嘢我聽唔明，所以「呢樣」未整到。
- 想改成點：（空）
- 騰訊原文：
```
⚠️ 玲今日把聲用緊嘅能源有啲唔夠⋯⋯主辦方會盡快 recharge（充值）！你可以一陣再同我傾過。多謝你等陣～
```
- 實現唔到原因：騰訊雲回覆解析唔到（要純 JSON 方案，唔係「Now creating…」旁白）。原文開頭：⚠️ 玲今日把聲用緊嘅能源有啲唔夠⋯⋯主辦方會盡快 recharge（充值）！你可以一陣再同我傾過。多謝你等陣～
- 技術詳情：⚠️ 玲今日把聲用緊嘅能源有啲唔夠⋯⋯主辦方會盡快 recharge（充值）！你可以一陣再同我傾過。多謝你等陣～

## 2026-10-28 16:00:13  （1/4 輪）

### Eva 講

今晚想改自己少少，結果一件都未整到。有啲唔開心。
唉，騰訊雲講嘢我聽唔明，所以「呢樣」未整到。
想睇技術細節就去 overlay/data/evolve-log.md（1/4 輪）。

### 第1輪 [parse-fail] stop
- **Eva：** 唉，騰訊雲講嘢我聽唔明，所以「呢樣」未整到。
- 想改成點：（空）
- 騰訊原文：
```
⚠️ 玲今日把聲用緊嘅能源有啲唔夠⋯⋯主辦方會盡快 recharge（充值）！你可以一陣再同我傾過。多謝你等陣～
```
- 實現唔到原因：騰訊雲回覆解析唔到（要純 JSON 方案，唔係「Now creating…」旁白）。原文開頭：⚠️ 玲今日把聲用緊嘅能源有啲唔夠⋯⋯主辦方會盡快 recharge（充值）！你可以一陣再同我傾過。多謝你等陣～
- 技術詳情：⚠️ 玲今日把聲用緊嘅能源有啲唔夠⋯⋯主辦方會盡快 recharge（充值）！你可以一陣再同我傾過。多謝你等陣～
