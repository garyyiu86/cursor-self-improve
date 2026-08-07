import "./style.css";
import * as api from "./api.js";
import { features } from "./platform.js";
import { loadConnection, saveConnection, needsSetup } from "./settings.js";
import { Capacitor } from "@capacitor/core";
import { Keyboard } from "@capacitor/keyboard";

const feat = features();
document.documentElement.classList.add(`platform-${feat.platform}`);
document.body.classList.add(`platform-${feat.platform}`);

/**
 * Shrink #app so chat flexes shorter and composer stays above the keyboard.
 * Uses direct pixel heights (CSS vars alone were not applying reliably in WebView).
 */
function applyAndroidAppHeight(visiblePx) {
  if (feat.platform !== "android") return;
  const app = document.getElementById("app");
  const h = Math.max(120, Math.round(Number(visiblePx) || 0));
  document.documentElement.style.setProperty("--app-height", `${h}px`);
  document.documentElement.style.height = `${h}px`;
  document.body.style.height = `${h}px`;
  if (app) {
    app.style.height = `${h}px`;
    app.style.maxHeight = `${h}px`;
  }
  window.scrollTo(0, 0);
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;
}

function visibleAndroidHeight() {
  const vv = window.visualViewport;
  if (vv && vv.height > 0) {
    // visible area above keyboard (offsetTop accounts for any pan)
    return Math.round(vv.height);
  }
  return Math.round(window.innerHeight || document.documentElement.clientHeight || 0);
}

function syncAndroidViewport() {
  if (feat.platform !== "android") return;
  applyAndroidAppHeight(visibleAndroidHeight());
}

async function setupAndroidKeyboard() {
  if (feat.platform !== "android") return;

  window.__evaFullHeight = visibleAndroidHeight();
  syncAndroidViewport();

  window.addEventListener("resize", syncAndroidViewport);
  window.visualViewport?.addEventListener("resize", syncAndroidViewport);
  window.visualViewport?.addEventListener("scroll", syncAndroidViewport);

  if (!Capacitor.isNativePlatform()) return;

  try {
    Keyboard.addListener("keyboardWillShow", (info) => {
      const full = window.__evaFullHeight || window.innerHeight;
      const kb = Math.round(info?.keyboardHeight || 0);
      if (kb > 0) applyAndroidAppHeight(full - kb);
      else syncAndroidViewport();
    });
    Keyboard.addListener("keyboardDidShow", (info) => {
      const full = window.__evaFullHeight || window.innerHeight;
      const kb = Math.round(info?.keyboardHeight || 0);
      if (kb > 0) applyAndroidAppHeight(full - kb);
      else syncAndroidViewport();
      // After layout, keep composer in the flexed view
      document.getElementById("prompt")?.scrollIntoView?.({ block: "nearest" });
    });
    Keyboard.addListener("keyboardWillHide", () => {
      applyAndroidAppHeight(window.__evaFullHeight || visibleAndroidHeight());
    });
    Keyboard.addListener("keyboardDidHide", () => {
      applyAndroidAppHeight(window.__evaFullHeight || visibleAndroidHeight());
    });
  } catch (err) {
    console.warn("[Eva] Keyboard listeners failed", err);
  }
}

void setupAndroidKeyboard();

const EXPR = {
  idle: "./assets/anime-girl-mascot-half.png?v=6",
  thinking: "./assets/eva-expr-thinking.png?v=6",
  happy: "./assets/eva-expr-happy.png?v=6",
  confused: "./assets/eva-expr-confused.png?v=6",
  shy: "./assets/eva-expr-shy.png?v=6",
};

const history = [];
const MAX_CONTEXT_TURNS = 16;
const MAX_STORED = 500;

const mascotHtml = `
    <div class="mascot ${feat.mascot ? "" : "hidden"}" id="mascot" title="${feat.drag ? "Drag to move" : "Eva"}">
      <div class="mascot-stage">
        <img id="mascotImgA" class="show" src="${EXPR.idle}" alt="Eva" draggable="false" />
        <img id="mascotImgB" src="${EXPR.idle}" alt="" draggable="false" />
      </div>
    </div>`;

