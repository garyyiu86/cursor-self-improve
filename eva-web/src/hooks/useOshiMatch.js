import { useCallback, useMemo, useState } from "react";
import {
  QUESTIONS,
  calculateMatch,
  generateOshiCertificate,
} from "../../../eva-core/services/oshi-matcher.js";

/** @typedef {{ questionId: string, optionId: string }} OshiAnswer */

export function useOshiMatch() {
  const [phase, setPhase] = useState("intro");
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState(/** @type {OshiAnswer[]} */ ([]));
  const [matchResult, setMatchResult] = useState(null);
  const [certificate, setCertificate] = useState(null);
  const [isCalculating, setIsCalculating] = useState(false);

  const isComplete = phase === "result" && !!matchResult;

  const selectAnswer = useCallback((qId, aId) => {
    setAnswers((prev) => {
      const rest = prev.filter((a) => a.questionId !== qId);
      return [...rest, { questionId: qId, optionId: aId }];
    });

    const qIndex = QUESTIONS.findIndex((q) => q.id === qId);
    if (qIndex < QUESTIONS.length - 1) {
      setCurrentQuestion(qIndex + 1);
    } else {
      setIsCalculating(true);
      setPhase("calculating");
    }
  }, []);

  const goBack = useCallback(() => {
    if (phase === "intro") return;
    if (phase === "result" || phase === "calculating") return;

    if (currentQuestion > 0) {
      const prevQ = QUESTIONS[currentQuestion - 1];
      setAnswers((prev) => prev.filter((a) => a.questionId !== prevQ.id));
      setCurrentQuestion((i) => i - 1);
    } else {
      setPhase("intro");
      setAnswers([]);
    }
  }, [currentQuestion, phase]);

  const resetQuiz = useCallback(() => {
    setPhase("intro");
    setCurrentQuestion(0);
    setAnswers([]);
    setMatchResult(null);
    setCertificate(null);
    setIsCalculating(false);
  }, []);

  const startQuiz = useCallback(() => {
    setPhase("quiz");
    setCurrentQuestion(0);
    setAnswers([]);
    setMatchResult(null);
    setCertificate(null);
  }, []);

  const calculateResults = useCallback(() => {
    const ordered = QUESTIONS.map((q) =>
      answers.find((a) => a.questionId === q.id),
    ).filter(Boolean);

    if (ordered.length < QUESTIONS.length) return null;

    const result = calculateMatch(ordered);
    const cert = generateOshiCertificate(result);
    setMatchResult(result);
    setCertificate(cert);
    setPhase("result");
    setIsCalculating(false);
    return { matchResult: result, certificate: cert };
  }, [answers]);

  const currentAnswer = useMemo(() => {
    const q = QUESTIONS[currentQuestion];
    if (!q) return null;
    return answers.find((a) => a.questionId === q.id)?.optionId ?? null;
  }, [answers, currentQuestion]);

  return {
    phase,
    currentQuestion,
    answers,
    matchResult,
    certificate,
    isComplete,
    isCalculating,
    currentAnswer,
    questions: QUESTIONS,
    selectAnswer,
    goBack,
    resetQuiz,
    startQuiz,
    calculateResults,
    setPhase,
  };
}
