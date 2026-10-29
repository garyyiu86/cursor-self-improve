import { useMemo } from "react";
import { Link } from "react-router-dom";
import {
  BICEP_WEEKLY_PLAN,
  getCatchUpSuggestion,
  getProgressOverview,
  getProgressSummary,
  getTodayPlanIndex,
} from "../../../eva-core/src/workoutPlanner.ts";
import { RoutineDayAccordion } from "../components/RoutineDayAccordion";
import { LastDebriefCard, WorkoutTracker } from "../components/WorkoutTracker";
import "../styles/workout.css";

export default function RoutineView() {
  const today = useMemo(() => new Date(), []);
  const todayIndex = useMemo(() => getTodayPlanIndex(today), [today]);
  const todayDay = BICEP_WEEKLY_PLAN.days.find((d) => d.dayIndex === todayIndex) ?? BICEP_WEEKLY_PLAN.days[0];
  const overview = useMemo(() => getProgressOverview(BICEP_WEEKLY_PLAN, today), [today]);
  const summary = useMemo(() => getProgressSummary(BICEP_WEEKLY_PLAN, today), [today]);
  const catchUp = useMemo(() => getCatchUpSuggestion(BICEP_WEEKLY_PLAN, today), [today]);

  const defaultExpandedId = overview.idle.idle ? todayDay.id : undefined;
  const hasWarmUpToday = (todayDay.warmUp?.length ?? 0) > 0;

  return (
    <div className="wk-page wk-routine-page">
      <header className="wk-page-head">
        <Link to="/" className="wk-page-back">
          ← 返回
        </Link>
        <h1 className="wk-page-title">{BICEP_WEEKLY_PLAN.title}</h1>
      </header>

      <p className="wk-routine-subtitle">{BICEP_WEEKLY_PLAN.subtitle}</p>
      <p className="wk-routine-motto">{BICEP_WEEKLY_PLAN.motto}</p>

      {hasWarmUpToday ? (
        <p className="wk-warmup-reminder" role="note">
          🔥 開始主訓練前，記得先做今日 Warm-up 熱身 — 跟住下面「{todayDay.emoji} 週{todayDay.weekday}」展開就得。
        </p>
      ) : (
        <p className="wk-warmup-reminder" role="note">
          📋 撳下面每日標題展開詳細動作；有 <span className="wk-routine-today-pill wk-routine-today-pill--inline">TODAY</span>{" "}
          就係今日計劃。
        </p>
      )}

      {overview.idle.idle ? (
        <div className="wk-idle-banner" role="status">
          <span className="wk-idle-icon" aria-hidden="true">
            💤
          </span>
          <div>
            <strong>好久冇動啦</strong>
            <p>
              距離上次訓練已 {overview.idle.daysSinceLast} 日
              {overview.idle.lastSessionDate
                ? `（上次：${overview.idle.lastSessionDate}）`
                : ""}
              ——今日重新開始就得，我陪住你 ✨
            </p>
          </div>
        </div>
      ) : null}

      <div className="wk-catchup-banner" role="status">
        <span className="wk-catchup-icon" aria-hidden="true">
          {catchUp.todayDone ? "✅" : "📋"}
        </span>
        <p>{catchUp.message}</p>
      </div>

      <section className="wk-routine-week" aria-label="每週概覽">
        <h2 className="wk-routine-section-title">一週概覽</h2>
        <LastDebriefCard debrief={summary.latestDebrief} className="wk-debrief-card--routine" />
        <RoutineDayAccordion
          days={BICEP_WEEKLY_PLAN.days}
          todayIndex={todayIndex}
          defaultExpandedId={defaultExpandedId}
        />
      </section>

      <WorkoutTracker />

      <ul className="wk-reminders">
        {BICEP_WEEKLY_PLAN.reminders.map((tip) => (
          <li key={tip}>{tip}</li>
        ))}
      </ul>
    </div>
  );
}
