import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  CompletionCard,
  ExerciseDetailModal,
  RestCoachBanner,
} from "../components/EvaCoachOverlay.jsx";
import { getExerciseById } from "../services/exerciseLibrary.js";
import { generateWeeklyPlan } from "../services/workoutPlanner.js";
import {
  createSessionId,
  formatDuration,
  parseRestSeconds,
  saveSession,
} from "../services/workoutStorage.js";
import "../styles/workout-session.css";

function pickWorkoutDay(plan) {
  const jsDay = new Date().getDay();
  const planIndex = jsDay === 0 ? 6 : jsDay - 1;
  const today = plan.days[planIndex];
  if (today?.exercises?.length) return today;

  return (
    plan.days.find(
      (d) =>
        d.exercises.length > 0 &&
        (d.type === "workout" || d.type === "cardio" || d.type === "technique"),
    ) || plan.days.find((d) => d.exercises.length > 0)
  );
}

function buildSessionExercises(day) {
  return day.exercises.map((ex) => {
    const lib = getExerciseById(ex.id);
    return {
      exerciseId: ex.id,
      name: ex.name,
      muscleGroup: lib?.muscleGroup || "biceps",
      targetSets: ex.sets,
      targetReps: ex.reps,
      restSeconds: parseRestSeconds(ex.rest),
      sets: [],
    };
  });
}

