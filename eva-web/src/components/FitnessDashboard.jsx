import { Link } from "react-router-dom";
import { FITNESS_GOALS } from "../../../eva-core/services/fitness-planner.js";
import { useFitnessState } from "../hooks/useFitnessState.js";
import WeeklyPlanView from "./WeeklyPlanView.jsx";
import "../styles/fitness.css";

const LEVELS = [
  { id: "beginner", label: "初學" },
  { id: "intermediate", label: "進階" },
  { id: "advanced", label: "高階" },
];

export default function FitnessDashboard() {
  const {
    activePlan,
    selectedGoal,
    level,
    daysPerWeek,
    streak,
    stats,
    setSelectedGoal,
    setLevel,
    setDaysPerWeek,
    regeneratePlan,
    toggleExercise,
    isExerciseDone,
  } = useFitnessState();

  const rec = activePlan?.recommendation;

  return (
    <div className="fit-page">
      <header className="fit-header">
        <div className="fit-header-top">
          <Link to="/" className="fit-back">
            ← 聊天
          </Link>
          <h1 className="fit-heading">Eva 健身顧問</h1>
        </div>
        <p className="fit-tagline">星光銀 × 櫻粉 · 偶像級每週計劃 ✨</p>
      </header>

      <section className="fit-goals" aria-label="訓練目標">
        <h2 className="fit-section-title">揀個目標</h2>
        <div className="fit-goal-grid">
          {Object.entries(FITNESS_GOALS).map(([id, meta]) => (
            <button
              key={id}
              type="button"
              className={`fit-goal-btn${selectedGoal === id ? " fit-goal-btn--active" : ""}`}
              onClick={() => setSelectedGoal(id)}
            >
              <span className="fit-goal-emoji" aria-hidden="true">
                {meta.emoji}
              </span>
              {meta.label}
            </button>
          ))}
        </div>
      </section>

      <section className="fit-controls" aria-label="計劃設定">
        <div className="fit-control-row">
          <label className="fit-label" htmlFor="fit-level">
            難度
          </label>
          <select
            id="fit-level"
            className="fit-select"
            value={level}
            onChange={(e) => setLevel(e.target.value)}
          >
            {LEVELS.map((l) => (
              <option key={l.id} value={l.id}>
                {l.label}
              </option>
            ))}
          </select>
        </div>
        <div className="fit-control-row">
          <label className="fit-label" htmlFor="fit-days">
            每週訓練日
          </label>
          <input
            id="fit-days"
            className="fit-range"
            type="range"
            min={2}
            max={6}
            value={daysPerWeek}
            onChange={(e) => setDaysPerWeek(Number(e.target.value))}
          />
          <span className="fit-days-val">{daysPerWeek} 日</span>
        </div>
        <button type="button" className="fit-btn fit-btn--primary" onClick={regeneratePlan}>
          生成新計劃
        </button>
      </section>

      {rec ? (
        <section className="fit-rec" aria-label="Eva 建議">
          <span className="fit-rec-emoji" aria-hidden="true">
            {rec.emoji}
          </span>
          <div>
            <p className="fit-rec-focus">
              重點：{rec.focusAreas.join(" · ")}
            </p>
            <p className="fit-rec-tip">{rec.tip}</p>
          </div>
        </section>
      ) : null}

      <section className="fit-progress" aria-label="進度摘要">
        <div className="fit-progress-head">
          <h2 className="fit-section-title">本週進度</h2>
          <span className="fit-streak">
            🔥 {streak} 日連續
          </span>
        </div>
        <div className="fit-bar-track" role="progressbar" aria-valuenow={stats.pct} aria-valuemin={0} aria-valuemax={100}>
          <div className="fit-bar-fill" style={{ width: `${stats.pct}%` }} />
        </div>
        <p className="fit-progress-meta">
          {stats.completed} / {stats.total} 項動作完成 · {stats.pct}%
        </p>
        <button
          type="button"
          className="fit-btn fit-btn--quick"
          onClick={() => {
            const first = activePlan?.days?.find(
              (d) => d.type === "workout" && d.exercises.length > 0,
            );
            const ex = first?.exercises?.[0];
            if (ex && !isExerciseDone(ex.id)) toggleExercise(ex.id);
          }}
        >
          ⚡ 快速開始第一項
        </button>
      </section>

      <WeeklyPlanView
        plan={activePlan}
        isExerciseDone={isExerciseDone}
        onToggleExercise={toggleExercise}
      />

      <footer className="fit-footer">
        <Link to="/workout" className="fit-btn">
          訓練計劃（計時）
        </Link>
        <Link to="/workout/dashboard" className="fit-btn fit-btn--ghost">
          訓練紀錄
        </Link>
      </footer>
    </div>
  );
}
