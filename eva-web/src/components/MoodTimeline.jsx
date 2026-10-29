import { useMemo } from "react";
import { toDayKey } from "../../../eva-core/services/mood-journal.js";
import JournalEntry from "./JournalEntry.jsx";

/** @param {{ entries: import('../../../eva-core/services/mood-journal.js').MoodEntry[], onDelete?: (id: string) => void }} props */
export default function MoodTimeline({ entries, onDelete }) {
  const groups = useMemo(() => groupByWeek(entries), [entries]);

  if (entries.length === 0) {
    return (
      <div className="mj-timeline-empty">
        <span className="mj-timeline-empty-emoji" aria-hidden="true">
          📔
        </span>
        <p>仲未有任何紀錄</p>
        <p className="mj-timeline-empty-hint">打卡一次，timeline 就會出現喺度～</p>
      </div>
    );
  }

  const currentWeekKey = toDayKey(startOfWeek(new Date()));

  return (
    <div className="mj-timeline" aria-label="心情 timeline">
      {groups.map((group) => {
        const isThisWeek = group.weekKey === currentWeekKey;
        return (
          <section
            key={group.weekKey}
            className={`mj-week-group${isThisWeek ? " mj-week-group--current" : ""}`}
          >
            <header className="mj-week-header">
              <h3 className="mj-week-title">
                {isThisWeek ? "今個禮拜" : group.label}
              </h3>
              {isThisWeek ? (
                <span className="mj-week-badge">This week</span>
              ) : null}
            </header>
            <div className="mj-week-entries">
              {group.entries.map((entry) => (
                <JournalEntry
                  key={entry.id}
                  entry={entry}
                  onDelete={onDelete}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

/** @param {import('../../../eva-core/services/mood-journal.js').MoodEntry[]} entries */
function groupByWeek(entries) {
  /** @type {Map<string, { weekKey: string, label: string, weekStart: Date, entries: typeof entries }>} */
  const map = new Map();

  for (const entry of entries) {
    const d = parseDayKey(entry.date);
    if (!d) continue;
    const weekStart = startOfWeek(d);
    const weekKey = toDayKey(weekStart);
    const bucket = map.get(weekKey) || {
      weekKey,
      label: formatWeekLabel(weekStart),
      weekStart,
      entries: [],
    };
    bucket.entries.push(entry);
    map.set(weekKey, bucket);
  }

  return [...map.values()]
    .sort((a, b) => b.weekKey.localeCompare(a.weekKey))
    .map((g) => ({
      ...g,
      entries: g.entries.sort((a, b) => b.date.localeCompare(a.date)),
    }));
}

/** @param {Date} d */
function startOfWeek(d) {
  const copy = new Date(d);
  const day = copy.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + diff);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

/** @param {Date} weekStart */
function formatWeekLabel(weekStart) {
  const end = new Date(weekStart);
  end.setDate(end.getDate() + 6);
  const fmt = (dt) => `${dt.getFullYear()}/${dt.getMonth() + 1}/${dt.getDate()}`;
  return `${fmt(weekStart)} – ${fmt(end)}`;
}

/** @param {string} key */
function parseDayKey(key) {
  const [y, m, d] = key.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}
