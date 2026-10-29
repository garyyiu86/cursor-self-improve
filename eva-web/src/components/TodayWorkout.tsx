import { useCallback, useEffect, useMemo, useState } from "react";
import { getDayByIndex, getTodayDayIndex, type WeeklyExercise } from "../data/weeklyPlan";
import {
  computeWorkoutStreak,
  logWorkout,
  type ToggleResult,
} from "../utils/workoutStorage";
import {
  computeDaySetProgress,
  loadSetProgress,
  toggleSet,
  type SetProgressKeys,
} from "../utils/workoutStore";
import { StreakBadge } from "./StreakBadge";
import { TodayProgress } from "./TodayProgress";
import { WeeklyOverview } from "./WeeklyOverview";
import { WorkoutCheckIn } from "./WorkoutCheckIn";
import "../styles/todayWorkout.css";

export interface TodayWorkoutProps {
  /** When set, overrides internal day selection (controlled mode). */
  dayIndex?: number;
  readOnly?: boolean;
}

export function TodayWorkout({ dayIndex: controlledDayIndex, readOnly: controlledReadOnly }: TodayWorkoutProps = {}) {
  const todayIndex = getTodayDayIndex();
  const [selectedDayIndex, setSelectedDayIndex] = useState(todayIndex);
  const [doneKeys, setDoneKeys] = useState<SetProgressKeys>(() => loadSetProgress());
  const [streak, setStreak] = useState(() => computeWorkoutStreak());
  const [loggedToday, setLoggedToday] = useState(false);

  const activeDayIndex = controlledDayIndex ?? selectedDayIndex;
  const day = useMemo(() => getDayByIndex(activeDayIndex), [activeDayIndex]);
  const isToday = activeDayIndex === todayIndex;
  const readOnly = controlledReadOnly ?? !isToday;

  const dayProgress = useMemo(
    () => computeDaySetProgress(day, doneKeys),
    [day, doneKeys],
  );

  const allDone = dayProgress.complete;

  useEffect(() => {
    if (!isToday) return;
    if (!allDone) {
      setLoggedToday(false);
      return;
    }
    if (loggedToday) return;
    const result: ToggleResult = logWorkout(new Date());
    setStreak(result.streak);
    setLoggedToday(true);
  }, [isToday, allDone, loggedToday]);

  const handleToggleSet = useCallback(
    (_exercise: WeeklyExercise, exerciseId: string, setIndex: number, done: boolean) => {
      if (readOnly) return;
      setDoneKeys((prev) => toggleSet(day.id, exerciseId, setIndex, done, prev));
    },
    [day.id, readOnly],
  );

  const handleSelectDay = useCallback(
    (index: number) => {
      if (controlledDayIndex == null) {
        setSelectedDayIndex(index);
      }
    },
    [controlledDayIndex],
  );

  return (
    <section className="tw-panel" aria-label="今日 guided 訓練">
      <header className="tw-panel-head">
        <div className="tw-panel-title-wrap">
          <h2 className="tw-panel-title">今日訓練</h2>
          <StreakBadge streak={streak} />
        </div>
        {controlledDayIndex == null ? (
          <WeeklyOverview
            selectedDayIndex={activeDayIndex}
            onSelectDay={handleSelectDay}
            doneKeys={doneKeys}
          />
        ) : null}
      </header>

      <article
        className={`tw-day${readOnly ? " tw-day--readonly" : ""}${allDone ? " tw-day--complete" : ""}`}
      >
        <header className="tw-day-head">
          <span className="tw-day-emoji" aria-hidden="true">
            {day.emoji}
          </span>
          <h3 className="tw-day-title">
            {day.weekdayLabel} · {day.title}
          </h3>
          {readOnly ? (
            <span className="tw-day-badge tw-day-badge--readonly">只讀</span>
          ) : null}
        </header>

        {day.exercises.length > 0 ? (
          <>
            <TodayProgress progress={dayProgress} />
            <ul className="wci-exercise-list" aria-label={`${day.weekdayLabel} 訓練項目`}>
              {day.exercises.map((ex) => (
                <WorkoutCheckIn
                  key={ex.id}
                  day={day}
                  exercise={ex}
                  doneKeys={doneKeys}
                  readOnly={readOnly}
                  onToggleSet={(exerciseId, setIndex, done) =>
                    handleToggleSet(ex, exerciseId, setIndex, done)
                  }
                />
              ))}
            </ul>
          </>
        ) : (
          <p className="tw-rest-msg">{day.note ?? "今日休息，不用訓練～"}</p>
        )}

        {allDone && day.exercises.length > 0 ? (
          <div className="tw-complete-banner" role="status">
            {isToday ? "完成今日訓練！" : "已完成"}
          </div>
        ) : null}
      </article>
    </section>
  );
}
