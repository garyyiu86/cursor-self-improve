import { useMemo, useState } from "react";
import {
  MUSCLE_FILTERS,
  WEEKLY_PLAN_EXERCISES,
  filterExercises,
  type MuscleFilter,
} from "../data/exercises";
import { ExerciseCard } from "./ExerciseCard.tsx";
import "../styles/exercises.css";

export function ExerciseLibrary() {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<MuscleFilter>("all");

  const exercises = useMemo(() => filterExercises(filter), [filter]);

  return (
    <section className="ex-library" aria-label="動作庫">
      <button
        type="button"
        className="ex-library-toggle"
        aria-expanded={open}
        aria-controls="ex-library-panel"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="ex-library-toggle-icon" aria-hidden="true">
          {open ? "▼" : "▶"}
        </span>
        <span className="ex-library-toggle-text">
          <span className="ex-library-title">動作庫 · Form Guide</span>
          <span className="ex-library-subtitle">Eva 每週訓練動作同要點</span>
        </span>
        <span className="ex-library-count" aria-hidden="true">
          {WEEKLY_PLAN_EXERCISES.length}
        </span>
      </button>

      {open ? (
        <div id="ex-library-panel" className="ex-library-panel">
          <div
            className="ex-library-filters"
            role="tablist"
            aria-label="肌肉群篩選"
          >
            {MUSCLE_FILTERS.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={filter === id}
                className={`ex-filter-btn${filter === id ? " ex-filter-btn--active" : ""}`}
                onClick={() => setFilter(id)}
              >
                {label}
              </button>
            ))}
          </div>

          {exercises.length > 0 ? (
            <div className="ex-library-grid">
              {exercises.map((exercise) => (
                <ExerciseCard key={exercise.id} exercise={exercise} />
              ))}
            </div>
          ) : (
            <p className="ex-library-empty">呢個分類暫時未有動作～</p>
          )}
        </div>
      ) : null}
    </section>
  );
}
