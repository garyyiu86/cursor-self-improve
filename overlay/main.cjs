const { app, BrowserWindow, screen, Menu, Tray, nativeImage, ipcMain } = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const crypto = require("node:crypto");
const OpenCC = require("opencc-js");
const knowledgeDb = require("./knowledge-db.cjs");

const toTraditional = OpenCC.Converter({ from: "cn", to: "hk" });
const toSimplified = OpenCC.Converter({ from: "hk", to: "cn" });
// Extra pass: some models emit Mainland phrasing that s2hk alone misses in edge cases
const toTraditionalTw = OpenCC.Converter({ from: "cn", to: "tw" });

/** Rough check for common Simplified-only characters. */
function looksLikeSimplifiedChinese(text) {
  const s = String(text || "");
  if (!s) return false;
  return /[这那吗为来对时会过还没说们个样长门车见发兴干声飞无怀报处总应开关东韦齐刘]/.test(
    s,
  );
}

function toTraditionalChinese(text) {
  const s = String(text ?? "");
  if (!s) return s;
  // cn→tw then cn→hk covers more variants than a single pass
  return toTraditional(toTraditionalTw(s));
}

const CHAR_WIDTH = 140;
const CHAR_HEIGHT = 180;
const CHAT_WIDTH = 360;
const WINDOW_WIDTH = CHAT_WIDTH + CHAR_WIDTH;
const WINDOW_HEIGHT = 420;
const MARGIN = 12;

let mainWindow = null;
let tray = null;
let dragOffset = null;
let allowQuit = false;
let reloadTimer = null;
let isRelaunching = false;
let askInFlight = 0;
let pendingReloadReason = null;

function nowMs() {
  return Date.now();
}

function msSince(start) {
  return Math.max(0, nowMs() - start);
}

function logTiming(label, start, extra = "") {
  const suffix = extra ? ` ${extra}` : "";
  console.log(`[Eva][timing] ${label}: ${msSince(start)}ms${suffix}`);
}

// Only one Eva process at a time. A second launch focuses the existing window and exits.
const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  console.warn("[Eva] Already running — exiting this instance.");
  app.exit(0);
}

function focusEvaWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.setAlwaysOnTop(true, "screen-saver");
  mainWindow.moveTop();
  mainWindow.focus();
}

app.on("second-instance", () => {
  console.log("[Eva] Second launch detected — focusing existing window.");
  focusEvaWindow();
});

function loadEnvFile() {
  const envPath = path.join(__dirname, "..", ".env");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const i = trimmed.indexOf("=");
    if (i <= 0) continue;
    const key = trimmed.slice(0, i).trim();
    let value = trimmed.slice(i + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

function dataDir() {
  const dir = path.join(__dirname, "data");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function windowBoundsPath() {
  return path.join(dataDir(), "window-bounds.json");
}

function defaultPosition() {
  const { workArea } = screen.getPrimaryDisplay();
  return {
    x: Math.round(workArea.x + workArea.width - WINDOW_WIDTH - MARGIN),
    y: Math.round(workArea.y + workArea.height - WINDOW_HEIGHT - MARGIN),
    width: WINDOW_WIDTH,
    height: WINDOW_HEIGHT,
  };
}

function isBoundsOnAnyDisplay(bounds) {
  const displays = screen.getAllDisplays();
  const cx = bounds.x + Math.floor(bounds.width / 2);
  const cy = bounds.y + Math.floor(bounds.height / 2);
  return displays.some((d) => {
    const b = d.bounds;
    return cx >= b.x && cy >= b.y && cx < b.x + b.width && cy < b.y + b.height;
  });
}

function loadWindowBounds() {
  try {
    const p = windowBoundsPath();
    if (!fs.existsSync(p)) return defaultPosition();
    const saved = JSON.parse(fs.readFileSync(p, "utf8"));
    const bounds = {
      x: Number(saved.x),
      y: Number(saved.y),
      width: WINDOW_WIDTH,
      height: WINDOW_HEIGHT,
    };
    if (![bounds.x, bounds.y].every(Number.isFinite)) return defaultPosition();
    if (!isBoundsOnAnyDisplay(bounds)) return defaultPosition();
    return bounds;
  } catch {
    return defaultPosition();
  }
}

let saveBoundsTimer = null;
function saveWindowBounds() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const b = mainWindow.getBounds();
  const payload = {
    x: b.x,
    y: b.y,
    width: WINDOW_WIDTH,
    height: WINDOW_HEIGHT,
    savedAt: new Date().toISOString(),
  };
  try {
    fs.writeFileSync(windowBoundsPath(), JSON.stringify(payload, null, 2), "utf8");
  } catch (err) {
    console.warn("[Eva] Failed to save window bounds:", err?.message || err);
  }
}

function scheduleSaveWindowBounds() {
  if (saveBoundsTimer) clearTimeout(saveBoundsTimer);
  saveBoundsTimer = setTimeout(saveWindowBounds, 250);
}

function createMainWindow() {
  const pos = loadWindowBounds();
  mainWindow = new BrowserWindow({
    width: WINDOW_WIDTH,
    height: WINDOW_HEIGHT,
    x: pos.x,
    y: pos.y,
    frame: false,
    transparent: true,
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: false,
    alwaysOnTop: true,
    hasShadow: false,
    show: false,
    backgroundColor: "#00000000",
    title: "Eva",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.setAlwaysOnTop(true, "screen-saver");
  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  mainWindow.loadFile(path.join(__dirname, "app.html"));

  mainWindow.once("ready-to-show", () => {
    // Re-apply saved position in case OS adjusted it
    const saved = loadWindowBounds();
    mainWindow.setBounds({
      x: saved.x,
      y: saved.y,
      width: WINDOW_WIDTH,
      height: WINDOW_HEIGHT,
    });
    mainWindow.show();
    mainWindow.moveTop();
    mainWindow.focus();
  });

  mainWindow.on("move", () => scheduleSaveWindowBounds());
  mainWindow.on("moved", () => scheduleSaveWindowBounds());

  mainWindow.on("close", (e) => {
    saveWindowBounds();
    if (!allowQuit) {
      e.preventDefault();
      mainWindow.show();
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

async function tavilySearchRaw(query) {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) {
    throw new Error(
      "Missing TAVILY_API_KEY in .env. Add it locally (do not paste keys in chat).",
    );
  }

  const t0 = nowMs();
  console.log(`[Eva][timing] Tavily start q="${String(query).slice(0, 60)}"`);
  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      search_depth: "basic",
      include_answer: true,
      max_results: 5,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    logTiming("Tavily error", t0, `status=${res.status}`);
    throw new Error(`Tavily error ${res.status}: ${body.slice(0, 300)}`);
  }

  const data = await res.json();
  const sources = (Array.isArray(data.results) ? data.results : [])
    .slice(0, 5)
    .map((r) => ({
      title: String(r.title || "Result"),
      url: String(r.url || ""),
      snippet: String(r.content || "").trim().slice(0, 280),
    }));

  logTiming(
    "Tavily OK",
    t0,
    `results=${sources.length} answerChars=${String(data.answer || "").length}`,
  );

  return {
    answer: String(data.answer || "").trim(),
    sources,
  };
}

function formatTavilyNotes(raw) {
  const lines = [];
  if (raw?.answer) {
    lines.push(String(raw.answer).trim());
    lines.push("");
  }
  for (const r of raw?.sources || []) {
    lines.push(`• ${r.title}`);
    if (r.snippet) lines.push(`  ${r.snippet}`);
    if (r.url) lines.push(`  ${r.url}`);
    lines.push("");
  }
  return lines.join("\n").trim() || "(No Tavily results)";
}

async function tavilySearch(query) {
  return formatTavilyNotes(await tavilySearchRaw(query));
}

function formatKbHits(hits) {
  return hits
    .map((h, i) => {
      const e = h.entry;
      const lines = [
        `[KB#${i + 1} score=${h.score.toFixed(1)}] Q: ${e.query}`,
      ];
      if (e.answer) lines.push(`A: ${e.answer}`);
      if (e.notes && e.notes !== e.answer) {
        lines.push(String(e.notes).slice(0, 900));
      }
      return lines.join("\n");
    })
    .join("\n\n");
}

function knowledgeLookupQuery(rawUser, history) {
  // For short follow-ups, search using previous substantive user question + follow-up.
  if (!isContextualFollowUp(rawUser)) return rawUser;
  const users = history.filter((m) => m.role === "user").map((m) => String(m.content || "").trim());
  if (users.length < 2) return rawUser;
  const prev = users[users.length - 2];
  if (!prev) return rawUser;
  return `${prev}\nFollow-up: ${rawUser}`;
}

function getNowParts(timeZone = "Asia/Hong_Kong") {
  const now = new Date();
  const fmt = (options) =>
    new Intl.DateTimeFormat("en-CA", { timeZone, ...options }).format(now);
  const y = Number(fmt({ year: "numeric" }));
  const m = Number(fmt({ month: "numeric" }));
  const d = Number(fmt({ day: "numeric" }));
  const weekdayEn = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "long",
  }).format(now);
  const time = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(now);
  const weekdayZhHant = {
    Sunday: "星期日",
    Monday: "星期一",
    Tuesday: "星期二",
    Wednesday: "星期三",
    Thursday: "星期四",
    Friday: "星期五",
    Saturday: "星期六",
  }[weekdayEn];
  const weekdayZhHans = {
    Sunday: "星期日",
    Monday: "星期一",
    Tuesday: "星期二",
    Wednesday: "星期三",
    Thursday: "星期四",
    Friday: "星期五",
    Saturday: "星期六",
  }[weekdayEn];
  return { y, m, d, time, weekdayEn, weekdayZhHant, weekdayZhHans, timeZone };
}

function formatNowForLang(lang) {
  const p = getNowParts();
  if (lang === "en") {
    return `Today is ${p.weekdayEn}, ${p.y}-${String(p.m).padStart(2, "0")}-${String(p.d).padStart(2, "0")}. Current time is ${p.time} (${p.timeZone}).`;
  }
  if (lang === "zh-Hans") {
    return `今天是${p.y}年${p.m}月${p.d}日，${p.weekdayZhHans}。现在时间是 ${p.time}（${p.timeZone}）。`;
  }
  // zh-Hant / auto
  return `今天是${p.y}年${p.m}月${p.d}日，${p.weekdayZhHant}。現在時間是 ${p.time}（${p.timeZone}）。`;
}

function isDateTimeQuestion(text) {
  const s = String(text || "").trim();
  if (!s) return false;
  // Opinion / preference questions often contain 而家/現在/點 — never treat those as clock.
  if (
    /(覺得|认为|認為|think|prefer|喜歡|喜欢|選擇|选择|邊個|哪个|哪個|定係|还是|還是|意見|意见|看法|點睇|点睇|點看)/i.test(
      s,
    )
  ) {
    return false;
  }
  // Only clear clock/calendar asks.
  return /(今天幾號|今日幾號|今天几号|今日几号|今天的?日期|今日的?日期|今天星期幾|今天星期几|今日星期|而家幾點|现在几点|現在幾點|现在几号|現在幾點鐘|现在几点钟|what\s+time\s+is\s+it|what(?:'s|\s+is)\s+today(?:'s)?\s+date|current\s+(?:date|time)|todays?\s+date|date\s+of\s+today|what\s+day\s+is\s+(?:it|today))/i.test(
    s,
  );
}

function isOpinionOrPreferenceQuestion(text) {
  const s = String(text || "").trim();
  if (!s) return false;
  if (extractBinaryChoice(s)) return true;
  return /(覺得|认为|認為|think|prefer|喜歡|喜欢|選擇|选择|邊個好|哪个好|哪個好|揀邊|选哪|選哪|定係|还是|還是|意見|意见|看法|點睇|点睇|你呢|你怎麼看|你怎么看|what\s+do\s+you\s+think|which\s+(?:one|do\s+you)|your\s+(?:take|opinion|preference)|A\s*(?:or|還是|还是|定係)\s*B|\b[Aa]\s*[.．、:：)]|\b[Bb]\s*[.．、:：)])/i.test(
    s,
  );
}

/** Detect A/B or「X 還是 Y」style binary choices. */
function extractBinaryChoice(text) {
  const s = String(text || "").trim();
  if (!s) return null;

  const labeled = s.match(
    /(?:^|[\s\n])A[.．、:：)\]]\s*([^\n]+?)\s*(?:\n|\s+)B[.．、:：)\]]\s*([^\n]+?)(?:\s*[?？!！。.]*)?$/i,
  );
  if (labeled) {
    return {
      kind: "ab",
      a: labeled[1].trim().replace(/[?？!！。.\s]+$/g, ""),
      b: labeled[2].trim().replace(/[?？!！。.\s]+$/g, ""),
    };
  }

  const inlineAb = s.match(
    /\bA\s*[:：.．、)]\s*([^/?？]+?)\s*(?:還是|还是|定係|或者|or|\/)\s*B\s*[:：.．、)]\s*([^/?？]+)/i,
  );
  if (inlineAb) {
    return {
      kind: "ab",
      a: inlineAb[1].trim(),
      b: inlineAb[2].trim(),
    };
  }

  // 「咖啡還是茶」「出去定係留喺屋企」
  const orChoice = s.match(
    /^(.{1,40}?)\s*(還是|还是|定係|或者|or)\s*(.{1,40}?)(?:\s*[?？!！。.]*)?$/i,
  );
  if (orChoice) {
    const left = orChoice[1].replace(/^(你覺得|你认为|你認為|你想|要唔要|要不要|不如|咁|那)\s*/i, "").trim();
    const right = orChoice[3].trim();
    if (left.length >= 1 && right.length >= 1 && left.length <= 36 && right.length <= 36) {
      return { kind: "or", a: left, b: right };
    }
  }

  return null;
}

