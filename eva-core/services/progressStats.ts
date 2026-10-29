import type { WeeklyWorkoutPlan, WorkoutProgressState } from "../types/workout.ts";

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

export interface ProgressStatsOptions {
  year?: number;
  month?: number;
}

export {
  buildCalendarMonth,
  buildEncouragement,
  computeLongestStreak,
  computeProgressStats,
  computeWeeklyCompletion,
  getProgressStatsForPlan,
} from "./progressStats.js";

export type { WeeklyWorkoutPlan, WorkoutProgressState };
