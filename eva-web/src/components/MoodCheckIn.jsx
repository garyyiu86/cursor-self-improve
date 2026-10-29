import { useCallback, useState } from "react";
import {
  ACTIVITY_TAGS,
  MOOD_LEVELS,
  getEvaEncouragement,
  getSuggestedActivity,
} from "../../../eva-core/services/mood-journal.js";

/** @param {{ open: boolean, onClose: () => void, onSubmit: (mood: number, note: string, tags: string[]) => void }} props */
export default function MoodCheckIn({ open, onClose, onSubmit }) {
  const [mood, setMood] = useState(null);
  const [note, setNote] = useState("");
  const [tags, setTags] = useState([]);
  const [phase, setPhase] = useState("form");
  const [encouragement, setEncouragement] = useState("");
  const [suggestion, setSuggestion] = useState(null);

  const reset = useCallback(() => {
    setMood(null);
    setNote("");
    setTags([]);
    setPhase("form");
    setEncouragement("");
    setSuggestion(null);
  }, []);

  const handleClose = useCallback(() => {
    reset();
    onClose();
  }, [onClose, reset]);

  const toggleTag = useCallback((tag) => {
    setTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  }, []);

  const handleSubmit = useCallback(() => {
    if (!mood) return;
    onSubmit(mood, note, tags);
    setEncouragement(getEvaEncouragement(mood));
    setSuggestion(getSuggestedActivity(mood));
    setPhase("success");
  }, [mood, note, tags, onSubmit]);

  if (!open) return null;

  return (
    <div
      className="mj-modal-backdrop"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div
        className={`mj-modal${phase === "success" ? " mj-modal--success" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="mj-checkin-title"
      >
        <button
          type="button"
          className="mj-modal-close"
          onClick={handleClose}
          aria-label="關閉"
        >
          ×
        </button>

        {phase === "form" ? (
          <>
            <h2 id="mj-checkin-title" className="mj-modal-title">
              今日心情點呀？
            </h2>
            <p className="mj-modal-sub">揀個 emoji，我陪住你記低 ✨</p>

            <div className="mj-mood-grid" role="radiogroup" aria-label="心情等級">
              {[1, 2, 3, 4, 5].map((level) => {
                const meta = MOOD_LEVELS[level];
                const selected = mood === level;
                return (
                  <button
                    key={level}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    className={`mj-mood-btn${selected ? " mj-mood-btn--selected" : ""}`}
                    onClick={() => setMood(level)}
                  >
                    <span className="mj-mood-btn-emoji" aria-hidden="true">
                      {meta.emoji}
                    </span>
                    <span className="mj-mood-btn-label">{meta.label}</span>
                  </button>
                );
              })}
            </div>

            <label className="mj-field">
              <span className="mj-field-label">想寫低啲咩？（可選）</span>
              <textarea
                className="mj-textarea"
                rows={3}
                placeholder="今日發生咩事…"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={500}
              />
            </label>

            <fieldset className="mj-tags-field">
              <legend className="mj-field-label">今日做咗咩</legend>
              <div className="mj-tag-grid">
                {ACTIVITY_TAGS.map((tag) => {
                  const active = tags.includes(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      className={`mj-tag mj-tag--chip${active ? " mj-tag--active" : ""}`}
                      onClick={() => toggleTag(tag)}
                      aria-pressed={active}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>
            </fieldset>

            <button
              type="button"
              className="mj-submit-btn"
              disabled={!mood}
              onClick={handleSubmit}
            >
              記低今日心情
            </button>
          </>
        ) : (
          <div className="mj-success-panel">
            <div className="mj-success-burst" aria-hidden="true">
              {MOOD_LEVELS[mood]?.emoji}
            </div>
            <h2 className="mj-success-title">記低啦 🌸</h2>
            <blockquote className="mj-eva-quote">
              <span className="mj-eva-avatar" aria-hidden="true">
                Eva
              </span>
              <p>{encouragement}</p>
            </blockquote>
            {suggestion ? (
              <div className="mj-suggestion">
                <span className="mj-suggestion-label">Eva 建議</span>
                <strong>{suggestion.title}</strong>
                <p>{suggestion.detail}</p>
              </div>
            ) : null}
            <button type="button" className="mj-submit-btn" onClick={handleClose}>
              好呀
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
