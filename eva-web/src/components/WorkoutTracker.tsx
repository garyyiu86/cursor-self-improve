import { useCallback, useState } from "react";
import {
  BICEP_WEEKLY_PLAN,
  getAdaptiveWorkoutTip,
  getProgressSummary,
  getRoutineDayForDate,
  markTodayComplete,
  sessionStore,
  unmarkToday,
  type WorkoutSession,
} from "../../../eva-core/src/workoutPlanner.ts";
import { DEBRIEF_QUESTIONS } from "../../../eva-core/src/notions.ts";
import {
  formatSessionDate,
  getEffortBand,
  getEffortLabel,
  type WorkoutDebrief,
} from "../../../eva-core/src/utils/progress.ts";
import { StreakBadge } from "./StreakBadge";
import "../styles/workout.css";

function formatTodayDate(date = new Date()): string {
  return date.toLocaleDateString("zh-HK", {
    weekday: "short",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export interface WorkoutTrackerProps {
  /** Recent sessions to show (default 5). */
  recentLimit?: number;
}

export interface LastDebriefCardProps {
  debrief?: WorkoutDebrief | null;
  className?: string;
}

/** Compact recap of the most recent post-workout debrief. */
export function LastDebriefCard({ debrief, className }: LastDebriefCardProps) {
  const latest = debrief ?? getProgressSummary(BICEP_WEEKLY_PLAN).latestDebrief;

  return (
    <aside
      className={`wk-debrief-card${className ? ` ${className}` : ""}`}
      aria-label="上次訓練回顧"
    >
      <div className="wk-debrief-head">
        <span className="wk-debrief-icon" aria-hidden="true">
          💬
        </span>
        <h3 className="wk-debrief-title">上次回顧</h3>
      </div>
      {latest ? (
        <>
          <p className="wk-debrief-main">
            最吃力：<strong>{latest.hardestExercise}</strong>
            {latest.feelNote ? ` · ${latest.feelNote}` : null}
          </p>
          <p className="wk-debrief-meta">
            {formatSessionDate(latest.date)} · 難度 {latest.difficultyRating}/5
          </p>
        </>
      ) : (
        <p className="wk-debrief-empty">尚未記低訓練感受</p>
      )}
      <p className="wk-debrief-hint">{DEBRIEF_QUESTIONS.hint}</p>
    </aside>
  );
}

export function WorkoutTracker({ recentLimit = 5 }: WorkoutTrackerProps) {
  const todayDay = getRoutineDayForDate();
  const [sessions, setSessions] = useState<WorkoutSession[]>(() =>
    sessionStore.getSessions(),
  );
  const [completed, setCompleted] = useState(() => sessionStore.isCompleted());
  const summary = getProgressSummary(BICEP_WEEKLY_PLAN);
  const adaptiveTip = getAdaptiveWorkoutTip(sessions);
  const [minutes, setMinutes] = useState(() => {
    const match = todayDay.duration.match(/(\d+)/);
    return match ? Number(match[1]) : 20;
  });
  const [difficulty, setDifficulty] = useState(3);

  const refresh = useCallback(() => {
    const next = sessionStore.getSessions();
    setSessions(next);
    setCompleted(sessionStore.isCompleted());
  }, []);

  const onToggle = useCallback(() => {
    if (completed) {
      unmarkToday();
    } else {
      markTodayComplete({ minutes, difficultyRating: difficulty });
    }
    refresh();
  }, [completed, minutes, difficulty, refresh]);

  const recent = [...sessions].reverse().slice(0, recentLimit);

  return (
    <section className="wk-tracker" aria-label="訓練打卡">
      <div className="wk-tracker-head">
        <div className="wk-tracker-date-wrap">
          <h2 className="wk-tracker-title">今日訓練</h2>
          <p className="wk-tracker-date">{formatTodayDate()}</p>
        </div>
        <StreakBadge streak={summary.streak} level={summary.level} />
      </div>

      <div className="wk-week-progress" aria-label="本周達標進度">
        <span className="wk-week-progress-label">
          本周 {summary.weekly.completed}/{summary.weekly.target} 次
          {summary.weekly.onTrack ? " · 達標 ✓" : ` · ${summary.weekly.pct}%`}
        </span>
        <div className="wk-progress-track">
          <div
            className="wk-progress-fill"
            style={{ width: `${summary.weekly.pct}%` }}
            role="progressbar"
            aria-valuenow={summary.weekly.completed}
            aria-valuemin={0}
            aria-valuemax={summary.weekly.target}
            aria-label={`本周完成 ${summary.weekly.completed} 次，目標 ${summary.weekly.target} 次`}
          />
        </div>
      </div>

      <p className="wk-tracker-meta">
        上次訓練：
        {summary.latestSession
          ? formatSessionDate(summary.latestSession.date)
          : "尚未記錄"}
        {summary.idle.idle && summary.idle.daysSinceLast != null
          ? ` · 已 ${summary.idle.daysSinceLast} 日未練`
          : null}
      </p>

      <p className="wk-tracker-motivation">{summary.motivationalCopy}</p>

      <LastDebriefCard debrief={summary.latestDebrief} />

      <aside
        className={`wk-adaptive-tip wk-adaptive-tip--${adaptiveTip.kind}`}
        role="note"
      >
        <span className="wk-adaptive-tip-icon" aria-hidden="true">
          {adaptiveTip.kind === "recovery"
            ? "💤"
            : adaptiveTip.kind === "intensity"
              ? "💪"
              : "✨"}
        </span>
        <p className="wk-adaptive-tip-text">{adaptiveTip.message}</p>
      </aside>

      <ul className="wk-checklist" aria-label="今日訓練清單">
        <li className="wk-checklist-item">
          <label className="wk-check-label">
            <input
              type="checkbox"
              className="wk-check-input"
              checked={completed}
              onChange={onToggle}
            />
            <span className="wk-check-box" aria-hidden="true" />
            <span className="wk-check-text">完成今日訓練 — {todayDay.title}</span>
          </label>
        </li>
      </ul>

      {!completed ? (
        <div className="wk-tracker-fields">
          <label className="wk-tracker-field">
            <span>分鐘</span>
            <input
              type="number"
              min={5}
              max={120}
              value={minutes}
              onChange={(e) => setMinutes(Number(e.target.value) || 0)}
            />
          </label>
          <label className="wk-tracker-field">
            <span>難度</span>
            <input
              type="range"
              min={1}
              max={5}
              value={difficulty}
              onChange={(e) => setDifficulty(Number(e.target.value))}
            />
            <span className="wk-tracker-field-value">{difficulty}/5</span>
          </label>
        </div>
      ) : null}

      {recent.length > 0 ? (
        <div className="wk-session-list-wrap">
          <h3 className="wk-session-list-title">最近記錄</h3>
          <ul className="wk-session-list">
            {recent.map((s) => {
              const effortBand = getEffortBand(s.difficultyRating);
              const effortClass = effortBand ? `wk-session-item--${effortBand}` : "";
              return (
                <li key={s.date} className={`wk-session-item ${effortClass}`.trim()}>
                  <span className="wk-session-date">{formatSessionDate(s.date)}</span>
                  <span className="wk-session-type">{s.workoutType}</span>
                  <span className="wk-session-meta">
                    {s.minutes}min
                    {s.difficultyRating != null ? (
                      <>
                        {" · "}
                        <span
                          className={`wk-effort-label wk-effort-label--${effortBand ?? "unknown"}`}
                        >
                          {getEffortLabel(s.difficultyRating)}
                        </span>
                      </>
                    ) : null}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      ) : (
        <p className="wk-hint">打勾記低今日訓練，我幫你計 streak～</p>
      )}
    </section>
  );
}