const composerInner = `
        <div class="row">
          <textarea id="prompt" placeholder="Talk to Eva..."></textarea>
          <div class="actions">
            <button class="send" id="send" type="button">Send</button>
            <button
              class="apply ${feat.applyWithCursor ? "" : "hidden"}"
              id="apply"
              type="button"
              title="Use Cursor Agent to apply code changes from this chat"
            >
              Apply with Cursor
            </button>
          </div>
        </div>
        <div class="hint">${
          feat.platform === "android"
            ? "連 PC 上 eva-core（同 Wi‑Fi）。KB → Tavily → LLM。"
            : "Postgres KB → Tavily miss → save → Ollama. Language follows dropdown."
        }</div>`;

const app = document.getElementById("app");
app.innerHTML =
  feat.platform === "android"
    ? `
  <div class="layout">
    <div class="panel">
      <div class="top">
        <h1>Eva</h1>
        <div class="top-actions">
          <button class="font-btn" id="fontDown" type="button" title="縮小字型">A−</button>
          <button class="font-btn" id="fontUp" type="button" title="放大字型">A+</button>
          <button class="settings-btn" id="settingsBtn" type="button" title="Connection">設定</button>
          <select class="lang" id="lang" title="Reply language (saved across restarts)">
            <option value="zh-Hant">繁中</option>
            <option value="zh-Hans">简中</option>
            <option value="en">EN</option>
            <option value="auto">Auto</option>
          </select>
          <button class="clear" id="clear" type="button" title="Clear saved chat history">Clear</button>
        </div>
      </div>
      <div class="chat-shell" id="chatShell">
        ${mascotHtml}
        <div id="response" class="response muted">Loading chat history…</div>
      </div>
      <div class="composer" id="composer">
        ${composerInner}
      </div>
    </div>
  </div>
  <div id="settingsOverlay" class="settings-overlay hidden">
    <div class="settings-card">
      <div class="settings-card-header">
        <h2>連線設定</h2>
        <button type="button" class="settings-close" id="connClose" title="關閉" aria-label="關閉">×</button>
      </div>
      <p>輸入 PC 位址（LAN 或 Cloudflare Tunnel HTTPS）同 API token（同 .env 嘅 EVA_API_TOKEN）。</p>
      <div id="settingsLockedHint" class="settings-locked-hint hidden">
        傾偈進行中，唔可以改連線設定。請等 Eva 答完再改。
      </div>
      <label>PC 位址（例如 http://192.168.1.10:8787 或 https://xxxx.trycloudflare.com）
        <input id="connBase" type="url" autocomplete="off" spellcheck="false" />
      </label>
      <label>API Token
        <input id="connToken" type="password" autocomplete="off" spellcheck="false" />
      </label>
      <div id="connStatus" class="settings-status"></div>
      <div class="settings-actions">
        <button type="button" class="secondary" id="connTest">測試連線</button>
        <button type="button" class="primary" id="connSave">儲存</button>
      </div>
    </div>
  </div>
`
    : `
  <div class="layout">
    <div class="panel">
      <div class="top">
        <h1>Eva</h1>
        <div class="top-actions">
          <button class="settings-btn hidden" id="settingsBtn" type="button" title="Connection">設定</button>
          <select class="lang" id="lang" title="Reply language (saved across restarts)">
            <option value="zh-Hant">繁中</option>
            <option value="zh-Hans">简中</option>
            <option value="en">EN</option>
            <option value="auto">Auto</option>
          </select>
          <button class="clear" id="clear" type="button" title="Clear saved chat history">Clear</button>
        </div>
      </div>
      <div id="response" class="response muted">Loading chat history…</div>
      ${composerInner}
    </div>
    ${mascotHtml}
  </div>
  <div id="settingsOverlay" class="settings-overlay hidden">
    <div class="settings-card">
      <div class="settings-card-header">
        <h2>連線設定</h2>
        <button type="button" class="settings-close" id="connClose" title="關閉" aria-label="關閉">×</button>
      </div>
      <p>輸入 PC 位址（LAN 或 Cloudflare Tunnel HTTPS）同 API token（同 .env 嘅 EVA_API_TOKEN）。</p>
      <div id="settingsLockedHint" class="settings-locked-hint hidden">
        傾偈進行中，唔可以改連線設定。請等 Eva 答完再改。
      </div>
      <label>PC 位址（例如 http://192.168.1.10:8787 或 https://xxxx.trycloudflare.com）
        <input id="connBase" type="url" autocomplete="off" spellcheck="false" />
      </label>
      <label>API Token
        <input id="connToken" type="password" autocomplete="off" spellcheck="false" />
      </label>
      <div id="connStatus" class="settings-status"></div>
      <div class="settings-actions">
        <button type="button" class="secondary" id="connTest">測試連線</button>
        <button type="button" class="primary" id="connSave">儲存</button>
      </div>
    </div>
  </div>
`;

