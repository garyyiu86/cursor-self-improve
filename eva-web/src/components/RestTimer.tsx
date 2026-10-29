import { useCallback, useEffect, useRef, useState } from "react";
import { playRestCompleteBeep } from "../services/sessionAudio";
import "../styles/rest-timer.css";
import "../styles/session.css";

const STORAGE_KEY = "eva-rest-timer-seconds";
const DEFAULT_SECONDS = 60;
const STEP_SECONDS = 15;
const MIN_SECONDS = 15;
const MAX_SECONDS = 180;

function loadDuration(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const n = Number(raw);
    if (Number.isFinite(n) && n >= MIN_SECONDS && n <= MAX_SECONDS) {
      return Math.round(n / STEP_SECONDS) * STEP_SECONDS;
    }
  } catch {
    // private mode / quota
  }
  return DEFAULT_SECONDS;
}

function saveDuration(seconds: number) {
  try {
    localStorage.setItem(STORAGE_KEY, String(seconds));
  } catch {
    // ignore
  }
}

function playRestCompleteCue() {
  playRestCompleteBeep();
}

export interface RestTimerProps {
  /** Increment to start or restart the countdown. */
  startSignal: number;
  /** When false, countdown freezes (e.g. tab hidden). */
  active?: boolean;
  onComplete?: () => void;
}

export function RestTimer({ startSignal, active = true, onComplete }: RestTimerProps) {
  const [duration, setDuration] = useState(loadDuration);
  const [remaining, setRemaining] = useState(0);
  const [status, setStatus] = useState<"idle" | "running" | "paused" | "complete">("idle");
  const endAtRef = useRef<number | null>(null);
  const pausedRemainingRef = useRef(0);
  const lastSignalRef = useRef(0);

  const adjustDuration = useCallback((delta: number) => {
    setDuration((prev) => {
      const next = Math.min(MAX_SECONDS, Math.max(MIN_SECONDS, prev + delta));
      saveDuration(next);
      if (endAtRef.current != null && (status === "running" || status === "paused")) {
        if (status === "running") {
          endAtRef.current += delta * 1000;
        } else {
          pausedRemainingRef.current = Math.max(
            MIN_SECONDS,
            Math.min(MAX_SECONDS, pausedRemainingRef.current + delta),
          );
        }
        setRemaining(
          status === "running"
            ? Math.max(0, Math.ceil((endAtRef.current - Date.now()) / 1000))
            : pausedRemainingRef.current,
        );
      }
      return next;
    });
  }, [status]);

  const skip = useCallback(() => {
    endAtRef.current = null;
    pausedRemainingRef.current = 0;
    setRemaining(0);
    setStatus("idle");
  }, []);

  useEffect(() => {
    if (startSignal <= 0 || startSignal === lastSignalRef.current) return;
    lastSignalRef.current = startSignal;
    endAtRef.current = Date.now() + duration * 1000;
    pausedRemainingRef.current = 0;
    setRemaining(duration);
    setStatus("running");
  }, [startSignal, duration]);

  useEffect(() => {
    if (status !== "running" && status !== "paused") return undefined;

    if (!active) {
      if (status === "running" && endAtRef.current != null) {
        pausedRemainingRef.current = Math.max(0, Math.ceil((endAtRef.current - Date.now()) / 1000));
        setRemaining(pausedRemainingRef.current);
        setStatus("paused");
      }
      return undefined;
    }

    if (status === "paused") {
      endAtRef.current = Date.now() + pausedRemainingRef.current * 1000;
      setStatus("running");
    }

    const id = window.setInterval(() => {
      if (endAtRef.current == null) return;
      const left = Math.max(0, Math.ceil((endAtRef.current - Date.now()) / 1000));
      setRemaining(left);
      if (left <= 0) {
        endAtRef.current = null;
        setStatus("complete");
        playRestCompleteCue();
        onComplete?.();
      }
    }, 250);

    return () => window.clearInterval(id);
  }, [status, active, onComplete]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden && status === "running" && endAtRef.current != null) {
        pausedRemainingRef.current = Math.max(0, Math.ceil((endAtRef.current - Date.now()) / 1000));
        setRemaining(pausedRemainingRef.current);
        setStatus("paused");
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [status]);

  if (status === "idle") return null;

  const pct = duration > 0 ? Math.round(((duration - remaining) / duration) * 100) : 0;
  const canAdjust = status !== "complete";

  return (
    <div
      className={`rt-bar${status === "running" ? " rt-bar--running" : ""}${
        status === "paused" ? " rt-bar--paused" : ""
      }${status === "complete" ? " rt-bar--complete" : ""}`}
      role="timer"
      aria-live="polite"
      aria-label={
        status === "complete"
          ? "休息時間到"
          : status === "paused"
            ? `休息暫停，剩餘 ${remaining} 秒`
            : `休息倒數 ${remaining} 秒`
      }
    >
      <div className="rt-bar-head">
        <span className="rt-bar-label">
          {status === "complete" ? "✨ 休息完成！" : status === "paused" ? "⏸ 休息暫停" : "💤 組間休息"}
        </span>
        <div className="rt-bar-actions">
          {canAdjust ? (
            <>
              <button
                type="button"
                className="rt-adjust-btn"
                onClick={() => adjustDuration(-STEP_SECONDS)}
                disabled={duration <= MIN_SECONDS}
                aria-label={`減少 ${STEP_SECONDS} 秒`}
              >
                −{STEP_SECONDS}s
              </button>
              <span className="rt-duration">{duration}s</span>
              <button
                type="button"
                className="rt-adjust-btn"
                onClick={() => adjustDuration(STEP_SECONDS)}
                disabled={duration >= MAX_SECONDS}
                aria-label={`增加 ${STEP_SECONDS} 秒`}
              >
                +{STEP_SECONDS}s
              </button>
            </>
          ) : null}
          <button type="button" className="rt-skip-btn" onClick={skip}>
            {status === "complete" ? "知道了" : "跳過"}
          </button>
        </div>
      </div>

      <div className="rt-countdown-wrap">
        <span className="rt-countdown" aria-hidden="true">
          {status === "complete" ? "GO" : remaining}
        </span>
        <div className="rt-progress-track" aria-hidden="true">
          <div className="rt-progress-fill" style={{ width: `${status === "complete" ? 100 : pct}%` }} />
        </div>
      </div>

      {status === "paused" ? (
        <p className="rt-paused-note">離開頁面時會自動暫停，返嚟會繼續倒數</p>
      ) : null}
    </div>
  );
}

