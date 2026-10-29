import { MOOD_LEVELS } from "../../../eva-core/services/mood-journal.js";

/** @param {{ streak: number, stats: ReturnType<import('../../../eva-core/services/mood-journal.js').getMoodStats> }} props */
export default function MoodStreak({ streak, stats }) {
  const { distribution, weeklyTrend, totalEntries, avgMood } = stats;

  return (
    <section className="mj-streak" aria-label="心情統計">
      <div className="mj-streak-hero">
        <div className="mj-streak-count-wrap">
          <span className="mj-streak-fire" aria-hidden="true">
            {streak > 0 ? "🔥" : "🌸"}
          </span>
          <span className="mj-streak-count">{streak}</span>
          <span className="mj-streak-unit">日連續打卡</span>
        </div>
        {totalEntries > 0 ? (
          <p className="mj-streak-summary">
            共 {totalEntries} 次 · 平均{" "}
            {MOOD_LEVELS[Math.round(avgMood)]?.emoji || "🙂"}{" "}
            {avgMood.toFixed(1)}
          </p>
        ) : (
          <p className="mj-streak-summary">今日開始記低心情，我陪住你 ✨</p>
        )}
      </div>

      {totalEntries > 0 ? (
        <>
          <div className="mj-distribution" aria-label="心情分佈">
            {[5, 4, 3, 2, 1].map((level) => {
              const count = distribution[level] || 0;
              const pct =
                totalEntries > 0 ? Math.round((count / totalEntries) * 100) : 0;
              return (
                <div key={level} className="mj-dist-row">
                  <span className="mj-dist-emoji" aria-hidden="true">
                    {MOOD_LEVELS[level].emoji}
                  </span>
                  <div className="mj-dist-bar-wrap">
                    <div
                      className="mj-dist-bar"
                      style={{ width: `${Math.max(pct, count > 0 ? 8 : 0)}%` }}
                    />
                  </div>
                  <span className="mj-dist-count">{count}</span>
                </div>
              );
            })}
          </div>

          {weeklyTrend.length > 0 ? (
            <div className="mj-weekly-trend" aria-label="每週趨勢">
              <h3 className="mj-trend-title">每週趨勢</h3>
              <div className="mj-trend-row">
                {weeklyTrend.map((w) => (
                  <div
                    key={w.weekLabel}
                    className={`mj-trend-chip${w.isCurrentWeek ? " mj-trend-chip--current" : ""}`}
                    title={`${w.weekLabel} · 平均 ${w.avgMood}`}
                  >
                    <span className="mj-trend-emoji" aria-hidden="true">
                      {w.emoji}
                    </span>
                    <span className="mj-trend-label">{w.weekLabel}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