const responseEl = document.getElementById("response");
const promptEl = document.getElementById("prompt");
const sendBtn = document.getElementById("send");
const applyBtn = document.getElementById("apply");
const clearBtn = document.getElementById("clear");
const langEl = document.getElementById("lang");
const settingsBtn = document.getElementById("settingsBtn");

if (feat.platform === "android" && promptEl) {
  const onPromptFocusChange = () => {
    // Capture full height before keyboard, then resync while it animates
    if (document.activeElement === promptEl && !window.__evaFullHeight) {
      window.__evaFullHeight = visibleAndroidHeight();
    }
    const pulses = [0, 50, 100, 200, 350, 500];
    for (const ms of pulses) {
      setTimeout(() => {
        syncAndroidViewport();
        if (document.activeElement === promptEl) {
          document.getElementById("composer")?.scrollIntoView?.({ block: "end" });
        }
      }, ms);
    }
  };
  promptEl.addEventListener("focus", onPromptFocusChange);
  promptEl.addEventListener("blur", () => {
    setTimeout(() => {
      applyAndroidAppHeight(window.__evaFullHeight || visibleAndroidHeight());
    }, 50);
    setTimeout(() => {
      applyAndroidAppHeight(window.__evaFullHeight || visibleAndroidHeight());
    }, 300);
  });
}
const settingsOverlay = document.getElementById("settingsOverlay");
const connBase = document.getElementById("connBase");
const connToken = document.getElementById("connToken");
const connStatus = document.getElementById("connStatus");
const connTest = document.getElementById("connTest");
const connSave = document.getElementById("connSave");
const connClose = document.getElementById("connClose");
const settingsLockedHint = document.getElementById("settingsLockedHint");
const fontDownBtn = document.getElementById("fontDown");
const fontUpBtn = document.getElementById("fontUp");
const mascot = document.getElementById("mascot");
const mascotImgA = document.getElementById("mascotImgA");
const mascotImgB = document.getElementById("mascotImgB");

const FONT_KEY = "eva.fontScale";
const FONT_MIN = 0.85;
const FONT_MAX = 1.6;
const FONT_STEP = 0.1;
const FONT_DEFAULT = feat.platform === "android" ? 1.15 : 1;

function loadFontScale() {
  const n = Number(localStorage.getItem(FONT_KEY));
  if (!Number.isFinite(n)) return FONT_DEFAULT;
  return Math.min(FONT_MAX, Math.max(FONT_MIN, n));
}

function applyFontScale(scale) {
  const s = Math.min(FONT_MAX, Math.max(FONT_MIN, Number(scale) || FONT_DEFAULT));
  document.documentElement.style.setProperty("--eva-font-scale", String(s));
  localStorage.setItem(FONT_KEY, String(s));
  if (fontDownBtn) fontDownBtn.disabled = s <= FONT_MIN + 0.001;
  if (fontUpBtn) fontUpBtn.disabled = s >= FONT_MAX - 0.001;
  return s;
}

let fontScale = applyFontScale(loadFontScale());
fontDownBtn?.addEventListener("click", () => {
  fontScale = applyFontScale(fontScale - FONT_STEP);
});
fontUpBtn?.addEventListener("click", () => {
  fontScale = applyFontScale(fontScale + FONT_STEP);
});

let dragging = false;
let moodTimer = null;
let idleExprTimer = null;
let exprName = "idle";
let frontIsA = true;
let switching = false;
/** True while ask / apply in flight — lock connection settings & skip history pull overwrite */
let chatBusy = false;
let syncTimer = null;

if (feat.mascot) {
  Object.values(EXPR).forEach((src) => {
    const im = new Image();
    im.src = src;
  });
}

function frontImg() {
  return frontIsA ? mascotImgA : mascotImgB;
}

function backImg() {
  return frontIsA ? mascotImgB : mascotImgA;
}

