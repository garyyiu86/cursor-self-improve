const fs = require("node:fs");
const path = require("node:path");
const { getDataDir } = require("./env.cjs");

function prefsPath() {
  return path.join(getDataDir(), "prefs.json");
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

module.exports = { loadPrefs, savePrefs, defaultPrefs };
