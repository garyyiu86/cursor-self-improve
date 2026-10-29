import { useCallback, useMemo, useState } from "react";
import {
  clearDayProgress,
  computeDayProgress,
  computeWeekProgress,
  loadDayProgress,
  saveDayProgress,
  setProgressKey,
} from "../services/trainingDayProgress.js";
import { buildSessionPlayUrl } from "../utils/sessionUrl";
import { RestTimer } from "./RestTimer";
import { TrainingDayCard, type TrackerDay } from "./TrainingDayCard";
import "../styles/training-tracker.css";
import "../styles/rest-timer.css";

export interface TrainingWeekViewProps {
  planId: string;
  days: TrackerDay[];
}

function pickDefaultDayId(days: TrackerDay[]): string {
  const jsDay = new Date().getDay();
  const planIndex = jsDay === 0 ? 6 : jsDay - 1;
  const today = days[planIndex];
  if (today?.exercises?.length) return today.id;

  const firstWorkout = days.find((d) => d.exercises?.length > 0);
  return firstWorkout?.id ?? days[0]?.id ?? "";
}

export function TrainingWeekView({ planId, days }: TrainingWeekViewProps) {
  const [doneKeys, setDoneKeys] = useState(() => loadDayProgress(planId));
  const [activeDayId, setActiveDayId] = useState(() => pickDefaultDayId(days));
  const [restSignal, setRestSignal] = useState(0);
  const [restDayId, setRestDayId] = useState("");

  const weekProgress = useMemo(() => computeWeekProgress(days, doneKeys), [days, doneKeys]);

  const activeDay = useMemo(
    () => days.find((d) => d.id === activeDayId) ?? days.find((d) => d.exercises?.length) ?? days[0],
    [days, activeDayId],
  );

  const toggleSet = useCallback(
    (dayId: string, exerciseId: string, setIndex: number, done: boolean) => {
      setDoneKeys((prev) => {
        const next = new Set(prev);
        const key = setProgressKey(dayId, exerciseId, setIndex);
        if (done) next.add(key);
        else next.delete(key);
        saveDayProgress(planId, next);
        return next;
      });
    },
    [planId],
  );

  const resetProgress = useCallback(() => {
    clearDayProgress(planId);
    setDoneKeys(new Set());
  }, [planId]);

  return (
    <section className="tt-week" aria-label="本週訓練進度">
      <header className="tt-week-head">
        <h2 className="tt-week-title">訓練日追蹤</h2>
        <p className="tt-week-sub">撳 checkbox 標記做完嘅組數，休息計時會自動開始</p>
      </header>

      <div
        className={`tt-week-progress${weekProgress.complete ? " tt-week-progress--complete" : ""}`}
        role="progressbar"
        aria-valuenow={weekProgress.done}
        aria-valuemin={0}
        aria-valuemax={weekProgress.total}
        aria-label={`本週訓練進度 ${weekProgress.done} / ${weekProgress.total}`}
      >
        <div className="tt-week-progress-label">
          {weekProgress.complete
            ? `🎉 本週 ${weekProgress.done} / ${weekProgress.total} 全部完成！`
            : `本週 ${weekProgress.done} / ${weekProgress.total} · ${weekProgress.pct}%`}
        </div>
        <div className="tt-progress-track">
          <div className="tt-progress-fill" style={{ width: `${weekProgress.pct}%` }} />
        </div>
      </div>

      <ul className="tt-week-days" role="list">
        {days.map((day) => {
          const prog = computeDayProgress(day, doneKeys);
          const active = day.id === activeDayId;
          const isRest = !prog.trackable;

          return (
            <li key={day.id}>
              <button
                type="button"
                className={`tt-week-day${active ? " tt-week-day--active" : ""}${
                  prog.complete ? " tt-week-day--complete" : ""
                }`}
                onClick={() => setActiveDayId(day.id)}
                aria-pressed={active}
                aria-label={`星期${day.weekday} ${day.title}${
                  prog.trackable ? `，${prog.done}/${prog.total} 完成` : "，休息日"
                }`}
              >
                <span className="tt-week-day-emoji" aria-hidden="true">
                  {day.emoji}
                </span>
                <span className="tt-week-day-main">
                  <span className="tt-week-day-label">
                    星期{day.weekday} · {day.title}
                  </span>
                  {isRest ? (
                    <span className="tt-week-day-meta">休息</span>
                  ) : (
                    <span className="tt-week-day-meta">
                      {prog.complete ? "✅ 完成" : `${prog.done}/${prog.total} 組 · ${prog.pct}%`}
                    </span>
                  )}
                </span>
                {prog.trackable ? (
                  <span className="tt-week-day-bar" aria-hidden="true">
                    <span className="tt-week-day-bar-fill" style={{ width: `${prog.pct}%` }} />
                  </span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>

      {activeDay ? (
        <>
          <TrainingDayCard
            planId={planId}
            day={activeDay}
            doneKeys={doneKeys}
            onToggleSet={(exerciseId, setIndex, done) =>
              toggleSet(activeDay.id, exerciseId, setIndex, done)
            }
            onSetChecked={() => {
              setRestDayId(activeDay.id);
              setRestSignal((n) => n + 1);
            }}
            sessionPlayUrl={
              activeDay.exercises?.length
                ? buildSessionPlayUrl({ planId, dayId: activeDay.id })
                : undefined
            }
          />
          <RestTimer
            startSignal={restSignal}
            active={!restDayId || restDayId === activeDayId}
          />
        </>
      ) : null}

      {weekProgress.total > 0 ? (
        <div className="tt-reset-wrap">
          <button type="button" className="tt-reset-btn" onClick={resetProgress}>
            重置本週進度
          </button>
        </div>
      ) : null}
    </section>
  );
}