function setExpression(name) {
  if (!feat.mascot) return;
  const src = EXPR[name] || EXPR.idle;
  if (src === (EXPR[exprName] || EXPR.idle) && !switching) return;
  if (switching) {
    const f = frontImg();
    f.src = src;
    exprName = name;
    return;
  }

  const from = frontImg();
  const to = backImg();
  switching = true;
  mascot.classList.add("switching");

  to.src = src;
  to.classList.remove("show", "fade-out");
  to.classList.add("fade-in");
  from.classList.remove("fade-in");
  from.classList.add("fade-out");

  requestAnimationFrame(() => {
    to.classList.add("show");
  });

  window.setTimeout(() => {
    from.classList.remove("show", "fade-out", "fade-in");
    to.classList.remove("fade-in", "fade-out");
    to.classList.add("show");
    frontIsA = !frontIsA;
    exprName = name;
    switching = false;
    mascot.classList.remove("switching");
  }, 320);
}

function setMood(mood, ms) {
  if (!feat.mascot) return;
  mascot.classList.remove("thinking", "happy", "dragging", "confused", "shy");
  if (moodTimer) clearTimeout(moodTimer);
  if (idleExprTimer) clearTimeout(idleExprTimer);

  if (mood === "thinking") {
    mascot.classList.add("thinking");
    setExpression("thinking");
  } else if (mood === "happy") {
    mascot.classList.add("happy");
    setExpression("happy");
  } else if (mood === "confused") {
    mascot.classList.add("confused");
    setExpression("confused");
  } else if (mood === "shy") {
    mascot.classList.add("shy");
    setExpression("shy");
  } else if (mood === "dragging") {
    mascot.classList.add("dragging");
    setExpression("shy");
  } else {
    setExpression("idle");
  }

  if (ms) {
    moodTimer = setTimeout(() => {
      mascot.classList.remove("thinking", "happy", "confused", "shy");
      setExpression("idle");
      scheduleIdleExpression();
    }, ms);
  } else if (!mood || mood === "dragging") {
    // keep
  } else if (mood === "thinking") {
    // stays
  } else {
    scheduleIdleExpression();
  }
}

function scheduleIdleExpression() {
  if (!feat.mascot) return;
  if (idleExprTimer) clearTimeout(idleExprTimer);
  idleExprTimer = setTimeout(() => {
    if (dragging || mascot.classList.contains("thinking")) return;
    setMood("shy", 1800);
  }, 9000 + Math.random() * 12000);
}

if (feat.mascot) scheduleIdleExpression();

function nowTs() {
  return new Date().toISOString();
}