function looksLikeHedgingChoice(text) {
  const s = String(text || "").trim();
  if (!s) return false;
  return /(兩者都|两者都|都好|都可以|都行|看情況|看情况|視情況|视情况|各有(優|优)缺|各有好處|各有好处|難以取捨|难以取舍|不好說|不好说|取決|取决|沒有絕對|没有绝对|兩邊|两边|隨你|随你|你自己決定|你自己决定|A\s*(和|同|與|与|&|\/)\s*B\s*都|我唔揀|我不选|我不選)/i.test(
    s,
  );
}

function choiceStanceInstruction(lang, choice) {
  const a = choice?.a || "A";
  const b = choice?.b || "B";
  if (lang === "en") {
    return [
      `[System: BINARY CHOICE — you MUST pick ONE side now.]`,
      `Options: A) ${a}   OR   B) ${b}`,
      `Start the reply by clearly choosing A or B (e.g. "I pick A — …").`,
      `FORBIDDEN: "both are fine", "depends", "each has pros", refusing to choose.`,
      `Give one short reason in Eva's voice. Do not mention date/time.`,
    ].join("\n");
  }
  return [
    `[系統：這是二選一。你必須立刻只選一邊。]`,
    `選項：A）${a}　或　B）${b}`,
    `回覆開頭就要表明揀邊，例如「我揀 A —— …」或「我偏 B 啦」。`,
    `禁止：兩邊都好、看情況、各有好處、不表態、叫用戶自己決定。`,
    `用 Eva 口語講一句短原因。禁止提日期時間。`,
  ].join("\n");
}

function isContextualFollowUp(text) {
  const s = String(text || "").trim();
  if (!s) return false;
  if (isDateTimeQuestion(s) || isGreeting(s)) return false;
  // Short anaphora / follow-ups that only make sense with prior turns
  if (s.length <= 24) {
    if (
      /(你覺得|你呢|點睇|点睇|為什麼|为甚么|為甚麼|点解|點解|然後|然后|呢\s*$|真的|係咩|是吗|是嗎|什麼研究|什么研究|邊個|哪个|哪個|同埋|還有|还有|繼續|继续|詳情|详情|來源|来源|哦|呀|嗯|huh|why|really|and\s+you)/i.test(
        s,
      )
    ) {
      return true;
    }
  }
  return /^(為什麼|为甚么|為甚麼|點解|点解|然後呢|然后呢|還有呢|还有呢|你覺得呢|你呢|真的嗎|真的吗|係咪|是吗|是嗎|詳情|详情)\s*[?？!！.。]*$/i.test(
    s,
  );
}

function answerDateTimeLocally(lang) {
  const fact = formatNowForLang(lang === "auto" ? "zh-Hant" : lang);
  if (lang === "en") {
    return `Hmm, let me check~ ${fact}`;
  }
  if (lang === "zh-Hans") {
    return `嗯，我瞄一眼时间～${fact}`;
  }
  return `嗯，我睇下先～${fact}`;
}

function looksLikeCannedAssistant(text) {
  const s = String(text || "").trim();
  if (!s) return false;
  return /^(作為一個|作为一个|根據我的|根据我的|簡單來說|简单来说|總結一下|总结一下|以下是|作為 AI|作为 AI|我可以幫你|我可以帮你|您好[！!]?\s*我是)/i.test(
    s,
  );
}

