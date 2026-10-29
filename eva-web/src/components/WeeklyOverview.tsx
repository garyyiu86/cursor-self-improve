import {
  EVA_WEEKLY_PLAN,
  getTodayDayIndex,
  type WeeklyDay,
} from "../data/weeklyPlan";
import { isDayFullyComplete, type SetProgressKeys } from "../utils/workoutStore";
import "../styles/todayWorkout.css";

export interface WeeklyOverviewProps {
  selectedDayIndex: number;
  onSelectDay: (dayIndex: number) => void;
  doneKeys: SetProgressKeys;
}

function dotState(
  day: WeeklyDay,
  dayIndex: number,
  todayIndex: number,
  doneKeys: SetProgressKeys,
): "current" | "done" | "pending" {
  if (dayIndex === todayIndex) return "current";
  if (isDayFullyComplete(day, doneKeys)) return "done";
  return "pending";
}

export function WeeklyOverview({
  selectedDayIndex,
  onSelectDay,
  doneKeys,
}: WeeklyOverviewProps) {
  const todayIndex = getTodayDayIndex();

  return (
    <nav className="tw-week-bar" aria-label="本週訓練概覽">
      <ul className="tw-week-days" role="list">
        {EVA_WEEKLY_PLAN.map((day) => {
          const state = dotState(day, day.dayIndex, todayIndex, doneKeys);
          const selected = day.dayIndex === selectedDayIndex;
          const isPast = day.dayIndex < todayIndex;

          return (
            <li key={day.id}>
              <button
                type="button"
                className={`tw-week-day${selected ? " tw-week-day--selected" : ""}${
                  isPast ? " tw-week-day--past" : ""
                }`}
                onClick={() => onSelectDay(day.dayIndex)}
                aria-pressed={selected}
                aria-label={`${day.weekdayLabel} ${day.title}${
                  state === "done" ? "，已完成" : state === "current" ? "，今日" : ""
                }`}
              >
                <span className="tw-week-day-name">{day.shortWeekday}</span>
                <span
                  className={`tw-week-dot tw-week-dot--${state}`}
                  aria-hidden="true"
                />
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