function formatTs(ts) {
  if (!ts) return "";
  try {
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) return String(ts);
    return d.toLocaleString(undefined, {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return String(ts);
  }
}

function trimStored() {
  while (history.length > MAX_STORED) history.shift();
}

async function persist() {
  trimStored();
  try {
    await api.saveChatHistory(history);
  } catch (err) {
    console.warn("save history failed", err);
  }
}

function contextForModel() {
  return history
    .filter((m) => m.role === "user" || m.role === "assistant")
    .filter((m) => {
      const c = String(m.content ?? "");
      return (
        !c.startsWith("Applying with Cursor") &&
        !c.startsWith("Cursor apply result:") &&
        !c.startsWith("Cursor apply failed:")
      );
    })
    .slice(-MAX_CONTEXT_TURNS);
}

function renderChat({ scrollToBottom = false, preserveScroll = false } = {}) {
  const prevTop = responseEl.scrollTop;
  if (!history.length) {
    responseEl.classList.add("muted");
    responseEl.textContent = feat.platform === "android"
      ? "Hi, I'm Eva. 同 PC 嘅 chat history 會同步。\n喺設定填 PC IP + token，然後傾偈。"
      : "Hi, I'm Eva. Chat history is saved across restarts.\nDrag the title or mascot to move. Type below, then Send.";
    return;
  }
  responseEl.classList.remove("muted");
  responseEl.innerHTML = "";
  for (const m of history) {
    const div = document.createElement("div");
    div.className = "msg " + (m.role === "user" ? "you" : "eva");
    const meta = document.createElement("div");
    meta.className = "meta";
    const who = document.createElement("div");
    who.className = "who";
    who.textContent = m.role === "user" ? "You" : "Eva";
    const ts = document.createElement("div");
    ts.className = "ts";
    ts.textContent = formatTs(m.ts);
    meta.appendChild(who);
    meta.appendChild(ts);
    const body = document.createElement("div");
    body.textContent = m.content;
    div.appendChild(meta);
    div.appendChild(body);
    responseEl.appendChild(div);
  }
  if (scrollToBottom) {
    responseEl.scrollTop = responseEl.scrollHeight;
  } else if (preserveScroll) {
    responseEl.scrollTop = prevTop;
  }
}

function openSettings(force = false) {
  if (!feat.connectionSettings && !force) return;
  if (chatBusy) {
    alert("傾偈進行中，唔可以改連線設定。請等 Eva 答完。");
    return;
  }
  const c = loadConnection();
  connBase.value = c.baseUrl;
  connToken.value = c.token;
  connStatus.textContent = "";
  connStatus.className = "settings-status";
  settingsLockedHint?.classList.add("hidden");
  connBase.disabled = false;
  connToken.disabled = false;
  connTest.disabled = false;
  connSave.disabled = false;
  settingsOverlay.classList.remove("hidden");
}

function closeSettings() {
  settingsOverlay.classList.add("hidden");
}

function setSettingsLocked(locked) {
  if (!feat.connectionSettings) return;
  settingsBtn.disabled = locked;
  if (locked && !settingsOverlay.classList.contains("hidden")) {
    // Mid-chat: allow close only; block edits / save / test
    settingsLockedHint?.classList.remove("hidden");
    connBase.disabled = true;
    connToken.disabled = true;
    connTest.disabled = true;
    connSave.disabled = true;
  }
}

settingsBtn?.addEventListener("click", () => openSettings(true));
connClose?.addEventListener("click", () => closeSettings());
settingsOverlay?.addEventListener("click", (e) => {
  if (e.target === settingsOverlay && !chatBusy) closeSettings();
});

connTest?.addEventListener("click", async () => {
  if (chatBusy) return;
  // Probe only — do not rewrite saved connection or reload chat
  const prev = loadConnection();
  const probe = {
    baseUrl: String(connBase.value || "").trim().replace(/\/$/, ""),
    token: String(connToken.value || "").trim(),
  };
  saveConnection(probe);
  connStatus.className = "settings-status";
  connStatus.textContent = "測試中…";
  try {
    const h = await api.healthCheck();
    connStatus.className = "settings-status ok";
    connStatus.textContent = h?.ok
      ? `OK${h.kb ? "（KB ready）" : "（KB off）"}`
      : "Unexpected response";
  } catch (err) {
    connStatus.className = "settings-status err";
    connStatus.textContent = String(err?.message || err);
  } finally {
    // Restore previous saved connection until user taps 儲存
    saveConnection(prev);
  }
});

connSave?.addEventListener("click", async () => {
  if (chatBusy) return;
  const next = {
    baseUrl: String(connBase.value || "").trim().replace(/\/$/, ""),
    token: String(connToken.value || "").trim(),
  };
  saveConnection(next);
  connStatus.className = "settings-status";
  connStatus.textContent = "儲存中…";
  try {
    await api.healthCheck();
    closeSettings();
    await pullHistoryFromServer();
    startHistorySync();
  } catch (err) {
    connStatus.className = "settings-status err";
    connStatus.textContent = String(err?.message || err);
  }
});

/**
 * Server file is source of truth for PC ↔ phone sync.
 * Skip while chatBusy so we don't wipe the streaming turn.
 */
async function pullHistoryFromServer({ scrollToBottom = false } = {}) {
  if (chatBusy) return false;
  try {
    const loaded = await api.loadChatHistory();
    if (!Array.isArray(loaded)) return false;
    history.length = 0;
    history.push(...loaded);
    renderChat(scrollToBottom ? { scrollToBottom: true } : { preserveScroll: true });
    return true;
  } catch (err) {
    console.warn("pull history failed", err);
    return false;
  }
}

function startHistorySync() {
  if (syncTimer) clearInterval(syncTimer);
  syncTimer = setInterval(() => {
    if (chatBusy) return;
    if (document.visibilityState !== "visible") return;
    void pullHistoryFromServer();
  }, 4000);
}
if (feat.drag) {
  mascot.addEventListener("mousedown", (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    dragging = true;
    setMood("dragging");
    window.companion.dragStart(e.screenX, e.screenY);
    mascot.setPointerCapture(e.pointerId);
  });

  mascot.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    window.companion.dragMove(e.screenX, e.screenY);
  });

  mascot.addEventListener("pointerup", (e) => {
    if (!dragging) return;
    dragging = false;
    try {
      mascot.releasePointerCapture(e.pointerId);
    } catch (_) {}
    window.companion.dragEnd();
    setMood("happy", 1200);
  });

  mascot.addEventListener("dblclick", () => {
    if (dragging) return;
    setMood("happy", 1200);
  });
}