function looksLikeEcho(reply, userText) {
  const a = String(reply || "")
    .replace(/\s+/g, "")
    .toLowerCase();
  const b = String(userText || "")
    .replace(/\s+/g, "")
    .toLowerCase();
  if (!a || !b) return false;
  if (a === b) return true;
  if (b.length >= 4 && (a.includes(b) || b.includes(a)) && a.length <= b.length + 8) {
    return true;
  }
  return false;
}

function applyLanguageScript(text, lang) {
  const s = String(text ?? "");
  if (!s) return s;
  if (lang === "zh-Hant" || lang === "auto") {
    const out = toTraditionalChinese(s);
    if (looksLikeSimplifiedChinese(out)) {
      console.warn(
        "[Eva] Still looks simplified after OpenCC:",
        out.slice(0, 80),
      );
    } else if (out !== s && looksLikeSimplifiedChinese(s)) {
      console.log("[Eva] Converted Simplified → Traditional (HK)");
    }
    return out;
  }
  if (lang === "zh-Hans") return toSimplified(s);
  return s;
}

function isGreeting(text) {
  const s = String(text || "").trim().toLowerCase();
  return /^(hi|hello|hey|yo|sup|你好|嗨|哈囉|哈啰|早晨|午安|晚安|早上好|下午好|晚上好)[!！.。\s]*$/i.test(
    s,
  );
}

function personaPath() {
  // Live persona lives under data/ so edits don't fight with source examples.
  return path.join(dataDir(), "persona.txt");
}

function personaSeedPath() {
  return path.join(__dirname, "persona.txt");
}

function defaultPersona() {
  return [
    "You are Eva (伊娃), a desktop anime companion living on the user's screen.",
    "Warm, playful, a little teasing, caring like a close friend.",
    "Short replies (1–3 sentences). Natural companion voice, not a helpdesk.",
    "If unsure, admit it honestly. Never only repeat the user's question.",
  ].join(" ");
}

function loadPersona() {
  try {
    const live = personaPath();
    if (!fs.existsSync(live)) {
      const seed = personaSeedPath();
      if (fs.existsSync(seed)) {
        fs.copyFileSync(seed, live);
      } else {
        fs.writeFileSync(live, defaultPersona() + "\n", "utf8");
      }
    }
    const text = fs.readFileSync(live, "utf8").trim();
    return text || defaultPersona();
  } catch {
    return defaultPersona();
  }
}

function savePersona(text) {
  const cleaned = String(text || "").trim();
  if (!cleaned) throw new Error("Empty persona");
  fs.writeFileSync(personaPath(), cleaned + "\n", "utf8");
  return cleaned;
}

function isPersonaChangeRequest(text) {
  const s = String(text || "").trim();
  if (!s) return false;
  // Explicit persona edits
  if (
    /(人設|人格|性格|persona|personality|character)/i.test(s) &&
    /(改|換|变|變|更新|設定|设置|變成|变成|改成|換成|换成|調整|调整|修正|change|update|rewrite|make\s+you|be\s+more)/i.test(
      s,
    )
  ) {
    return true;
  }
  // Meta feedback about Eva's tone / catchphrases / vibe
  return isMetaStyleFeedback(s);
}

/** User is criticizing or asking to fix Eva's speaking style — not continuing prior A/B. */
function isMetaStyleFeedback(text) {
  const s = String(text || "").trim();
  if (!s) return false;
  return (
    /(假謙虛|假谦虚|謙虛感|谦虚感|口頭禪|口头禅|語氣|语气|口吻|人設感|说话方式|說話方式)/i.test(s) ||
    /(點解係都要講|点解系都要讲|點解成日|为什么总是|為什麼總是|可唔可以修正|可不可以修正|唔好再講|不要再说|唔好成日|別再|别再|少啲|少点|收埋|收起)/i.test(
      s,
    ) ||
    /(改(一)?下|修正(一)?下).{0,12}(感|語氣|语气|講法|讲法|口吻|習慣|习惯)/i.test(s) ||
    /(stop\s+saying|sound\s+less|less\s+humble|fake\s+humility|change\s+your\s+(tone|vibe|style))/i.test(s)
  );
}

function formatFetchError(err) {
  const msg = String(err?.message || err || "unknown");
  const cause = err?.cause;
  const bits = [msg];
  if (cause) {
    if (cause.code) bits.push(`code=${cause.code}`);
    if (cause.message && cause.message !== msg) bits.push(String(cause.message));
    if (cause.errno) bits.push(`errno=${cause.errno}`);
  }
  return bits.join(" | ");
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function ollamaChatRequest(host, payload, { label = "Ollama", retries = 2 } = {}) {
  const url = `${host}/api/chat`;
  const timeoutMs = Number(process.env.OLLAMA_TIMEOUT_MS || 180000);
  let lastErr;
  for (let attempt = 1; attempt <= retries + 1; attempt++) {
    const t0 = nowMs();
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!res.ok) {
        const body = await res.text();
        logTiming(`${label} error`, t0, `status=${res.status} attempt=${attempt}`);
        throw new Error(`Ollama error ${res.status}: ${body.slice(0, 300)}`);
      }
      const data = await res.json();
      const text = String(data?.message?.content ?? "").trim();
      logTiming(label, t0, `chars=${text.length} model=${payload.model} attempt=${attempt}`);
      return { data, text };
    } catch (err) {
      lastErr = err;
      const detail = formatFetchError(err);
      console.warn(`[Eva] ${label} attempt ${attempt}/${retries + 1} failed: ${detail}`);
      const transient =
        /fetch failed|ECONNREFUSED|ECONNRESET|ETIMEDOUT|socket|TimeoutError|network/i.test(
          detail,
        );
      if (!transient || attempt > retries) break;
      const wait = 1500 * attempt;
      console.log(`[Eva] Retrying Ollama in ${wait}ms (model may still be loading)…`);
      await sleep(wait);
    }
  }
  throw lastErr;
}

async function warmOllamaModel() {
  const host = (process.env.OLLAMA_HOST || "http://127.0.0.1:11434").replace(/\/$/, "");
  const model = process.env.OLLAMA_MODEL || "llama3.1:8b";
  console.log(`[Eva] Warming Ollama ${model} at ${host}…`);
  try {
    await ollamaChatRequest(
      host,
      {
        model,
        stream: false,
        messages: [{ role: "user", content: "ping" }],
        options: { num_predict: 1, temperature: 0 },
      },
      { label: "Ollama warm", retries: 3 },
    );
    console.log(`[Eva] Ollama warm OK (${model})`);
  } catch (err) {
    console.warn(
      `[Eva] Ollama warm failed — chat may be slow/fail until model loads: ${formatFetchError(err)}`,
    );
  }
}

async function ollamaChatOnce({
  host,
  model,
  messages,
  temperature = 0.4,
  numPredict = 160,
  numCtx = 4096,
  label = "ollamaChatOnce",
}) {
  const { text } = await ollamaChatRequest(
    host,
    {
      model,
      stream: false,
      messages,
      options: {
        temperature,
        top_p: 0.9,
        repeat_penalty: 1.1,
        num_predict: numPredict,
        num_ctx: numCtx,
      },
    },
    { label, retries: 2 },
  );
  return text;
}

async function updatePersonaFromUserRequest(rawUser, lang) {
  const host = (process.env.OLLAMA_HOST || "http://127.0.0.1:11434").replace(/\/$/, "");
  const model = process.env.OLLAMA_MODEL || "llama3.1:8b";
  const current = loadPersona();

  const draft = await ollamaChatOnce({
    host,
    model,
    temperature: 0.35,
    numPredict: 500,
    numCtx: 4096,
    label: "persona rewrite",
    messages: [
      {
        role: "system",
        content: [
          "You rewrite Eva's persona profile for a desktop companion.",
          "Output ONLY the new persona plain text file contents.",
          "Keep the name Eva / 伊娃.",
          "Include sections: Personality / Core vibe, Speech rules, Boundaries.",
          "Merge the user's requested changes into the current persona.",
          "If the user complains about fake humility / catchphrases / tone,",
          "REMOVE those habits and forbid repeating them.",
          "Especially forbid overused lines like「欸我唔敢亂講呀」unless truly unsure.",
          "Do not wrap in markdown fences. No preamble.",
          "Keep it under 40 lines.",
        ].join(" "),
      },
      {
        role: "user",
        content: [
          "Current persona:",
          current,
          "",
          "User request:",
          rawUser,
        ].join("\n"),
      },
    ],
  });

  let next = draft
    .replace(/^```[\w]*\n?/i, "")
    .replace(/\n?```$/i, "")
    .trim();
  if (!/eva|伊娃/i.test(next)) {
    next = `You are Eva (伊娃).\n${next}`;
  }
  savePersona(next);

  if (lang === "en") {
    return "Got it — I updated my vibe/persona. Try me again; I won't do that fake-humble bit.";
  }
  if (lang === "zh-Hans") {
    return "得，我改好人设/语气了。下次唔会再玩那种假谦虚～你再讲一句试下？";
  }
  return "得，我改好人設／語氣喇。下次唔會再玩嗰種假謙虛～你再講一句試下？";
}

