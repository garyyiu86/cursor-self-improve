import { Link } from "react-router-dom";
import type { DayProgress, WorkoutDay } from "../services/workoutProgress";
import { ExerciseItem } from "./ExerciseItem";
import "../styles/session.css";

export interface WorkoutDayCardProps {
  day: WorkoutDay;
  progress: DayProgress;
  isExerciseDone: (dayId: string, exerciseId: string) => boolean;
  readOnly?: boolean;
  onToggleExercise: (exerciseId: string, done: boolean) => void;
  sessionPlayUrl?: string;
}

export function WorkoutDayCard({
  day,
  progress,
  isExerciseDone,
  readOnly = false,
  onToggleExercise,
  sessionPlayUrl,
}: WorkoutDayCardProps) {
  const isRest = day.type === "rest" || day.type === "free";
  const trackable = progress.trackable;

  return (
    <article
      className={`wk-day-card wk-day-card--${day.type}${
        progress.complete ? " wk-day-card--complete" : ""
      }`}
    >
      <header className="wk-day-head">
        <div className="wk-day-title-wrap">
          <h3 className="wk-day-title">
            <span className="wk-day-emoji" aria-hidden="true">
              {day.emoji}
            </span>
            星期{day.weekday} · {day.title}
          </h3>
          <span className="wk-day-duration">⏱ {day.duration}</span>
        </div>
        {trackable ? (
          <span
            className={`wk-day-badge${
              progress.complete ? " wk-day-badge--complete" : ""
            }`}
          >
            {progress.complete ? "✅ 完成" : `${progress.done}/${progress.total}`}
          </span>
        ) : null}
      </header>

      {day.note ? <p className="wk-day-note">{day.note}</p> : null}

      {trackable ? (
        <>
          <div
            className={`wk-day-progress${progress.complete ? " wk-day-progress--complete" : ""}`}
            role="progressbar"
            aria-valuenow={progress.done}
            aria-valuemin={0}
            aria-valuemax={progress.total}
            aria-label={`星期${day.weekday} 進度 ${progress.done} / ${progress.total}`}
          >
            <div className="wk-day-progress-label">
              {progress.complete
                ? `🎉 ${progress.done} / ${progress.total} 全部完成！`
                : `${progress.done} / ${progress.total} · ${progress.pct}%`}
            </div>
            <div className="wk-progress-track">
              <div
                className="wk-progress-fill"
                style={{ width: `${progress.pct}%` }}
              />
            </div>
          </div>
          <ul className="wk-exercise-list" aria-label={`星期${day.weekday} 訓練項目`}>
            {day.exercises.map((ex) => (
              <ExerciseItem
                key={ex.id}
                dayId={day.id}
                exercise={ex}
                done={isExerciseDone(day.id, ex.id)}
                readOnly={readOnly}
                onToggle={onToggleExercise}
              />
            ))}
          </ul>
          {sessionPlayUrl ? (
            <Link to={sessionPlayUrl} className="wk-day-start-btn">
              開始訓練 ▶
            </Link>
          ) : null}
        </>
      ) : isRest ? (
        <p className="wk-day-rest">
          {day.type === "free"
            ? "今日隨心活動就得～跳舞、行山、游水都 OK！"
            : "今日完全休息，讓肌肉修復生長。"}
        </p>
      ) : null}

      {progress.complete && trackable ? (
        <div className="wk-day-complete-banner" role="status">
          今日訓練完成！
        </div>
      ) : null}
    </article>
  );
}
