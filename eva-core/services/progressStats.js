import { computeStreak, getTodayDayIndex, loadProgress, toDayKey } from "./workoutTracker.js";

/** @typedef {'completed'|'missed'|'future'|'today'|'rest'|'none'} CalendarDayStatus */

/**
 * @typedef {Object} CalendarDay
 * @property {string} date
 * @property {number} dayOfMonth
 * @property {CalendarDayStatus} status
 * @property {boolean} trackable
 */

/**
 * @typedef {Object} WeeklyCompletion
 * @property {string} weekStart
 * @property {string} weekEnd
 * @property {string} weekLabel
 * @property {number} completedDays
 * @property {number} expectedDays
 * @property {number} pct
 */

/**
 * @typedef {Object} Encouragement
 * @property {string} message
 * @property {'celebrate'|'motivate'|'gentle'|'welcome'} tone
 */

/**
 * @typedef {Object} ProgressStats
 * @property {string} planId
 * @property {number} currentStreak
 * @property {number} longestStreak
 * @property {number} totalCompletedDays
 * @property {string} calendarMonth
 * @property {CalendarDay[]} calendarDays
 * @property {WeeklyCompletion[]} weeklyCompletion
 * @property {Encouragement} encouragement
 * @property {string} updatedAt
 */

/** @param {string[]} completedDays */
export function computeLongestStreak(completedDays) {
  const unique = [...new Set(completedDays)].sort();
  if (unique.length === 0) return 0;
  if (unique.length === 1) return 1;

  let longest = 1;
  let current = 1;

  for (let i = 1; i < unique.length; i += 1) {
    const prev = new Date(`${unique[i - 1]}T12:00:00`);
    prev.setDate(prev.getDate() + 1);
    if (toDayKey(prev) === unique[i]) {
      current += 1;
      longest = Math.max(longest, current);
    } else {
      current = 1;
    }
  }

  return longest;
}

/** @param {Date} d */
function getWeekStartMonday(d) {
  const date = new Date(d);
  date.setHours(0, 0, 0, 0);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  return date;
}

/** @param {Date} start @param {Date} end */
function formatWeekLabel(start, end) {
  const fmt = (d) =>
    d.toLocaleDateString("zh-HK", { month: "numeric", day: "numeric" });
  return `${fmt(start)}–${fmt(end)}`;
}

/**
 * @param {string[]} completedDays
 * @param {import("../types/workout.ts").WeeklyWorkoutPlan} plan
 * @param {number} year
 * @param {number} month 0-indexed
 */
export function buildCalendarMonth(completedDays, plan, year, month) {
  const completed = new Set(completedDays);
  const todayKey = toDayKey(new Date());
  const today = new Date(`${todayKey}T12:00:00`);
  const last = new Date(year, month + 1, 0);

  /** @type {CalendarDay[]} */
  const days = [];

  for (let d = 1; d <= last.getDate(); d += 1) {
    const date = new Date(year, month, d, 12, 0, 0, 0);
    const key = toDayKey(date);
    const dayIndex = getTodayDayIndex(date);
    const planDay = plan.days[dayIndex];
    const trackable = Boolean(planDay?.exercises?.length);

    /** @type {CalendarDayStatus} */
    let status = "none";

    if (completed.has(key)) {
      status = "completed";
    } else if (key === todayKey) {
      status = "today";
    } else if (date > today) {
      status = "future";
    } else if (trackable) {
      status = "missed";
    } else {
      status = "rest";
    }

    days.push({ date: key, dayOfMonth: d, status, trackable });
  }

  return days;
}

/**
 * @param {string[]} completedDays
 * @param {import("../types/workout.ts").WeeklyWorkoutPlan} plan
 * @param {number} [weeks=4]
 */
