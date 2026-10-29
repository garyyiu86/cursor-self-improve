import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { buildSessionPlayUrl } from "../utils/sessionUrl";
import "../styles/session.css";
import { generateTrainingPlan } from "../services/trainingService.js";
import {
  generateWeeklyPlan,
  MUSCLE_GROUPS,
  MUSCLE_GROUP_META,
} from "../services/workoutPlanner.js";
import "../styles/workout-planner.css";

const DIFFICULTIES = [
  { id: "beginner", label: "初學" },
  { id: "intermediate", label: "進階" },
  { id: "advanced", label: "高階" },
];

function DayCard({ day, muscleGroup, difficulty, planId }) {
  const isRest = day.type === "rest" || day.type === "free";
  const sessionUrl =
    !isRest && day.exercises.length > 0
      ? buildSessionPlayUrl({
          planId,
          dayId: day.id,
          muscleGroup,
          difficulty,
          dayIndex: day.dayIndex,
        })
      : null;

  return (
    <article className={`wp-day wp-day--${day.type}`}>
      <header className="wp-day-head">
        <h3 className="wp-day-title">
          <span className="wp-day-emoji" aria-hidden="true">
            {day.emoji}
          </span>
          星期{day.weekday} · {day.title}
        </h3>
        <span className="wp-day-duration">⏱ {day.duration}</span>
      </header>

      {day.note ? <p className="wp-day-note">{day.note}</p> : null}

      {!isRest && day.exercises.length > 0 ? (
        <ul className="wp-ex-list">
          {day.exercises.map((ex) => (
            <li key={ex.id} className="wp-ex-item">
              <div className="wp-ex-main">
                <strong className="wp-ex-name">{ex.name}</strong>
                <span className="wp-ex-meta">
                  {ex.sets} 組 × {ex.reps}
                  {ex.rest && ex.rest !== "—" ? ` · 休息 ${ex.rest}` : ""}
                </span>
              </div>
              {ex.tip ? <p className="wp-ex-tip">{ex.tip}</p> : null}
              {ex.idolContext ? (
                <p className="wp-ex-idol">✨ {ex.idolContext}</p>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      {sessionUrl ? (
        <Link to={sessionUrl} className="wk-day-start-btn">
          開始訓練 ▶
        </Link>
      ) : null}

      {isRest ? (
        <p className="wp-day-rest">
          {day.type === "free"
            ? "今日隨心活動就得～跳舞、行山、游水都 OK！"
            : "今日完全休息，讓肌肉修復生長。"}
        </p>
      ) : null}
    </article>
  );
}

export default function WorkoutPlanner() {
  const [muscleGroup, setMuscleGroup] = useState("biceps");
  const [difficulty, setDifficulty] = useState("beginner");
  const [plan, setPlan] = useState(() => generateWeeklyPlan("biceps", "beginner"));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setSaving(true);
    generateTrainingPlan({ muscleGroup, difficulty, source: "planner" })
      .then((saved) => {
        if (!cancelled && saved?.days) setPlan(saved);
      })
      .catch(() => {
        if (!cancelled) setPlan(generateWeeklyPlan(muscleGroup, difficulty));
      })
      .finally(() => {
        if (!cancelled) setSaving(false);
      });
    return () => {
      cancelled = true;
    };
  }, [muscleGroup, difficulty]);

  return (
    <div className="wp-page">
      <header className="wp-header">
        <div className="wp-header-top">
          <Link to="/" className="wp-back">
            ← 返回聊天
          </Link>
          <h1 className="wp-heading">健身訓練計劃</h1>
        </div>
        <p className="wp-tagline">
          LUMINA 偶像級 weekly planner · Eva 幫你編排 💪
          {saving ? " · 儲存中…" : " · 已自動儲存"}
        </p>
      </header>

      <section className="wp-controls" aria-label="計劃設定">
        <div className="wp-control">
          <span className="wp-control-label">肌群</span>
          <div className="wp-chip-row" role="group" aria-label="選擇肌群">
            {MUSCLE_GROUPS.map((g) => {
              const meta = MUSCLE_GROUP_META[g];
              const active = muscleGroup === g;
              return (
                <button
                  key={g}
                  type="button"
                  className={`wp-chip${active ? " wp-chip--active" : ""}`}
                  aria-pressed={active}
                  onClick={() => setMuscleGroup(g)}
                >
                  {meta.emoji} {meta.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="wp-control">
          <span className="wp-control-label">難度</span>
          <div className="wp-toggle-row" role="group" aria-label="選擇難度">
            {DIFFICULTIES.map((d) => {
              const active = difficulty === d.id;
              return (
                <button
                  key={d.id}
                  type="button"
                  className={`wp-toggle${active ? " wp-toggle--active" : ""}`}
                  aria-pressed={active}
                  onClick={() => setDifficulty(d.id)}
                >
                  {d.label}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <section className="wp-plan-intro">
        <h2 className="wp-plan-title">{plan.title}</h2>
        <p className="wp-plan-sub">{plan.subtitle}</p>
        <div className="wp-action-row">
          <Link
            to={buildSessionPlayUrl({ muscleGroup, difficulty, planId: plan.id })}
            className="wp-start-btn"
          >
            開始訓練 ▶
          </Link>
          <Link to="/workout/dashboard" className="wp-dash-link">
            訓練紀錄
          </Link>
          <Link to="/workout/progress" className="wp-dash-link">
            健身進度
          </Link>
          <Link to="/workout/plans" className="wp-dash-link">
            已儲存計劃
          </Link>
        </div>
      </section>

      <div className="wp-day-grid">
        {plan.days.map((day) => (
          <DayCard
            key={day.id}
            day={day}
            muscleGroup={muscleGroup}
            difficulty={difficulty}
            planId={plan.id}
          />
        ))}
      </div>

      <section className="wp-reminders">
        <h3>重點提醒</h3>
        <ul>
          {plan.reminders.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <footer className="wp-footer">LUMINA motto：{plan.motto} ✊</footer>
    </div>
  );
}
