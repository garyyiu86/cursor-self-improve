import {
  BICEP_WEEKLY_PLAN,
  flattenRoutineDaySteps,
  getMainWorkoutDays,
  getRoutineDayForDate,
  type BicepWeeklyPlanData,
  type RoutineDay,
  type RoutineDayStep,
} from "./routines/bicep";
import {
  computeWeeklyConsistency,
  computeWorkoutStreak,
  deriveProgressLevel,
  detectIdleGap,
  getLastSessionDate,
  getLatestDebrief,
  getLatestSession,
  getMotivationalCopy,
  hasSessionOnDay,
  normalizeDebriefs,
  normalizeSessions,
  recordCompletedSession,
  recordDebriefEntry,
  removeSessionForDay,
  toDayKey,
  type IdleGapResult,
  type ProgressLevel,
  type WeeklyConsistency,
  type WorkoutDebrief,
  type WorkoutSession,
} from "./utils/progress";

export {
  BICEP_WEEKLY_PLAN,
  flattenRoutineDaySteps,
  getMainWorkoutDays,
  getRoutineDayForDate,
  type BicepWeeklyPlanData,
  type RoutineDay,
  type RoutineDayStep,
  type WorkoutSession,
  type WorkoutDebrief,
  type WeeklyConsistency,
  type IdleGapResult,
  type ProgressLevel,
};

/** Today's index in the weekly plan (Mon=0 … Sun=6). */
export function getTodayPlanIndex(date: Date = new Date()): number {
  return getRoutineDayForDate(date).dayIndex;
}

const STORAGE_KEY = "eva-workout-sessions-v1";

interface WorkoutLogSnapshot {
  sessions: WorkoutSession[];
  debriefs: WorkoutDebrief[];
}

/** localStorage-compatible session store with in-memory fallback. */
export interface SessionStore {
  getSessions(): WorkoutSession[];
  getDebriefs(): WorkoutDebrief[];
  saveSessions(sessions: WorkoutSession[]): WorkoutSession[];
  saveDebriefs(debriefs: WorkoutDebrief[]): WorkoutDebrief[];
  recordSession(input: {
    date?: string;
    workoutType: string;
    minutes: number;
    difficultyRating: number;
  }): WorkoutSession[];
  removeSession(date: string): WorkoutSession[];
  isCompleted(date?: string): boolean;
}

let memoryLog: WorkoutLogSnapshot = { sessions: [], debriefs: [] };

function hasStorage(): boolean {
  return typeof globalThis !== "undefined" && !!globalThis.localStorage;
}

function normalizeStoredLog(raw: unknown): WorkoutLogSnapshot {
  if (Array.isArray(raw)) {
    return { sessions: normalizeSessions(raw), debriefs: [] };
  }
  if (raw && typeof raw === "object") {
    const row = raw as Record<string, unknown>;
    return {
      sessions: normalizeSessions(row.sessions),
      debriefs: normalizeDebriefs(row.debriefs),
    };
  }
  return { sessions: [], debriefs: [] };
}

function readLog(): WorkoutLogSnapshot {
  if (!hasStorage()) {
    return {
      sessions: [...memoryLog.sessions],
      debriefs: [...memoryLog.debriefs],
    };
  }
  try {
    const raw = globalThis.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { sessions: [], debriefs: [] };
    return normalizeStoredLog(JSON.parse(raw));
  } catch {
    return { sessions: [], debriefs: [] };
  }
}

function writeLog(log: WorkoutLogSnapshot): WorkoutLogSnapshot {
  const normalized: WorkoutLogSnapshot = {
    sessions: normalizeSessions(log.sessions),
    debriefs: normalizeDebriefs(log.debriefs),
  };
  memoryLog = normalized;
  if (hasStorage()) {
    try {
      globalThis.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    } catch {
      // quota / private mode
    }
  }
  return normalized;
}

/** Shared store instance for browser + Node smoke tests. */
export const sessionStore: SessionStore = {
  getSessions() {
    return readLog().sessions;
  },
  getDebriefs() {
    return readLog().debriefs;
  },
  saveSessions(sessions) {
    const log = readLog();
    return writeLog({ ...log, sessions: normalizeSessions(sessions) }).sessions;
  },
  saveDebriefs(debriefs) {
    const log = readLog();
    return writeLog({ ...log, debriefs: normalizeDebriefs(debriefs) }).debriefs;
  },
  recordSession(input) {
    const log = readLog();
    const next = recordCompletedSession(log.sessions, input);
    return writeLog({ ...log, sessions: next }).sessions;
  },
  removeSession(date) {
    const log = readLog();
    const next = removeSessionForDay(log.sessions, date);
    return writeLog({ ...log, sessions: next }).sessions;
  },
  isCompleted(date = toDayKey()) {
    return hasSessionOnDay(readLog().sessions, date);
  },
};

