import {
  EXERCISES,
  MUSCLE_GROUPS,
  MUSCLE_GROUP_META,
  getExerciseById,
  getExercises,
} from "./exerciseLibrary.js";

/** @typedef {'workout'|'recovery'|'technique'|'cardio'|'free'|'rest'} DayType */

/**
 * @typedef {Object} PlannedExercise
 * @property {string} id
 * @property {string} name
 * @property {number} sets
 * @property {string} reps
 * @property {string} rest
 * @property {string} tip
 * @property {string} [idolContext]
 */

/**
 * @typedef {Object} PlannedDay
 * @property {string} id
 * @property {number} dayIndex 0=Mon … 6=Sun
 * @property {string} weekday
 * @property {string} emoji
 * @property {string} title
 * @property {string} duration
 * @property {DayType} type
 * @property {PlannedExercise[]} exercises
 * @property {string} [note]
 */

/**
 * @typedef {Object} WeeklyPlan
 * @property {string} id
 * @property {string} muscleGroup
 * @property {string} difficulty
 * @property {string} title
 * @property {string} subtitle
 * @property {string} motto
 * @property {PlannedDay[]} days
 * @property {string[]} reminders
 */

/** @param {import('./exerciseLibrary.js').Exercise} ex @returns {PlannedExercise} */
function toPlanned(ex) {
  return {
    id: ex.id,
    name: ex.name,
    sets: ex.sets,
    reps: ex.reps,
    rest: ex.rest,
    tip: ex.tip,
    idolContext: ex.idolContext,
  };
}

/** @param {string[]} ids @returns {PlannedExercise[]} */
function exercisesFromIds(ids) {
  return ids.map((id) => {
    const ex = getExerciseById(id);
    if (!ex) throw new Error(`Unknown exercise id: ${id}`);
    return toPlanned(ex);
  });
}

/** Biceps beginner — matches chat bicep-weekly plan exactly. */
export const BICEPS_BEGINNER_WEEKLY = /** @type {WeeklyPlan} */ ({
  id: "biceps-beginner-weekly",
  muscleGroup: "biceps",
  difficulty: "beginner",
  title: "二頭肌線條每週訓練表",
  subtitle: "偶像級 7 日 schedule（Mon · Wed · Fri 主訓練）",
  motto: "楽しむことが一番",
  days: [
    {
      id: "day-mon",
      dayIndex: 0,
      weekday: "一",
      emoji: "🌕",
      title: "二頭肌主訓練（Curl + Hammer + Push-up）",
      duration: "~20min",
      type: "workout",
      exercises: exercisesFromIds([
        "dumbbell-bicep-curl",
        "hammer-curl",
        "push-up",
      ]),
    },
    {
      id: "day-tue",
      dayIndex: 1,
      weekday: "二",
      emoji: "🌑",
      title: "Active Recovery（拉伸放鬆）",
      duration: "15min",
      type: "recovery",
      exercises: exercisesFromIds(["arm-stretch-hold"]),
      note: "輕鬆拉伸就得，唔使 push 到力竭。",
    },
    {
      id: "day-wed",
      dayIndex: 2,
      weekday: "三",
      emoji: "🔥",
      title: "全身燃脂＋Concentration Curl",
      duration: "~20min",
      type: "cardio",
      exercises: exercisesFromIds([
        "jumping-jack",
        "bodyweight-squat",
        "concentration-curl",
      ]),
    },
    {
      id: "day-thu",
      dayIndex: 3,
      weekday: "四",
      emoji: "🌊",
      title: "輕量技術日（意念控制肌肉收縮）",
      duration: "~15min",
      type: "technique",
      exercises: exercisesFromIds(["slow-tempo-curl", "hammer-curl"]),
      note: "控制比力度更重要——上舉 2 秒 → 下降 3–4 秒。",
    },
    {
      id: "day-fri",
      dayIndex: 4,
      weekday: "五",
      emoji: "💪",
      title: "二頭肌主訓練（Incline + Reverse Curl）",
      duration: "~20min",
      type: "workout",
      exercises: exercisesFromIds([
        "incline-dumbbell-curl",
        "reverse-curl",
        "band-pull-apart",
      ]),
    },
    {
      id: "day-sat",
      dayIndex: 5,
      weekday: "六",
      emoji: "🎵",
      title: "自由活動 — 跳舞／行山／游水都得！",
      duration: "隨心",
      type: "free",
      exercises: [],
      note: "LUMINA 休息日都可以輕鬆排舞或 cardio——開心就得 ✨",
    },
    {
      id: "day-sun",
      dayIndex: 6,
      weekday: "日",
      emoji: "😴",
      title: "完全休息 — 肌肉修復先係關鍵",
      duration: "—",
      type: "rest",
      exercises: [],
      note: "肌肉喺休息時先會生長——今日好好瞓 💤",
    },
  ],
  reminders: [
    "用中輕重量（12–15 下做到力竭就夠）",
    "控制節奏：上舉 2 秒 → 下降 3 秒（離心收縮先係線條秘密）",
    "體脂配合先睇到線條，記得飲食都要留意下～",
    "每星期 2–3 次主訓練就夠，休息 45–60 秒 keep 住 pump",
  ],
});

