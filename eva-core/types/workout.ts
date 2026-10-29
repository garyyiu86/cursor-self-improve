/** Muscle groups supported by the exercise library. */
export type MuscleGroup =
  | "biceps"
  | "triceps"
  | "chest"
  | "back"
  | "shoulders"
  | "legs"
  | "core";

export type Difficulty = "beginner" | "intermediate" | "advanced";

export type DayType =
  | "workout"
  | "recovery"
  | "technique"
  | "cardio"
  | "free"
  | "rest";

/** One row in the exercise library / weekly plan. */
export interface WorkoutExercise {
  id: string;
  name: string;
  sets: number;
  reps: string;
  rest: string;
  tip?: string;
  idolContext?: string;
  muscleGroup?: MuscleGroup;
  equipment?: string;
}

/** A single day inside a weekly workout plan. */
export interface WorkoutDay {
  id: string;
  dayIndex: number;
  weekday: string;
  emoji: string;
  title: string;
  duration: string;
  type: DayType;
  exercises: WorkoutExercise[];
  note?: string;
}

/** Full 7-day weekly workout plan. */
export interface WeeklyWorkoutPlan {
  id: string;
  muscleGroup: MuscleGroup | string;
  difficulty: Difficulty | string;
  title: string;
  subtitle: string;
  motto: string;
  days: WorkoutDay[];
  reminders: string[];
}

/** Stable key for one completed exercise: `${dayId}:${exerciseId}` */
export type ExerciseProgressKey = string;

/** Persisted workout progress for a plan. */
export interface WorkoutProgressState {
  planId: string;
  /** Checked exercise keys */
  completedExercises: ExerciseProgressKey[];
  /** ISO day keys (YYYY-MM-DD) when all trackable exercises were finished */
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

export interface WeekProgress extends DayProgress {}

export interface ToggleExerciseResult {
  done: boolean;
  dayProgress: DayProgress;
  streak: number;
  milestone: number | null;
}

export const WORKOUT_MILESTONES = [3, 7, 14, 30] as const;
export type WorkoutMilestone = (typeof WORKOUT_MILESTONES)[number];
