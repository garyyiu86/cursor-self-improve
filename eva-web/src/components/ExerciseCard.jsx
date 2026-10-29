export default function ExerciseCard({
  exercise,
  completed = false,
  onToggle,
}) {
  const dots = Array.from({ length: 5 }, (_, i) => i < exercise.difficulty);

  return (
    <article className={`fit-ex-card${completed ? " fit-ex-card--done" : ""}`}>
      <header className="fit-ex-head">
        <span className="fit-ex-icon" aria-hidden="true">
          {exercise.icon}
        </span>
        <div className="fit-ex-title-wrap">
          <h4 className="fit-ex-name">{exercise.name}</h4>
          <span className="fit-ex-badge">{exercise.muscleLabel}</span>
        </div>
        <label className="fit-ex-check">
          <input
            type="checkbox"
            checked={completed}
            onChange={() => onToggle?.(exercise.id)}
            aria-label={`標記 ${exercise.name} 完成`}
          />
          <span className="fit-ex-check-ui" aria-hidden="true" />
        </label>
      </header>

      <div className="fit-ex-diff" aria-label={`難度 ${exercise.difficulty} / 5`}>
        {dots.map((filled, i) => (
          <span
            key={i}
            className={`fit-ex-dot${filled ? " fit-ex-dot--on" : ""}`}
          />
        ))}
      </div>

      <p className="fit-ex-sets">
        {exercise.sets} 組 × {exercise.reps}
      </p>

      {exercise.description ? (
        <p className="fit-ex-tip">{exercise.description}</p>
      ) : exercise.tip ? (
        <p className="fit-ex-tip">{exercise.tip}</p>
      ) : null}
    </article>
  );
}
