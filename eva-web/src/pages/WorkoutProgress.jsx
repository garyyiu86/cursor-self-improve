import { useEffect, useMemo, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import { MUSCLE_GROUP_META } from "../services/exerciseLibrary.js";
import {
  computeAchievements,
  computeMuscleBalance,
  computePersonalRecords,
  computeVolumeTrend,
  computeWeightProgression,
  formatAchievedDate,
  hasProgressData,
} from "../services/progressCalculator.js";
import { computeStats, getSessions } from "../services/workoutStorage.js";
import "../styles/workout-progress.css";

const MUSCLE_COLORS = {
  biceps: "#ec4899",
  triceps: "#f472b6",
  chest: "#fb7185",
  back: "#a78bfa",
  shoulders: "#818cf8",
  legs: "#34d399",
  core: "#fbbf24",
  other: "#94a3b8",
};

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {{ label: string, value: number }[]} points
 * @param {number} width
 * @param {number} height
 * @param {string} yUnit
 * @param {string} lineColor
 */
function drawLineChart(ctx, points, width, height, yUnit, lineColor) {
  const pad = { top: 12, right: 10, bottom: 28, left: 36 };
  const chartW = width - pad.left - pad.right;
  const chartH = height - pad.top - pad.bottom;

  ctx.clearRect(0, 0, width, height);

  if (points.length === 0) {
    ctx.fillStyle = "#9ca3af";
    ctx.font = "12px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("暫無數據", width / 2, height / 2);
    return;
  }

  const values = points.map((p) => p.value);
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const yMin = minVal === maxVal ? Math.max(0, minVal - 1) : minVal * 0.9;
  const yMax = minVal === maxVal ? maxVal + 1 : maxVal * 1.05;

  const xAt = (i) =>
    pad.left + (points.length === 1 ? chartW / 2 : (i / (points.length - 1)) * chartW);
  const yAt = (v) => pad.top + chartH - ((v - yMin) / (yMax - yMin)) * chartH;

  ctx.strokeStyle = "rgba(192, 192, 192, 0.35)";
  ctx.lineWidth = 1;
  for (let i = 0; i <= 3; i += 1) {
    const y = pad.top + (chartH / 3) * i;
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(width - pad.right, y);
    ctx.stroke();
  }

  ctx.fillStyle = "#6b7280";
  ctx.font = "10px system-ui, sans-serif";
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  for (let i = 0; i <= 3; i += 1) {
    const val = yMax - ((yMax - yMin) / 3) * i;
    const y = pad.top + (chartH / 3) * i;
    ctx.fillText(`${Math.round(val)}`, pad.left - 4, y);
  }

  ctx.save();
  ctx.translate(8, pad.top + chartH / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.textAlign = "center";
  ctx.fillStyle = "#9d174d";
  ctx.font = "10px system-ui, sans-serif";
  ctx.fillText(yUnit, 0, 0);
  ctx.restore();

  ctx.strokeStyle = lineColor;
  ctx.lineWidth = 2;
  ctx.lineJoin = "round";
  ctx.beginPath();
  points.forEach((p, i) => {
    const x = xAt(i);
    const y = yAt(p.value);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();

  points.forEach((p, i) => {
    const x = xAt(i);
    const y = yAt(p.value);
    ctx.fillStyle = lineColor;
    ctx.beginPath();
    ctx.arc(x, y, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 1.5;
    ctx.stroke();
  });

  ctx.fillStyle = "#6b7280";
  ctx.font = "9px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  const labelStep = points.length <= 5 ? 1 : Math.ceil(points.length / 5);
  points.forEach((p, i) => {
    if (i % labelStep !== 0 && i !== points.length - 1) return;
    ctx.fillText(p.label, xAt(i), height - pad.bottom + 6);
  });
}

function LineChart({ points, yUnit, lineColor, ariaLabel }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const draw = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.scale(dpr, dpr);
      drawLineChart(ctx, points, rect.width, rect.height, yUnit, lineColor);
    };

    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(canvas);
    return () => ro.disconnect();
  }, [points, yUnit, lineColor]);

  return (
    <canvas
      ref={canvasRef}
      className="wp-chart-canvas"
      role="img"
      aria-label={ariaLabel}
    />
  );
}

function PRCard({ record }) {
  return (
    <article className="wp-pr-card" aria-label={record.label}>
      <span className="wp-pr-emoji" aria-hidden="true">
        {record.emoji}
      </span>
      <span className="wp-pr-value">
        {record.value != null ? record.value : "—"}
        {record.value != null ? <small>{record.unit}</small> : null}
      </span>
      <span className="wp-pr-label">{record.label}</span>
      {record.detail ? <span className="wp-pr-detail">{record.detail}</span> : null}
      {record.achievedAt ? (
        <span className="wp-pr-date">{formatAchievedDate(record.achievedAt)}</span>
      ) : null}
    </article>
  );
}

function EmptyState() {
  return (
    <section className="wp-empty">
      <span className="wp-empty-emoji" aria-hidden="true">
        📊
      </span>
      <h2>仲未有進度數據</h2>
      <p>完成至少一堂訓練並記錄組數，就會喺呢度睇到重量曲線、容量趨勢同個人紀錄。</p>
      <Link to="/workout" className="wp-btn wp-btn--primary">
        前往訓練計劃
      </Link>
    </section>
  );
}

export default function WorkoutProgress() {
  const location = useLocation();
  const sessions = useMemo(() => getSessions(), [location.key]);

  const hasData = useMemo(() => hasProgressData(sessions), [sessions]);
  const records = useMemo(() => computePersonalRecords(sessions), [sessions]);
  const weightSeries = useMemo(() => computeWeightProgression(sessions), [sessions]);
  const volumeSeries = useMemo(() => computeVolumeTrend(sessions), [sessions]);
  const achievements = useMemo(
    () => computeAchievements(sessions, computeStats),
    [sessions],
  );
  const muscleBalance = useMemo(() => computeMuscleBalance(sessions), [sessions]);

  return (
    <div className="wp-page">
      <header className="wp-header">
        <div className="wp-header-top">
          <Link to="/workout/dashboard" className="wp-back">
            ← 紀錄
          </Link>
          <h1 className="wp-heading">健身進度</h1>
        </div>
        <p className="wp-tagline">重量 · 容量 · 個人紀錄 · 成就 ✨</p>
      </header>

      {!hasData ? (
        <EmptyState />
      ) : (
        <>
          <section className="wp-section" aria-label="個人紀錄">
            <h2 className="wp-section-title">個人紀錄 (PR)</h2>
            <div className="wp-pr-grid">
              {records.map((record) => (
                <PRCard key={record.id} record={record} />
              ))}
            </div>
          </section>

          <section className="wp-section" aria-label="重量進展">
            <div className="wp-chart-card">
              <div className="wp-chart-head">
                <h2 className="wp-section-title">重量進展</h2>
                <span className="wp-chart-y-label">kg</span>
              </div>
              <LineChart
                points={weightSeries}
                yUnit="kg"
                lineColor="#be185d"
                ariaLabel="重量進展圖表，橫軸為日期，縱軸為公斤"
              />
            </div>
          </section>

          <section className="wp-section" aria-label="容量趨勢">
            <div className="wp-chart-card">
              <div className="wp-chart-head">
                <h2 className="wp-section-title">容量趨勢</h2>
                <span className="wp-chart-y-label">kg</span>
              </div>
              <LineChart
                points={volumeSeries}
                yUnit="volume (kg)"
                lineColor="#7c3aed"
                ariaLabel="容量趨勢圖表，橫軸為日期，縱軸為訓練容量公斤"
              />
            </div>
          </section>

          <section className="wp-section" aria-label="成就徽章">
            <h2 className="wp-section-title">成就徽章</h2>
            <div className="wp-badge-grid">
              {achievements.map((badge) => (
                <div
                  key={badge.id}
                  className={`wp-badge${badge.unlocked ? "" : " wp-badge--locked"}`}
                  title={badge.description}
                >
                  <span className="wp-badge-emoji" aria-hidden="true">
                    {badge.emoji}
                  </span>
                  <span className="wp-badge-label">{badge.label}</span>
                  {badge.unlocked && badge.unlockedAt ? (
                    <span className="wp-badge-date">
                      {formatAchievedDate(badge.unlockedAt)}
                    </span>
                  ) : null}
                </div>
              ))}
            </div>
          </section>

          {muscleBalance.length > 0 ? (
            <section className="wp-section" aria-label="肌群平衡">
              <h2 className="wp-section-title">肌群平衡</h2>
              <div className="wp-balance-bar" role="img" aria-label="肌群訓練分布橫條圖">
                {muscleBalance.map(({ muscleGroup, pct }) => (
                  <div
                    key={muscleGroup}
                    className="wp-balance-seg"
                    style={{
                      width: `${pct}%`,
                      background: MUSCLE_COLORS[muscleGroup] || MUSCLE_COLORS.other,
                    }}
                    title={`${MUSCLE_GROUP_META[muscleGroup]?.label || muscleGroup} ${pct}%`}
                  />
                ))}
              </div>
              <ul className="wp-balance-legend">
                {muscleBalance.map(({ muscleGroup, sets, pct }) => {
                  const meta = MUSCLE_GROUP_META[muscleGroup];
                  return (
                    <li key={muscleGroup}>
                      <span
                        className="wp-balance-dot"
                        style={{
                          background: MUSCLE_COLORS[muscleGroup] || MUSCLE_COLORS.other,
                        }}
                        aria-hidden="true"
                      />
                      {meta?.emoji || "💪"} {meta?.label || muscleGroup} · {sets} 組 ({pct}%)
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : null}
        </>
      )}

      <footer className="wp-footer">
        <Link to="/workout/dashboard" className="wp-btn">
          訓練紀錄
        </Link>
        <Link to="/workout" className="wp-btn wp-btn--ghost">
          訓練計劃
        </Link>
      </footer>
    </div>
  );
}
