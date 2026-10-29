/** One logged workout session. */
export interface WorkoutSession {
  date: string;
  workoutType: string;
  minutes: number;
  /** Optional perceived effort / difficulty (1 = easy … 5 = very hard). */
  difficultyRating?: number;
}

/** Post-workout debrief captured from chat or tracker follow-up. */
export interface WorkoutDebrief {
  date: string;
  /** Mon=0 … Sun=6 in the weekly plan. */
  dayIndex: number;
  hardestExercise: string;
  difficultyRating: number;
  feelNote?: string;
}

/** Coarse effort band derived from a 1–5 rating. */
export type EffortBand = "easy" | "moderate" | "hard";

/** Habit tier used to pick motivational copy. */
export type ProgressLevel = "newbie" | "steady" | "consistent" | "streaking";

export interface WeeklyConsistency {
  weekStart: string;
  weekEnd: string;
  completed: number;
  target: number;
  pct: number;
  onTrack: boolean;
}

export interface IdleGapResult {
  idle: boolean;
  daysSinceLast: number | null;
  lastSessionDate: string | null;
  thresholdDays: number;
}

const DAY_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

export function toDayKey(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function parseDayKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function daysBetween(a: string, b: string): number {
  const start = parseDayKey(a).getTime();
  const end = parseDayKey(b).getTime();
  return Math.round((end - start) / (24 * 60 * 60 * 1000));
}

function normalizeSession(raw: unknown): WorkoutSession | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const date = typeof row.date === "string" && DAY_KEY_RE.test(row.date) ? row.date : null;
  const workoutType = typeof row.workoutType === "string" ? row.workoutType.trim() : "";
  const minutes = typeof row.minutes === "number" && row.minutes >= 0 ? row.minutes : 0;
  if (!date || !workoutType) return null;
  const session: WorkoutSession = { date, workoutType, minutes };
  if (
    typeof row.difficultyRating === "number" &&
    row.difficultyRating >= 1 &&
    row.difficultyRating <= 5
  ) {
    session.difficultyRating = Math.round(row.difficultyRating);
  }
  return session;
}

