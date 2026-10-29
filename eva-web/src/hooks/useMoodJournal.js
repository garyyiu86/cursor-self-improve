import { useCallback, useEffect, useMemo, useState } from "react";
import {
  deleteMoodEntry,
  getMoodHistory,
  getMoodStats,
  getMoodStreak,
  hasCheckedInToday,
  loadEntries,
  logMood,
  toDayKey,
} from "../../../eva-core/services/mood-journal.js";

export function useMoodJournal({ autoPrompt = false } = {}) {
  const [moodEntries, setMoodEntries] = useState(() => loadEntries());
  const [streak, setStreak] = useState(() => getMoodStreak());
  const [stats, setStats] = useState(() => getMoodStats());
  const [isCheckInOpen, setIsCheckInOpen] = useState(false);

  const refreshStats = useCallback(() => {
    setMoodEntries(loadEntries());
    setStreak(getMoodStreak());
    setStats(getMoodStats());
  }, []);

  useEffect(() => {
    if (!autoPrompt) return;
    const timer = setTimeout(() => {
      if (!hasCheckedInToday()) {
        setIsCheckInOpen(true);
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [autoPrompt]);

  const logEntry = useCallback(
    (mood, note = "", activityTags = [], date = toDayKey()) => {
      const entry = logMood(date, mood, note, activityTags);
      refreshStats();
      return entry;
    },
    [refreshStats],
  );

  const deleteEntry = useCallback(
    (id) => {
      deleteMoodEntry(id);
      refreshStats();
    },
    [refreshStats],
  );

  const openCheckIn = useCallback(() => setIsCheckInOpen(true), []);
  const closeCheckIn = useCallback(() => setIsCheckInOpen(false), []);

  const checkedInToday = useMemo(
    () => moodEntries.some((e) => e.date === toDayKey()),
    [moodEntries],
  );

  const history = useMemo(() => getMoodHistory(90), [moodEntries]);

  return {
    moodEntries,
    history,
    streak,
    stats,
    isCheckInOpen,
    checkedInToday,
    logEntry,
    deleteEntry,
    refreshStats,
    openCheckIn,
    closeCheckIn,
    setIsCheckInOpen,
  };
}
