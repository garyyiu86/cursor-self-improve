/** Eva encouragement copy for guided workout sessions */

const START_MESSAGES = [
  "開波啦～跟住節奏做，Eva 全程陪住你！",
  "今日 session 開始！form 靚過上一日就贏㗎啦 💪",
  "準備好未？偶像 stamina 就係咁練出嚟㗎～",
  "Eva 坐喺度睇住～每組都要認真做呀！",
] as const;

const MID_MESSAGES = [
  "過半啦！你而家嘅節奏好 idol 級～",
  "一半有多！keep 住呢個 pace，Eva 好 proud ✨",
  "中場加油！舞台 stamina 就係咁堆出嚟㗎！",
  "做到呢度已經好叻～唔好停呀！",
] as const;

const REST_MESSAGES = [
  "休息好啦～下一組要更 sharp 㗎！",
  "深呼吸先，Eva 陪住你等 countdown～",
  "肌肉而家喺度 recover，飲啖水先～",
  "下一組 form 要靚過上一組，Eva 睇住㗎～",
] as const;

const FINAL_MESSAGES = [
  "今日 session 收工～你超叻㗎！每組都認真做，偶像 discipline 就係咁練出嚟。",
  "全部做完啦！Eva 要為你拍手～記得拉伸 cooldown 呀。",
  "Session 完成！你今日嘅 consistency 好 idol 級，Eva 好 proud～",
  "練完啦～舞台 stamina 又 upgrade 咗！聽日繼續 keep 住就得㗎。",
] as const;

function pick<T extends readonly string[]>(list: T, seed: number): string {
  const idx = ((seed % list.length) + list.length) % list.length;
  return list[idx]!;
}

export function getSessionStartMessage(seed = 0): string {
  return pick(START_MESSAGES, seed);
}

export function getSessionMidMessage(seed = 0): string {
  return pick(MID_MESSAGES, seed);
}

export function getSessionRestMessage(cycle: number): string {
  return pick(REST_MESSAGES, cycle);
}

export function getSessionFinalMessage(seed = 0): string {
  return pick(FINAL_MESSAGES, seed);
}
