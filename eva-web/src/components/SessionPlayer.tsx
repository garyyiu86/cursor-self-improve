import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  createSessionId,
  formatDuration,
  saveSession,
} from "../services/workoutStorage.js";
import { playMilestoneChime } from "../services/sessionAudio";
import {
  getSessionFinalMessage,
  getSessionMidMessage,
  getSessionRestMessage,
  getSessionStartMessage,
} from "../services/sessionMessages";
import { CircularRestTimer } from "./RestTimer";
import { SessionProgressBar } from "./SessionProgressBar";
import "../styles/session.css";

export interface SessionExercise {
  id: string;
  name: string;
  sets: number;
  reps: string;
  restSeconds: number;
  muscleGroup?: string;
}

export interface SessionPlayerProps {
  dayTitle: string;
  planTitle: string;
  exercises: SessionExercise[];
  muscleGroup?: string;
  difficulty?: string;
  /** Where the back link returns to */
  backTo?: string;
  backLabel?: string;
}

type Phase = "active" | "resting" | "summary";

function countTotalSets(exercises: SessionExercise[]): number {
  return exercises.reduce((n, ex) => n + Math.max(1, ex.sets), 0);
}

function EvaBanner({
  message,
  label = "Eva",
  tone = "default",
}: {
  message: string;
  label?: string;
  tone?: "default" | "mid" | "final";
}) {
  return (
    <aside
      className={`sess-eva-banner${
        tone === "mid" ? " sess-eva-banner--mid" : ""
      }${tone === "final" ? " sess-eva-banner--final" : ""}`}
      role="status"
      aria-live="polite"
    >
      <span className="sess-eva-avatar" aria-hidden="true">
        ✨
      </span>
      <p className="sess-eva-text">
        <span className="sess-eva-label">{label}</span>
        {message}
      </p>
    </aside>
  );
}

