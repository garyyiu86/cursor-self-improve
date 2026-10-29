import { loadConnection } from "../settings.js";
import { generateWeeklyPlan } from "./workoutPlanner.js";
import {
  computeStreak,
  getTodayDayIndex,
  loadProgress,
  toDayKey,
  type WeeklyWorkoutPlan,
  type WorkoutProgressState,
} from "./workoutProgress";

export type CalendarDayStatus =
  | "completed"
  | "missed"
  | "future"
  | "today"
  | "rest"
  | "none";

export interface CalendarDay {
  date: string;
  dayOfMonth: number;
  status: CalendarDayStatus;
  trackable: boolean;
}

export interface WeeklyCompletion {
  weekStart: string;
  weekEnd: string;
  weekLabel: string;
  completedDays: number;
  expectedDays: number;
  pct: number;
}

export type EncouragementTone = "celebrate" | "motivate" | "gentle" | "welcome";

export interface Encouragement {
  message: string;
  tone: EncouragementTone;
}

export interface ProgressStats {
  planId: string;
  currentStreak: number;
  longestStreak: number;
  totalCompletedDays: number;
  calendarMonth: string;
  calendarDays: CalendarDay[];
  weeklyCompletion: WeeklyCompletion[];
  encouragement: Encouragement;
  updatedAt: string;
}

function apiUrl(path: string): string {
  const { baseUrl } = loadConnection();
  return `${baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
}

function computeLongestStreak(completedDays: string[]): number {
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

function getWeekStartMonday(d: Date): Date {
  const date = new Date(d);
  date.setHours(0, 0, 0, 0);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  return date;
}

function formatWeekLabel(start: Date, end: Date): string {
  const fmt = (d: Date) =>
    d.toLocaleDateString("zh-HK", { month: "numeric", day: "numeric" });
  return `${fmt(start)}–${fmt(end)}`;
}

function buildCalendarMonth(
  completedDays: string[],
  plan: WeeklyWorkoutPlan,
  year: number,
  month: number,
): CalendarDay[] {
  const completed = new Set(completedDays);
  const todayKey = toDayKey(new Date());
  const today = new Date(`${todayKey}T12:00:00`);
  const last = new Date(year, month + 1, 0);
  const days: CalendarDay[] = [];

  for (let d = 1; d <= last.getDate(); d += 1) {
    const date = new Date(year, month, d, 12, 0, 0, 0);
    const key = toDayKey(date);
    const dayIndex = getTodayDayIndex(date);
    const planDay = plan.days[dayIndex];
    const trackable = Boolean(planDay?.exercises?.length);

    let status: CalendarDayStatus = "none";

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

function computeWeeklyCompletion(
  completedDays: string[],
  plan: WeeklyWorkoutPlan,
  weeks = 4,
): WeeklyCompletion[] {
  const expectedDays = plan.days.filter((day) => day.exercises?.length > 0).length;
  const completed = new Set(completedDays);
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const results: WeeklyCompletion[] = [];

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

function buildEncouragement(input: {
  currentStreak: number;
  longestStreak: number;
  completedDays: string[];
  todayCompleted: boolean;
}): Encouragement {
  const { currentStreak, longestStreak, completedDays, todayCompleted } = input;
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

export function computeProgressStatsLocal(
  plan: WeeklyWorkoutPlan,
  progressState: WorkoutProgressState,
  options: { year?: number; month?: number } = {},
): ProgressStats {
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

export async function fetchProgressStats(
  planId = "biceps-beginner-weekly",
  muscleGroup = "biceps",
  difficulty = "beginner",
  options: { year?: number; month?: number } = {},
): Promise<ProgressStats> {
  const params = new URLSearchParams({
    planId,
    muscleGroup,
    difficulty,
  });
  if (options.year != null) params.set("year", String(options.year));
  if (options.month != null) params.set("month", String(options.month));

  try {
    const res = await fetch(apiUrl(`/api/workout/progress-stats?${params}`));
    if (res.ok) {
      return (await res.json()) as ProgressStats;
    }
  } catch {
    // offline fallback below
  }

  const plan = generateWeeklyPlan(muscleGroup, difficulty) as WeeklyWorkoutPlan;
  const state = loadProgress(planId);
  return computeProgressStatsLocal(plan, state, options);
}
