import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { WorkoutPlanView } from "./WorkoutPlanView";
import type { WeeklyWorkoutPlan } from "../services/workoutProgress";
import { generateWeeklyPlan } from "../services/workoutPlanner.js";
import { loadConnection } from "../settings.js";

function apiUrl(path: string): string {
  const { baseUrl } = loadConnection();
  return `${baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
}

/** Compact bicep preset embed below chat on the home route. */
export function WorkoutPlanEmbed() {
  const [plan, setPlan] = useState<WeeklyWorkoutPlan | null>(() =>
    generateWeeklyPlan("biceps", "beginner") as WeeklyWorkoutPlan,
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          apiUrl("/api/workout/plan?muscleGroup=biceps&difficulty=beginner"),
        );
        if (!res.ok) return;
        const data = (await res.json()) as WeeklyWorkoutPlan;
        if (!cancelled) setPlan(data);
      } catch {
        // keep bundled bicep preset
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!plan) return null;

  return (
    <>
      <WorkoutPlanView plan={plan} compact />
      <div className="wk-plan-footer">
        <Link to="/workout/track" className="wk-plan-link">
          查看完整訓練計劃 →
        </Link>
      </div>
    </>
  );
}
