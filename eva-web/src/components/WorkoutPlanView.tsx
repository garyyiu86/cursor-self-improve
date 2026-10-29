import { useCallback, useMemo, useState } from "react";
import {
  computeDayProgress,
  computeStreak,
  computeWeekProgress,
  getTodayDayIndex,
  getEncouragementForMilestone,
  isExerciseDone as checkExerciseDone,
  loadProgress,
  toggleExercise,
  type WeeklyWorkoutPlan,
  type WorkoutProgressState,
} from "../services/workoutProgress";
import { buildSessionPlayUrl } from "../utils/sessionUrl";
import { StreakBadge } from "./StreakBadge";
import { WorkoutDayCard } from "./WorkoutDayCard";

export interface WorkoutPlanViewProps {
  plan: WeeklyWorkoutPlan;
  compact?: boolean;
}

function pickDefaultDayIndex(plan: WeeklyWorkoutPlan): number {
  const idx = getTodayDayIndex();
  const today = plan.days[idx];
  if (today?.exercises?.length) return idx;
  const first = plan.days.findIndex((d) => d.exercises.length > 0);
  return first >= 0 ? first : 0;
}

export function WorkoutPlanView({ plan, compact = false }: WorkoutPlanViewProps) {
  const [progress, setProgress] = useState<WorkoutProgressState>(() =>
    loadProgress(plan.id),
  );
  const [activeDayIndex, setActiveDayIndex] = useState(() =>
    pickDefaultDayIndex(plan),
  );
  const [encouragement, setEncouragement] = useState<string | null>(null);

  const todayIndex = getTodayDayIndex();
  const streak = useMemo(
    () => computeStreak(progress.completedDays),
    [progress.completedDays],
  );
  const weekProgress = useMemo(
    () => computeWeekProgress(plan, progress),
    [plan, progress],
  );

  const activeDay = plan.days[activeDayIndex] ?? plan.days[0];
  const dayProgress = useMemo(
    () => (activeDay ? computeDayProgress(activeDay, progress) : null),
    [activeDay, progress],
  );

  const isExerciseDoneFn = useCallback(
    (dayId: string, exerciseId: string) =>
      checkExerciseDone(dayId, exerciseId, progress),
    [progress],
  );

  const handleToggleExercise = useCallback(
    (exerciseId: string, done: boolean) => {
      if (!activeDay) return;
      const result = toggleExercise(plan, activeDay.id, exerciseId, done, progress);
      setProgress(result.state);
      if (result.milestone != null) {
        setEncouragement(getEncouragementForMilestone(result.milestone));
      }
    },
    [activeDay, plan, progress],
  );

  const readOnly = activeDayIndex !== todayIndex;

  return (
    <section
      className={`wk-plan${compact ? " wk-plan--compact" : ""}`}
      aria-label={plan.title}
    >
      <header className="wk-plan-head">
        <div className="wk-plan-title-wrap">
          <h2 className="wk-plan-title">{compact ? "每週訓練" : plan.title}</h2>
          {!compact ? (
            <p className="wk-plan-subtitle">{plan.subtitle}</p>
          ) : null}
        </div>
        <StreakBadge streak={streak} />
      </header>

      {!compact && weekProgress.trackable ? (
        <div
          className={`wk-week-progress${
            weekProgress.complete ? " wk-week-progress--complete" : ""
          }`}
          role="progressbar"
          aria-valuenow={weekProgress.done}
          aria-valuemin={0}
          aria-valuemax={weekProgress.total}
        >
          <span className="wk-week-progress-label">
            本週 {weekProgress.done}/{weekProgress.total} · {weekProgress.pct}%
          </span>
          <div className="wk-progress-track">
            <div
              className="wk-progress-fill"
              style={{ width: `${weekProgress.pct}%` }}
            />
          </div>
        </div>
      ) : null}

      <ul className="wk-plan-days" role="list">
        {plan.days.map((day, index) => {
          const prog = computeDayProgress(day, progress);
          const active = index === activeDayIndex;
          const isToday = index === todayIndex;
          return (
            <li key={day.id}>
              <button
                type="button"
                className={`wk-plan-day${active ? " wk-plan-day--active" : ""}${
                  prog.complete ? " wk-plan-day--complete" : ""
                }${isToday ? " wk-plan-day--today" : ""}`}
                onClick={() => setActiveDayIndex(index)}
                aria-pressed={active}
                aria-label={`星期${day.weekday} ${day.title}${
                  prog.trackable ? `，${prog.done}/${prog.total}` : "，休息"
                }`}
              >
                <span className="wk-plan-day-emoji" aria-hidden="true">
                  {day.emoji}
                </span>
                <span className="wk-plan-day-label">星期{day.weekday}</span>
                {prog.trackable ? (
                  <span className="wk-plan-day-meta">
                    {prog.complete ? "✓" : `${prog.done}/${prog.total}`}
                  </span>
                ) : (
                  <span className="wk-plan-day-meta">—</span>
                )}
              </button>
            </li>
          );
        })}
      </ul>

      {activeDay && dayProgress ? (
        <WorkoutDayCard
          day={activeDay}
          progress={dayProgress}
          isExerciseDone={isExerciseDoneFn}
          readOnly={readOnly}
          onToggleExercise={handleToggleExercise}
          sessionPlayUrl={
            activeDay.exercises.length
              ? buildSessionPlayUrl({
                  planId: plan.id,
                  dayId: activeDay.id,
                  muscleGroup: plan.muscleGroup,
                  difficulty: plan.difficulty,
                  dayIndex: activeDay.dayIndex,
                })
              : undefined
          }
        />
      ) : null}

      {encouragement ? (
        <div className="wk-encouragement" role="status">
          <span className="wk-encouragement-avatar" aria-hidden="true">
            ✨
          </span>
          <p className="wk-encouragement-text">{encouragement}</p>
          <button
            type="button"
            className="wk-encouragement-dismiss"
            onClick={() => setEncouragement(null)}
            aria-label="關閉"
          >
            ×
          </button>
        </div>
      ) : null}

      {readOnly && activeDay?.exercises.length ? (
        <p className="wk-hint">只可以喺今日打勾～切返今日先可以 check off。</p>
      ) : null}
    </section>
  );
}
