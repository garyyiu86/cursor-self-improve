import { useMemo } from "react";
import type { CalendarDay } from "../services/progressStats";
import "../styles/dashboard.css";

const WEEKDAY_LABELS = ["一", "二", "三", "四", "五", "六", "日"];

export interface StreakCalendarProps {
  calendarMonth: string;
  calendarDays: CalendarDay[];
  onMonthChange?: (year: number, month: number) => void;
}

function parseMonth(calendarMonth: string): { year: number; month: number } {
  const [y, m] = calendarMonth.split("-").map(Number);
  return { year: y, month: m - 1 };
}

function statusLabel(status: CalendarDay["status"]): string {
  switch (status) {
    case "completed":
      return "已完成";
    case "missed":
      return "錯過";
    case "today":
      return "今日";
    case "future":
      return "未來";
    case "rest":
      return "休息";
    default:
      return "";
  }
}

export function StreakCalendar({
  calendarMonth,
  calendarDays,
  onMonthChange,
}: StreakCalendarProps) {
  const { year, month } = parseMonth(calendarMonth);

  const monthLabel = useMemo(
    () =>
      new Date(year, month, 1).toLocaleDateString("zh-HK", {
        year: "numeric",
        month: "long",
      }),
    [year, month],
  );

  const leadingBlanks = useMemo(() => {
    const first = new Date(year, month, 1);
    const jsDay = first.getDay();
    return jsDay === 0 ? 6 : jsDay - 1;
  }, [year, month]);

  const shiftMonth = (delta: number) => {
    const d = new Date(year, month + delta, 1);
    onMonthChange?.(d.getFullYear(), d.getMonth());
  };

  return (
    <section className="dash-calendar" aria-label={`${monthLabel} 訓練日曆`}>
      <header className="dash-calendar-head">
        <button
          type="button"
          className="dash-calendar-nav"
          onClick={() => shiftMonth(-1)}
          aria-label="上個月"
        >
          ‹
        </button>
        <h3 className="dash-calendar-title">{monthLabel}</h3>
        <button
          type="button"
          className="dash-calendar-nav"
          onClick={() => shiftMonth(1)}
          aria-label="下個月"
        >
          ›
        </button>
      </header>

      <div className="dash-calendar-weekdays" aria-hidden="true">
        {WEEKDAY_LABELS.map((label) => (
          <span key={label} className="dash-calendar-weekday">
            {label}
          </span>
        ))}
      </div>

      <div className="dash-calendar-grid" role="grid">
        {Array.from({ length: leadingBlanks }, (_, i) => (
          <span key={`blank-${i}`} className="dash-calendar-cell dash-calendar-cell--blank" />
        ))}
        {calendarDays.map((day) => (
          <span
            key={day.date}
            role="gridcell"
            className={`dash-calendar-cell dash-calendar-cell--${day.status}`}
            aria-label={`${day.dayOfMonth} 日 · ${statusLabel(day.status)}`}
            title={statusLabel(day.status)}
          >
            {day.dayOfMonth}
          </span>
        ))}
      </div>

      <ul className="dash-calendar-legend" aria-label="圖例">
        <li>
          <span className="dash-legend-dot dash-legend-dot--completed" /> 完成
        </li>
        <li>
          <span className="dash-legend-dot dash-legend-dot--missed" /> 錯過
        </li>
        <li>
          <span className="dash-legend-dot dash-legend-dot--today" /> 今日
        </li>
        <li>
          <span className="dash-legend-dot dash-legend-dot--rest" /> 休息
        </li>
      </ul>
    </section>
  );
}