function localGreeting(lang) {
  if (lang === "en") {
    return "Hehe, hi~ I'm Eva. Miss me already, or got something fun to share?";
  }
  if (lang === "zh-Hans") {
    return "嘿嘿，嗨～我是 Eva。想我了，还是有事找我聊呀？";
  }
  return "嘿嘿，嗨～我是 Eva。想我了，定係有嘢想同我傾呀？";
}

function isFactualQuestion(text) {
  const s = String(text || "").trim();
  if (!s || isGreeting(s) || isDateTimeQuestion(s)) return false;
  if (extractBinaryChoice(s)) return false;
  // Soft chat / feelings — never treat as web-fact lookup
  if (
    /^(謝謝|谢谢|thanks|thank you|拜拜|bye|再見|再见|我累|好悶|想你|哈哈|嘿嘿|嗯+|哦+|喔+|唉|心塞|開心|开心|無聊|无聊)[!！.。\s]*$/i.test(
      s,
    )
  ) {
    return false;
  }
  // Preference / A-B style — opinion path, not KB/Tavily
  if (
    /(覺得|认为|認為|prefer|喜歡|喜欢|選擇|选择|邊個|哪个|哪個|揀|选哪|選哪|定係|还是|還是|點睇|点睇|你呢|你怎麼看|你怎么看|which\s+do\s+you|what\s+do\s+you\s+think)/i.test(
      s,
    )
  ) {
    return false;
  }
  // Stronger fact signals only (old regex matched almost every「嗎／？」→ slow KB path)
  return /(什麼是|什么是|是什麼|是什么|誰是|谁是|邊個係|哪个是|哪個是|幾多|多少|首都|人口|定義|定义|意思係|意思是|最新|新聞|新闻|天氣|天气|資料|数据|數據|歷史|历史|位於|位于|發明|发明|成立於|成立于|查(一)?下|搜(尋|索|一下)|介紹(一)?下|介绍(一)?下|explain|define|what\s+is|who\s+is|when\s+did|where\s+is|how\s+many|how\s+much|tell\s+me\s+about|wikipedia)/i.test(
    s,
  );
}

/** Chat / stance mode: everything that is not a fact lookup. */
function isOpinionMode(text) {
  const s = String(text || "").trim();
  if (!s) return false;
  if (isGreeting(s) || isDateTimeQuestion(s) || isPersonaChangeRequest(s)) return false;
  return !isFactualQuestion(s);
}

function tavilyEnabled() {
  if (process.env.EVA_USE_SEARCH === "0") return false;
  return Boolean(String(process.env.TAVILY_API_KEY || "").trim());
}

function kbEnabled() {
  if (process.env.EVA_USE_KB === "0") return false;
  return Boolean(
    String(process.env.EVA_DATABASE_URL || process.env.DATABASE_URL || "").trim(),
  );
}

function searchEnabled() {
  // Back-compat: "search" means Tavily fill for KB misses
  return kbEnabled() && tavilyEnabled();
}

/**
 * KB-first knowledge pipeline (PostgreSQL):
 * 1) search Postgres knowledge base
 * 2) if miss → Tavily
 * 3) save Tavily result into Postgres
 * 4) return notes for Ollama
 */
async function gatherKnowledgeForOllama(query, { allowSearch = true, onProgress } = {}) {
  const progress = (stage, message) => {
    try {
      onProgress?.({ stage, message });
    } catch (_) {}
  };
  const tAll = nowMs();

  if (!kbEnabled()) {
    console.warn("[Eva][KB] skipped: EVA_DATABASE_URL missing or EVA_USE_KB=0");
    return { notes: "", source: "none", refreshed: false };
  }

  progress("kb", "正在查知識庫…");
  let hits = [];
  const tKb = nowMs();
  try {
    hits = await knowledgeDb.searchKnowledgeBase(query, 3);
    logTiming(
      "KB search",
      tKb,
      `hits=${hits.length} best=${hits[0] ? hits[0].score.toFixed(1) : "-"}`,
    );
  } catch (err) {
    logTiming("KB search failed", tKb);
    console.warn("[Eva][KB] search failed:", err?.message || err);
  }

  const best = hits[0];
  const KB_HIT_SCORE = Number(process.env.EVA_KB_MIN_SCORE || 7);

  if (best && best.score >= KB_HIT_SCORE) {
    console.log(`[Eva] KB hit score=${best.score.toFixed(1)} q="${query.slice(0, 50)}"`);
    progress("kb", "知識庫已找到相關資料");
    logTiming("gatherKnowledge total", tAll, "source=kb");
    return {
      notes: formatKbHits(hits),
      source: "kb",
      refreshed: false,
    };
  }

  if (!allowSearch) {
    logTiming("gatherKnowledge total", tAll, "source=kb-weak|none (search off)");
    if (hits.length) {
      return { notes: formatKbHits(hits), source: "kb-weak", refreshed: false };
    }
    return { notes: "", source: "none", refreshed: false };
  }

  if (!tavilyEnabled()) {
    console.warn(
      "[Eva][KB] miss and Tavily disabled/missing TAVILY_API_KEY — nothing to write yet",
    );
    progress("kb", "知識庫沒有資料，且未啟用網路搜尋");
    logTiming("gatherKnowledge total", tAll, "source=none (no tavily)");
    if (hits.length) {
      return { notes: formatKbHits(hits), source: "kb-weak", refreshed: false };
    }
    return { notes: "", source: "none", refreshed: false };
  }

  try {
    console.log(`[Eva] KB miss → Tavily q="${query.slice(0, 50)}"`);
    progress("search", "正在上網搜尋資料…");
    const raw = await tavilySearchRaw(query);
    const notes = formatTavilyNotes(raw);
    const tSave = nowMs();
    try {
      const saved = await knowledgeDb.addKnowledgeEntry({
        query,
        answer: raw.answer,
        notes,
        sources: raw.sources,
      });
      logTiming("KB save", tSave, `id=${saved.id}`);
      console.log(`[Eva][KB] saved id=${saved.id}`);
      progress("search", "搜尋完成，已寫入知識庫");
    } catch (err) {
      logTiming("KB save failed", tSave);
      console.warn("[Eva][KB] save failed:", err?.message || err);
      progress("search", "搜尋完成（寫入知識庫失敗）");
    }
    const combined = hits.length
      ? `${formatKbHits(hits)}\n\n[Fresh web search]\n${notes}`
      : notes;
    logTiming("gatherKnowledge total", tAll, "source=tavily");
    return { notes: combined, source: "tavily", refreshed: true };
  } catch (err) {
    console.warn("[Eva] Tavily failed:", err?.message || err);
    progress("search", "網路搜尋失敗，改用現有資料回答");
    logTiming("gatherKnowledge total", tAll, "source=tavily-failed");
    if (hits.length) return { notes: formatKbHits(hits), source: "kb-weak", refreshed: false };
    return { notes: "", source: "none", refreshed: false };
  }
}

async function rememberAnswerInKb(query, answer) {
  if (!kbEnabled()) return;
  const q = String(query || "").trim();
  const a = String(answer || "").trim();
  if (!q || !a || a.length < 8) return;
  if (/抱歉|沒答好|empty Ollama|Cursor apply/i.test(a)) return;
  try {
    const saved = await knowledgeDb.addKnowledgeEntry({
      query: q,
      answer: a,
      notes: a,
      sources: [],
    });
    console.log(`[Eva][KB] remembered chat answer id=${saved.id}`);
  } catch (err) {
    console.warn("[Eva][KB] remember failed:", err?.message || err);
  }
}

