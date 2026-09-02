const fs = require("node:fs");
const path = require("node:path");
const { getDataDir } = require("./env.cjs");

function prefsPath() {
  return path.join(getDataDir(), "prefs.json");
}

const LANGS = new Set(["auto", "zh-Hant", "zh-Hans", "en"]);
const CHAT_MODES = new Set(["eva", "tencent"]);

function defaultPrefs() {
  const fromEnv = (process.env.EVA_REPLY_LANGUAGE || "").trim();
  const modeEnv = String(process.env.EVA_CHAT_MODE || "").trim().toLowerCase();
  return {
    replyLanguage: LANGS.has(fromEnv) ? fromEnv : "zh-Hant",
    chatMode: CHAT_MODES.has(modeEnv) ? modeEnv : "eva",
  };
}

function loadPrefs() {
  try {
    const p = prefsPath();
    if (!fs.existsSync(p)) return defaultPrefs();
    const raw = JSON.parse(fs.readFileSync(p, "utf8"));
    const base = defaultPrefs();
    const lang = String(raw.replyLanguage || base.replyLanguage);
    const mode = String(raw.chatMode || base.chatMode).trim().toLowerCase();
    return {
      replyLanguage: LANGS.has(lang) ? lang : base.replyLanguage,
      chatMode: CHAT_MODES.has(mode) ? mode : base.chatMode,
    };
  } catch {
    return defaultPrefs();
  }
}

function savePrefs(patch) {
  const next = { ...loadPrefs(), ...(patch || {}) };
  if (!LANGS.has(next.replyLanguage)) next.replyLanguage = "zh-Hant";
  next.chatMode = String(next.chatMode || "eva").trim().toLowerCase();
  if (!CHAT_MODES.has(next.chatMode)) next.chatMode = "eva";
  fs.writeFileSync(prefsPath(), JSON.stringify(next, null, 2), "utf8");
  return next;
}

module.exports = { loadPrefs, savePrefs, defaultPrefs };
