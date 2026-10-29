import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { buildSessionPlayUrl } from "../utils/sessionUrl";
import { TrainingWeekView } from "../components/TrainingWeekView";
import { getTrainingPlan } from "../services/trainingService.js";
import "../styles/workout-planner.css";
import "../styles/saved-plans.css";
import "../styles/training-tracker.css";

export default function SavedPlanDetail() {
  const { planId } = useParams();
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getTrainingPlan(planId)
      .then((data) => {
        if (!cancelled) {
          setPlan(data?.id ? data : null);
          setError("");
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setPlan(null);
          setError(String(err?.message || err));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [planId]);

  if (loading) {
    return (
      <div className="sp-page">
        <p className="sp-status">載入計劃中…</p>
      </div>
    );
  }

  if (error || !plan) {
    return (
      <div className="sp-page">
        <Link to="/workout/plans" className="sp-back">
          ← 返回列表
        </Link>
        <p className="sp-error">{error || "找不到呢個計劃"}</p>
      </div>
    );
  }

  return (
    <div className="wp-page">
      <header className="wp-header">
        <div className="wp-header-top">
          <Link to="/workout/plans" className="wp-back">
            ← 已儲存計劃
          </Link>
          <h1 className="wp-heading">訓練計劃詳情</h1>
        </div>
        <p className="wp-tagline">
          儲存於 {new Date(plan.createdAt).toLocaleString()} · {plan.source === "chat" ? "聊天" : "計劃器"}
        </p>
      </header>

      <section className="wp-plan-intro">
        <h2 className="wp-plan-title">{plan.title}</h2>
        <p className="wp-plan-sub">{plan.subtitle}</p>
        <div className="wp-action-row">
          <Link
            to={buildSessionPlayUrl({
              planId: plan.id,
              muscleGroup: plan.muscleGroup,
              difficulty: plan.difficulty,
            })}
            className="wp-start-btn"
          >
            開始訓練 ▶
          </Link>
        </div>
      </section>

      <TrainingWeekView planId={plan.id} days={plan.days} />

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
