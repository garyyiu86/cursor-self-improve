/** Client-side workout progress — mirrors eva-core/services/workoutTracker.ts */

export interface WorkoutExercise {
  id: string;
  name: string;
  sets: number;
  reps: string;
  rest: string;
  tip?: string;
  idolContext?: string;
}

export interface WorkoutDay {
  id: string;
  dayIndex: number;
  weekday: string;
  emoji: string;
  title: string;
  duration: string;
  type: string;
  exercises: WorkoutExercise[];
  note?: string;
}

export interface WeeklyWorkoutPlan {
  id: string;
  muscleGroup: string;
  difficulty: string;
  title: string;
  subtitle: string;
  motto: string;
  days: WorkoutDay[];
  reminders: string[];
}

export interface WorkoutProgressState {
  planId: string;
  completedExercises: string[];
  completedDays: string[];
  celebratedMilestones: number[];
  updatedAt: string;
}

export interface DayProgress {
  done: number;
  total: number;
  pct: number;
  complete: boolean;
  trackable: boolean;
}

const STORAGE_KEY = "eva-workout-plan-progress-v1";
export const WORKOUT_MILESTONES = [3, 7, 14, 30] as const;

function hasStorage(): boolean {
  return typeof globalThis !== "undefined" && !!globalThis.localStorage;
}

export function exerciseProgressKey(dayId: string, exerciseId: string): string {
  return `${dayId}:${exerciseId}`;
}

export function toDayKey(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function readAll(): Record<string, WorkoutProgressState> {
  if (!hasStorage()) return {};
  try {
    const raw = globalThis.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function writeAll(all: Record<string, WorkoutProgressState>): void {
  if (!hasStorage()) return;
  try {
    globalThis.localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {
    // quota / private mode
  }
}

export function emptyProgress(planId: string): WorkoutProgressState {
  return {
    planId,
    completedExercises: [],
    completedDays: [],
    celebratedMilestones: [],
    updatedAt: new Date().toISOString(),
  };
}

export function loadProgress(planId: string): WorkoutProgressState {
  const all = readAll();
  return all[planId] ? structuredClone(all[planId]) : emptyProgress(planId);
}

export function saveProgress(state: WorkoutProgressState): WorkoutProgressState {
  const all = readAll();
  const next = { ...state, updatedAt: new Date().toISOString() };
  all[state.planId] = next;
  writeAll(all);
  return next;
}

export function isExerciseDone(
  dayId: string,
  exerciseId: string,
  state: WorkoutProgressState,
): boolean {
  return state.completedExercises.includes(exerciseProgressKey(dayId, exerciseId));
}

export function computeDayProgress(day: WorkoutDay, state: WorkoutProgressState): DayProgress {
  const exercises = day.exercises || [];
  if (exercises.length === 0) {
    return { done: 0, total: 0, pct: 0, complete: false, trackable: false };
  }
  const total = exercises.length;
  let done = 0;
  for (const ex of exercises) {
    if (isExerciseDone(day.id, ex.id, state)) done += 1;
  }
  const pct = total ? Math.round((done / total) * 100) : 0;
  return { done, total, pct, complete: total > 0 && done === total, trackable: true };
}

export function computeWeekProgress(
  plan: WeeklyWorkoutPlan,
  state: WorkoutProgressState,
): DayProgress {
  let done = 0;
  let total = 0;
  for (const day of plan.days) {
    const prog = computeDayProgress(day, state);
    if (!prog.trackable) continue;
    done += prog.done;
    total += prog.total;
  }
  const pct = total ? Math.round((done / total) * 100) : 0;
  return { done, total, pct, complete: total > 0 && done === total, trackable: total > 0 };
}

export function computeStreak(completedDays: string[]): number {
  if (completedDays.length === 0) return 0;
  const dayKeys = new Set(completedDays);
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

function detectMilestone(streak: number, celebrated: number[]): number | null {
  for (const m of WORKOUT_MILESTONES) {
    if (streak === m && !celebrated.includes(m)) return m;
  }
  return null;
}

function maybeLogCompletedDay(
  day: WorkoutDay,
  state: WorkoutProgressState,
  date: Date = new Date(),
): WorkoutProgressState {
  const prog = computeDayProgress(day, state);
  if (!prog.complete) return state;
  const key = toDayKey(date);
  if (state.completedDays.includes(key)) return state;
  return { ...state, completedDays: [...state.completedDays, key].sort() };
}

export function toggleExercise(
  plan: WeeklyWorkoutPlan,
  dayId: string,
  exerciseId: string,
  done: boolean,
  state: WorkoutProgressState,
  date: Date = new Date(),
): {
  state: WorkoutProgressState;
  dayProgress: DayProgress;
  streak: number;
  milestone: number | null;
} {
  const key = exerciseProgressKey(dayId, exerciseId);
  let completed = [...state.completedExercises];
  const has = completed.includes(key);
  if (done && !has) completed.push(key);
  else if (!done && has) completed = completed.filter((k) => k !== key);

  let next: WorkoutProgressState = { ...state, planId: plan.id, completedExercises: completed };
  const day = plan.days.find((d) => d.id === dayId);
  if (day) {
    next = maybeLogCompletedDay(day, next, date);
    if (!computeDayProgress(day, next).complete) {
      const dayKey = toDayKey(date);
      next = { ...next, completedDays: next.completedDays.filter((d) => d !== dayKey) };
    }
  }

  const streak = computeStreak(next.completedDays);
  let milestone: number | null = null;
  if (done) {
    milestone = detectMilestone(streak, next.celebratedMilestones);
    if (milestone != null) {
      next = { ...next, celebratedMilestones: [...next.celebratedMilestones, milestone] };
    }
  }

  const saved = saveProgress(next);
  const dayProgress = day
    ? computeDayProgress(day, saved)
    : { done: 0, total: 0, pct: 0, complete: false, trackable: false };

  return { state: saved, dayProgress, streak, milestone };
}

export function resetProgress(planId: string): WorkoutProgressState {
  return saveProgress(emptyProgress(planId));
}

export function getTodayDayIndex(date: Date = new Date()): number {
  const jsDay = date.getDay();
  return jsDay === 0 ? 6 : jsDay - 1;
}

export function getEncouragementForMilestone(milestone: number): string {
  switch (milestone) {
    case 3:
      return "三連擊！我見到你開始有恒心了～繼續落去呀 ✨";
    case 7:
      return "一個禮拜喇！堅持落去，你會見到自己嘅改變 🔥";
    case 14:
      return "兩星期打卡！你而家係我心目中嘅健身同學仔 💪";
    case 30:
      return "三十日！嚴重懷疑你偷偷變強了，我要監視你 😤";
    default:
      return "做得好！我陪住你繼續衝 💕";
  }
}