const PRESET_PLANS = {
  "biceps:beginner": BICEPS_BEGINNER_WEEKLY,
};

/**
 * @param {string} muscleGroup
 * @param {string} difficulty
 * @returns {WeeklyPlan}
 */
export function generateWeeklyPlan(muscleGroup, difficulty) {
  const group = String(muscleGroup || "biceps").trim();
  const level = String(difficulty || "beginner").trim();
  const key = `${group}:${level}`;

  if (PRESET_PLANS[key]) {
    return structuredClone(PRESET_PLANS[key]);
  }

  return buildGenericWeeklyPlan(group, level);
}

/**
 * @param {string} muscleGroup
 * @param {string} difficulty
 * @returns {WeeklyPlan}
 */
function buildGenericWeeklyPlan(muscleGroup, difficulty) {
  const meta = MUSCLE_GROUP_META[muscleGroup] || MUSCLE_GROUP_META.biceps;
  const pool = getExercises({ muscleGroup, difficulty });
  const fallback = getExercises({ muscleGroup });
  const source = pool.length >= 3 ? pool : fallback.length ? fallback : EXERCISES;

  const pick = (offset, count = 3) => {
    const items = [];
    for (let i = 0; i < count; i += 1) {
      items.push(toPlanned(source[(offset + i) % source.length]));
    }
    return items;
  };

  const weekdayLabels = ["一", "二", "三", "四", "五", "六", "日"];
  const emojis = ["🌕", "🌑", "🔥", "🌊", "💪", "🎵", "😴"];
  const types = ["workout", "recovery", "cardio", "technique", "workout", "free", "rest"];

  /** @type {PlannedDay[]} */
  const days = weekdayLabels.map((weekday, dayIndex) => {
    const type = /** @type {DayType} */ (types[dayIndex]);
    const isWork = type === "workout" || type === "cardio" || type === "technique";
    return {
      id: `day-${dayIndex}`,
      dayIndex,
      weekday,
      emoji: emojis[dayIndex],
      title:
        type === "rest"
          ? "完全休息"
          : type === "free"
            ? "自由活動"
            : type === "recovery"
              ? "Active Recovery（拉伸放鬆）"
              : `${meta.label}訓練 Day ${Math.floor(dayIndex / 2) + 1}`,
      duration: type === "rest" ? "—" : type === "free" ? "隨心" : "~20min",
      type,
      exercises: isWork ? pick(dayIndex * 2, type === "technique" ? 2 : 3) : [],
    };
  });

  return {
    id: `${muscleGroup}-${difficulty}-weekly`,
    muscleGroup,
    difficulty,
    title: `${meta.emoji} ${meta.label}每週訓練表`,
    subtitle: `${difficulty} · 7 日自動編排`,
    motto: "楽しむことが一番",
    days,
    reminders: [
      "用中輕重量，控制離心 2–3 秒",
      "每組 rest 45–60 秒",
      "唔使一次做到好 intensive，堅持先係王道",
    ],
  };
}

export { MUSCLE_GROUPS, MUSCLE_GROUP_META, EXERCISES, getExercises };