function buildSystemPrompt(lang, nowFact, knowledgeNotes, { includeClock = false, continuityBlock = "", knowledgeSource = "", forceChoice = false } = {}) {
  const parts = [
    loadPersona(),
    "",
    "VOICE FIRST (higher priority than sounding formal):",
    "- Reply as Eva the companion. Sound spoken and personal.",
    "- Put a tiny emotional beat first, then the useful answer.",
    "- Forbidden canned openings: AI disclaimers,「根據資料」「簡單來說」「總結」「以下是」, helpdesk tone.",
    "- Forbidden: asking the user to wait, or saying you will search later.",
    "- If knowledge notes exist: paraphrase into Eva's voice; do not paste them raw.",
    "",
    "CONTEXT RULES:",
    "CRITICAL: Use the recent conversation turns. Follow-ups like「你覺得呢」「為什麼」「什麼研究」refer to the previous topic — answer THAT topic.",
    "Never suddenly switch to date, time, weather, or unrelated small-talk unless the user asked for it.",
    "When the user asks your preference, opinion, or A/B choice: pick ONE clear side immediately and briefly say why. NEVER sit on both sides.",
    "Answer the user's question directly NOW in this single reply.",
    "If you are unsure, say you are unsure in character. Do not invent facts, dates, numbers, or names.",
    languageInstruction(lang),
  ];
  if (forceChoice) {
    parts.push(
      "HARD RULE FOR THIS TURN: The user gave a binary choice. Your first sentence MUST name the chosen side (A or B / left or right). Hedging is a failure.",
    );
  }
  if (includeClock && nowFact) {
    parts.push(`Trusted current date/time (use ONLY if user asks for date/time): ${nowFact}`);
  } else {
    parts.push("Do NOT mention today's date or the current time unless the user explicitly asks.");
  }
  if (continuityBlock) {
    parts.push(
      "Recent conversation transcript (highest priority for context):",
      continuityBlock,
      "Stay on this transcript's topic for the next reply.",
    );
  }
  if (knowledgeNotes) {
    parts.push(
      "You are given Knowledge Base notes below (already fetched for you).",
      knowledgeSource ? `Knowledge source: ${knowledgeSource}.` : "",
      "Use these notes and answer NOW in Eva's spoken voice. Paraphrase; do not dump a report.",
      "If insufficient, say what is missing instead of guessing.",
      "Knowledge notes:\n" + knowledgeNotes,
    );
  }
  return parts.filter((p) => p !== "").join("\n");
}

