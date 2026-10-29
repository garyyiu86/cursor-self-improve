const TICKET_LABELS = {
  available: { text: "有飛", className: "le-ticket--available" },
  limited: { text: "少量", className: "le-ticket--limited" },
  "sold out": { text: "售罄", className: "le-ticket--soldout" },
};

function formatShortDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString("zh-HK", {
    month: "short",
    day: "numeric",
    weekday: "short",
  });
}

/** @param {{ event: import('../../../eva-core/services/event-service.js').LiveEvent, selected?: boolean, onSelect: (id: string) => void }} props */
export default function EventCard({ event, selected = false, onSelect }) {
  const ticket = TICKET_LABELS[event.ticketStatus] || TICKET_LABELS.available;

  return (
    <button
      type="button"
      className={`le-event-card${selected ? " le-event-card--selected" : ""}`}
      onClick={() => onSelect(event.id)}
      aria-pressed={selected}
    >
      <span className="le-event-card-emoji" aria-hidden="true">
        {event.imagePlaceholder}
      </span>
      <div className="le-event-card-body">
        <h3 className="le-event-card-name">{event.name}</h3>
        <p className="le-event-card-meta">
          {formatShortDate(event.date)} · {event.venue}
        </p>
        <p className="le-event-card-meta">
          開場 {event.doorsOpen} · 開演 {event.startTime}
        </p>
      </div>
      <span className={`le-ticket ${ticket.className}`}>{ticket.text}</span>
    </button>
  );
}
