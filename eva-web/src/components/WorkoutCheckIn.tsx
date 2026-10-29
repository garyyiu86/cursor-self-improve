import { useCallback } from "react";
import type { WeeklyDay, WeeklyExercise } from "../data/weeklyPlan";
import {
  isExerciseFullyComplete,
  isSetDone,
  type SetProgressKeys,
} from "../utils/workoutStore";

export interface WorkoutCheckInProps {
  day: WeeklyDay;
  exercise: WeeklyExercise;
  doneKeys: SetProgressKeys;
  readOnly?: boolean;
  onToggleSet: (exerciseId: string, setIndex: number, done: boolean) => void;
}

export function WorkoutCheckIn({
  day,
  exercise,
  doneKeys,
  readOnly = false,
  onToggleSet,
}: WorkoutCheckInProps) {
  const setCount = Math.max(1, exercise.sets || 1);
  const allDone = isExerciseFullyComplete(day.id, exercise, doneKeys);

  const handleToggle = useCallback(
    (setIndex: number, done: boolean) => {
      if (readOnly) return;
      onToggleSet(exercise.id, setIndex, done);
    },
    [exercise.id, onToggleSet, readOnly],
  );

  return (
    <li className={`wci-exercise${allDone ? " wci-exercise--done" : ""}`}>
      <div className="wci-exercise-head">
        <span className="wci-exercise-name">{exercise.name}</span>
        <span className="wci-exercise-target">
          {exercise.sets}×{exercise.reps}
        </span>
      </div>
      <ul className="wci-set-list" aria-label={`${exercise.name} 各組進度`}>
        {Array.from({ length: setCount }, (_, setIndex) => {
          const done = isSetDone(day.id, exercise.id, setIndex, doneKeys);
          const inputId = `wci-${day.id}-${exercise.id}-${setIndex}`;
          return (
            <li key={setIndex}>
              <label
                className={`wci-set-row${done ? " wci-set-row--done" : ""}`}
                htmlFor={inputId}
              >
                <input
                  id={inputId}
                  type="checkbox"
                  className="wci-set-check"
                  checked={done}
                  disabled={readOnly}
                  onChange={() => handleToggle(setIndex, !done)}
                  aria-label={`${exercise.name} 第 ${setIndex + 1} 組`}
                />
                <span className="wci-set-box" aria-hidden="true" />
                <span className="wci-set-label">第 {setIndex + 1} 組</span>
              </label>
            </li>
          );
        })}
      </ul>
    </li>
  );
}