export interface ProgressOverview {
  streak: number;
  lastSessionDate: string | null;
  weekly: WeeklyConsistency;
  idle: IdleGapResult;
  sessions: WorkoutSession[];
}

export function getProgressOverview(
  plan: BicepWeeklyPlanData = BICEP_WEEKLY_PLAN,
  referenceDate: Date = new Date(),
): ProgressOverview {
  const sessions = sessionStore.getSessions();
  return {
    streak: computeWorkoutStreak(sessions, referenceDate),
    lastSessionDate: getLastSessionDate(sessions),
    weekly: computeWeeklyConsistency(sessions, plan.weeklyTarget, referenceDate),
    idle: detectIdleGap(sessions, 3, referenceDate),
    sessions,
  };
}

/** Combined snapshot for UI: latest session, streak, week attainment, idle status. */
export interface ProgressSummary {
  latestSession: WorkoutSession | null;
  latestDebrief: WorkoutDebrief | null;
  streak: number;
  weekly: WeeklyConsistency;
  idle: IdleGapResult;
  level: ProgressLevel;
  motivationalCopy: string;
}

export function getProgressSummary(
  plan: BicepWeeklyPlanData = BICEP_WEEKLY_PLAN,
  referenceDate: Date = new Date(),
): ProgressSummary {
  const sessions = sessionStore.getSessions();
  const debriefs = sessionStore.getDebriefs();
  const streak = computeWorkoutStreak(sessions, referenceDate);
  const weekly = computeWeeklyConsistency(sessions, plan.weeklyTarget, referenceDate);
  const idle = detectIdleGap(sessions, 3, referenceDate);
  const level = deriveProgressLevel(sessions, streak, weekly);

  return {
    latestSession: getLatestSession(sessions),
    latestDebrief: getLatestDebrief(debriefs),
    streak,
    weekly,
    idle,
    level,
    motivationalCopy: getMotivationalCopy(level, streak, weekly, sessions.length),
  };
}

/**
 * Persist a post-workout debrief from chat follow-up and return the updated summary.
 */
export function recordDebrief(
  dayIndex: number,
  hardestExercise: string,
  difficultyRating: number,
  feelNote?: string,
  referenceDate: Date = new Date(),
): ProgressSummary {
  const log = readLog();
  const nextDebriefs = recordDebriefEntry(log.debriefs, {
    dayIndex,
    hardestExercise,
    difficultyRating,
    feelNote,
    date: toDayKey(referenceDate),
  });
  writeLog({ ...log, debriefs: nextDebriefs });
  return getProgressSummary(BICEP_WEEKLY_PLAN, referenceDate);
}

export type AdaptiveTipKind = "recovery" | "intensity" | "general";

export interface AdaptiveTip {
  message: string;
  kind: AdaptiveTipKind;
}

const RECENT_EFFORT_WINDOW = 5;
const HARD_EFFORT_THRESHOLD = 4;
const EASY_EFFORT_THRESHOLD = 2;

/**
 * Suggest recovery or progression based on recent effort ratings.
 * Consistently hard → rest; consistently easy → increase reps.
 */
export function getAdaptiveWorkoutTip(
  sessions: WorkoutSession[] = sessionStore.getSessions(),
): AdaptiveTip {
  const rated = sessions
    .filter((s) => typeof s.difficultyRating === "number")
    .slice(-RECENT_EFFORT_WINDOW);

  if (rated.length === 0) {
    return {
      kind: "general",
      message: "記低難度之後，我可以幫你調整訓練建議～",
    };
  }

  const hardCount = rated.filter((s) => (s.difficultyRating ?? 0) >= HARD_EFFORT_THRESHOLD).length;
  const easyCount = rated.filter((s) => (s.difficultyRating ?? 5) <= EASY_EFFORT_THRESHOLD).length;
  const majority = Math.ceil(rated.length / 2);

  if (hardCount >= majority) {
    return {
      kind: "recovery",
      message: "最近幾次都偏吃力——今日可以減少組數，或者加長休息，讓肌肉回復先 💤",
    };
  }

  if (easyCount >= majority) {
    return {
      kind: "intensity",
      message: "最近覺得輕鬆？試下每組加 2 下 rep，或者加多一組，慢慢推上去～",
    };
  }

  return {
    kind: "general",
    message: "難度適中，保持而家節奏就得，唔使一次逼太盡 ✨",
  };
}

export interface CatchUpSuggestion {
  message: string;
  suggestedDay: RoutineDay | null;
  todayKey: string;
  todayDone: boolean;
}

