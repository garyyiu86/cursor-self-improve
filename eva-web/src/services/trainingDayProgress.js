const STORAGE_PREFIX = "eva-training-day-progress:";

/** @param {string} dayId @param {string} exerciseId */
export function progressKey(dayId, exerciseId) {
  return `${dayId}:${exerciseId}`;
}

/** @param {string} dayId @param {string} exerciseId @param {number} setIndex 0-based */
export function setProgressKey(dayId, exerciseId, setIndex) {
  return `${dayId}:${exerciseId}:s${setIndex}`;
}

/** @param {{ sets?: number }[]} exercises */
export function countTotalSets(exercises) {
  return (exercises || []).reduce((n, ex) => n + Math.max(1, Number(ex.sets) || 1), 0);
}

/** @param {string} dayId @param {{ id: string, sets?: number }[]} exercises @param {Set<string>} doneKeys */
export function countDoneSets(dayId, exercises, doneKeys) {
  let done = 0;
  for (const ex of exercises || []) {
    const setCount = Math.max(1, Number(ex.sets) || 1);
    for (let i = 0; i < setCount; i++) {
      if (doneKeys.has(setProgressKey(dayId, ex.id, i))) done++;
    }
  }
  return done;
}

/** @param {string} planId */
export function loadDayProgress(planId) {
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${planId}`);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return new Set(Array.isArray(parsed) ? parsed.filter((k) => typeof k === "string") : []);
  } catch {
    return new Set();
  }
}

/** @param {string} planId @param {Set<string>} keys */
export function saveDayProgress(planId, keys) {
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${planId}`, JSON.stringify([...keys]));
  } catch {
    // quota / private mode
  }
}

/** @param {string} planId */
export function clearDayProgress(planId) {
  try {
    localStorage.removeItem(`${STORAGE_PREFIX}${planId}`);
  } catch {
    // ignore
  }
}

/**
 * @param {{ id: string, exercises?: { id: string }[] }} day
 * @param {Set<string>} doneKeys
 */
export function computeDayProgress(day, doneKeys) {
  const exercises = day.exercises || [];
  if (exercises.length === 0) {
    return { done: 0, total: 0, pct: 0, complete: false, trackable: false };
  }
  const total = countTotalSets(exercises);
  const done = countDoneSets(day.id, exercises, doneKeys);
  const pct = total ? Math.round((done / total) * 100) : 0;
  return { done, total, pct, complete: total > 0 && done === total, trackable: true };
}

/**
 * @param {{ id: string, exercises?: { id: string }[] }[]} days
 * @param {Set<string>} doneKeys
 */
export function computeWeekProgress(days, doneKeys) {
  let done = 0;
  let total = 0;
  for (const day of days) {
    const dayProg = computeDayProgress(day, doneKeys);
    if (!dayProg.trackable) continue;
    done += dayProg.done;
    total += dayProg.total;
  }
  const pct = total ? Math.round((done / total) * 100) : 0;
  return { done, total, pct, complete: total > 0 && done === total };
}