export function computeWeeklyCompletion(completedDays, plan, weeks = 4) {
  const expectedDays = plan.days.filter((day) => day.exercises?.length > 0).length;
  const completed = new Set(completedDays);
  const today = new Date();
  today.setHours(12, 0, 0, 0);

  /** @type {WeeklyCompletion[]} */
  const results = [];

  for (let w = weeks - 1; w >= 0; w -= 1) {
    const anchor = new Date(today);
    anchor.setDate(anchor.getDate() - w * 7);
    const weekStart = getWeekStartMonday(anchor);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);

    let completedInWeek = 0;
    for (const key of completed) {
      const d = new Date(`${key}T12:00:00`);
      if (d >= weekStart && d <= weekEnd) completedInWeek += 1;
    }

    const pct = expectedDays
      ? Math.round(Math.min(100, (completedInWeek / expectedDays) * 100))
      : 0;

    results.push({
      weekStart: toDayKey(weekStart),
      weekEnd: toDayKey(weekEnd),
      weekLabel: formatWeekLabel(weekStart, weekEnd),
      completedDays: completedInWeek,
      expectedDays,
      pct,
    });
  }

  return results;
}

/**
 * @param {Object} input
 * @param {number} input.currentStreak
 * @param {number} input.longestStreak
 * @param {string[]} input.completedDays
 * @param {boolean} input.todayCompleted
 */
export function buildEncouragement({
  currentStreak,
  longestStreak,
  completedDays,
  todayCompleted,
}) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 7);
  cutoff.setHours(0, 0, 0, 0);

  const recent7 = completedDays.filter((key) => {
    const d = new Date(`${key}T12:00:00`);
    return d >= cutoff;
  }).length;

  if (currentStreak >= 14) {
    return {
      message: "兩星期連環開啟！你係我桌面最硬淨嘅人 💪 繼續嚇我！",
      tone: "celebrate",
    };
  }
  if (currentStreak >= 7) {
    return {
      message: "一個禮拜無走漏！下星期會唔會再升級？ 🔥",
      tone: "celebrate",
    };
  }
  if (currentStreak >= 3) {
    return {
      message: `${currentStreak} 日 streak 喎～再堅持多幾日，我請你幻想食雪糕 🍦`,
      tone: "motivate",
    };
  }
  if (currentStreak === 0 && recent7 === 0 && completedDays.length === 0) {
    return {
      message: "未開始都唔緊要～撳返去今日嘅訓練，我陪住你第一下 ✨",
      tone: "welcome",
    };
  }
  if (currentStreak === 0 && longestStreak >= 3) {
    return {
      message: "上次最長打咗好耐架喎⋯⋯今日返嚟打個卡，我唔會嬲 😤",
      tone: "gentle",
    };
  }
  if (todayCompleted) {
    return {
      message: "今日搞掂！記得拉伸，唔好成日坐喺我面前打機～",
      tone: "celebrate",
    };
  }
  return {
    message: "今日未 check off？快啲，我唔想睇住你頹 📌",
    tone: "motivate",
  };
}

/**
 * @param {import("../types/workout.ts").WeeklyWorkoutPlan} plan
 * @param {import("../types/workout.ts").WorkoutProgressState} progressState
 * @param {{ year?: number, month?: number }} [options]
 * @returns {ProgressStats}
 */
export function computeProgressStats(plan, progressState, options = {}) {
  const now = new Date();
  const year = options.year ?? now.getFullYear();
  const month = options.month ?? now.getMonth();
  const todayKey = toDayKey(now);

  const currentStreak = computeStreak(progressState.completedDays);
  const longestStreak = computeLongestStreak(progressState.completedDays);
  const calendarDays = buildCalendarMonth(progressState.completedDays, plan, year, month);
  const weeklyCompletion = computeWeeklyCompletion(progressState.completedDays, plan);
  const todayCompleted = progressState.completedDays.includes(todayKey);
  const encouragement = buildEncouragement({
    currentStreak,
    longestStreak,
    completedDays: progressState.completedDays,
    todayCompleted,
  });

  const monthStr = String(month + 1).padStart(2, "0");

  return {
    planId: progressState.planId,
    currentStreak,
    longestStreak,
    totalCompletedDays: progressState.completedDays.length,
    calendarMonth: `${year}-${monthStr}`,
    calendarDays,
    weeklyCompletion,
    encouragement,
    updatedAt: progressState.updatedAt,
  };
}

/**
 * @param {string} planId
 * @param {import("../types/workout.ts").WeeklyWorkoutPlan} plan
 * @param {{ year?: number, month?: number }} [options]
 */
export function getProgressStatsForPlan(planId, plan, options = {}) {
  const state = loadProgress(planId);
  return computeProgressStats(plan, state, options);
}
