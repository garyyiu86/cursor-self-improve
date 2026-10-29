import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ProgressDashboard } from "../components/ProgressDashboard";
import {
  fetchProgressStats,
  type ProgressStats,
} from "../services/progressStats";
import "../styles/dashboard.css";
import "../styles/library.css";

const DEFAULT_PLAN_ID = "biceps-beginner-weekly";

export default function DashboardPage() {
  const [stats, setStats] = useState<ProgressStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMonth, setViewMonth] = useState<{ year: number; month: number }>(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });

  const loadStats = useCallback(async (year: number, month: number) => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchProgressStats(DEFAULT_PLAN_ID, "biceps", "beginner", {
        year,
        month,
      });
      setStats(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "無法載入進度");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStats(viewMonth.year, viewMonth.month);
  }, [loadStats, viewMonth.year, viewMonth.month]);

  const handleMonthChange = (year: number, month: number) => {
    setViewMonth({ year, month });
  };

  return (
    <div className="dash-page">
      <header className="dash-page-head">
        <Link to="/workout/track" className="dash-page-back">
          ← 訓練追蹤
        </Link>
        <h1 className="dash-page-title">進度儀表板</h1>
      </header>

      <nav className="lib-track-nav" aria-label="訓練追蹤導航">
        <Link to="/workout/track" className="lib-track-nav-link">
          訓練計劃
        </Link>
        <Link
          to="/workout/track/dashboard"
          className="lib-track-nav-link lib-track-nav-link--active"
          aria-current="page"
        >
          進度儀表板
        </Link>
        <Link to="/workout/track/library" className="lib-track-nav-link">
          動作庫
        </Link>
      </nav>

      {loading && !stats ? (
        <p className="dash-page-status">載入進度中…</p>
      ) : stats ? (
        <>
          {error ? <p className="dash-page-notice">{error}</p> : null}
          <ProgressDashboard stats={stats} onMonthChange={handleMonthChange} />
        </>
      ) : (
        <p className="dash-page-status">{error ?? "無法載入進度"}</p>
      )}

      <footer className="dash-page-foot">
        <Link to="/workout/track" className="dash-page-cta">
          返回今日訓練 →
        </Link>
      </footer>
    </div>
  );
}
