import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listTrainingPlans } from "../services/trainingService.js";
import { MUSCLE_GROUP_META } from "../services/workoutPlanner.js";
import "../styles/saved-plans.css";

function formatWhen(iso) {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function sourceLabel(source) {
  return source === "chat" ? "聊天生成" : "計劃器";
}

export default function SavedPlans() {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listTrainingPlans()
      .then((data) => {
        if (!cancelled) {
          setPlans(Array.isArray(data?.plans) ? data.plans : []);
          setError("");
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setPlans([]);
          setError(String(err?.message || err));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="sp-page">
      <header className="sp-header">
        <Link to="/workout" className="sp-back">
          ← 返回計劃器
        </Link>
        <h1 className="sp-heading">已儲存訓練計劃</h1>
        <p className="sp-tagline">Eva 幫你留低每次生成嘅 weekly plan，隨時翻睇 💾</p>
      </header>

      {loading ? <p className="sp-status">載入中…</p> : null}
      {error ? <p className="sp-error">{error}</p> : null}

      {!loading && !error && plans.length === 0 ? (
        <section className="sp-empty">
          <p>仲未有儲存嘅計劃～</p>
          <Link to="/workout" className="sp-btn">
            去生成計劃
          </Link>
        </section>
      ) : null}

      {!loading && plans.length > 0 ? (
        <ul className="sp-list">
          {plans.map((plan) => {
            const meta = MUSCLE_GROUP_META[plan.muscleGroup] || MUSCLE_GROUP_META.biceps;
            return (
              <li key={plan.id}>
                <Link to={`/workout/plans/${encodeURIComponent(plan.id)}`} className="sp-card">
                  <div className="sp-card-top">
                    <span className="sp-card-emoji" aria-hidden="true">
                      {meta.emoji}
                    </span>
                    <div>
                      <h2 className="sp-card-title">{plan.title}</h2>
                      <p className="sp-card-sub">
                        {meta.label} · {plan.difficulty} · {plan.workoutDayCount} 訓練日
                      </p>
                    </div>
                  </div>
                  <div className="sp-card-meta">
                    <span className="sp-badge">{sourceLabel(plan.source)}</span>
                    <time dateTime={plan.createdAt}>{formatWhen(plan.createdAt)}</time>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
