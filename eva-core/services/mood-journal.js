/** @typedef {1|2|3|4|5} MoodLevel */

/**
 * @typedef {Object} MoodEntry
 * @property {string} id
 * @property {string} date YYYY-MM-DD
 * @property {MoodLevel} mood
 * @property {string} note
 * @property {string[]} activityTags
 * @property {string} createdAt ISO timestamp
 */

export const MOOD_LEVELS = {
  1: { emoji: "😢", label: "失落" },
  2: { emoji: "😐", label: "一般" },
  3: { emoji: "🙂", label: "唔錯" },
  4: { emoji: "😊", label: "幾好" },
  5: { emoji: "🤩", label: "超正" },
};

export const ACTIVITY_TAGS = [
  "排舞",
  "練歌",
  "見朋友",
  "睇live",
  "休息",
  "返工",
  "運動",
  "創作",
  "學嘢",
  "獨處",
];

const STORAGE_KEY = "eva-mood-journal-v1";

/** @returns {boolean} */
function hasStorage() {
  return typeof globalThis !== "undefined" && !!globalThis.localStorage;
}

/** @returns {MoodEntry[]} */
export function loadEntries() {
  if (!hasStorage()) return [];
  try {
    const raw = globalThis.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** @param {MoodEntry[]} entries */
function persistEntries(entries) {
  if (!hasStorage()) return;
  globalThis.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

/** @param {Date} [d] */
export function toDayKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** @returns {string} */
export function createEntryId() {
  return `mj-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * @param {string} date YYYY-MM-DD
 * @param {MoodLevel} mood
 * @param {string} [note]
 * @param {string[]} [activityTags]
 * @returns {MoodEntry}
 */
export function logMood(date, mood, note = "", activityTags = []) {
  const level = clampMood(mood);
  const dayKey = date || toDayKey();
  const entries = loadEntries();

  const entry = {
    id: createEntryId(),
    date: dayKey,
    mood: level,
    note: String(note || "").trim(),
    activityTags: Array.isArray(activityTags)
      ? activityTags.filter(Boolean)
      : [],
    createdAt: new Date().toISOString(),
  };

  const withoutDay = entries.filter((e) => e.date !== dayKey);
  persistEntries([entry, ...withoutDay]);
  return entry;
}

/** @param {string} id */
export function deleteMoodEntry(id) {
  persistEntries(loadEntries().filter((e) => e.id !== id));
}

/**
 * @param {number} days
 * @returns {MoodEntry[]}
 */
export function getMoodHistory(days = 30) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - Math.max(1, days) + 1);
  const cutoffKey = toDayKey(cutoff);

  return loadEntries()
    .filter((e) => e.date >= cutoffKey)
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
}

/** @returns {number} */
export function getMoodStreak() {
  const dayKeys = new Set(loadEntries().map((e) => e.date));
  if (dayKeys.size === 0) return 0;

  const today = new Date();
  const todayKey = toDayKey(today);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = toDayKey(yesterday);

  if (!dayKeys.has(todayKey) && !dayKeys.has(yesterdayKey)) return 0;

  let streak = 0;
  let cursor = dayKeys.has(todayKey) ? today : yesterday;

  while (dayKeys.has(toDayKey(cursor))) {
    streak += 1;
    cursor = new Date(cursor);
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}

/** @param {MoodLevel} mood */
function clampMood(mood) {
  const n = Number(mood);
  if (n < 1) return 1;
  if (n > 5) return 5;
  return /** @type {MoodLevel} */ (Math.round(n));
}

/** @returns {{ distribution: Record<number, number>, weeklyTrend: { weekLabel: string, avgMood: number, emoji: string, isCurrentWeek: boolean }[], totalEntries: number, avgMood: number }} */
export function getMoodStats() {
  const entries = loadEntries();
  /** @type {Record<number, number>} */
  const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

  for (const e of entries) {
    const m = clampMood(e.mood);
    distribution[m] = (distribution[m] || 0) + 1;
  }

  const totalEntries = entries.length;
  const avgMood =
    totalEntries > 0
      ? entries.reduce((sum, e) => sum + clampMood(e.mood), 0) / totalEntries
      : 0;

  const weeklyTrend = buildWeeklyTrend(entries);

  return {
    distribution,
    weeklyTrend,
    totalEntries,
    avgMood: Math.round(avgMood * 10) / 10,
  };
}

/** @param {MoodEntry[]} entries */
function buildWeeklyTrend(entries) {
  /** @type {Map<string, { moods: number[], weekStart: Date }>} */
  const weeks = new Map();

  for (const e of entries) {
    const d = parseDayKey(e.date);
    if (!d) continue;
    const weekStart = startOfWeek(d);
    const key = toDayKey(weekStart);
    const bucket = weeks.get(key) || { moods: [], weekStart };
    bucket.moods.push(clampMood(e.mood));
    weeks.set(key, bucket);
  }

  const currentWeekKey = toDayKey(startOfWeek(new Date()));
  const sorted = [...weeks.entries()].sort((a, b) => b[0].localeCompare(a[0]));

  return sorted.slice(0, 8).map(([key, { moods, weekStart }]) => {
    const avg = moods.reduce((a, b) => a + b, 0) / moods.length;
    const rounded = Math.round(avg);
    return {
      weekLabel: formatWeekLabel(weekStart),
      avgMood: Math.round(avg * 10) / 10,
      emoji: MOOD_LEVELS[clampMood(rounded)]?.emoji || "🙂",
      isCurrentWeek: key === currentWeekKey,
    };
  });
}

/** @param {Date} d */
function startOfWeek(d) {
  const copy = new Date(d);
  const day = copy.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + diff);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

/** @param {Date} weekStart */
function formatWeekLabel(weekStart) {
  const end = new Date(weekStart);
  end.setDate(end.getDate() + 6);
  const fmt = (dt) =>
    `${dt.getMonth() + 1}/${dt.getDate()}`;
  return `${fmt(weekStart)} – ${fmt(end)}`;
}

/** @param {string} key */
function parseDayKey(key) {
  const [y, m, d] = key.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

/** @returns {boolean} */
export function hasCheckedInToday() {
  const today = toDayKey();
  return loadEntries().some((e) => e.date === today);
}

/** @param {MoodLevel} mood */
export function getEvaEncouragement(mood) {
  const level = clampMood(mood);
  const lines = {
    1: [
      "今日好似有啲攰…我坐你枱角陪住你，唔使硬撐㗎。",
      "失落嗰陣，先至證明你在乎。我喺度，慢慢嚟。",
      "就算今日唔靚，你都值得被好好對待 — 包括被自己。",
    ],
    2: [
      "一般就一般啦，唔使日日都要超正先算合格。",
      "平穩一日都係勝利，我同你打卡先～",
      "今日平平地，聽日可能有驚喜，留啲力畀自己。",
    ],
    3: [
      "唔錯喔！保持住呢個節奏，偶像都係咁練出嚟㗎。",
      "有啲光嘅一日～記低佢，下次攰可以翻嚟睇。",
      "你今日做得好好，繼續用你嘅步調行就夠。",
    ],
    4: [
      "幾好喎！呢種心情好適合練兩首或者排少少舞～",
      "見到你狀態唔錯，我都跟住開心埋！",
      "今日嘅你，好有舞台感 ✨ 保持！",
    ],
    5: [
      "超正！！快啲記低今日做咗咩，下次可以複製呢個配方！",
      "哇你今日發光喎 — 呢啲日子就係我哋嘅 fuel！",
      "狀態咁好，記得同自己講聲「我勁叻」！",
    ],
  };

  const pool = lines[level] || lines[3];
  return pool[Math.floor(Math.random() * pool.length)];
}

/** @param {MoodLevel} mood */
export function getSuggestedActivity(mood) {
  const level = clampMood(mood);
  const suggestions = {
    1: [
      { title: "輕聲 warmup", detail: "跟住哼兩句最熟悉嘅副歌，唔使開嗓。" },
      { title: "桌面 stretch", detail: "郁郁膊頭同頸，像開 show 前嘅小準備。" },
      { title: "靜靜 rest", detail: "播首慢歌，閉眼三分鐘，當係後台休息。" },
    ],
    2: [
      { title: "5 分鐘 vocal", detail: "練下氣息就得，唔使逼自己唱 full take。" },
      { title: "慢步 walk", detail: "行一圈，當係去 stage 嘅 backstage corridor。" },
      { title: "整理 playlist", detail: "執下啲歌單，搵返啲聽完會 smile 嘅歌。" },
    ],
    3: [
      { title: "排舞小節", detail: "跟住鏡頭跳 8 個 eight，唔使跳足成首。" },
      { title: "練歌 15 分鐘", detail: "揀一段最啱今日 mood 嘅 verse 練熟佢。" },
      { title: "同朋友 share", detail: "send 首今日 loop 緊嘅歌畀朋友。" },
    ],
    4: [
      { title: "dance practice", detail: "今日狀態好，可以 challenge 新編舞！" },
      { title: "full vocal run", detail: "由 intro 唱到 outro，當 mini rehearsal。" },
      { title: "睇 live clip", detail: "搵場偶像 live 當 fuel，順便偷師 stage 感。" },
    ],
    5: [
      { title: "record 一段", detail: "錄低今日 vibe — 遲啲睇返會好有成就感。" },
      { title: "freestyle dance", detail: "開心就跳，唔使跟 choreo，享受舞台感。" },
      { title: "plan 下個 goal", detail: "趁狀態好，寫低下個想完成嘅小目標。" },
    ],
  };

  const pool = suggestions[level] || suggestions[3];
  return pool[Math.floor(Math.random() * pool.length)];
}
