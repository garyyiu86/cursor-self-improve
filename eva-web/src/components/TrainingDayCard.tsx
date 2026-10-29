import { useCallback } from "react";
import { Link } from "react-router-dom";
import { setProgressKey } from "../services/trainingDayProgress.js";
import "../styles/training-tracker.css";
import "../styles/session.css";

export interface TrackerExercise {
  id: string;
  name: string;
  sets: number;
  reps: string;
  rest?: string;
  tip?: string;
  idolContext?: string;
}

export interface TrackerDay {
  id: string;
  weekday: string;
  emoji: string;
  title: string;
  duration: string;
  type: string;
  exercises: TrackerExercise[];
  note?: string;
}

export interface TrainingDayCardProps {
  planId: string;
  day: TrackerDay;
  doneKeys: Set<string>;
  onToggleSet: (exerciseId: string, setIndex: number, done: boolean) => void;
  /** Fired when a set is checked — parent can start the rest timer. */
  onSetChecked?: () => void;
  sessionPlayUrl?: string;
}

function setDone(doneKeys: Set<string>, dayId: string, exerciseId: string, setIndex: number): boolean {
  return doneKeys.has(setProgressKey(dayId, exerciseId, setIndex));
}

function exerciseAllSetsDone(
  doneKeys: Set<string>,
  dayId: string,
  exercise: TrackerExercise,
): boolean {
  const setCount = Math.max(1, exercise.sets || 1);
  for (let i = 0; i < setCount; i++) {
    if (!setDone(doneKeys, dayId, exercise.id, i)) return false;
  }
  return true;
}

function ProgressBar({
  done,
  total,
  pct,
  label,
  complete,
}: {
  done: number;
  total: number;
  pct: number;
  label: string;
  complete: boolean;
}) {
  return (
    <div
      className={`tt-progress${complete ? " tt-progress--complete" : ""}`}
      role="progressbar"
      aria-valuenow={done}
      aria-valuemin={0}
      aria-valuemax={total}
      aria-label={label}
    >
      <div className="tt-progress-label">
        {complete ? `🎉 ${done} / ${total} 組全部完成！` : `${done} / ${total} 組完成 · ${pct}%`}
      </div>
      <div className="tt-progress-track">
        <div className="tt-progress-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function TrainingDayCard({
  planId,
  day,
  doneKeys,
  onToggleSet,
  onSetChecked,
  sessionPlayUrl,
}: TrainingDayCardProps) {
  const exercises = day.exercises || [];
  const trackable = exercises.length > 0;

  let doneSets = 0;
  let totalSets = 0;
  for (const ex of exercises) {
    const setCount = Math.max(1, ex.sets || 1);
    totalSets += setCount;
    for (let i = 0; i < setCount; i++) {
      if (setDone(doneKeys, day.id, ex.id, i)) doneSets++;
    }
  }

  const pct = totalSets ? Math.round((doneSets / totalSets) * 100) : 0;
  const complete = totalSets > 0 && doneSets === totalSets;
  const isRest = day.type === "rest" || day.type === "free";

  const handleToggleSet = useCallback(
    (exerciseId: string, setIndex: number, done: boolean) => {
      onToggleSet(exerciseId, setIndex, done);
      if (done) onSetChecked?.();
    },
    [onToggleSet, onSetChecked],
  );

  return (
    <article
      className={`tt-day-card tt-day-card--${day.type}${complete ? " tt-day-card--complete" : ""}`}
      data-plan-id={planId}
      data-day-id={day.id}
    >
      <header className="tt-day-head">
        <div className="tt-day-title-wrap">
          <h3 className="tt-day-title">
            <span className="tt-day-emoji" aria-hidden="true">
              {day.emoji}
            </span>
            星期{day.weekday} · {day.title}
          </h3>
          <span className="tt-day-duration">⏱ {day.duration}</span>
        </div>
        {trackable ? (
          <span
            className={`tt-day-badge${complete ? " tt-day-badge--complete" : " tt-day-badge--partial"}`}
          >
            {complete ? "✅ 完成" : `${doneSets}/${totalSets} 組`}
          </span>
        ) : null}
      </header>

      {day.note ? <p className="tt-day-note">{day.note}</p> : null}

      {trackable ? (
        <>
          <ProgressBar
            done={doneSets}
            total={totalSets}
            pct={pct}
            complete={complete}
            label={`星期${day.weekday} 訓練進度 ${doneSets} / ${totalSets} 組`}
          />
          <ul className="tt-exercise-list">
            {exercises.map((ex) => {
              const allDone = exerciseAllSetsDone(doneKeys, day.id, ex);
              const setCount = Math.max(1, ex.sets || 1);
              return (
                <li key={ex.id}>
                  <div className={`tt-exercise-card${allDone ? " tt-exercise-card--done" : ""}`}>
                    <div className="tt-exercise-body">
                      <strong className="tt-exercise-name">{ex.name}</strong>
                      <span className="tt-exercise-meta">
                        {ex.sets} 組 × {ex.reps}
                        {ex.rest && ex.rest !== "—" ? ` · 休息 ${ex.rest}` : ""}
                      </span>
                      {ex.tip ? <p className="tt-exercise-tip">{ex.tip}</p> : null}
                      {ex.idolContext ? (
                        <p className="tt-exercise-idol">✨ {ex.idolContext}</p>
                      ) : null}
                      <ul className="tt-set-list" aria-label={`${ex.name} 各組進度`}>
                        {Array.from({ length: setCount }, (_, setIndex) => {
                          const done = setDone(doneKeys, day.id, ex.id, setIndex);
                          const inputId = `tt-set-${planId}-${day.id}-${ex.id}-${setIndex}`;
                          return (
                            <li key={setIndex}>
                              <label className={`tt-set-row${done ? " tt-set-row--done" : ""}`} htmlFor={inputId}>
                                <input
                                  id={inputId}
                                  type="checkbox"
                                  className="tt-set-check"
                                  checked={done}
                                  onChange={() => handleToggleSet(ex.id, setIndex, !done)}
                                  aria-label={`${ex.name} 第 ${setIndex + 1} 組`}
                                />
                                <span className="tt-set-label">第 {setIndex + 1} 組</span>
                              </label>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
          {sessionPlayUrl ? (
            <Link to={sessionPlayUrl} className="tt-day-start-btn">
              開始訓練 ▶
            </Link>
          ) : null}
        </>
      ) : isRest ? (
        <p className="tt-day-rest">
          {day.type === "free"
            ? "今日隨心活動就得～跳舞、行山、游水都 OK！"
            : "今日完全休息，讓肌肉修復生長。"}
        </p>
      ) : null}
    </article>
  );
}
