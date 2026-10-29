import { useCallback, useEffect, useState } from "react";
import {
  getCompletionSpeech,
  getExerciseIntro,
  getRestMessage,
} from "../data/evaCoachMessages.js";
import "../styles/eva-coach.css";

const DISMISS_MS = 180;

function useDismissible(visible, onClose) {
  const [dismissing, setDismissing] = useState(false);

  useEffect(() => {
    if (visible) setDismissing(false);
  }, [visible]);

  const dismiss = useCallback(() => {
    if (dismissing) return;
    setDismissing(true);
    window.setTimeout(() => {
      onClose();
      setDismissing(false);
    }, DISMISS_MS);
  }, [dismissing, onClose]);

  return { dismissing, dismiss };
}

function EvaAvatar() {
  return (
    <div className="eva-coach-avatar" aria-hidden="true">
      ✨
    </div>
  );
}

function SpeechBubble({ title, children }) {
  return (
    <div className="eva-coach-bubble-wrap">
      <EvaAvatar />
      <div className="eva-coach-bubble">
        {title ? <strong>{title}</strong> : null}
        {children}
      </div>
    </div>
  );
}

/**
 * 動作詳情 modal — form tips + Eva 偶像情境
 */
export function ExerciseDetailModal({ exercise, onClose }) {
  const { dismissing, dismiss } = useDismissible(Boolean(exercise), onClose);

  useEffect(() => {
    if (!exercise) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") dismiss();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [exercise, dismiss]);

  if (!exercise) return null;

  const intro = getExerciseIntro(exercise.name);

  return (
    <div
      className={`eva-coach-backdrop${dismissing ? " eva-coach-backdrop--dismiss" : ""}`}
      role="presentation"
      onClick={dismiss}
    >
      <div
        className={`eva-coach-modal${dismissing ? " eva-coach-modal--dismiss" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="eva-exercise-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="eva-coach-modal__header">
          <h2 id="eva-exercise-modal-title" className="eva-coach-modal__title">
            {exercise.name}
          </h2>
          <button
            type="button"
            className="eva-coach-modal__close"
            onClick={dismiss}
            aria-label="關閉"
          >
            ×
          </button>
        </header>
        <div className="eva-coach-modal__body">
          <section className="eva-coach-section">
            <p className="eva-coach-section__label">Form Tips</p>
            <p className="eva-coach-section__text">{exercise.tip || "保持核心收緊，動作要 controlled。"}</p>
          </section>
          {exercise.idolContext ? (
            <section className="eva-coach-section">
              <p className="eva-coach-section__label">Eva 偶像貼士</p>
              <SpeechBubble title="Eva 話：">{exercise.idolContext}</SpeechBubble>
            </section>
          ) : null}
          <SpeechBubble title="Eva">{intro}</SpeechBubble>
        </div>
      </div>
    </div>
  );
}

/**
 * 休息倒數應援 — 每個 rest cycle 輪換訊息
 */
export function RestCoachBanner({ remaining, restCycle }) {
  if (remaining <= 0) return null;

  const message = getRestMessage(restCycle);

  return (
    <div className="eva-coach-rest" role="status" aria-live="polite">
      <div className="eva-coach-rest__top">
        <span>休息中</span>
        <span className="eva-coach-rest__timer">{remaining}s</span>
      </div>
      <SpeechBubble title="Eva 應援">{message}</SpeechBubble>
    </div>
  );
}

/**
 * 完訓賀卡 — session summary + 行動按鈕
 */
export function CompletionCard({ summary, onClose, onDashboard, onProgress }) {
  const { dismissing, dismiss } = useDismissible(Boolean(summary), onClose);
  const speech = getCompletionSpeech(summary?.totalSets ?? 0);

  useEffect(() => {
    if (!summary) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") dismiss();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [summary, dismiss]);

  if (!summary) return null;

  return (
    <div
      className={`eva-coach-backdrop${dismissing ? " eva-coach-backdrop--dismiss" : ""}`}
      role="presentation"
      onClick={dismiss}
    >
      <div
        className={`eva-coach-modal eva-coach-complete${dismissing ? " eva-coach-modal--dismiss" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="eva-complete-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="eva-coach-modal__header">
          <h2 id="eva-complete-title" className="eva-coach-modal__title">
            訓練完成 🎉
          </h2>
          <button
            type="button"
            className="eva-coach-modal__close"
            onClick={dismiss}
            aria-label="關閉"
          >
            ×
          </button>
        </header>
        <div className="eva-coach-modal__body">
          <SpeechBubble title={speech.headline}>{speech.body}</SpeechBubble>

          <div className="eva-coach-stats">
            <div className="eva-coach-stat">
              <span className="eva-coach-stat__val">{summary.durationLabel}</span>
              <span className="eva-coach-stat__lbl">訓練時長</span>
            </div>
            <div className="eva-coach-stat">
              <span className="eva-coach-stat__val">{summary.totalSets}</span>
              <span className="eva-coach-stat__lbl">總組數</span>
            </div>
            <div className="eva-coach-stat">
              <span className="eva-coach-stat__val">{summary.exerciseCount}</span>
              <span className="eva-coach-stat__lbl">動作數</span>
            </div>
          </div>

          <div className="eva-coach-actions">
            <button type="button" className="ws-btn ws-btn--primary" onClick={onProgress}>
              睇進度
            </button>
            <button type="button" className="ws-btn ws-btn--finish" onClick={onDashboard}>
              返回訓練主頁
            </button>
            <button type="button" className="ws-btn ws-btn--ghost" onClick={dismiss}>
              留喺呢度
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** @deprecated 用 named exports；保留 default 方便 tree-shake 匯入 */
export default function EvaCoachOverlay() {
  return null;
}
