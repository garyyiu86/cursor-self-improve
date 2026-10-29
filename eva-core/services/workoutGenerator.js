/** Runtime weekly plan generator — types in ../types/workout.ts */
export {
  BICEPS_BEGINNER_WEEKLY,
  BICEPS_BEGINNER_WEEKLY as BICEP_CHAT_PRESET,
  generateWeeklyPlan,
} from "./workoutPlanner.js";

export function getPresetPlanIds() {
  return ["biceps-beginner-weekly"];
}
