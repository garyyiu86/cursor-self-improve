import { useEffect, useRef } from "react";

/** @param {{ value: number, label: string }} props */
function FlipUnit({ value, label }) {
  const prevRef = useRef(value);
  const unitRef = useRef(null);

  useEffect(() => {
    if (prevRef.current !== value && unitRef.current) {
      unitRef.current.classList.remove("le-flip-unit--animate");
      void unitRef.current.offsetWidth;
      unitRef.current.classList.add("le-flip-unit--animate");
    }
    prevRef.current = value;
  }, [value]);

  const padded = String(value).padStart(2, "0");
  const top = padded[0];
  const bottom = padded[1];

  return (
    <div className="le-flip-group">
      <span className="le-flip-label">{label}</span>
      <div ref={unitRef} className="le-flip-unit">
        <div className="le-flip-digit">
          <span className="le-flip-face le-flip-face--top">{top}</span>
        </div>
        <div className="le-flip-digit">
          <span className="le-flip-face le-flip-face--bottom">{bottom}</span>
        </div>
      </div>
    </div>
  );
}

function formatEventDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString("zh-HK", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  });
}

/** @param {{ event: import('../../../eva-core/services/event-service.js').LiveEvent, countdown: import('../../../eva-core/services/event-service.js').Countdown, label: string }} props */
export default function LiveCountdown({ event, countdown, label }) {
  if (!event || !countdown) return null;

  if (countdown.isPast) {
    return (
      <section className="le-countdown le-countdown--past" aria-live="polite">
        <p className="le-countdown-past-msg">多謝你嚟應援！次回お楽しみに～</p>
        <h2 className="le-countdown-event-name">{event.name}</h2>
        <p className="le-countdown-meta">{event.venue}</p>
      </section>
    );
  }

  if (countdown.isToday) {
    return (
      <section className="le-countdown le-countdown--today" aria-live="polite">
        <p className="le-countdown-today-msg">🎉 就係今日！</p>
        <h2 className="le-countdown-event-name">{event.name}</h2>
        <p className="le-countdown-meta">
          {event.venue} · 開場 {event.doorsOpen} · 開演 {event.startTime}
        </p>
        <p className="le-countdown-sub">{label}</p>
        <div className="le-flip-row">
          <FlipUnit value={countdown.hours} label="時" />
          <span className="le-flip-sep">:</span>
          <FlipUnit value={countdown.minutes} label="分" />
          <span className="le-flip-sep">:</span>
          <FlipUnit value={countdown.seconds} label="秒" />
        </div>
      </section>
    );
  }

  return (
    <section className="le-countdown" aria-live="polite">
      <div className="le-countdown-header">
        <span className="le-countdown-emoji" aria-hidden="true">
          {event.imagePlaceholder}
        </span>
        <div>
          <h2 className="le-countdown-event-name">{event.name}</h2>
          <p className="le-countdown-meta">
            {formatEventDate(event.date)} · {event.venue}
          </p>
          <p className="le-countdown-meta">
            開場 {event.doorsOpen} · 開演 {event.startTime}
          </p>
        </div>
      </div>
      <p className="le-countdown-sub">{label}</p>
      <div className="le-flip-row">
        <FlipUnit value={countdown.days} label="日" />
        <span className="le-flip-sep">:</span>
        <FlipUnit value={countdown.hours} label="時" />
        <span className="le-flip-sep">:</span>
        <FlipUnit value={countdown.minutes} label="分" />
        <span className="le-flip-sep">:</span>
        <FlipUnit value={countdown.seconds} label="秒" />
      </div>
    </section>
  );
}