/** Suggest the next missed main session relative to today. */
export function getCatchUpSuggestion(
  plan: BicepWeeklyPlanData = BICEP_WEEKLY_PLAN,
  referenceDate: Date = new Date(),
): CatchUpSuggestion {
  const todayKey = toDayKey(referenceDate);
  const todayDay = getRoutineDayForDate(referenceDate, plan);
  const sessions = sessionStore.getSessions();
  const todayDone = hasSessionOnDay(sessions, todayKey);
  const weekly = computeWeeklyConsistency(sessions, plan.weeklyTarget, referenceDate);
  const idle = detectIdleGap(sessions, 3, referenceDate);

  if (todayDone) {
    return {
      message: `${formatTodayLabel(referenceDate)} 已打卡 ✓ 本周 ${weekly.completed}/${weekly.target} 次，保持節奏就得～`,
      suggestedDay: todayDay,
      todayKey,
      todayDone: true,
    };
  }

  const mainDays = getMainWorkoutDays(plan);
  const weekStart = weekly.weekStart;
  const weekEnd = weekly.weekEnd;

  const missedMain = mainDays.filter((day) => {
    const dayDate = dateForDayIndex(day.dayIndex, referenceDate);
    const key = toDayKey(dayDate);
    if (key > todayKey) return false;
    if (key < weekStart || key > weekEnd) return false;
    return !hasSessionOnDay(sessions, key);
  });

  const suggestedDay = missedMain[0] ?? todayDay;

  if (idle.idle && idle.daysSinceLast != null) {
    return {
      message: `距離上次訓練已 ${idle.daysSinceLast} 日（${todayKey}）——今日補做「${suggestedDay.title}」就得，唔使一次追晒 💪`,
      suggestedDay,
      todayKey,
      todayDone: false,
    };
  }

  if (!weekly.onTrack) {
    const remaining = weekly.target - weekly.completed;
    return {
      message: `${formatTodayLabel(referenceDate)} 本周仲差 ${remaining} 次（${weekly.completed}/${weekly.target}）——建議跟「${suggestedDay.title}」`,
      suggestedDay,
      todayKey,
      todayDone: false,
    };
  }

  return {
    message: `${formatTodayLabel(referenceDate)} 今日計劃：${todayDay.title}（${todayDay.duration}）`,
    suggestedDay: todayDay,
    todayKey,
    todayDone: false,
  };
}

function formatTodayLabel(date: Date): string {
  return date.toLocaleDateString("zh-HK", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function dateForDayIndex(dayIndex: number, referenceDate: Date): Date {
  const todayIndex = getRoutineDayForDate(referenceDate).dayIndex;
  const delta = dayIndex - todayIndex;
  const d = new Date(referenceDate);
  d.setDate(d.getDate() + delta);
  return d;
}

/** Record today's session using the scheduled day title as workout type. */
export function markTodayComplete(
  options: {
    minutes?: number;
    difficultyRating?: number;
    workoutType?: string;
    date?: Date;
  } = {},
): WorkoutSession[] {
  const date = options.date ?? new Date();
  const day = getRoutineDayForDate(date);
  return sessionStore.recordSession({
    date: toDayKey(date),
    workoutType: options.workoutType ?? day.title,
    minutes: options.minutes ?? parseDurationMinutes(day.duration),
    difficultyRating: options.difficultyRating ?? 3,
  });
}

export function unmarkToday(date: Date = new Date()): WorkoutSession[] {
  return sessionStore.removeSession(toDayKey(date));
}

function parseDurationMinutes(duration: string): number {
  const match = duration.match(/(\d+)\s*min/i);
  return match ? Number(match[1]) : 20;
}

/** Build a minimal HTML snippet for the weekly plan (chat / embed). */
export function renderPlanHtml(plan: BicepWeeklyPlanData = BICEP_WEEKLY_PLAN): string {
  const dayRows = plan.days
    .map(
      (day) => `<tr>
  <td>${day.emoji} 週${day.weekday}</td>
  <td>${escapeHtml(day.title)}</td>
  <td>${escapeHtml(day.duration)}</td>
</tr>`,
    )
    .join("\n");

  const exerciseSections = plan.days
    .filter((d) => d.exercises.length > 0)
    .map((day) => {
      const rows = day.exercises
        .map(
          (ex) =>
            `<li><strong>${escapeHtml(ex.name)}</strong> — ${ex.sets}×${escapeHtml(ex.reps)}，休息 ${escapeHtml(ex.rest)}</li>`,
        )
        .join("\n");
      return `<section><h3>${day.emoji} 週${day.weekday} · ${escapeHtml(day.title)}</h3><ul>${rows}</ul></section>`;
    })
    .join("\n");

  return `<article class="eva-bicep-plan">
<h2>${escapeHtml(plan.title)}</h2>
<p>${escapeHtml(plan.subtitle)}</p>
<table><thead><tr><th>日</th><th>內容</th><th>時間</th></tr></thead><tbody>
${dayRows}
</tbody></table>
${exerciseSections}
</article>`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
