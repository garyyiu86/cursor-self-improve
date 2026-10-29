import { useCallback, useState } from "react";
import type { RoutineDay, RoutineExercise } from "../../../eva-core/src/routines/bicep.ts";

export interface RoutineDayAccordionProps {
  days: RoutineDay[];
  todayIndex: number;
  /** Day id to expand on first render (e.g. today when idle gap detected). */
  defaultExpandedId?: string;
}

function ExerciseRows({ exercises }: { exercises: RoutineExercise[] }) {
  if (exercises.length === 0) return null;

  return (
    <ul className="wk-exercise-list">
      {exercises.map((ex) => (
        <li key={ex.name} className="wk-exercise">
          <div className="wk-exercise-body">
            <span className="wk-exercise-name">{ex.name}</span>
            <span className="wk-exercise-meta">
              {ex.sets} 組 × {ex.reps} · 休息 {ex.rest}
            </span>
            {ex.tip ? <span className="wk-exercise-tip">{ex.tip}</span> : null}
          </div>
        </li>
      ))}
    </ul>
  );
}

function PhaseBlock({
  label,
  exercises,
  phaseClass,
}: {
  label: string;
  exercises: RoutineExercise[] | undefined;
  phaseClass: string;
}) {
  if (!exercises?.length) return null;

  return (
    <div className={`wk-routine-phase ${phaseClass}`}>
      <h4 className="wk-routine-phase-title">{label}</h4>
      <ExerciseRows exercises={exercises} />
    </div>
  );
}

export function RoutineDayAccordion({
  days,
  todayIndex,
  defaultExpandedId,
}: RoutineDayAccordionProps) {
  const [expandedId, setExpandedId] = useState<string | null>(defaultExpandedId ?? null);

  const toggleDay = useCallback((dayId: string) => {
    setExpandedId((prev) => (prev === dayId ? null : dayId));
  }, []);

  return (
    <div className="wk-routine-accordion" role="region" aria-label="每週訓練計劃">
      {days.map((day) => {
        const isToday = day.dayIndex === todayIndex;
        const expanded = expandedId === day.id;
        const panelId = `wk-routine-panel-${day.id}`;
        const hasContent =
          (day.warmUp?.length ?? 0) > 0 ||
          day.exercises.length > 0 ||
          (day.coolDown?.length ?? 0) > 0;

        return (
          <article
            key={day.id}
            className={`wk-routine-accordion-item${
              isToday ? " wk-routine-accordion-item--today" : ""
            }${expanded ? " wk-routine-accordion-item--open" : ""}`}
          >
            <h3 className="wk-routine-accordion-head">
              <button
                type="button"
                className="wk-routine-accordion-toggle"
                aria-expanded={expanded}
                aria-controls={panelId}
                onClick={() => toggleDay(day.id)}
              >
                <span className="wk-routine-accordion-summary">
                  <span className="wk-routine-accordion-day">
                    {day.emoji} 週{day.weekday}
                  </span>
                  <span className="wk-routine-accordion-title">{day.title}</span>
                  <span className="wk-routine-accordion-duration">{day.duration}</span>
                </span>
                <span className="wk-routine-accordion-actions">
                  {isToday ? (
                    <span className="wk-routine-today-pill" aria-label="今日">
                      TODAY
                    </span>
                  ) : null}
                  <span className="wk-routine-accordion-chevron" aria-hidden="true">
                    {expanded ? "▾" : "▸"}
                  </span>
                </span>
              </button>
            </h3>

            {expanded ? (
              <div id={panelId} className="wk-routine-accordion-panel">
                {day.note ? <p className="wk-day-note">{day.note}</p> : null}

                {hasContent ? (
                  <>
                    <PhaseBlock label="Warm-up 熱身" exercises={day.warmUp} phaseClass="wk-routine-phase--warmup" />
                    <PhaseBlock label="主訓練" exercises={day.exercises} phaseClass="wk-routine-phase--main" />
                    <PhaseBlock
                      label="Cool-down 收操"
                      exercises={day.coolDown}
                      phaseClass="wk-routine-phase--cooldown"
                    />
                  </>
                ) : (
                  <p className="wk-day-rest">今日無固定動作表 — 跟計劃自由安排就得。</p>
                )}
              </div>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}