clearBtn.addEventListener("click", async () => {
  const ok = confirm("Clear all saved Eva chat history?");
  if (!ok) return;
  history.length = 0;
  try {
    await api.clearChatHistory();
  } catch (err) {
    console.warn(err);
  }
  renderChat();
  promptEl.focus();
});

langEl.addEventListener("change", async () => {
  try {
    await api.savePrefs({ replyLanguage: langEl.value });
  } catch (err) {
    console.warn("save prefs failed", err);
  }
});

async function send() {
  const prompt = promptEl.value.trim();
  if (!prompt || chatBusy) return;
  promptEl.value = "";

  // Sync from PC before appending, so both sides share one thread
  await pullHistoryFromServer();

  history.push({ role: "user", content: prompt, ts: nowTs() });
  await persist();
  renderChat({ scrollToBottom: true });

  chatBusy = true;
  setSettingsLocked(true);
  sendBtn.disabled = true;
  setMood("thinking");
  const thinking = document.createElement("div");
  thinking.className = "msg eva muted";
  thinking.dataset.progress = "1";
  thinking.textContent = "Eva 正在處理…";
  responseEl.appendChild(thinking);
  responseEl.scrollTop = responseEl.scrollHeight;

  try {
    const answer = await api.askChat(contextForModel(), {
      onProgress: (info) => {
        const stage = String(info?.stage || "");
        const msg = String(info?.message || "");
        if (stage === "done") return;
        if (stage === "stream") {
          thinking.classList.remove("muted");
          thinking.textContent = msg || "…";
        } else {
          const tip = msg.trim();
          if (!tip) return;
          thinking.classList.add("muted");
          thinking.textContent = tip;
        }
        responseEl.scrollTop = responseEl.scrollHeight;
      },
    });
    history.push({ role: "assistant", content: answer, ts: nowTs() });
    await persist();
    renderChat({ scrollToBottom: true });
    setMood("happy", 1200);
  } catch (err) {
    history.push({
      role: "assistant",
      content: String(err?.message || err),
      ts: nowTs(),
    });
    await persist();
    renderChat({ scrollToBottom: true });
    setMood("confused", 1800);
  } finally {
    chatBusy = false;
    setSettingsLocked(false);
    sendBtn.disabled = false;
    promptEl.focus();
  }
}

sendBtn.addEventListener("click", send);
promptEl.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    send();
  }
});

applyBtn?.addEventListener("click", async () => {
  if (!feat.applyWithCursor) return;
  if (!history.length) {
    alert("Chat with Eva first, then click Apply with Cursor.");
    return;
  }
  if (chatBusy) return;
  const ok = confirm(
    "Apply code changes with Cursor Agent using this chat?\n\nThis can edit files in the project.",
  );
  if (!ok) return;

  chatBusy = true;
  setSettingsLocked(true);
  applyBtn.disabled = true;
  sendBtn.disabled = true;
  setMood("thinking");
  history.push({
    role: "assistant",
    content: "Applying with Cursor Agent…",
    ts: nowTs(),
  });
  await persist();
  renderChat({ scrollToBottom: true });

  try {
    const result = await window.companion.applyWithCursor(history);
    history.pop();
    history.push({
      role: "assistant",
      content: "Cursor apply result:\n" + result,
      ts: nowTs(),
    });
    await persist();
    renderChat({ scrollToBottom: true });
    setMood("happy", 1200);
  } catch (err) {
    history.pop();
    history.push({
      role: "assistant",
      content: "Cursor apply failed:\n" + String(err?.message || err),
      ts: nowTs(),
    });
    await persist();
    renderChat({ scrollToBottom: true });
    setMood("confused", 1800);
  } finally {
    chatBusy = false;
    setSettingsLocked(false);
    applyBtn.disabled = false;
    sendBtn.disabled = false;
    promptEl.focus();
  }
});

async function bootstrapChat() {
  try {
    const prefs = await api.loadPrefs();
    if (prefs?.replyLanguage) langEl.value = prefs.replyLanguage;
  } catch (err) {
    console.warn("load prefs failed", err);
  }
  await pullHistoryFromServer({ scrollToBottom: true });
}

(async () => {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && !chatBusy) {
      void pullHistoryFromServer();
    }
  });
  if (feat.connectionSettings && needsSetup(feat.platform)) {
    openSettings(true);
    responseEl.textContent = "請先完成連線設定…";
    return;
  }
  await bootstrapChat();
  startHistorySync();
})();
