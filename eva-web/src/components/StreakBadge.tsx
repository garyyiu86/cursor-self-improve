import type { ProgressLevel } from "../../../eva-core/src/utils/progress.ts";
import "../styles/workout.css";

export interface StreakBadgeProps {
  streak: number;
  /** Habit tier — intensifies flame styling when streaking. */
  level?: ProgressLevel;
}

function flameForStreak(streak: number, level?: ProgressLevel): string {
  if (streak <= 0) return "🌸";
  if (level === "streaking" || streak >= 7) return "🔥🔥";
  if (streak >= 3) return "🔥";
  return "✨";
}

export function StreakBadge({ streak, level }: StreakBadgeProps) {
  const hot = level === "streaking" || streak >= 5;
  return (
    <div
      className={`wk-streak-badge${hot ? " wk-streak-badge--hot" : ""}`}
      aria-label={`連續訓練 ${streak} 日`}
    >
      <span className="wk-streak-flame" aria-hidden="true">
        {flameForStreak(streak, level)}
      </span>
      <span className="wk-streak-count">{streak}</span>
      <span className="wk-streak-label">日連續</span>
    </div>
  );
}