export interface CircularRestTimerProps {
  /** Increment to start or restart the countdown. */
  startSignal: number;
  /** Fixed duration in seconds (from exercise restSeconds). */
  durationSeconds: number;
  onComplete?: () => void;
  onSkip?: () => void;
}

/** Circular countdown for guided session rest between sets. */
export function CircularRestTimer({
  startSignal,
  durationSeconds,
  onComplete,
  onSkip,
}: CircularRestTimerProps) {
  const [remaining, setRemaining] = useState(0);
  const [status, setStatus] = useState<"idle" | "running" | "complete">("idle");
  const endAtRef = useRef<number | null>(null);
  const lastSignalRef = useRef(0);
  const duration = Math.max(5, durationSeconds);

  useEffect(() => {
    if (startSignal <= 0 || startSignal === lastSignalRef.current) return;
    lastSignalRef.current = startSignal;
    endAtRef.current = Date.now() + duration * 1000;
    setRemaining(duration);
    setStatus("running");
  }, [startSignal, duration]);

  useEffect(() => {
    if (status !== "running") return undefined;

    const id = window.setInterval(() => {
      if (endAtRef.current == null) return;
      const left = Math.max(0, Math.ceil((endAtRef.current - Date.now()) / 1000));
      setRemaining(left);
      if (left <= 0) {
        endAtRef.current = null;
        setStatus("complete");
        playRestCompleteBeep();
        onComplete?.();
      }
    }, 250);

    return () => window.clearInterval(id);
  }, [status, onComplete]);

  const skip = useCallback(() => {
    endAtRef.current = null;
    setRemaining(0);
    setStatus("idle");
    onSkip?.();
  }, [onSkip]);

  if (status === "idle") return null;

  const pct = duration > 0 ? (duration - remaining) / duration : 1;
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - (status === "complete" ? 1 : pct));

  return (
    <div
      className={`sess-rest${status === "complete" ? " sess-rest--complete" : ""}`}
      role="timer"
      aria-live="polite"
      aria-label={
        status === "complete" ? "休息時間到" : `休息倒數 ${remaining} 秒`
      }
    >
      <div className="sess-rest-ring-wrap" aria-hidden="true">
        <svg className="sess-rest-ring" viewBox="0 0 120 120">
          <circle className="sess-rest-ring-bg" cx="60" cy="60" r={radius} />
          <circle
            className="sess-rest-ring-fill"
            cx="60"
            cy="60"
            r={radius}
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
          />
        </svg>
        <span className="sess-rest-count">
          {status === "complete" ? "GO!" : remaining}
        </span>
      </div>
      <p className="sess-rest-label">
        {status === "complete" ? "休息完成，準備下一組！" : "組間休息"}
      </p>
      {status === "running" ? (
        <button type="button" className="sess-rest-skip" onClick={skip}>
          跳過休息
        </button>
      ) : (
        <button type="button" className="sess-rest-skip" onClick={skip}>
          繼續
        </button>
      )}
    </div>
  );
}