function looksLikeDeferredSearch(text) {
  const s = String(text || "").trim();
  if (!s) return false;
  return (
    /(請稍等|稍等一下|等我一下|我現在就(開始)?找|讓我(先)?(查|搜|找)|我去(查|搜|找)|我來(查|搜)|稍後回|please\s+wait|hold\s+on|let\s+me\s+(search|look|find|check)|i('ll| will)\s+(search|look|find|check|get\s+back))/i.test(
      s,
    ) && s.length < 160
  );
}

function formatContinuityBlock(turns) {
  return turns
    .map((m) => {
      const who = m.role === "assistant" ? "Eva" : "User";
      return `${who}: ${String(m.content ?? "").trim()}`;
    })
    .filter((line) => line.length > 6)
    .join("\n");
}

function resolveHistoryForModel(incoming) {
  const clean = (arr) =>
    (Array.isArray(arr) ? arr : [])
      .filter((m) => m && (m.role === "user" || m.role === "assistant"))
      .filter((m) => {
        const c = String(m.content ?? "");
        return (
          !c.startsWith("Applying with Cursor") &&
          !c.startsWith("Cursor apply result:") &&
          !c.startsWith("Cursor apply failed:")
        );
      })
      .map((m) => ({
        role: m.role === "assistant" ? "assistant" : "user",
        content: String(m.content ?? ""),
      }));

  const fromUi = clean(incoming);
  const fromDisk = clean(loadChatHistory());
  const MAX = 16;

  // Prefer the richer source; stitch latest UI user turn onto disk if needed.
  let base = fromUi.length >= fromDisk.length ? fromUi.slice() : fromDisk.slice();
  const lastUi = fromUi[fromUi.length - 1];
  if (lastUi?.role === "user") {
    const lastBase = base[base.length - 1];
    if (!lastBase || lastBase.content !== lastUi.content || lastBase.role !== "user") {
      // Avoid duplicate if disk already has same last user from persist()
      if (!(lastBase?.role === "user" && lastBase.content === lastUi.content)) {
        base.push(lastUi);
      }
    }
  }

  // Drop orphan leading assistant
  while (base.length && base[0].role === "assistant") base.shift();
  return base.slice(-MAX);
}

function langReminder(lang, userText) {
  if (lang === "zh-Hant") {
    return "\n\n[系統提醒：必須用繁體中文（香港用字）回答。禁止简体字／簡體字。不要重複用戶的話。不確定就坦白說。]";
  }
  if (lang === "zh-Hans") {
    return "\n\n[系统提醒：请直接用简体中文回答，不要重复用户的话。不确定就坦白说。]";
  }
  if (lang === "en") {
    return "\n\n[System reminder: Answer directly in English. Do not invent facts. Do not repeat the question.]";
  }
  if (lang === "auto" && /[\u4e00-\u9fff]/.test(userText)) {
    return "\n\n[系統提醒：必須用繁體中文回答，禁止简体字。不確定就坦白說。]";
  }
  return "";
}

async function askOllama(historyMessages, { onProgress } = {}) {
  const tAll = nowMs();
  const progress = (stage, message) => {
    try {
      onProgress?.({ stage, message });
    } catch (_) {}
  };

  const host = (process.env.OLLAMA_HOST || "http://127.0.0.1:11434").replace(/\/$/, "");
  const model = process.env.OLLAMA_MODEL || "llama3.1:8b";
  const prefs = loadPrefs();
  const lang = prefs.replyLanguage || "zh-Hant";

  const history = resolveHistoryForModel(historyMessages);
  const lastUser = [...history].reverse().find((m) => m.role === "user");
  const rawUser = String(lastUser?.content ?? "").trim() || "你好";
  console.log(`[Eva][timing] ask start q="${rawUser.slice(0, 80)}"`);

  if (isDateTimeQuestion(rawUser)) {
    progress("done", "已取得日期時間");
    logTiming("ask total (datetime local)", tAll);
    return applyLanguageScript(answerDateTimeLocally(lang), lang);
  }
  // Greetings go through Ollama so persona voice stays alive (no canned hi).
  if (isPersonaChangeRequest(rawUser)) {
    try {
      return applyLanguageScript(
        await updatePersonaFromUserRequest(rawUser, lang),
        lang,
      );
    } catch (err) {
      console.warn("[Eva] Persona update failed:", err?.message || err);
      if (lang === "en") return "I tried to update my persona but failed. Check Ollama and try again.";
      return "我想更新人設但失敗了，請確認 Ollama 正常後再試一次。";
    }
  }

  const nowFact = formatNowForLang(lang);
  const followUp = isContextualFollowUp(rawUser);
  let binaryChoice = extractBinaryChoice(rawUser);
  // Fact = explicit knowledge lookup only. Everything else (incl. A/B) = opinion/chat.
  const wantFacts = !binaryChoice && isFactualQuestion(rawUser);
  // Only recover prior A/B for short preference follow-ups — NOT for style/meta feedback.
  if (
    !binaryChoice &&
    !wantFacts &&
    !isMetaStyleFeedback(rawUser) &&
    !isPersonaChangeRequest(rawUser) &&
    (followUp || isOpinionOrPreferenceQuestion(rawUser))
  ) {
    for (let i = history.length - 2; i >= 0; i--) {
      if (history[i].role === "user") {
        binaryChoice = extractBinaryChoice(history[i].content);
        if (binaryChoice) break;
      }
    }
  }
  const opinion = !wantFacts && isOpinionMode(rawUser);
  const forceChoice = Boolean(binaryChoice);

  let knowledgeNotes = "";
  let knowledgeSource = "";
  if (wantFacts) {
    const kbQuery = knowledgeLookupQuery(rawUser, history);
    console.log(`[Eva][timing] knowledge path on q="${kbQuery.slice(0, 60)}"`);
    const kb = await gatherKnowledgeForOllama(kbQuery, {
      allowSearch: true,
      onProgress,
    });
    knowledgeNotes = kb.notes || "";
    knowledgeSource = kb.source || "";
  } else {
    console.log("[Eva][timing] knowledge path skipped (not fact)");
  }
  const factual = Boolean(knowledgeNotes) || wantFacts;

  // Shorter context for chat/opinion = faster; keep more for fact answers
  const continuityBlock = formatContinuityBlock(
    history.slice(factual ? -10 : -6),
  );
  const historyForTurns = factual ? history : history.slice(-8);

  const turns = historyForTurns.map((m, i) => {
    const role = m.role === "assistant" ? "assistant" : "user";
    let content = String(m.content ?? "");
    if (role === "user" && i === historyForTurns.length - 1) {
      content += langReminder(lang, content);
      if (binaryChoice) {
        content += "\n\n" + choiceStanceInstruction(lang, binaryChoice);
      } else if (opinion) {
        content +=
          lang === "en"
            ? "\n\n[System: Chat/opinion mode. If there is any preference or A/B in this message or recent chat, pick ONE side now with a short reason. Forbidden: both fine / depends / no stance. Do NOT mention date/time.]"
            : "\n\n[系統：閒聊／意見模式。若這句或上文有偏好／二選一，必須立刻只選一邊並講一句原因。禁止兩邊都好、看情況、不表態。禁止提日期時間。]";
      } else if (followUp) {
        content +=
          lang === "en"
            ? "\n\n[System: Follow-up — stay on the previous topic. Do NOT mention date/time.]"
            : "\n\n[系統：追問——承接上文主題。禁止提日期時間。]";
      }
      if (knowledgeNotes) {
        content +=
          lang === "en"
            ? "\n\n[System: Knowledge notes are ready. Answer now in Eva's warm spoken voice. Paraphrase — no report tone, no 'please wait'.]"
            : "\n\n[系統：資料已準備好。請用 Eva 口語語氣立刻回答：先有一點反應，再講重點；不要報告腔、不要說稍等。]";
      }
    }
    return { role, content };
  });

  if (!turns.length) {
    turns.push({ role: "user", content: rawUser + langReminder(lang, rawUser) });
  }

  const messages = [
    {
      role: "system",
      content: buildSystemPrompt(lang, nowFact, knowledgeNotes, {
        includeClock: false,
        continuityBlock,
        knowledgeSource,
        forceChoice: forceChoice || opinion,
      }),
    },
    ...turns,
  ];

  const numPredict = factual ? 220 : 110;
  const numCtx = factual ? 4096 : 2048;

  console.log(
    `[Eva] Ollama context turns=${turns.length} followUp=${followUp} opinion=${opinion} fact=${wantFacts} choice=${binaryChoice ? `${binaryChoice.a}|${binaryChoice.b}` : "none"} kb=${knowledgeSource || "none"} model=${model}`,
  );

  progress("think", "Eva 正在整理回答…");
  const tOllama = nowMs();
  let text;
  try {
    const result = await ollamaChatRequest(
      host,
      {
        model,
        stream: false,
        messages,
        options: {
          temperature: factual ? 0.4 : 0.72,
          top_p: 0.9,
          repeat_penalty: 1.1,
          num_predict: numPredict,
          num_ctx: numCtx,
        },
      },
      { label: "Ollama main", retries: 2 },
    );
    text = result.text || "(empty Ollama response)";
  } catch (err) {
    logTiming("Ollama main failed", tOllama, formatFetchError(err));
    throw err;
  }

  // If model still dumps clock on a non-date follow-up, reject and retry once with harder constraint.
  const dumpedClock =
    !isDateTimeQuestion(rawUser) &&
    /(今天是\d{4}年|現在時間是|现在时间是|Asia\/Hong_Kong)/.test(text);
  if (dumpedClock) {
    console.warn("[Eva] Model dumped clock on non-date question; retrying");
    const retryMessages = [
      {
        role: "system",
        content: [
          loadPersona(),
          "Answer ONLY about the recent conversation topic.",
          "FORBIDDEN: mentioning today's date or current time.",
          continuityBlock ? `Transcript:\n${continuityBlock}` : "",
          languageInstruction(lang),
        ]
          .filter(Boolean)
          .join("\n"),
      },
      {
        role: "user",
        content:
          rawUser +
          (lang === "en"
            ? "\n\n[Reply about the previous topic only.]"
            : "\n\n[請只回答上文主題，不要提日期時間。]"),
      },
    ];
    try {
      text =
        (await ollamaChatOnce({
          host,
          model,
          messages: retryMessages,
          temperature: 0.4,
          numPredict: 100,
          numCtx: 2048,
          label: "Ollama retry(clock)",
        })) || text;
    } catch (err) {
      console.warn("[Eva] Retry failed:", err?.message || err);
    }
  }

  if (looksLikeDeferredSearch(text)) {
    console.warn("[Eva] Model deferred search; forcing direct answer");
    progress("think", "改為直接回答…");
    const forceMessages = [
      {
        role: "system",
        content: [
          loadPersona(),
          "Answer the user NOW with a concrete reply in Eva's spoken voice.",
          "FORBIDDEN: asking the user to wait, or saying you will search later.",
          knowledgeNotes
            ? `Use these notes (paraphrase in character):\n${knowledgeNotes}`
            : "If you lack facts, say you are unsure in character.",
          languageInstruction(lang),
        ]
          .filter(Boolean)
          .join("\n"),
      },
      {
        role: "user",
        content:
          rawUser +
          (lang === "en"
            ? "\n\n[Give the answer now, as Eva.]"
            : "\n\n[請用 Eva 口語語氣現在直接給出答案，不要說稍等。]"),
      },
    ];
    try {
      text =
        (await ollamaChatOnce({
          host,
          model,
          messages: forceMessages,
          temperature: 0.55,
          numPredict: 120,
          numCtx: numCtx,
          label: "Ollama retry(deferred)",
        })) || text;
    } catch (err) {
      console.warn("[Eva] Force-answer retry failed:", err?.message || err);
      if (knowledgeNotes) {
        const firstLine = knowledgeNotes.split(/\r?\n/).find((l) => l.trim());
        if (firstLine) {
          text = firstLine.replace(/^\[KB#[^\]]+\]\s*/i, "").replace(/^A:\s*/i, "");
        }
      }
    }
  }

  if ((forceChoice || opinion) && looksLikeHedgingChoice(text)) {
    console.warn("[Eva] Hedged on A/B choice; forcing a pick");
    progress("think", "逼佢揀邊…");
    const pick = binaryChoice || { a: "A", b: "B" };
    const pickMessages = [
      {
        role: "system",
        content: [
          loadPersona(),
          "The user asked a binary preference or opinion. You MUST pick exactly one side.",
          binaryChoice ? `A = ${pick.a}` : "Pick one clear stance from the conversation topic.",
          binaryChoice ? `B = ${pick.b}` : "",
          "First words must clearly commit (e.g.「我揀 A」「我偏呢邊」).",
          "FORBIDDEN: both fine / depends / each has pros / let user decide.",
          continuityBlock ? `Transcript:\n${continuityBlock}` : "",
          languageInstruction(lang),
        ]
          .filter(Boolean)
          .join("\n"),
      },
      {
        role: "user",
        content:
          rawUser +
          "\n\n" +
          (binaryChoice
            ? choiceStanceInstruction(lang, pick)
            : lang === "en"
              ? "[Pick one side now. One short reason.]"
              : "[而家立刻只選一邊，再講一句原因。]") +
          (lang === "en"
            ? "\n\n[Commit now.]"
            : "\n\n[而家表態，唔好騎牆。]"),
      },
    ];
    try {
      text =
        (await ollamaChatOnce({
          host,
          model,
          messages: pickMessages,
          temperature: 0.55,
          numPredict: 90,
          numCtx: 2048,
          label: "Ollama retry(pick)",
        })) || text;
    } catch (err) {
      console.warn("[Eva] Force-pick retry failed:", err?.message || err);
      if (binaryChoice) {
        const side = Math.random() < 0.5 ? "A" : "B";
        const label = side === "A" ? pick.a : pick.b;
        text =
          lang === "en"
            ? `I pick ${side} — ${label}. Feels more like me today.`
            : `我揀 ${side} 啦——${label}。今日心情比較傾向呢邊～`;
      }
    }
  }

  // Optional second pass (slow). Enable with EVA_VOICE_REWRITE=1
  if (process.env.EVA_VOICE_REWRITE === "1" && looksLikeCannedAssistant(text)) {
    console.warn("[Eva] Canned assistant tone; rewriting with persona");
    progress("think", "調整語氣…");
    const voiceMessages = [
      {
        role: "system",
        content: [
          loadPersona(),
          "Rewrite the draft below as Eva: warm, teasing, spoken HK Traditional Chinese.",
          "Keep the same facts. Do not add new facts. No FAQ openings.",
          languageInstruction(lang),
          "",
          "Draft to rewrite:",
          text,
        ].join("\n"),
      },
      {
        role: "user",
        content:
          rawUser +
          (lang === "en"
            ? "\n\n[Rewrite as Eva.]"
            : "\n\n[請改寫成 Eva 嘅口語語氣。]"),
      },
    ];
    try {
      text =
        (await ollamaChatOnce({
          host,
          model,
          messages: voiceMessages,
          temperature: 0.7,
          numPredict: 120,
          numCtx: 2048,
        })) || text;
    } catch (err) {
      console.warn("[Eva] Voice rewrite failed:", err?.message || err);
    }
  }

  if (looksLikeEcho(text, rawUser)) {
    if (knowledgeNotes) {
      const firstLine = knowledgeNotes.split(/\r?\n/).find((l) => l.trim());
      if (firstLine) return applyLanguageScript(firstLine.replace(/^Answer:\s*|^A:\s*/i, ""), lang);
    }
    if (lang === "en") {
      return "Sorry — I didn't catch that clearly. Could you ask again in another way?";
    }
    if (lang === "zh-Hans") {
      return "抱歉，我刚才没答好。可以换个说法再问我一次吗？";
    }
    return "抱歉，我剛才沒答好。可以換個說法再問我一次嗎？";
  }

  // If Tavily didn't fill KB, still remember Eva's factual answer.
  if (wantFacts && (knowledgeSource === "none" || knowledgeSource === "kb-weak")) {
    const tRemember = nowMs();
    await rememberAnswerInKb(rawUser, text);
    logTiming("KB remember answer", tRemember);
  }

  progress("done", "完成");
  logTiming(
    "ask total",
    tAll,
    `fact=${wantFacts} kb=${knowledgeSource || "none"} chars=${text.length}`,
  );
  return applyLanguageScript(text, lang);
}

function prefsPath() {
  return path.join(dataDir(), "prefs.json");
}

function defaultPrefs() {
  const fromEnv = (process.env.EVA_REPLY_LANGUAGE || "").trim();
  const allowed = new Set(["auto", "zh-Hant", "zh-Hans", "en"]);
  return {
    replyLanguage: allowed.has(fromEnv) ? fromEnv : "zh-Hant",
  };
}

function loadPrefs() {
  try {
    const p = prefsPath();
    if (!fs.existsSync(p)) return defaultPrefs();
    const raw = JSON.parse(fs.readFileSync(p, "utf8"));
    const base = defaultPrefs();
    const lang = String(raw.replyLanguage || base.replyLanguage);
    const allowed = new Set(["auto", "zh-Hant", "zh-Hans", "en"]);
    return {
      replyLanguage: allowed.has(lang) ? lang : base.replyLanguage,
    };
  } catch {
    return defaultPrefs();
  }
}

function savePrefs(patch) {
  const next = { ...loadPrefs(), ...(patch || {}) };
  const allowed = new Set(["auto", "zh-Hant", "zh-Hans", "en"]);
  if (!allowed.has(next.replyLanguage)) next.replyLanguage = "zh-Hant";
  fs.writeFileSync(prefsPath(), JSON.stringify(next, null, 2), "utf8");
  return next;
}

function detectLanguagePreference(text) {
  const s = String(text || "");
  if (/繁體|繁体中文|正體|正体|traditional\s*chinese|用繁|請用繁|请用繁/i.test(s)) {
    return "zh-Hant";
  }
  if (/簡體|简体|simplified\s*chinese|用简|請用簡|请用简/i.test(s)) {
    return "zh-Hans";
  }
  if (/\b(reply|respond|answer)\s+in\s+english\b|\benglish\s+only\b|用英文|請用英文|请用英文/i.test(s)) {
    return "en";
  }
  return null;
}

function languageInstruction(lang) {
  switch (lang) {
    case "zh-Hant":
      return [
        "CRITICAL LANGUAGE RULE:",
        "Always reply in Traditional Chinese (繁體中文) with a natural Hong Kong spoken feel (口語).",
        "Prefer particles like 呀/啦/喎/嘛 when natural. Avoid stiff textbook 書面語.",
        "NEVER use Simplified Chinese characters (简体字). Examples of forbidden forms: 因为/这个/吗/什么/喜欢 — use 因為/這個/嗎/什麼/喜歡 instead.",
        "If the user writes Simplified Chinese, still answer in Traditional Chinese.",
        "Do not switch scripts mid-reply.",
      ].join(" ");
    case "zh-Hans":
      return [
        "CRITICAL LANGUAGE RULE:",
        "Always reply in Simplified Chinese (简体中文).",
        "Never use Traditional Chinese characters.",
      ].join(" ");
    case "en":
      return "CRITICAL LANGUAGE RULE: Always reply in English only.";
    case "auto":
    default:
      return [
        "LANGUAGE RULE:",
        "Match the user's language.",
        "If the user writes Chinese, reply in Traditional Chinese (繁體中文), never Simplified Chinese.",
      ].join(" ");
  }
}

async function askChat(historyMessages, { onProgress } = {}) {
  askInFlight += 1;
  try {
    const lang = loadPrefs().replyLanguage || "zh-Hant";
    const answer = await askChatInner(historyMessages, { onProgress });
    // Final safety net: every reply path must respect script preference
    return applyLanguageScript(answer, lang);
  } finally {
    askInFlight = Math.max(0, askInFlight - 1);
    flushDeferredReload();
  }
}

async function askChatInner(historyMessages, { onProgress } = {}) {
  const history = Array.isArray(historyMessages) ? historyMessages : [];
  const lastUser = [...history].reverse().find((m) => m.role === "user");
  const prompt = lastUser ? String(lastUser.content ?? "") : "";

  // Only auto-detect language when dropdown is Auto. Pinned 繁中/简中/EN always wins.
  const currentLang = loadPrefs().replyLanguage || "zh-Hant";
  if (currentLang === "auto") {
    const detected = detectLanguagePreference(prompt);
    if (detected) savePrefs({ replyLanguage: detected });
  }

  try {
    return await askOllama(history, { onProgress });
  } catch (ollamaErr) {
    console.warn(
      "Ollama unavailable, falling back:",
      formatFetchError(ollamaErr),
    );
  }

  if (!process.env.TAVILY_API_KEY) {
    throw new Error(
      "Ollama is not reachable (fetch failed / timeout). Keep the Ollama app running, wait for llama3.1:8b to finish loading, or set OLLAMA_MODEL=qwen2.5:3b. Or set TAVILY_API_KEY for search fallback.",
    );
  }

  const tavilyText = await tavilySearch(prompt || "hello");
  const lang = loadPrefs().replyLanguage || "zh-Hant";
  const cursorKey = process.env.CURSOR_API_KEY;
  if (!cursorKey) return applyLanguageScript(tavilyText, lang);

  try {
    const { Agent } = await import("@cursor/sdk");
    const result = await Agent.prompt(
      [
        "You are Eva, a helpful desktop companion.",
        "Using ONLY the Tavily search notes below, answer the user briefly.",
        "Do NOT edit files or run tools. Plain text only.",
        languageInstruction(lang),
        "",
        `User question: ${prompt}`,
        "",
        "Tavily notes:",
        tavilyText,
      ].join("\n"),
      {
        apiKey: cursorKey,
        model: { id: "composer-2.5" },
        local: { cwd: path.join(__dirname, "..") },
      },
    );
    if (result.status === "error") return applyLanguageScript(tavilyText, lang);
    return applyLanguageScript(
      String(result.result ?? "").trim() || tavilyText,
      lang,
    );
  } catch {
    return applyLanguageScript(tavilyText, lang);
  }
}

function restartEva(reason = "manual", { force = false } = {}) {
  if (!force && askInFlight > 0) {
    pendingReloadReason = reason || "deferred";
    console.log(`[Eva] Reload deferred until chat finishes (${pendingReloadReason})`);
    try {
      mainWindow?.webContents?.send("eva-progress", {
        stage: "reload",
        message: "程式有更新，答完這題後會重載…",
      });
    } catch (_) {}
    return;
  }
  if (isRelaunching) return;
  isRelaunching = true;
  pendingReloadReason = null;
  if (reloadTimer) {
    clearTimeout(reloadTimer);
    reloadTimer = null;
  }
  const restartCode = Number(process.env.EVA_RESTART_EXIT_CODE || 75);
  console.log(`[Eva] Restarting (${reason})...`);
  saveWindowBounds();
  allowQuit = true;
  // Prefer runner-managed restart so `npm run overlay` keeps the terminal + logs.
  // Fallback: Electron self-relaunch when started without the runner.
  if (process.env.EVA_UNDER_RUNNER === "1") {
    app.exit(restartCode);
    return;
  }
  app.relaunch();
  app.exit(0);
}

function flushDeferredReload() {
  if (askInFlight > 0 || !pendingReloadReason || isRelaunching) return;
  const reason = pendingReloadReason;
  pendingReloadReason = null;
  console.log(`[Eva] Chat finished — reloading (${reason})`);
  // Short delay so the answer can render in the UI first
  if (reloadTimer) clearTimeout(reloadTimer);
  reloadTimer = setTimeout(() => restartEva(reason, { force: true }), 400);
}

function scheduleFileReload(name) {
  const reason = `file change: ${name}`;
  if (askInFlight > 0) {
    pendingReloadReason = reason;
    console.log(`[Eva] Reload deferred until chat finishes (${reason})`);
    try {
      mainWindow?.webContents?.send("eva-progress", {
        stage: "reload",
        message: "程式有更新，答完這題後會重載…",
      });
    } catch (_) {}
    return;
  }
  if (reloadTimer) clearTimeout(reloadTimer);
  reloadTimer = setTimeout(() => restartEva(reason, { force: true }), 600);
}

function fileContentHash(filePath) {
  try {
    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) return null;
    const buf = fs.readFileSync(filePath);
    return crypto.createHash("sha256").update(buf).digest("hex");
  } catch {
    return null;
  }
}

function watchForUpdates() {
  // Default ON. Set EVA_AUTO_RELOAD=0 in .env to disable.
  if (process.env.EVA_AUTO_RELOAD === "0") {
    console.log("[Eva] Auto-reload disabled (EVA_AUTO_RELOAD=0)");
    return;
  }

  // Only these files can trigger reload — not the whole overlay/ tree
  // (Cursor/IDE scans fire fs.watch without content changes).
  const watchFiles = [
    path.join(__dirname, "main.cjs"),
    path.join(__dirname, "preload.cjs"),
    path.join(__dirname, "app.html"),
    path.join(__dirname, "knowledge-db.cjs"),
    path.join(__dirname, "..", "package.json"),
    path.join(__dirname, "..", ".env"),
  ];

  /** @type {Map<string, string|null>} */
  const fingerprints = new Map();
  for (const filePath of watchFiles) {
    fingerprints.set(filePath, fileContentHash(filePath));
  }

  const onMaybeChanged = (filePath) => {
    const name = path.basename(filePath);
    // Debounce bursty IDE events, then compare content hash
    if (reloadTimer) clearTimeout(reloadTimer);
    reloadTimer = setTimeout(() => {
      reloadTimer = null;
      const prev = fingerprints.get(filePath);
      const next = fileContentHash(filePath);
      if (next == null) return;
      if (prev === next) {
        // Touch/scan only — content identical
        return;
      }
      fingerprints.set(filePath, next);
      console.log(`[Eva] Content changed: ${name}`);
      scheduleFileReload(name);
    }, 800);
  };

  for (const filePath of watchFiles) {
    try {
      if (!fs.existsSync(filePath)) {
        console.warn("[Eva] Watch skip (missing):", filePath);
        continue;
      }
      fs.watch(filePath, { persistent: true }, () => onMaybeChanged(filePath));
      console.log("[Eva] Watching for content changes:", filePath);
    } catch (err) {
      console.warn("[Eva] Watch failed for", filePath, err?.message || err);
    }
  }
}

function createTray() {
  const iconPath = path.join(__dirname, "..", "assets", "anime-girl-mascot.png");
  const icon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });
  tray = new Tray(icon.isEmpty() ? nativeImage.createEmpty() : icon);
  tray.setToolTip("Eva");
  tray.setContextMenu(
    Menu.buildFromTemplate([
      {
        label: "Show",
        click: () => {
          if (!mainWindow || mainWindow.isDestroyed()) createMainWindow();
          else focusEvaWindow();
        },
      },
      {
        label: "Restart Eva",
        click: () => restartEva("tray", { force: true }),
      },
      { type: "separator" },
      {
        label: "Quit",
        click: () => {
          allowQuit = true;
          app.quit();
        },
      },
    ]),
  );
  tray.on("double-click", () => focusEvaWindow());
}

