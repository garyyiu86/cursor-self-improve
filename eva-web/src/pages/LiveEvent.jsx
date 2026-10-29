import { Link } from "react-router-dom";
import EventCard from "../components/EventCard.jsx";
import LiveCountdown from "../components/LiveCountdown.jsx";
import SetlistViewer from "../components/SetlistViewer.jsx";
import { useLiveEvent } from "../hooks/useLiveEvent.js";
import "../styles/live-event.css";

export default function LiveEvent() {
  const {
    upcomingEvents,
    activeEvent,
    countdown,
    countdownLabel,
    setlist,
    cheeringGuide,
    selectEvent,
  } = useLiveEvent();

  return (
    <div className="le-page">
      <header className="le-header">
        <div className="le-header-top">
          <Link to="/" className="le-back">
            ← 聊天
          </Link>
          <h1 className="le-heading">Live 應援</h1>
        </div>
        <p className="le-tagline">LUMINA 演出倒數 · Setlist · 應援指南 ✨</p>
      </header>

      <section className="le-events-grid" aria-label="即將演出">
        {upcomingEvents.map((event) => (
          <EventCard
            key={event.id}
            event={event}
            selected={activeEvent?.id === event.id}
            onSelect={selectEvent}
          />
        ))}
      </section>

      {activeEvent && countdown && (
        <LiveCountdown
          event={activeEvent}
          countdown={countdown}
          label={countdownLabel}
        />
      )}

      <SetlistViewer tracks={setlist} guide={cheeringGuide} />
    </div>
  );
}
