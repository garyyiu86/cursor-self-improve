const { app, BrowserWindow, screen, Menu, Tray, nativeImage, ipcMain } = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const OpenCC = require("opencc-js");

const toTraditional = OpenCC.Converter({ from: "cn", to: "hk" });
const toSimplified = OpenCC.Converter({ from: "hk", to: "cn" });

const CHAR_WIDTH = 96;
const CHAR_HEIGHT = 256;
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

async function tavilySearch(query) {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) {
    throw new Error(
      "Missing TAVILY_API_KEY in .env. Add it locally (do not paste keys in chat).",
    );
  }

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
    throw new Error(`Tavily error ${res.status}: ${body.slice(0, 300)}`);
  }

  const data = await res.json();
  const lines = [];
  if (data.answer) {
    lines.push(String(data.answer).trim());
    lines.push("");
  }
  const results = Array.isArray(data.results) ? data.results : [];
  for (const r of results.slice(0, 5)) {
    const title = r.title || "Result";
    const url = r.url || "";
    const snippet = (r.content || "").trim().slice(0, 220);
    lines.push(`• ${title}`);
    if (snippet) lines.push(`  ${snippet}`);
    if (url) lines.push(`  ${url}`);
    lines.push("");
  }
  return lines.join("\n").trim() || "(No Tavily results)";
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
  return /(覺得|认为|認為|think|prefer|喜歡|喜欢|選擇|选择|邊個好|哪个好|哪個好|定係|还是|還是|意見|意见|看法|點睇|点睇|你呢|你怎麼看|你怎么看|what\s+do\s+you\s+think|which\s+(?:one|do\s+you)|your\s+(?:take|opinion|preference))/i.test(
    s,
  );
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
  return formatNowForLang(lang === "auto" ? "zh-Hant" : lang);
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
  if (lang === "zh-Hant" || lang === "auto") return toTraditional(s);
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
  return /(人設|人格|性格|persona|personality|character)/i.test(s) &&
    /(改|換|变|變|更新|設定|设置|變成|变成|改成|換成|换成|調整|调整|change|update|rewrite|make\s+you|be\s+more)/i.test(
      s,
    );
}

async function ollamaChatOnce({ host, model, messages, temperature = 0.4 }) {
  const res = await fetch(`${host}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      stream: false,
      messages,
      options: {
        temperature,
        top_p: 0.9,
        repeat_penalty: 1.1,
      },
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Ollama error ${res.status}: ${body.slice(0, 300)}`);
  }
  const data = await res.json();
  return String(data?.message?.content ?? "").trim();
}