export default function WorkoutSession() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const muscleGroup = params.get("muscleGroup") || "biceps";
  const difficulty = params.get("difficulty") || "beginner";

  const plan = useMemo(
    () => generateWeeklyPlan(muscleGroup, difficulty),
    [muscleGroup, difficulty],
  );
  const workoutDay = useMemo(() => pickWorkoutDay(plan), [plan]);

  const sessionIdRef = useRef(createSessionId());
  const startedAtRef = useRef(new Date().toISOString());

  const [exercises, setExercises] = useState(() =>
    workoutDay ? buildSessionExercises(workoutDay) : [],
  );
  const [activeExIdx, setActiveExIdx] = useState(0);
  const [repsInput, setRepsInput] = useState("");
  const [weightInput, setWeightInput] = useState("");

  const [elapsedMs, setElapsedMs] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const timerStartRef = useRef(null);
  const timerAccumRef = useRef(0);

  const [restRemaining, setRestRemaining] = useState(0);
  const [isResting, setIsResting] = useState(false);
  const [restCycle, setRestCycle] = useState(-1);
  const restEndRef = useRef(null);

  const [modalExercise, setModalExercise] = useState(null);
  const [completionSummary, setCompletionSummary] = useState(null);

  const activeEx = exercises[activeExIdx];

  const tickTimer = useCallback(() => {
    if (timerStartRef.current != null) {
      setElapsedMs(timerAccumRef.current + (Date.now() - timerStartRef.current));
    }
  }, []);

  useEffect(() => {
    if (!timerRunning) return undefined;
    const id = setInterval(tickTimer, 250);
    return () => clearInterval(id);
  }, [timerRunning, tickTimer]);

  useEffect(() => {
    if (!isResting) return undefined;
    const id = setInterval(() => {
      if (restEndRef.current == null) return;
      const left = Math.max(0, Math.ceil((restEndRef.current - Date.now()) / 1000));
      setRestRemaining(left);
      if (left <= 0) {
        restEndRef.current = null;
        setIsResting(false);
      }
    }, 250);
    return () => clearInterval(id);
  }, [isResting]);

  const handleTimerStart = () => {
    if (timerRunning) return;
    timerStartRef.current = Date.now();
    setTimerRunning(true);
  };

  const handleTimerPause = () => {
    if (!timerRunning) return;
    timerAccumRef.current += Date.now() - (timerStartRef.current || Date.now());
    timerStartRef.current = null;
    setTimerRunning(false);
    tickTimer();
  };

  const handleTimerReset = () => {
    timerStartRef.current = null;
    timerAccumRef.current = 0;
    setTimerRunning(false);
    setElapsedMs(0);
  };

  const startRest = (seconds) => {
    restEndRef.current = Date.now() + seconds * 1000;
    setRestRemaining(seconds);
    setIsResting(true);
    setRestCycle((c) => c + 1);
  };

  const openExerciseModal = (exerciseId) => {
    const lib = getExerciseById(exerciseId);
    if (lib) setModalExercise(lib);
  };

  const handleLogSet = () => {
    if (!activeEx) return;
    const reps = Number(repsInput);
    const weight = Number(weightInput);
    if (!Number.isFinite(reps) || reps <= 0) return;

    const logged = {
      reps,
      weight: Number.isFinite(weight) && weight >= 0 ? weight : 0,
      loggedAt: new Date().toISOString(),
    };

    setExercises((prev) =>
      prev.map((ex, i) =>
        i === activeExIdx ? { ...ex, sets: [...ex.sets, logged] } : ex,
      ),
    );
    setRepsInput("");
    startRest(activeEx.restSeconds);
  };

  const handleComplete = () => {
    if (timerRunning && timerStartRef.current != null) {
      timerAccumRef.current += Date.now() - timerStartRef.current;
    }
    const durationMs = timerAccumRef.current || elapsedMs;

    saveSession({
      id: sessionIdRef.current,
      startedAt: startedAtRef.current,
      completedAt: new Date().toISOString(),
      durationMs,
      muscleGroup,
      difficulty,
      planTitle: plan.title,
      dayTitle: workoutDay?.title || plan.title,
      exercises: exercises.map(({ exerciseId, name, muscleGroup: mg, targetSets, targetReps, sets }) => ({
        exerciseId,
        name,
        muscleGroup: mg,
        targetSets,
        targetReps,
        sets,
      })),
    });

    const totalSets = exercises.reduce((n, ex) => n + ex.sets.length, 0);
    setCompletionSummary({
      durationLabel: formatDuration(durationMs),
      totalSets,
      exerciseCount: exercises.filter((ex) => ex.sets.length > 0).length,
    });
  };

  if (!workoutDay || exercises.length === 0) {
    return (
      <div className="ws-page">
        <header className="ws-header">
          <Link to="/workout" className="ws-back">
            ← 返回計劃
          </Link>
          <h1 className="ws-title">今日休息</h1>
        </header>
        <p className="ws-empty-note">計劃顯示今日係休息／自由日，揀其他日子或者改設定再試。</p>
        <Link to="/workout" className="ws-btn ws-btn--primary">
          返回訓練計劃
        </Link>
      </div>
    );
  }

  const totalLoggedSets = exercises.reduce((n, ex) => n + ex.sets.length, 0);

  return (
    <div className="ws-page">
      <header className="ws-header">
        <Link to="/workout" className="ws-back">
          ← 計劃
        </Link>
        <div className="ws-header-main">
          <h1 className="ws-title">{workoutDay.title}</h1>
          <p className="ws-sub">{plan.title}</p>
        </div>
      </header>

      <section className="ws-timer-card" aria-label="訓練計時器">
        <div className="ws-timer-display" aria-live="polite">
          {formatDuration(elapsedMs)}
        </div>
        <div className="ws-timer-actions">
          {!timerRunning ? (
            <button type="button" className="ws-btn ws-btn--primary" onClick={handleTimerStart}>
              {elapsedMs > 0 ? "繼續" : "開始"}
            </button>
          ) : (
            <button type="button" className="ws-btn" onClick={handleTimerPause}>
              暫停
            </button>
          )}
          <button type="button" className="ws-btn ws-btn--ghost" onClick={handleTimerReset}>
            重置
          </button>
        </div>
      </section>

      <RestCoachBanner remaining={isResting ? restRemaining : 0} restCycle={restCycle} />

      <section className="ws-exercise-nav" aria-label="動作列表">
        {exercises.map((ex, i) => (
          <button
            key={ex.exerciseId}
            type="button"
            className={`ws-ex-tab${i === activeExIdx ? " ws-ex-tab--active" : ""}`}
            onClick={() => setActiveExIdx(i)}
          >
            {ex.name.split("（")[0]}
            <span className="ws-ex-tab-count">
              {ex.sets.length}/{ex.targetSets}
            </span>
          </button>
        ))}
      </section>

      {activeEx ? (
        <section className="ws-exercise-card">
          <h2 className="ws-ex-name">
            <button
              type="button"
              className="ws-ex-name-btn"
              onClick={() => openExerciseModal(activeEx.exerciseId)}
              title="睇 form tips 同 Eva 貼士"
            >
              {activeEx.name}
            </button>
          </h2>
          <p className="ws-ex-target">
            目標 {activeEx.targetSets} 組 × {activeEx.targetReps}
          </p>

          <ul className="ws-set-list">
            {activeEx.sets.map((set, i) => (
              <li key={`${set.loggedAt}-${i}`} className="ws-set-item">
                <span className="ws-set-num">第 {i + 1} 組</span>
                <span>
                  {set.reps} 下 · {set.weight} kg
                </span>
              </li>
            ))}
          </ul>

          <div className="ws-log-form">
            <label className="ws-field">
              <span>下數</span>
              <input
                type="number"
                min="1"
                inputMode="numeric"
                value={repsInput}
                onChange={(e) => setRepsInput(e.target.value)}
                placeholder="12"
              />
            </label>
            <label className="ws-field">
              <span>重量 (kg)</span>
              <input
                type="number"
                min="0"
                step="0.5"
                inputMode="decimal"
                value={weightInput}
                onChange={(e) => setWeightInput(e.target.value)}
                placeholder="5"
              />
            </label>
            <button type="button" className="ws-btn ws-btn--primary" onClick={handleLogSet}>
              記錄組數
            </button>
          </div>
        </section>
      ) : null}

      <footer className="ws-footer">
        <p className="ws-footer-stats">已記錄 {totalLoggedSets} 組</p>
        <button
          type="button"
          className="ws-btn ws-btn--finish"
          onClick={handleComplete}
          disabled={totalLoggedSets === 0}
        >
          完成訓練
        </button>
      </footer>

      <ExerciseDetailModal exercise={modalExercise} onClose={() => setModalExercise(null)} />
      <CompletionCard
        summary={completionSummary}
        onClose={() => setCompletionSummary(null)}
        onDashboard={() => navigate("/workout/dashboard")}
        onProgress={() => navigate("/workout/progress")}
      />
    </div>
  );
}
