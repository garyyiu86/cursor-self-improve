import { useState } from "react";
import ExerciseCard from "./ExerciseCard.jsx";

function DayCard({ day, isExerciseDone, onToggleExercise }) {
  const isRest = day.type === "rest";
  const allDone =
    !isRest &&
    day.exercises.length > 0 &&
    day.exercises.every((ex) => isExerciseDone(ex.id));
  const [collapsed, setCollapsed] = useState(allDone);

  if (isRest) {
    return (
      <article className="fit-day fit-day--rest">
        <header className="fit-day-head">
          <h3 className="fit-day-name">{day.dayName}</h3>
          <span className="fit-day-tag">🌸 休息</span>
        </header>
        <p className="fit-day-rest-msg">今日完全休息，讓肌肉修復生長～</p>
      </article>
    );
  }

  return (
    <article
      className={`fit-day fit-day--workout${allDone ? " fit-day--complete" : ""}`}
    >
      <header className="fit-day-head">
        <button
          type="button"
          className="fit-day-collapse"
          onClick={() => setCollapsed((c) => !c)}
          aria-expanded={!collapsed}
        >
          <h3 className="fit-day-name">
            {day.emoji} {day.dayName}
          </h3>
          <span className="fit-day-title">{day.title}</span>
          {allDone ? (
            <span className="fit-day-done-badge">✓ 完成</span>
          ) : null}
          <span className="fit-day-chevron" aria-hidden="true">
            {collapsed ? "▸" : "▾"}
          </span>
        </button>
      </header>

      {!collapsed ? (
        <div className="fit-day-body">
          {day.exercises.map((ex) => (
            <ExerciseCard
              key={ex.id}
              exercise={ex}
              completed={isExerciseDone(ex.id)}
              onToggle={onToggleExercise}
            />
          ))}
        </div>
      ) : null}
    </article>
  );
}

export default function WeeklyPlanView({ plan, isExerciseDone, onToggleExercise }) {
  if (!plan?.days) return null;

  return (
    <section className="fit-week" aria-label="每週訓練計劃">
      <h2 className="fit-section-title">7 日訓練表</h2>
      <div className="fit-week-grid">
        {plan.days.map((day) => (
          <DayCard
            key={day.dayIndex}
            day={day}
            isExerciseDone={isExerciseDone}
            onToggleExercise={onToggleExercise}
          />
        ))}
      </div>
    </section>
  );
}
