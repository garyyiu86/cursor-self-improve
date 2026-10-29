import { useEffect, useRef } from "react";
import {
  DIFFICULTY_LABELS,
  MUSCLE_GROUP_META,
  type LibraryExercise,
  type PlanDayRef,
} from "../../../eva-core/data/exerciseLibrary";

interface ExerciseDetailModalProps {
  exercise: LibraryExercise;
  planDays: PlanDayRef[];
  onClose: () => void;
}

export function ExerciseDetailModal({
  exercise,
  planDays,
  onClose,
}: ExerciseDetailModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const diff = DIFFICULTY_LABELS[exercise.difficulty];
  const muscle = MUSCLE_GROUP_META[exercise.muscleGroup];

  return (
    <div
      className="lib-modal-backdrop"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className="lib-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="lib-modal-title"
      >
        <header className="lib-modal-head">
          <div
            className={`lib-illus lib-illus--lg lib-illus--${exercise.illustration}`}
            aria-hidden="true"
          >
            <span className="lib-illus-figure" />
          </div>
          <div className="lib-modal-titles">
            <h2 id="lib-modal-title" className="lib-modal-name">
              {exercise.name}
            </h2>
            <div className="lib-modal-meta">
              <span className="lib-card-muscle">
                {muscle.emoji} {muscle.label}
              </span>
              <span className={`lib-card-diff lib-card-diff--${diff.tone}`}>
                {diff.label}
              </span>
              <span className="lib-modal-equip">{exercise.equipment}</span>
            </div>
            <p className="lib-modal-prescription">
              {exercise.sets} 組 × {exercise.reps} · 休息 {exercise.rest}
            </p>
          </div>
          <button
            type="button"
            className="lib-modal-close"
            onClick={onClose}
            aria-label="關閉"
          >
            ×
          </button>
        </header>

        <div className="lib-modal-body">
          <section className="lib-modal-section">
            <h3 className="lib-modal-section-title">✅ 動作要點</h3>
            <ol className="lib-modal-list">
              {exercise.formTips.map((tip) => (
                <li key={tip}>{tip}</li>
              ))}
            </ol>
          </section>

          <section className="lib-modal-section">
            <h3 className="lib-modal-section-title">⚠️ 常見錯誤</h3>
            <ul className="lib-modal-list lib-modal-list--mistakes">
              {exercise.commonMistakes.map((mistake) => (
                <li key={mistake}>{mistake}</li>
              ))}
            </ul>
          </section>

          <section className="lib-modal-section lib-modal-idol">
            <h3 className="lib-modal-section-title">✨ 偶像小貼士</h3>
            <blockquote className="lib-modal-idol-quote">
              <span className="lib-modal-idol-avatar" aria-hidden="true">
                伊
              </span>
              <p>{exercise.idolTip}</p>
            </blockquote>
          </section>

          <section className="lib-modal-section">
            <h3 className="lib-modal-section-title">📅 本週計劃出現日</h3>
            {planDays.length > 0 ? (
              <ul className="lib-modal-days">
                {planDays.map((day) => (
                  <li key={day.dayId} className="lib-modal-day">
                    <span className="lib-modal-day-emoji" aria-hidden="true">
                      {day.emoji}
                    </span>
                    <span className="lib-modal-day-label">
                      週{day.weekday}
                    </span>
                    <span className="lib-modal-day-title">{day.title}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="lib-modal-no-days">
                呢個動作未排入本週計劃，但可以加落自由訓練日～
              </p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
