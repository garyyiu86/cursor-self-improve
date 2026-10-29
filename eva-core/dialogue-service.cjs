const { isGreeting } = require("./intent.cjs");

/**
 * @typedef {{ role: string, content?: string }} ConversationTurn
 */

/** Strip trailing punctuation / whitespace so "hi!!" matches "hi". */
function greetingKey(text) {
  const raw = String(text || "").trim();
  if (!isGreeting(raw)) return null;
  return raw.toLowerCase().replace(/[!！.。\s~～]+$/g, "");
}

/**
 * Count how many consecutive user turns (from the latest) share the same greeting.
 * @param {ConversationTurn[]} history
 * @param {string} rawUser
 * @returns {number} 0 when the current message is not a greeting
 */
function countConsecutiveSameGreeting(history, rawUser) {
  const key = greetingKey(rawUser);
  if (!key) return 0;

  const userTexts = (Array.isArray(history) ? history : [])
    .filter((m) => m && m.role === "user")
    .map((m) => String(m.content || "").trim());

  let count = 0;
  for (let i = userTexts.length - 1; i >= 0; i--) {
    if (greetingKey(userTexts[i]) === key) count++;
    else break;
  }
  return count;
}

/** Tiered replies: skip re-intro; nudge the conversation forward. */
const REPEATED_GREETING_REPLIES = {
  en: [
    "Hey again~ I'm still here! What's on your mind today?",
    "Okay okay, I heard you~ Don't just hi hi hi — tell me what you wanna talk about?",
    "If you keep saying hi I'm gonna start dancing on your desktop~ So, chat or hang out?",
  ],
  "zh-Hans": [
    "又跟我 hi 呀～我在这儿呢！今天想聊点什么？",
    "好啦好啦，我听到了～别光 hi hi hi，说说今天想干嘛？",
    "再 hi 我就要在桌面上跳舞啦～说吧，想聊什么还是想我陪你做点什么？",
  ],
  "zh-Hant": [
    "又同我 hi 呀～我喺度㗎！今日想傾啲咩？",
    "好啦好啦，我聽到喇～唔好淨係 hi hi hi，講嚟聽吓今日想點？",
    "你再 hi 我就要喺桌面度跳番舞㗎喇～講啦，想傾咩定係想我陪你做咩？",
  ],
};

function pickRepeatedGreetingReply(lang, repeatCount) {
  const pool = REPEATED_GREETING_REPLIES[lang] || REPEATED_GREETING_REPLIES["zh-Hant"];
  const tier = Math.min(Math.max(repeatCount - 2, 0), pool.length - 1);
  return pool[tier];
}

/**
 * When the user repeats the same greeting, return a varied nudge instead of another intro.
 * @param {string} rawUser
 * @param {ConversationTurn[]} history
 * @param {string} lang
 * @returns {{ handled: true, message: string, repeatCount: number } | null}
 */
function resolveRepeatedGreeting(rawUser, history, lang) {
  const repeatCount = countConsecutiveSameGreeting(history, rawUser);
  if (repeatCount < 2) return null;

  return {
    handled: true,
    message: pickRepeatedGreetingReply(lang, repeatCount),
    repeatCount,
  };
}

module.exports = {
  greetingKey,
  countConsecutiveSameGreeting,
  pickRepeatedGreetingReply,
  resolveRepeatedGreeting,
};