async function updatePersonaFromUserRequest(rawUser, lang) {
  const host = (process.env.OLLAMA_HOST || "http://127.0.0.1:11434").replace(/\/$/, "");
  const model = process.env.OLLAMA_MODEL || "qwen2.5:3b";
  const current = loadPersona();

  const draft = await ollamaChatOnce({
    host,
    model,
    temperature: 0.35,
    messages: [
      {
        role: "system",
        content: [
          "You rewrite Eva's persona profile for a desktop companion.",
          "Output ONLY the new persona plain text file contents.",
          "Keep the name Eva / 伊娃.",
          "Include sections: Personality, Speech style, Boundaries.",
          "Merge the user's requested changes into the current persona.",
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
    return "Got it~ I updated my persona. Talk to me again and you'll feel the new vibe.";
  }
  if (lang === "zh-Hans") {
    return "好呀～我已经按你的要求更新人设了。再跟我聊几句就会感觉到变化。";
  }
  return "好呀～我已經按你嘅要求更新人設喇。再同我傾兩句就會感覺到變化。";
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
  if (/^(謝謝|谢谢|thanks|thank you|拜拜|bye|再見|再见|我累|好悶|想你)[!！.。\s]*$/i.test(s)) {
    return false;
  }
  return /(\?|？|什麼|什么|為甚麼|为什么|為何|为何|怎麼|怎么|怎樣|怎样|哪裡|哪里|哪個|哪个|誰|谁|多少|幾|几|是否|嗎|吗|define|what|who|when|where|why|how|which|capital|population|meaning|explain|告訴我|告诉我|介紹|介绍|是不是|最新|新聞|新闻|天氣|天气)/i.test(
    s,
  );
}

function searchEnabled() {
  if (process.env.EVA_USE_SEARCH === "0") return false;
  return Boolean(process.env.TAVILY_API_KEY);
}

async function maybeSearchNotes(query) {
  if (!searchEnabled()) return "";
  if (!isFactualQuestion(query)) return "";
  try {
    return await tavilySearch(query);
  } catch (err) {
    console.warn("[Eva] Search failed:", err?.message || err);
    return "";
  }
}

function buildSystemPrompt(lang, nowFact, searchNotes, { includeClock = false, continuityBlock = "" } = {}) {
  const parts = [
    loadPersona(),
    "Be concise and stay in character, but stay accurate.",
    "CRITICAL: Use the recent conversation turns. Follow-ups like「你覺得呢」「為什麼」「什麼研究」refer to the previous topic — answer THAT topic.",
    "Never suddenly switch to date, time, weather, or unrelated small-talk unless the user asked for it.",
    "When the user asks your preference or opinion, pick ONE clear side and briefly say why — do not sit on both sides.",
    "Answer the user's question directly — never only repeat the question.",
    "If you are unsure, say you are unsure. Do not invent facts, dates, numbers, or names.",
    languageInstruction(lang),
  ];
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
  if (searchNotes) {
    parts.push(
      "You are given web search notes below. Prefer those notes for factual claims.",
      "If the notes are insufficient, say what is missing instead of guessing.",
      "Search notes:\n" + searchNotes,
    );
  }
  return parts.join("\n");
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
    return "\n\n[系統提醒：請直接用繁體中文（香港用字）回答，不要用簡體字，也不要重複用戶的話。不確定就坦白說。]";
  }
  if (lang === "zh-Hans") {
    return "\n\n[系统提醒：请直接用简体中文回答，不要重复用户的话。不确定就坦白说。]";
  }
  if (lang === "en") {
    return "\n\n[System reminder: Answer directly in English. Do not invent facts. Do not repeat the question.]";
  }
  if (lang === "auto" && /[\u4e00-\u9fff]/.test(userText)) {
    return "\n\n[系統提醒：請直接用繁體中文回答，不要用簡體字。不確定就坦白說。]";
  }
  return "";
}

async function askOllama(historyMessages) {
  const host = (process.env.OLLAMA_HOST || "http://127.0.0.1:11434").replace(/\/$/, "");
  const model = process.env.OLLAMA_MODEL || "qwen2.5:3b";
  const prefs = loadPrefs();
  const lang = prefs.replyLanguage || "zh-Hant";

  const history = resolveHistoryForModel(historyMessages);
  const lastUser = [...history].reverse().find((m) => m.role === "user");
  const rawUser = String(lastUser?.content ?? "").trim() || "你好";

  if (isDateTimeQuestion(rawUser)) {
    return applyLanguageScript(answerDateTimeLocally(lang), lang);
  }
  if (isGreeting(rawUser) && lang !== "en" && history.length <= 1) {
    return localGreeting(lang);
  }
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
  const opinion = isOpinionOrPreferenceQuestion(rawUser);
  const followUp = isContextualFollowUp(rawUser);
  // Follow-ups / opinions should not be derailed by web search.
  const searchNotes =
    opinion || followUp ? "" : await maybeSearchNotes(rawUser);
  const factual = Boolean(searchNotes) || (!opinion && !followUp && isFactualQuestion(rawUser));

  const continuityBlock = formatContinuityBlock(history.slice(-10));

  const turns = history.map((m, i) => {
    const role = m.role === "assistant" ? "assistant" : "user";
    let content = String(m.content ?? "");
    if (role === "user" && i === history.length - 1) {
      content += langReminder(lang, content);
      if (opinion || followUp) {
        content +=
          lang === "en"
            ? "\n\n[System: This is a follow-up. Answer using the previous topic in this chat only. Pick one clear stance if asked for preference. Do NOT mention date/time.]"
            : "\n\n[系統：這是延續上一輪的追問。必須根據對話上文回答同一主題。若問偏好，只選一邊。禁止提及日期或時間。]";
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
      content: buildSystemPrompt(lang, nowFact, searchNotes, {
        includeClock: false,
        continuityBlock,
      }),
    },
    ...turns,
  ];

  console.log(
    `[Eva] Ollama context turns=${turns.length} followUp=${followUp} opinion=${opinion} model=${model}`,
  );

  const res = await fetch(`${host}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      stream: false,
      messages,
      options: {
        temperature: factual ? 0.2 : followUp || opinion ? 0.55 : 0.65,
        top_p: 0.9,
        repeat_penalty: 1.15,
        num_ctx: 8192,
      },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Ollama error ${res.status}: ${body.slice(0, 300)}`);
  }

  const data = await res.json();
  let text = String(data?.message?.content ?? "").trim() || "(empty Ollama response)";

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
        })) || text;
    } catch (err) {
      console.warn("[Eva] Retry failed:", err?.message || err);
    }
  }

  if (looksLikeEcho(text, rawUser)) {
    if (searchNotes) {
      const firstLine = searchNotes.split(/\r?\n/).find((l) => l.trim());
      if (firstLine) return applyLanguageScript(firstLine.replace(/^Answer:\s*/i, ""), lang);
    }
    if (lang === "en") {
      return "Sorry — I didn't catch that clearly. Could you ask again in another way?";
    }
    if (lang === "zh-Hans") {
      return "抱歉，我刚才没答好。可以换个说法再问我一次吗？";
    }
    return "抱歉，我剛才沒答好。可以換個說法再問我一次嗎？";
  }

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
        "Always reply in Traditional Chinese (繁體中文), using Hong Kong / Taiwan wording when natural.",
        "Never use Simplified Chinese characters (简体字).",
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

