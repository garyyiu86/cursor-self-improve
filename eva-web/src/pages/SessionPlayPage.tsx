import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { SessionPlayer, type SessionExercise } from "../components/SessionPlayer";
import { getTrainingPlan } from "../services/trainingService.js";
import { parseRestSeconds } from "../services/workoutStorage.js";
import { generateWeeklyPlan } from "../services/workoutPlanner.js";
import type { WorkoutDay } from "../services/workoutProgress";
import "../styles/session.css";

function buildExercises(day: WorkoutDay, muscleGroup: string): SessionExercise[] {
  return (day.exercises || []).map((ex) => ({
    id: ex.id,
    name: ex.name,
    sets: ex.sets,
    reps: ex.reps,
    restSeconds: parseRestSeconds(ex.rest),
    muscleGroup,
  }));
}

function pickDayByIndex(days: WorkoutDay[], dayIndex: number): WorkoutDay | null {
  const byIndex = days.find((d) => d.dayIndex === dayIndex);
  if (byIndex?.exercises?.length) return byIndex;
  const byPos = days[dayIndex];
  if (byPos?.exercises?.length) return byPos;
  return days.find((d) => d.exercises.length > 0) ?? null;
}

export default function SessionPlayPage() {
  const [params] = useSearchParams();
  const planId = params.get("planId");
  const dayId = params.get("dayId");
  const muscleGroup = params.get("muscleGroup") || "biceps";
  const difficulty = params.get("difficulty") || "beginner";
  const dayIndexParam = params.get("dayIndex");
  const dayIndex = dayIndexParam != null ? Number(dayIndexParam) : null;

  const [loadedPlan, setLoadedPlan] = useState<{
    title: string;
    muscleGroup: string;
    difficulty: string;
    days: WorkoutDay[];
  } | null>(null);
  const [loading, setLoading] = useState(Boolean(planId));
  const [error, setError] = useState("");

  const offlinePlan = useMemo(
    () => generateWeeklyPlan(muscleGroup, difficulty) as typeof loadedPlan,
    [muscleGroup, difficulty],
  );

  useEffect(() => {
    if (!planId) {
      setLoadedPlan(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    getTrainingPlan(planId)
      .then((data) => {
        if (cancelled) return;
        if (data?.days) {
          setLoadedPlan(data);
          setError("");
        } else {
          setLoadedPlan(null);
          setError("找不到呢個計劃");
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setLoadedPlan(null);
          setError(String(err?.message || err));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [planId]);

  const plan = loadedPlan ?? offlinePlan;
  const resolvedDay = useMemo(() => {
    if (!plan?.days?.length) return null;
    if (dayId) {
      const byId = plan.days.find((d) => d.id === dayId);
      if (byId?.exercises?.length) return byId;
    }
    if (dayIndex != null && Number.isFinite(dayIndex)) {
      return pickDayByIndex(plan.days, dayIndex);
    }
    const jsDay = new Date().getDay();
    const todayIdx = jsDay === 0 ? 6 : jsDay - 1;
    return pickDayByIndex(plan.days, todayIdx);
  }, [plan, dayId, dayIndex]);

  if (loading) {
    return (
      <div className="sess-page">
        <p className="sess-sub">載入訓練計劃中…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="sess-page">
        <Link to="/workout/plans" className="sess-back">
          ← 返回計劃
        </Link>
        <p className="sess-sub">{error}</p>
      </div>
    );
  }

  if (!resolvedDay || !resolvedDay.exercises.length) {
    return (
      <div className="sess-page">
        <Link to={planId ? `/workout/plans/${planId}` : "/workout/track"} className="sess-back">
          ← 返回計劃
        </Link>
        <h1 className="sess-title">今日休息</h1>
        <p className="sess-sub">呢日冇訓練項目，揀其他日子再試。</p>
      </div>
    );
  }

  const backTo = planId ? `/workout/plans/${planId}` : "/workout/track";

  return (
    <SessionPlayer
      dayTitle={resolvedDay.title}
      planTitle={plan?.title ?? "訓練計劃"}
      exercises={buildExercises(resolvedDay, plan?.muscleGroup ?? muscleGroup)}
      muscleGroup={plan?.muscleGroup ?? muscleGroup}
      difficulty={plan?.difficulty ?? difficulty}
      backTo={backTo}
      backLabel="← 返回計劃"
    />
  );
}