export function SessionPlayer({
  dayTitle,
  planTitle,
  exercises,
  muscleGroup = "biceps",
  difficulty = "beginner",
  backTo = "/workout/track",
  backLabel = "← 返回計劃",
}: SessionPlayerProps) {
  const sessionIdRef = useRef(createSessionId());
  const startedAtRef = useRef(new Date().toISOString());
  const startMsRef = useRef(Date.now());
  const midShownRef = useRef(false);
  const savedRef = useRef(false);

  const totalSets = useMemo(() => countTotalSets(exercises), [exercises]);

  const [exerciseIndex, setExerciseIndex] = useState(0);
  const [completedSetsInExercise, setCompletedSetsInExercise] = useState(0);
  const [completedSetsTotal, setCompletedSetsTotal] = useState(0);
  const [phase, setPhase] = useState<Phase>("active");
  const [elapsedMs, setElapsedMs] = useState(0);
  const [restSignal, setRestSignal] = useState(0);
  const [restCycle, setRestCycle] = useState(0);
  const [startMessage] = useState(() => getSessionStartMessage(Date.now() % 4));
  const [midMessage, setMidMessage] = useState<string | null>(null);
  const [restMessage, setRestMessage] = useState<string | null>(null);
  const [finalMessage, setFinalMessage] = useState<string | null>(null);
  const [summaryStats, setSummaryStats] = useState<{
    totalSets: number;
    exerciseCount: number;
    durationMs: number;
  } | null>(null);

  const activeExercise = exercises[exerciseIndex];
  const targetSets = activeExercise ? Math.max(1, activeExercise.sets) : 0;
  const currentSetNumber = completedSetsInExercise + 1;
  const isLastExercise = exerciseIndex >= exercises.length - 1;

  useEffect(() => {
    playMilestoneChime();
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => {
      setElapsedMs(Date.now() - startMsRef.current);
    }, 500);
    return () => window.clearInterval(id);
  }, []);

  const finishSession = useCallback(
    (finalCompletedTotal: number, finalExerciseIndex: number, finalSetsInExercise: number) => {
      if (savedRef.current) return;
      savedRef.current = true;

      const durationMs = Date.now() - startMsRef.current;
      const finalMsg = getSessionFinalMessage(finalCompletedTotal);
      setFinalMessage(finalMsg);
      setSummaryStats({
        totalSets: finalCompletedTotal,
        exerciseCount: exercises.length,
        durationMs,
      });
      setCompletedSetsTotal(finalCompletedTotal);

      const loggedAt = new Date().toISOString();
      saveSession({
        id: sessionIdRef.current,
        startedAt: startedAtRef.current,
        completedAt: loggedAt,
        durationMs,
        muscleGroup,
        difficulty,
        planTitle,
        dayTitle,
        exercises: exercises.map((ex, i) => {
          let doneCount = 0;
          if (i < finalExerciseIndex) doneCount = ex.sets;
          else if (i === finalExerciseIndex) doneCount = finalSetsInExercise;

          return {
            exerciseId: ex.id,
            name: ex.name,
            muscleGroup: ex.muscleGroup || muscleGroup,
            targetSets: ex.sets,
            targetReps: ex.reps,
            sets: Array.from({ length: doneCount }, () => ({
              reps: 0,
              weight: 0,
              loggedAt,
            })),
          };
        }),
      });

      setPhase("summary");
      playMilestoneChime();
    },
    [dayTitle, difficulty, exercises, muscleGroup, planTitle],
  );

  const handleCompleteSet = useCallback(() => {
    if (phase !== "active" || !activeExercise) return;

    const nextCompletedInEx = completedSetsInExercise + 1;
    const nextCompletedTotal = completedSetsTotal + 1;

    setCompletedSetsInExercise(nextCompletedInEx);
    setCompletedSetsTotal(nextCompletedTotal);

    if (!midShownRef.current && nextCompletedTotal >= Math.ceil(totalSets / 2)) {
      midShownRef.current = true;
      setMidMessage(getSessionMidMessage(nextCompletedTotal));
      playMilestoneChime();
    }

    const finishedExercise = nextCompletedInEx >= targetSets;

    if (finishedExercise) {
      if (isLastExercise) {
        finishSession(nextCompletedTotal, exerciseIndex, nextCompletedInEx);
        return;
      }
      setExerciseIndex((i) => i + 1);
      setCompletedSetsInExercise(0);
      return;
    }

    setRestMessage(getSessionRestMessage(restCycle));
    setRestCycle((c) => c + 1);
    setRestSignal((s) => s + 1);
    setPhase("resting");
  }, [
    activeExercise,
    completedSetsInExercise,
    completedSetsTotal,
    finishSession,
    isLastExercise,
    phase,
    restCycle,
    targetSets,
    totalSets,
  ]);

  const handleRestDone = useCallback(() => {
    setPhase("active");
    setRestMessage(null);
  }, []);

  const handleRestSkip = useCallback(() => {
    setPhase("active");
    setRestMessage(null);
  }, []);

  if (exercises.length === 0) {
    return (
      <div className="sess-page">
        <header className="sess-header">
          <Link to={backTo} className="sess-back">
            {backLabel}
          </Link>
          <h1 className="sess-title">今日休息</h1>
        </header>
        <p className="sess-sub">呢日冇訓練項目，揀其他日子再試。</p>
      </div>
    );
  }

  if (phase === "summary" && summaryStats) {
    return (
      <div className="sess-page">
        <div className="sess-summary" role="region" aria-label="訓練總結">
          <h1 className="sess-summary-title">訓練完成 🎉</h1>

          {finalMessage ? (
            <EvaBanner message={finalMessage} label="Eva 話" tone="final" />
          ) : null}

          <div className="sess-summary-stats">
            <div className="sess-summary-stat">
              <span className="sess-summary-stat-val">
                {formatDuration(summaryStats.durationMs)}
              </span>
              <span className="sess-summary-stat-lbl">總時長</span>
            </div>
            <div className="sess-summary-stat">
              <span className="sess-summary-stat-val">{summaryStats.exerciseCount}</span>
              <span className="sess-summary-stat-lbl">完成動作</span>
            </div>
            <div className="sess-summary-stat">
              <span className="sess-summary-stat-val">{summaryStats.totalSets}</span>
              <span className="sess-summary-stat-lbl">總組數</span>
            </div>
          </div>

          <div className="sess-summary-actions">
            <Link to="/workout/progress" className="sess-btn sess-btn--primary">
              睇進度
            </Link>
            <Link to="/workout/dashboard" className="sess-btn">
              訓練紀錄
            </Link>
            <Link to={backTo} className="sess-btn">
              {backLabel.replace("← ", "")}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="sess-page">
      <header className="sess-header">
        <Link to={backTo} className="sess-back">
          {backLabel}
        </Link>
        <h1 className="sess-title">{dayTitle}</h1>
        <p className="sess-sub">{planTitle}</p>
      </header>

      <SessionProgressBar
        completedSets={completedSetsTotal}
        totalSets={totalSets}
        exerciseIndex={exerciseIndex}
        exerciseCount={exercises.length}
        elapsedLabel={formatDuration(elapsedMs)}
      />

      <EvaBanner message={startMessage} />

      {midMessage ? <EvaBanner message={midMessage} label="Eva 加油" tone="mid" /> : null}

      {phase === "resting" && activeExercise ? (
        <>
          {restMessage ? <EvaBanner message={restMessage} label="Eva 應援" /> : null}
          <CircularRestTimer
            startSignal={restSignal}
            durationSeconds={activeExercise.restSeconds}
            onComplete={handleRestDone}
            onSkip={handleRestSkip}
          />
        </>
      ) : activeExercise ? (
        <section className="sess-exercise-card" aria-label="目前動作">
          <h2 className="sess-exercise-name">{activeExercise.name}</h2>
          <p className="sess-exercise-target">
            目標 {activeExercise.sets} 組 × {activeExercise.reps}
          </p>
          <div className="sess-set-badge" aria-live="polite">
            第 {currentSetNumber} / {targetSets} 組
          </div>
          <button
            type="button"
            className="sess-complete-btn"
            onClick={handleCompleteSet}
          >
            ✓ 完成呢組
          </button>
        </section>
      ) : null}

      <ul className="sess-exercise-list" aria-label="動作概覽">
        {exercises.map((ex, i) => {
          const done = i < exerciseIndex;
          const active = i === exerciseIndex;
          return (
            <li
              key={ex.id}
              className={`sess-exercise-chip${
                active ? " sess-exercise-chip--active" : ""
              }${done ? " sess-exercise-chip--done" : ""}`}
            >
              {done ? "✓ " : ""}
              {ex.name.split("（")[0]}
            </li>
          );
        })}
      </ul>

    </div>
  );
}
