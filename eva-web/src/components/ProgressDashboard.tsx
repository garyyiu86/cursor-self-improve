import type { ProgressStats } from "../services/progressStats";
import { EncouragementBanner } from "./EncouragementBanner";
import { StreakCalendar } from "./StreakCalendar";
import { StreakBadge } from "./StreakBadge";
import "../styles/dashboard.css";

export interface ProgressDashboardProps {
  stats: ProgressStats;
  onMonthChange?: (year: number, month: number) => void;
}

export function ProgressDashboard({ stats, onMonthChange }: ProgressDashboardProps) {
  const maxPct = Math.max(...stats.weeklyCompletion.map((w) => w.pct), 1);

  return (
    <div className="dash-root">
      <EncouragementBanner encouragement={stats.encouragement} />

      <section className="dash-streak-row" aria-label="連續訓練統計">
        <article className="dash-streak-card">
          <StreakBadge streak={stats.currentStreak} />
          <span className="dash-streak-caption">目前連續</span>
        </article>
        <article className="dash-streak-card dash-streak-card--longest">
          <span className="dash-longest-num" aria-label={`最長連續 ${stats.longestStreak} 日`}>
            🏆 {stats.longestStreak}
          </span>
          <span className="dash-streak-caption">最長紀錄</span>
        </article>
        <article className="dash-streak-card dash-streak-card--total">
          <span className="dash-total-num">{stats.totalCompletedDays}</span>
          <span className="dash-streak-caption">累計完成日</span>
        </article>
      </section>

      <StreakCalendar
        calendarMonth={stats.calendarMonth}
        calendarDays={stats.calendarDays}
        onMonthChange={onMonthChange}
      />

      <section className="dash-weekly-chart" aria-label="近四週完成率">
        <h3 className="dash-section-title">近四週完成率</h3>
        <ul className="dash-bars" role="list">
          {stats.weeklyCompletion.map((week) => (
            <li key={week.weekStart} className="dash-bar-item">
              <div className="dash-bar-track" aria-hidden="true">
                <div
                  className="dash-bar-fill"
                  style={{ height: `${Math.round((week.pct / maxPct) * 100)}%` }}
                />
              </div>
              <span className="dash-bar-pct">{week.pct}%</span>
              <span className="dash-bar-label">{week.weekLabel}</span>
              <span className="dash-bar-meta">
                {week.completedDays}/{week.expectedDays} 日
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
