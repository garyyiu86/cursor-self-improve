export type {
  DayProgress,
  DayType,
  Difficulty,
  ExerciseProgressKey,
  MuscleGroup,
  ToggleExerciseResult,
  WeekProgress,
  WeeklyWorkoutPlan,
  WorkoutDay,
  WorkoutExercise,
  WorkoutMilestone,
  WorkoutProgressState,
} from "../types/workout.ts";

export {
  BICEPS_BEGINNER_WEEKLY,
  BICEPS_BEGINNER_WEEKLY as BICEP_CHAT_PRESET,
  generateWeeklyPlan,
  getPresetPlanIds,
} from "./workoutGenerator.js";