async function applyWithCursor(historyMessages) {
  const apiKey = process.env.CURSOR_API_KEY;
  if (!apiKey) {
    throw new Error(
      "Missing CURSOR_API_KEY in .env. Create one at https://cursor.com/dashboard/api",
    );
  }

  const history = Array.isArray(historyMessages) ? historyMessages : [];
  const transcript = history
    .filter((m) => m && (m.role === "user" || m.role === "assistant"))
    .filter((m) => {
      const c = String(m.content ?? "");
      return (
        !c.startsWith("Applying with Cursor") &&
        !c.startsWith("Cursor apply result:") &&
        !c.startsWith("Cursor apply failed:")
      );
    })
    .map((m) => {
      const ts = m.ts ? ` [${m.ts}]` : "";
      return `${m.role === "user" ? "User" : "Eva"}${ts}: ${m.content}`;
    })
    .join("\n\n");

  if (!transcript.trim()) {
    throw new Error("No chat history to apply.");
  }

  const projectRoot = path.join(__dirname, "..");
  const { Agent } = await import("@cursor/sdk");

  const result = await Agent.prompt(
    [
      "You are Cursor Agent working inside this repository.",
      "The user confirmed they want you to APPLY code changes based on the Eva chat below.",
      "Implement the requested changes with minimal, focused edits.",
      "Do not expand scope. Prefer editing existing files over creating new ones unless needed.",
      "When done, briefly summarize what files you changed.",
      "",
      "=== Eva chat transcript ===",
      transcript,
      "=== end transcript ===",
    ].join("\n"),
    {
      apiKey,
      model: { id: "composer-2.5" },
      local: { cwd: projectRoot },
    },
  );

  if (result.status === "error") {
    throw new Error(`Cursor agent error (run ${result.id})`);
  }

  return String(result.result ?? "").trim() || "(Cursor finished with empty summary)";
}

