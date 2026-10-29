const STORAGE_KEY = "eva-workout-streak-v1";

export const WORKOUT_MILESTONES = [3, 7, 14, 30] as const;

export type WorkoutMilestone = (typeof WORKOUT_MILESTONES)[number];

export interface WorkoutStreakData {
  completedDays: string[];
  celebratedMilestones: number[];
}

export interface ToggleResult {
  completed: boolean;
  streak: number;
  milestone: WorkoutMilestone | null;
}

function hasStorage(): boolean {
  return typeof globalThis !== "undefined" && !!globalThis.localStorage;
}

export function toDayKey(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function loadData(): WorkoutStreakData {
  if (!hasStorage()) {
    return { completedDays: [], celebratedMilestones: [] };
  }
  try {
    const raw = globalThis.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (!parsed || typeof parsed !== "object") {
      return { completedDays: [], celebratedMilestones: [] };
    }
    const completedDays = Array.isArray(parsed.completedDays)
      ? parsed.completedDays.filter((d: unknown) => typeof d === "string")
      : [];
    const celebratedMilestones = Array.isArray(parsed.celebratedMilestones)
      ? parsed.celebratedMilestones.filter((n: unknown) => typeof n === "number")
      : [];
    return { completedDays, celebratedMilestones };
  } catch {
    return { completedDays: [], celebratedMilestones: [] };
  }
}

function saveData(data: WorkoutStreakData): void {
  if (!hasStorage()) return;
  try {
    globalThis.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // private mode / quota
  }
}

export function getCompletedDays(): string[] {
  return [...loadData().completedDays].sort();
}

export function isWorkoutCompleted(date: Date = new Date()): boolean {
  const key = toDayKey(date);
  return loadData().completedDays.includes(key);
}

export function computeWorkoutStreak(completedDays: string[] = getCompletedDays()): number {
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

export function getEncouragementForMilestone(milestone: WorkoutMilestone): string {
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

function detectMilestone(
  streak: number,
  celebrated: number[],
): WorkoutMilestone | null {
  for (const m of WORKOUT_MILESTONES) {
    if (streak === m && !celebrated.includes(m)) return m;
  }
  return null;
}

export function setWorkoutCompleted(
  completed: boolean,
  date: Date = new Date(),
): ToggleResult {
  const data = loadData();
  const key = toDayKey(date);
  const hasDay = data.completedDays.includes(key);

  if (completed && !hasDay) {
    data.completedDays.push(key);
  } else if (!completed && hasDay) {
    data.completedDays = data.completedDays.filter((d) => d !== key);
  }

  data.completedDays.sort();
  const streak = computeWorkoutStreak(data.completedDays);
  let milestone: WorkoutMilestone | null = null;

  if (completed) {
    milestone = detectMilestone(streak, data.celebratedMilestones);
    if (milestone != null) {
      data.celebratedMilestones = [...data.celebratedMilestones, milestone];
    }
  }

  saveData(data);

  return { completed: data.completedDays.includes(key), streak, milestone };
}

export function toggleWorkoutCompleted(date: Date = new Date()): ToggleResult {
  const next = !isWorkoutCompleted(date);
  return setWorkoutCompleted(next, date);
}

/** Log a completed workout for the given day (streak tracker). */
export function logWorkout(date: Date = new Date()): ToggleResult {
  return setWorkoutCompleted(true, date);
}

export function formatWorkoutDate(date: Date = new Date()): string {
  return date.toLocaleDateString("zh-HK", {
    weekday: "short",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}
