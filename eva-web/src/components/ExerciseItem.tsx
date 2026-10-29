import { useCallback } from "react";
import type { WorkoutExercise } from "../services/workoutProgress";

export interface ExerciseItemProps {
  dayId: string;
  exercise: WorkoutExercise;
  done: boolean;
  readOnly?: boolean;
  onToggle: (exerciseId: string, done: boolean) => void;
}

export function ExerciseItem({
  dayId,
  exercise,
  done,
  readOnly = false,
  onToggle,
}: ExerciseItemProps) {
  const inputId = `wk-ex-${dayId}-${exercise.id}`;

  const handleChange = useCallback(() => {
    if (readOnly) return;
    onToggle(exercise.id, !done);
  }, [done, exercise.id, onToggle, readOnly]);

  return (
    <li className={`wk-exercise${done ? " wk-exercise--done" : ""}`}>
      <label className="wk-exercise-label" htmlFor={inputId}>
        <input
          id={inputId}
          type="checkbox"
          className="wk-check-input"
          checked={done}
          disabled={readOnly}
          onChange={handleChange}
          aria-label={`${exercise.name} 完成`}
        />
        <span className="wk-check-box" aria-hidden="true" />
        <span className="wk-exercise-body">
          <span className="wk-exercise-name">{exercise.name}</span>
          <span className="wk-exercise-meta">
            {exercise.sets} 組 × {exercise.reps}
            {exercise.rest && exercise.rest !== "—" ? ` · 休息 ${exercise.rest}` : ""}
          </span>
          {exercise.tip ? <span className="wk-exercise-tip">{exercise.tip}</span> : null}
        </span>
      </label>
    </li>
  );
}