async function askChat(historyMessages) {
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
    return await askOllama(history);
  } catch (ollamaErr) {
    console.warn("Ollama unavailable, falling back:", ollamaErr?.message || ollamaErr);
  }

  if (!process.env.TAVILY_API_KEY) {
    throw new Error(
      "Ollama is not running (or model missing). Start Ollama and ensure OLLAMA_MODEL=companion-min. Or set TAVILY_API_KEY for search fallback.",
    );
  }

  const tavilyText = await tavilySearch(prompt || "hello");
  const cursorKey = process.env.CURSOR_API_KEY;
  if (!cursorKey) return tavilyText;

  try {
    const { Agent } = await import("@cursor/sdk");
    const lang = loadPrefs().replyLanguage || "zh-Hant";
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

function restartEva(reason = "manual") {
  if (isRelaunching) return;
  isRelaunching = true;
  console.log(`[Eva] Restarting (${reason})...`);
  saveWindowBounds();
  allowQuit = true;
  app.relaunch();
  app.exit(0);
}

function watchForUpdates() {
  // Default ON. Set EVA_AUTO_RELOAD=0 in .env to disable.
  if (process.env.EVA_AUTO_RELOAD === "0") {
    console.log("[Eva] Auto-reload disabled (EVA_AUTO_RELOAD=0)");
    return;
  }

  const watchRoots = [
    path.join(__dirname), // overlay sources
    path.join(__dirname, "..", "package.json"),
    path.join(__dirname, "..", ".env"),
  ];

  const onChange = (file) => {
    const name = path.basename(file || "");
    // Ignore noise and persisted chat (would restart-loop)
    if (!name || name.endsWith(".map") || name.startsWith(".")) return;
    if (
      name === "chat-history.json" ||
      name === "window-bounds.json" ||
      name === "prefs.json" ||
      name === "persona.txt"
    ) {
      return;
    }
    if (reloadTimer) clearTimeout(reloadTimer);
    reloadTimer = setTimeout(() => restartEva(`file change: ${name}`), 600);
  };

  for (const root of watchRoots) {
    try {
      if (!fs.existsSync(root)) continue;
      const stat = fs.statSync(root);
      if (stat.isDirectory()) {
        fs.watch(root, { recursive: true }, (_event, filename) => {
          onChange(filename || root);
        });
      } else {
        fs.watch(root, () => onChange(root));
      }
      console.log("[Eva] Watching for updates:", root);
    } catch (err) {
      console.warn("[Eva] Watch failed for", root, err?.message || err);
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
          if (!mainWindow) createMainWindow();
          else {
            mainWindow.show();
            mainWindow.moveTop();
          }
        },
      },
      {
        label: "Restart Eva",
        click: () => restartEva("tray"),
      },
      { type: "separator" },
      { label: "Quit", click: () => app.quit() },
    ]),
  );
  tray.on("double-click", () => {
    mainWindow?.show();
    mainWindow?.moveTop();
  });
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

ipcMain.handle("ask-chat", async (_event, historyMessages) => {
  return askChat(historyMessages);
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

app.whenReady().then(() => {
  loadEnvFile();
  createMainWindow();
  createTray();
  watchForUpdates();
});

app.on("before-quit", () => {
  saveWindowBounds();
  allowQuit = true;
});

app.on("window-all-closed", (e) => {
  e.preventDefault();
});
