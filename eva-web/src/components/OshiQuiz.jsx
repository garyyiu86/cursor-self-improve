import { useEffect, useRef, useState } from "react";
import { getOptionEmoji } from "../../../eva-core/services/oshi-matcher.js";
import { useOshiMatch } from "../hooks/useOshiMatch.js";
import OshiResult from "./OshiResult.jsx";
import "../styles/oshi-match.css";

export default function OshiQuiz() {
  const {
    phase,
    currentQuestion,
    answers,
    matchResult,
    certificate,
    currentAnswer,
    questions,
    selectAnswer,
    goBack,
    resetQuiz,
    startQuiz,
    calculateResults,
  } = useOshiMatch();

  const [slideDir, setSlideDir] = useState("in");
  const prevQRef = useRef(currentQuestion);

  useEffect(() => {
    if (phase !== "quiz") return;
    setSlideDir(currentQuestion >= prevQRef.current ? "forward" : "back");
    prevQRef.current = currentQuestion;
  }, [currentQuestion, phase]);

  useEffect(() => {
    if (phase !== "calculating") return;
    const timer = setTimeout(() => calculateResults(), 1400);
    return () => clearTimeout(timer);
  }, [phase, calculateResults]);

  if (phase === "intro") {
    return (
      <section className="om-intro">
        <div className="om-stars" aria-hidden="true">
          {Array.from({ length: 12 }).map((_, i) => (
            <span key={i} className="om-star" style={{ "--i": i }} />
          ))}
        </div>
        <div className="om-eva-bubble">
          <span className="om-eva-avatar" aria-hidden="true">
            ✨
          </span>
          <p>等我睇下你同邊個 member 最有緣份先～✨</p>
        </div>
        <h2 className="om-intro-title">LUMINA 推し配對分析</h2>
        <p className="om-intro-sub">5 題小測驗 · 找出你的推し · 獲發認證書</p>
        <button type="button" className="om-btn" onClick={startQuiz}>
          開始配對
        </button>
      </section>
    );
  }

  if (phase === "calculating") {
    return (
      <section className="om-calculating" aria-live="polite">
        <div className="om-calculating-orbs" aria-hidden="true">
          <span>🌸</span>
          <span>⭐</span>
          <span>💫</span>
        </div>
        <p className="om-calculating-text">計算緣份中…</p>
        <div className="om-calculating-bar">
          <div className="om-calculating-fill" />
        </div>
      </section>
    );
  }

  if (phase === "result" && matchResult && certificate) {
    return (
      <OshiResult
        matchResult={matchResult}
        certificate={certificate}
        onRetry={resetQuiz}
      />
    );
  }

  const q = questions[currentQuestion];
  if (!q) return null;

  const step = currentQuestion + 1;
  const progress = (answers.length / questions.length) * 100;

  return (
    <section className="om-quiz">
      <div className="om-quiz-header">
        {currentQuestion > 0 && (
          <button type="button" className="om-back-btn" onClick={goBack}>
            ← 上一題
          </button>
        )}
        <p className="om-progress-label">
          第 {step} / {questions.length} 題
        </p>
      </div>

      <div className="om-progress-track" aria-hidden="true">
        <div className="om-progress-fill" style={{ width: `${progress}%` }} />
      </div>

      <div
        key={q.id}
        className={`om-question om-question--${slideDir}`}
      >
        <p className="om-question-emoji" aria-hidden="true">
          {q.emoji}
        </p>
        <h2 className="om-question-text">{q.questionText}</h2>

        <div className="om-options" role="listbox" aria-label={q.questionText}>
          {q.options.map((opt) => {
            const selected = currentAnswer === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                role="option"
                aria-selected={selected}
                className={`om-option${selected ? " om-option--selected" : ""}`}
                onClick={() => selectAnswer(q.id, opt.id)}
              >
                <span className="om-option-emoji" aria-hidden="true">
                  {getOptionEmoji(opt.id)}
                </span>
                <span className="om-option-label">{opt.text}</span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
