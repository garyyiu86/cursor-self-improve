import { useMemo } from "react";
import { Link, useLocation } from "react-router-dom";
import { MUSCLE_GROUP_META } from "../services/exerciseLibrary.js";
import {
  computeMuscleBreakdown,
  computeStats,
  formatDuration,
  getRecentSessions,
  getSessions,
} from "../services/workoutStorage.js";
import "../styles/workout-dashboard.css";

function StatCard({ label, value, unit }) {
  return (
    <article className="wd-stat">
      <span className="wd-stat-value">
        {value}
        {unit ? <small>{unit}</small> : null}
      </span>
      <span className="wd-stat-label">{label}</span>
    </article>
  );
}

function EmptyState() {
  return (
    <section className="wd-empty">
      <span className="wd-empty-emoji" aria-hidden="true">
        🏋️
      </span>
      <h2>仲未開始第一堂訓練</h2>
      <p>去訓練計劃揀肌群同難度，撳「開始訓練」就會幫你計時同記錄組數。</p>
      <Link to="/workout" className="wd-btn wd-btn--primary">
        前往訓練計劃
      </Link>
    </section>
  );
}

export default function WorkoutDashboard() {
  const location = useLocation();
  const sessions = useMemo(() => getSessions(), [location.key]);
  const stats = useMemo(() => computeStats(sessions), [sessions]);
  const recent = useMemo(() => getRecentSessions(sessions, 5), [sessions]);
  const breakdown = useMemo(() => computeMuscleBreakdown(sessions), [sessions]);

  const hasSessions = stats.totalSessions > 0;

  return (
    <div className="wd-page">
      <header className="wd-header">
        <div className="wd-header-top">
          <Link to="/workout" className="wd-back">
            ← 計劃
          </Link>
          <h1 className="wd-heading">訓練紀錄</h1>
        </div>
        <p className="wd-tagline">計時 · 組數 · 進度一覽 ✨</p>
        {hasSessions ? (
          <Link to="/workout/progress" className="wd-progress-link">
            查看進度圖表 →
          </Link>
        ) : null}
      </header>

      {!hasSessions ? (
        <EmptyState />
      ) : (
        <>
          <section className="wd-streak" aria-label="連續訓練天數">
            <span className="wd-streak-num">{stats.streak}</span>
            <span className="wd-streak-label">日連續 🔥</span>
          </section>

          <section className="wd-stats-grid" aria-label="統計摘要">
            <StatCard label="完成訓練" value={stats.totalSessions} unit="次" />
            <StatCard label="總組數" value={stats.totalSets} unit="組" />
            <StatCard label="總下數" value={stats.totalReps} unit="下" />
            <StatCard label="總容量" value={stats.totalVolume} unit="kg" />
          </section>

          <section className="wd-section">
            <h2 className="wd-section-title">最近訓練</h2>
            <ul className="wd-recent-list">
              {recent.map((session) => {
                const setCount = session.exercises.reduce(
                  (n, ex) => n + ex.sets.length,
                  0,
                );
                const date = new Date(session.completedAt);
                const dateLabel = date.toLocaleDateString("zh-HK", {
                  month: "short",
                  day: "numeric",
                  weekday: "short",
                });

                return (
                  <li key={session.id} className="wd-recent-item">
                    <div className="wd-recent-main">
                      <strong>{session.dayTitle}</strong>
                      <span className="wd-recent-meta">
                        {dateLabel} · {formatDuration(session.durationMs)} · {setCount} 組
                      </span>
                    </div>
                    <span className="wd-recent-badge">
                      {MUSCLE_GROUP_META[session.muscleGroup]?.emoji || "💪"}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>

          {breakdown.length > 0 ? (
            <section className="wd-section">
              <h2 className="wd-section-title">肌群分布</h2>
              <ul className="wd-breakdown">
                {breakdown.map(({ muscleGroup, sets, pct }) => {
                  const meta = MUSCLE_GROUP_META[muscleGroup];
                  return (
                    <li key={muscleGroup} className="wd-bar-row">
                      <div className="wd-bar-head">
                        <span>
                          {meta?.emoji || "💪"} {meta?.label || muscleGroup}
                        </span>
                        <span className="wd-bar-count">{sets} 組</span>
                      </div>
                      <div className="wd-bar-track" aria-hidden="true">
                        <div className="wd-bar-fill" style={{ width: `${pct}%` }} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : null}
        </>
      )}

      <footer className="wd-footer">
        {hasSessions ? (
          <Link to="/workout/progress" className="wd-btn wd-btn--primary">
            健身進度
          </Link>
        ) : null}
        <Link to="/workout" className="wd-btn">
          訓練計劃
        </Link>
        <Link to="/" className="wd-btn wd-btn--ghost">
          返回聊天
        </Link>
      </footer>
    </div>
  );
}
