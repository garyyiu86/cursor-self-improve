/** Exercise row inside a saved training plan day. */
export interface SavedPlanExercise {
  id: string;
  name: string;
  sets: number;
  reps: string;
  rest: string;
  tip: string;
  idolContext?: string;
}

/** One day in a persisted weekly plan. */
export interface SavedPlanDay {
  id: string;
  dayIndex: number;
  weekday: string;
  emoji: string;
  title: string;
  duration: string;
  type: "workout" | "recovery" | "technique" | "cardio" | "free" | "rest";
  exercises: SavedPlanExercise[];
  note?: string;
}

/** Full training plan record stored on disk. */
export interface SavedTrainingPlan {
  id: string;
  createdAt: string;
  source: "planner" | "chat";
  muscleGroup: string;
  difficulty: string;
  title: string;
  subtitle: string;
  motto: string;
  days: SavedPlanDay[];
  reminders: string[];
}

/** Lightweight row for plan list views. */
export interface TrainingPlanSummary {
  id: string;
  title: string;
  muscleGroup: string;
  difficulty: string;
  createdAt: string;
  source: SavedTrainingPlan["source"];
  workoutDayCount: number;
}
