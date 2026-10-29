import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ExerciseDetailModal } from "../components/ExerciseDetailModal";
import { ExerciseLibraryGrid } from "../components/ExerciseLibraryGrid";
import { MuscleFilterBar } from "../components/MuscleFilterBar";
import {
  findExercisePlanDays,
  getPlanExercises,
  type LibraryExercise,
  type MuscleFilter,
} from "../../../eva-core/data/exerciseLibrary";
import type { WeeklyWorkoutPlan } from "../services/workoutProgress";
import { generateWeeklyPlan } from "../services/workoutPlanner.js";
import { loadConnection } from "../settings.js";
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

export default function LibraryPage() {
  const [plan, setPlan] = useState<WeeklyWorkoutPlan | null>(() =>
    generateWeeklyPlan("biceps", "beginner") as WeeklyWorkoutPlan,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<MuscleFilter>("all");
  const [selected, setSelected] = useState<LibraryExercise | null>(null);

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

  const planExercises = useMemo(
    () => (plan ? getPlanExercises(plan) : []),
    [plan],
  );

  const filtered = useMemo(() => {
    if (filter === "all") return planExercises;
    return planExercises.filter((e) => e.muscleGroup === filter);
  }, [planExercises, filter]);

  const planDays = useMemo(() => {
    if (!selected || !plan) return [];
    return findExercisePlanDays(plan, selected.id);
  }, [selected, plan]);

  return (
    <div className="lib-page">
      <header className="lib-page-head">
        <Link to="/" className="lib-page-back">
          ← 返回
        </Link>
        <h1 className="lib-page-title">動作庫 · Form Guide</h1>
      </header>

      <nav className="lib-track-nav" aria-label="訓練追蹤導航">
        <Link to="/workout/track" className="lib-track-nav-link">
          訓練計劃
        </Link>
        <Link to="/workout/track/dashboard" className="lib-track-nav-link">
          進度儀表板
        </Link>
        <Link
          to="/workout/track/library"
          className="lib-track-nav-link lib-track-nav-link--active"
          aria-current="page"
        >
          動作庫
        </Link>
      </nav>

      <p className="lib-page-intro">
        本週計劃所有動作 · Eva 動作要點同偶像小貼士
        {planExercises.length > 0 ? (
          <span className="lib-page-count">（{planExercises.length} 項）</span>
        ) : null}
      </p>

      {loading ? (
        <p className="lib-page-status">載入動作庫中…</p>
      ) : (
        <>
          {error ? <p className="lib-page-notice">{error}</p> : null}
          <MuscleFilterBar value={filter} onChange={setFilter} />
          <ExerciseLibraryGrid
            exercises={filtered}
            onSelect={setSelected}
          />
        </>
      )}

      {selected ? (
        <ExerciseDetailModal
          exercise={selected}
          planDays={planDays}
          onClose={() => setSelected(null)}
        />
      ) : null}
    </div>
  );
}
