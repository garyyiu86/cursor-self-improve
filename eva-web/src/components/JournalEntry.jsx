import { useState } from "react";
import { MOOD_LEVELS } from "../../../eva-core/services/mood-journal.js";

const NOTE_PREVIEW = 80;

/** @param {{ entry: import('../../../eva-core/services/mood-journal.js').MoodEntry, onDelete?: (id: string) => void, compact?: boolean }} props */
export default function JournalEntry({ entry, onDelete, compact = false }) {
  const [expanded, setExpanded] = useState(false);
  const meta = MOOD_LEVELS[entry.mood] || MOOD_LEVELS[3];
  const note = entry.note || "";
  const needsTruncate = note.length > NOTE_PREVIEW;
  const displayNote =
    !needsTruncate || expanded ? note : `${note.slice(0, NOTE_PREVIEW)}…`;

  const dateLabel = formatEntryDate(entry.date);

  return (
    <article className={`mj-entry${compact ? " mj-entry--compact" : ""}`}>
      <div className="mj-entry-head">
        <span className="mj-entry-emoji" aria-hidden="true">
          {meta.emoji}
        </span>
        <div className="mj-entry-meta">
          <time className="mj-entry-date" dateTime={entry.date}>
            {dateLabel}
          </time>
          <span className="mj-entry-label">{meta.label}</span>
        </div>
        {onDelete ? (
          <button
            type="button"
            className="mj-entry-delete"
            onClick={() => onDelete(entry.id)}
            aria-label="刪除紀錄"
            title="刪除"
          >
            ×
          </button>
        ) : null}
      </div>

      {note ? (
        <p className="mj-entry-note">
          {displayNote}
          {needsTruncate ? (
            <button
              type="button"
              className="mj-entry-expand"
              onClick={() => setExpanded((v) => !v)}
            >
              {expanded ? "收埋" : "睇多啲"}
            </button>
          ) : null}
        </p>
      ) : null}

      {entry.activityTags?.length > 0 ? (
        <div className="mj-entry-tags">
          {entry.activityTags.map((tag) => (
            <span key={tag} className="mj-tag mj-tag--pill">
              {tag}
            </span>
          ))}
        </div>
      ) : null}
    </article>
  );
}

/** @param {string} dateKey */
function formatEntryDate(dateKey) {
  const today = new Date();
  const todayKey = toDayKey(today);
  if (dateKey === todayKey) return "今日";

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (dateKey === toDayKey(yesterday)) return "尋日";

  const [y, m, d] = dateKey.split("-").map(Number);
  const weekdays = ["日", "一", "二", "三", "四", "五", "六"];
  const dt = new Date(y, m - 1, d);
  return `${m}月${d}日 · 星期${weekdays[dt.getDay()]}`;
}

/** @param {Date} d */
function toDayKey(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
