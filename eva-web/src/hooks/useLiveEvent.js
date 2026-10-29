import { useCallback, useEffect, useMemo, useState } from "react";
import {
  formatCountdownString,
  getCheeringGuide,
  getCountdown,
  getEventById,
  getSetlist,
  getUpcomingEvents,
} from "../../../eva-core/services/event-service.js";

export function useLiveEvent(initialEventId = null) {
  const [upcomingEvents] = useState(() => getUpcomingEvents());
  const [activeEvent, setActiveEvent] = useState(() => {
    if (initialEventId) return getEventById(initialEventId);
    const events = getUpcomingEvents();
    return events[0] || null;
  });
  const [countdown, setCountdown] = useState(() =>
    activeEvent ? getCountdown(activeEvent.date) : null,
  );
  const [setlist, setSetlist] = useState(() =>
    activeEvent ? getSetlist(activeEvent.id) : [],
  );
  const [cheeringGuide, setCheeringGuide] = useState(() =>
    activeEvent ? getCheeringGuide(activeEvent.id) : null,
  );

  const selectEvent = useCallback((id) => {
    const event = getEventById(id);
    if (!event) return;
    setActiveEvent(event);
    setSetlist(getSetlist(id));
    setCheeringGuide(getCheeringGuide(id));
    setCountdown(getCountdown(event.date));
  }, []);

  const refreshCountdown = useCallback(() => {
    if (!activeEvent) return;
    setCountdown(getCountdown(activeEvent.date));
  }, [activeEvent]);

  useEffect(() => {
    if (!activeEvent) return undefined;
    refreshCountdown();
    const timer = setInterval(refreshCountdown, 1000);
    return () => clearInterval(timer);
  }, [activeEvent, refreshCountdown]);

  const countdownLabel = useMemo(
    () => (countdown ? formatCountdownString(countdown) : ""),
    [countdown],
  );

  return {
    upcomingEvents,
    activeEvent,
    countdown,
    countdownLabel,
    setlist,
    cheeringGuide,
    selectEvent,
    refreshCountdown,
  };
}
