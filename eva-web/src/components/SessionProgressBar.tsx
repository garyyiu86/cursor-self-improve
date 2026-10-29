import "../styles/session.css";

export interface SessionProgressBarProps {
  completedSets: number;
  totalSets: number;
  exerciseIndex: number;
  exerciseCount: number;
  elapsedLabel: string;
}

export function SessionProgressBar({
  completedSets,
  totalSets,
  exerciseIndex,
  exerciseCount,
  elapsedLabel,
}: SessionProgressBarProps) {
  const pct = totalSets > 0 ? Math.round((completedSets / totalSets) * 100) : 0;

  return (
    <header className="sess-progress" aria-label="訓練進度">
      <div className="sess-progress-top">
        <span className="sess-progress-elapsed" aria-live="polite">
          ⏱ {elapsedLabel}
        </span>
        <span className="sess-progress-meta">
          動作 {Math.min(exerciseIndex + 1, exerciseCount)}/{exerciseCount}
        </span>
      </div>
      <div
        className="sess-progress-track"
        role="progressbar"
        aria-valuenow={completedSets}
        aria-valuemin={0}
        aria-valuemax={totalSets}
        aria-label={`已完成 ${completedSets} / ${totalSets} 組`}
      >
        <div className="sess-progress-fill" style={{ width: `${pct}%` }} />
      </div>
      <p className="sess-progress-label">
        {completedSets}/{totalSets} 組 · {pct}%
      </p>
    </header>
  );
}