export function normalizeSessions(raw: unknown): WorkoutSession[] {
  if (!Array.isArray(raw)) return [];
  const out: WorkoutSession[] = [];
  for (const item of raw) {
    const session = normalizeSession(item);
    if (session) out.push(session);
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

/** Append or replace a session for the same calendar day. */
export function recordCompletedSession(
  sessions: WorkoutSession[],
  input: {
    date?: string;
    workoutType: string;
    minutes: number;
    difficultyRating?: number;
  },
): WorkoutSession[] {
  const date = input.date ?? toDayKey();
  const next: WorkoutSession = {
    date,
    workoutType: input.workoutType.trim(),
    minutes: Math.max(0, Math.round(input.minutes)),
  };
  if (typeof input.difficultyRating === "number") {
    next.difficultyRating = Math.min(5, Math.max(1, Math.round(input.difficultyRating)));
  }
  const filtered = sessions.filter((s) => s.date !== date);
  return [...filtered, next].sort((a, b) => a.date.localeCompare(b.date));
}

/** Remove the session logged on a given day, if any. */
export function removeSessionForDay(
  sessions: WorkoutSession[],
  date: string,
): WorkoutSession[] {
  return sessions.filter((s) => s.date !== date);
}

export function hasSessionOnDay(sessions: WorkoutSession[], date: string): boolean {
  return sessions.some((s) => s.date === date);
}

export function getLastSessionDate(sessions: WorkoutSession[]): string | null {
  if (sessions.length === 0) return null;
  return sessions[sessions.length - 1].date;
}

export function getLatestSession(sessions: WorkoutSession[]): WorkoutSession | null {
  if (sessions.length === 0) return null;
  return sessions[sessions.length - 1];
}

function normalizeDebrief(raw: unknown): WorkoutDebrief | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const date = typeof row.date === "string" && DAY_KEY_RE.test(row.date) ? row.date : null;
  const dayIndex =
    typeof row.dayIndex === "number" && row.dayIndex >= 0 && row.dayIndex <= 6
      ? Math.round(row.dayIndex)
      : null;
  const hardestExercise =
    typeof row.hardestExercise === "string" ? row.hardestExercise.trim() : "";
  const difficultyRating =
    typeof row.difficultyRating === "number" &&
    row.difficultyRating >= 1 &&
    row.difficultyRating <= 5
      ? Math.round(row.difficultyRating)
      : null;
  if (!date || dayIndex == null || !hardestExercise || difficultyRating == null) return null;
  const debrief: WorkoutDebrief = { date, dayIndex, hardestExercise, difficultyRating };
  if (typeof row.feelNote === "string" && row.feelNote.trim()) {
    debrief.feelNote = row.feelNote.trim();
  }
  return debrief;
}

export function normalizeDebriefs(raw: unknown): WorkoutDebrief[] {
  if (!Array.isArray(raw)) return [];
  const out: WorkoutDebrief[] = [];
  for (const item of raw) {
    const debrief = normalizeDebrief(item);
    if (debrief) out.push(debrief);
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

/** Append a debrief entry (multiple per day allowed). */
export function recordDebriefEntry(
  debriefs: WorkoutDebrief[],
  input: {
    dayIndex: number;
    hardestExercise: string;
    difficultyRating: number;
    feelNote?: string;
    date?: string;
  },
): WorkoutDebrief[] {
  const date = input.date ?? toDayKey();
  const next: WorkoutDebrief = {
    date,
    dayIndex: Math.min(6, Math.max(0, Math.round(input.dayIndex))),
    hardestExercise: input.hardestExercise.trim(),
    difficultyRating: Math.min(5, Math.max(1, Math.round(input.difficultyRating))),
  };
  if (input.feelNote?.trim()) {
    next.feelNote = input.feelNote.trim();
  }
  return [...debriefs, next].sort((a, b) => a.date.localeCompare(b.date));
}

export function getLatestDebrief(debriefs: WorkoutDebrief[]): WorkoutDebrief | null {
  if (debriefs.length === 0) return null;
  return debriefs[debriefs.length - 1];
}

/** Map a 1–5 effort rating to a coarse band; null when unrated. */
export function getEffortBand(rating?: number): EffortBand | null {
  if (rating == null || rating < 1 || rating > 5) return null;
  if (rating <= 2) return "easy";
  if (rating >= 4) return "hard";
  return "moderate";
}

/** Short zh-HK label for session list tinting. */
export function getEffortLabel(rating?: number): string {
  const band = getEffortBand(rating);
  if (band === "easy") return "輕鬆";
  if (band === "hard") return "吃力";
  if (band === "moderate") return "適中";
  return "未評";
}

/**
 * Derive a habit tier from streak, weekly attainment, and session history.
 * Used to pick Eva motivational copy.
 */
export function deriveProgressLevel(
  sessions: WorkoutSession[],
  streak: number,
  weekly: WeeklyConsistency,
): ProgressLevel {
  if (streak >= 5) return "streaking";
  if (weekly.onTrack || streak >= 3) return "consistent";
  if (sessions.length >= 3) return "steady";
  return "newbie";
}

/** Level-aware motivational line for the tracker UI. */
export function getMotivationalCopy(
  level: ProgressLevel,
  streak: number,
  weekly: WeeklyConsistency,
  totalSessions = 0,
): string {
  switch (level) {
    case "streaking":
      return streak >= 7
        ? `🔥 ${streak} 日連續！你而家真係開竅咗～`
        : `連續 ${streak} 日，節奏好靚，保持就得！`;
    case "consistent":
      return weekly.onTrack
        ? `本周 ${weekly.completed}/${weekly.target} 次達標，繼續穩住～`
        : `已連續 ${streak} 日，再堅持多一日就更好！`;
    case "steady":
      return `已記 ${totalSessions} 次，慢慢砌習慣就得～`;
    default:
      return "第一次打卡？打勾記低，我幫你計 streak～";
  }
}

/** Consecutive-day streak ending today or yesterday. */
export function computeWorkoutStreak(
  sessions: WorkoutSession[],
  referenceDate: Date = new Date(),
): number {
  const dayKeys = new Set(sessions.map((s) => s.date));
  if (dayKeys.size === 0) return 0;

  const todayKey = toDayKey(referenceDate);
  const yesterday = new Date(referenceDate);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = toDayKey(yesterday);

  if (!dayKeys.has(todayKey) && !dayKeys.has(yesterdayKey)) return 0;

  let streak = 0;
  let cursor = dayKeys.has(todayKey) ? referenceDate : yesterday;

  while (dayKeys.has(toDayKey(cursor))) {
    streak += 1;
    cursor = new Date(cursor);
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}

function startOfWeek(date: Date): Date {
  const d = new Date(date);
  const jsDay = d.getDay();
  const offset = jsDay === 0 ? 6 : jsDay - 1;
  d.setDate(d.getDate() - offset);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfWeek(weekStart: Date): Date {
  const d = new Date(weekStart);
  d.setDate(d.getDate() + 6);
  return d;
}

/** Sessions logged in the ISO week containing referenceDate. */
export function computeWeeklyConsistency(
  sessions: WorkoutSession[],
  weeklyTarget: number,
  referenceDate: Date = new Date(),
): WeeklyConsistency {
  const weekStartDate = startOfWeek(referenceDate);
  const weekEndDate = endOfWeek(weekStartDate);
  const weekStart = toDayKey(weekStartDate);
  const weekEnd = toDayKey(weekEndDate);

  const completed = sessions.filter(
    (s) => s.date >= weekStart && s.date <= weekEnd,
  ).length;

  const target = Math.max(1, weeklyTarget);
  const pct = Math.min(100, Math.round((completed / target) * 100));

  return {
    weekStart,
    weekEnd,
    completed,
    target,
    pct,
    onTrack: completed >= target,
  };
}

/** Flag when no session has been logged for more than thresholdDays. */
export function detectIdleGap(
  sessions: WorkoutSession[],
  thresholdDays = 3,
  referenceDate: Date = new Date(),
): IdleGapResult {
  const lastSessionDate = getLastSessionDate(sessions);
  if (!lastSessionDate) {
    return {
      idle: false,
      daysSinceLast: null,
      lastSessionDate: null,
      thresholdDays,
    };
  }

  const todayKey = toDayKey(referenceDate);
  const daysSinceLast = daysBetween(lastSessionDate, todayKey);

  return {
    idle: daysSinceLast > thresholdDays,
    daysSinceLast,
    lastSessionDate,
    thresholdDays,
  };
}

export function formatSessionDate(
  dateKey: string,
  locale = "zh-HK",
): string {
  try {
    return parseDayKey(dateKey).toLocaleDateString(locale, {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  } catch {
    return dateKey;
  }
}
