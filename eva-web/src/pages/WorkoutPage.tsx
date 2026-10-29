import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { WorkoutPlanView } from "../components/WorkoutPlanView";
import type { WeeklyWorkoutPlan } from "../services/workoutProgress";
import { generateWeeklyPlan } from "../services/workoutPlanner.js";
import { loadConnection } from "../settings.js";
import "../styles/workout.css";
import "../styles/library.css";

function apiUrl(path: string): string {
  const { baseUrl } = loadConnection();
  return `${baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
}

async function fetchWeeklyPlan(
  muscleGroup = "biceps",
  difficulty = "beginner",
): Promise<WeeklyWorkoutPlan> {
  const res = await fetch(
    apiUrl(
      `/api/workout/plan?muscleGroup=${encodeURIComponent(muscleGroup)}&difficulty=${encodeURIComponent(difficulty)}`,
    ),
  );
  if (!res.ok) {
    throw new Error(`Failed to load plan (${res.status})`);
  }
  return res.json() as Promise<WeeklyWorkoutPlan>;
}

export default function WorkoutPage() {
  const [plan, setPlan] = useState<WeeklyWorkoutPlan | null>(() =>
    generateWeeklyPlan("biceps", "beginner") as WeeklyWorkoutPlan,
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchWeeklyPlan("biceps", "beginner");
        if (!cancelled) setPlan(data);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "無法連線，已載入離線預設計劃",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="wk-page">
      <header className="wk-page-head">
        <Link to="/" className="wk-page-back">
          ← 返回
        </Link>
        <h1 className="wk-page-title">訓練計劃追蹤</h1>
      </header>

      <nav className="lib-track-nav" aria-label="訓練追蹤導航">
        <Link
          to="/workout/track"
          className="lib-track-nav-link lib-track-nav-link--active"
          aria-current="page"
        >
          訓練計劃
        </Link>
        <Link to="/workout/track/dashboard" className="lib-track-nav-link">
          進度儀表板
        </Link>
        <Link to="/workout/track/library" className="lib-track-nav-link">
          動作庫
        </Link>
      </nav>

      {loading ? (
        <p className="wk-page-status">載入訓練計劃中…</p>
      ) : plan ? (
        <>
          {error ? <p className="wk-page-notice">{error}</p> : null}
          {plan.reminders?.length ? (
            <ul className="wk-reminders" aria-label="訓練提醒">
              {plan.reminders.map((tip) => (
                <li key={tip}>{tip}</li>
              ))}
            </ul>
          ) : null}
          <WorkoutPlanView plan={plan} />
        </>
      ) : (
        <p className="wk-page-status">無法載入訓練計劃</p>
      )}
    </div>
  );
}
