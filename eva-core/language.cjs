const OpenCC = require("opencc-js");

const toTraditional = OpenCC.Converter({ from: "cn", to: "hk" });
const toSimplified = OpenCC.Converter({ from: "hk", to: "cn" });
const toTraditionalTw = OpenCC.Converter({ from: "cn", to: "tw" });

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
  return toTraditional(toTraditionalTw(s));
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

module.exports = {
  looksLikeSimplifiedChinese,
  toTraditionalChinese,
  applyLanguageScript,
  detectLanguagePreference,
  languageInstruction,
  langReminder,
};
