/** Eva 健身教練語料 — 偶像語氣、粵語口語、無浪漫內容 */

/** @type {readonly string[]} */
export const REST_MESSAGES = [
  "休息好啦～下一組要更 sharp 㗎！",
  "深呼吸先，Eva 陪住你等 countdown～",
  "舞台後台都係咁歇一歇，唔好急呀。",
  "肌肉而家喺度 recover，你坐低飲啖水先～",
  "LUMINA 排練中場休息都係咁，穩陣啲！",
  "下一組 form 要靚過上一組，Eva 睇住㗎～",
  "心跳慢慢落返嚟，準備好就繼續衝！",
  "偶像體力係練出嚟㗎，休息都係訓練一部份。",
  "拉伸下膊頭同手腕，等陣做動作會順啲。",
  "好叻呀～keep 住呢個節奏就得㗎啦！",
];

/** @type {readonly string[]} */
export const COMPLETION_HEADLINES = [
  "今日訓練收工～你超叻㗎！",
  "Session 完成！Eva 要為你拍手～",
  "練完啦～舞台 stamina 又 upgrade 咗！",
  "收工收工！呢次 session Eva 好滿意呀～",
];

/** @type {readonly string[]} */
export const COMPLETION_BODY = [
  "每組都認真做，偶像 discipline 就係咁練出嚟㗎。",
  "今日嘅 effort Eva 記住晒，繼續 keep 住就會見到 progress！",
  "排練完都要 cooldown 㗎——記得拉伸，聽日仲有力。",
  "你今日嘅 consistency 好 idol 級，Eva 好 proud～",
];

/**
 * @param {number} cycle 0-based rest cycle index
 * @returns {string}
 */
export function getRestMessage(cycle) {
  const idx = ((cycle % REST_MESSAGES.length) + REST_MESSAGES.length) % REST_MESSAGES.length;
  return REST_MESSAGES[idx];
}

/**
 * @param {number} [seed]
 * @returns {{ headline: string, body: string }}
 */
export function getCompletionSpeech(seed = 0) {
  const h =
    COMPLETION_HEADLINES[
      ((seed % COMPLETION_HEADLINES.length) + COMPLETION_HEADLINES.length) %
        COMPLETION_HEADLINES.length
    ];
  const b =
    COMPLETION_BODY[
      ((seed % COMPLETION_BODY.length) + COMPLETION_BODY.length) % COMPLETION_BODY.length
    ];
  return { headline: h, body: b };
}

/**
 * Eva 開場貼士（動作 modal 用）
 * @param {string} exerciseName
 * @returns {string}
 */
export function getExerciseIntro(exerciseName) {
  const short = exerciseName.split("（")[0];
  return `呢招「${short}」Eva 排練都會練㗎～跟住 form tips 做就穩陣啦！`;
}
