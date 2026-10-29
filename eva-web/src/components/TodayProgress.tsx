import type { DaySetProgress } from "../utils/workoutStore";

export interface TodayProgressProps {
  progress: DaySetProgress;
  label?: string;
}

export function TodayProgress({ progress, label }: TodayProgressProps) {
  if (!progress.trackable) return null;

  const ariaLabel =
    label ??
    (progress.complete
      ? `今日訓練進度 ${progress.done} / ${progress.total} 全部完成`
      : `今日訓練進度 ${progress.done} / ${progress.total} 組 · ${progress.pct}%`);

  return (
    <div
      className={`wci-progress${progress.complete ? " wci-progress--complete" : ""}`}
      role="progressbar"
      aria-valuenow={progress.done}
      aria-valuemin={0}
      aria-valuemax={progress.total}
      aria-label={ariaLabel}
    >
      <div className="wci-progress-label">
        {progress.complete
          ? `🎉 ${progress.done} / ${progress.total} 組全部完成！`
          : `${progress.done} / ${progress.total} 組 · ${progress.pct}%`}
      </div>
      <div className="wci-progress-track">
        <div className="wci-progress-fill" style={{ width: `${progress.pct}%` }} />
      </div>
    </div>
  );
}