function chatHistoryPath() {
  return path.join(__dirname, "data", "chat-history.json");
}

function loadChatHistory() {
  try {
    const p = chatHistoryPath();
    if (!fs.existsSync(p)) return [];
    const raw = JSON.parse(fs.readFileSync(p, "utf8"));
    return Array.isArray(raw) ? raw : [];
  } catch (err) {
    console.warn("[Eva] Failed to load chat history:", err?.message || err);
    return [];
  }
}

function saveChatHistory(historyMessages) {
  const dir = path.join(__dirname, "data");
  fs.mkdirSync(dir, { recursive: true });
  const history = Array.isArray(historyMessages) ? historyMessages : [];
  // Cap persisted size
  const trimmed = history.slice(-500);
  fs.writeFileSync(chatHistoryPath(), JSON.stringify(trimmed, null, 2), "utf8");
  return trimmed;
}

function clearChatHistory() {
  const p = chatHistoryPath();
  if (fs.existsSync(p)) fs.unlinkSync(p);
  return [];
}

ipcMain.handle("ask-chat", async (event, historyMessages) => {
  return askChat(historyMessages, {
    onProgress: (info) => {
      try {
        event.sender.send("eva-progress", info || {});
      } catch (_) {}
    },
  });
});

ipcMain.handle("apply-with-cursor", async (_event, historyMessages) => {
  return applyWithCursor(historyMessages);
});

ipcMain.handle("load-chat-history", async () => loadChatHistory());
ipcMain.handle("save-chat-history", async (_event, historyMessages) =>
  saveChatHistory(historyMessages),
);
ipcMain.handle("clear-chat-history", async () => clearChatHistory());
ipcMain.handle("load-prefs", async () => loadPrefs());
ipcMain.handle("save-prefs", async (_event, patch) => savePrefs(patch || {}));
ipcMain.handle("load-persona", async () => loadPersona());

// Back-compat alias
ipcMain.handle("ask-copilot", async (_event, prompt) => {
  return askChat([{ role: "user", content: String(prompt ?? "") }]);
});

ipcMain.on("drag-start", (_event, screenX, screenY) => {
  if (!mainWindow) return;
  const b = mainWindow.getBounds();
  dragOffset = { dx: screenX - b.x, dy: screenY - b.y };
});

ipcMain.on("drag-move", (_event, screenX, screenY) => {
  if (!mainWindow || !dragOffset) return;
  mainWindow.setPosition(
    Math.round(screenX - dragOffset.dx),
    Math.round(screenY - dragOffset.dy),
  );
});

ipcMain.on("drag-end", () => {
  dragOffset = null;
  saveWindowBounds();
});

app.whenReady().then(async () => {
  if (!gotSingleInstanceLock) return;
  loadEnvFile();
  try {
    await knowledgeDb.initKnowledgeDb();
  } catch (err) {
    console.warn("[Eva][KB] init skipped:", err?.message || err);
  }
  createMainWindow();
  createTray();
  watchForUpdates();
  // Load 8B into memory before the first chat (avoids "fetch failed" on cold start)
  warmOllamaModel().catch(() => {});
});

app.on("before-quit", () => {
  saveWindowBounds();
  allowQuit = true;
  knowledgeDb.closeKnowledgeDb().catch(() => {});
});

app.on("window-all-closed", (e) => {
  e.preventDefault();
});
