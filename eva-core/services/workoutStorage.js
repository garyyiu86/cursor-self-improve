/** @typedef {{ reps: number, weight: number, loggedAt: string }} LoggedSet */

/**
 * @typedef {Object} SessionExercise
 * @property {string} exerciseId
 * @property {string} name
 * @property {string} muscleGroup
 * @property {number} targetSets
 * @property {string} targetReps
 * @property {LoggedSet[]} sets
 */

/**
 * @typedef {Object} WorkoutSession
 * @property {string} id
 * @property {string} startedAt
 * @property {string} completedAt
 * @property {number} durationMs
 * @property {string} muscleGroup
 * @property {string} difficulty
 * @property {string} planTitle
 * @property {string} dayTitle
 * @property {SessionExercise[]} exercises
 */

const STORAGE_KEY = "eva-workout-sessions";

/** @returns {boolean} */
function hasStorage() {
  return typeof globalThis !== "undefined" && !!globalThis.localStorage;
}

/** @returns {WorkoutSession[]} */
export function getSessions() {
  if (!hasStorage()) return [];
  try {
    const raw = globalThis.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** @param {WorkoutSession[]} sessions */
function persistSessions(sessions) {
  if (!hasStorage()) return;
  globalThis.localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
}

/** @param {WorkoutSession} session */
export function saveSession(session) {
  const sessions = getSessions();
  const idx = sessions.findIndex((s) => s.id === session.id);
  if (idx >= 0) {
    sessions[idx] = session;
  } else {
    sessions.unshift(session);
  }
  persistSessions(sessions);
  return session;
}

/** @param {string} id */
export function deleteSession(id) {
  persistSessions(getSessions().filter((s) => s.id !== id));
}

/** @returns {string} */
export function createSessionId() {
  return `ws-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** @param {string} restLabel e.g. "45–60s" */
export function parseRestSeconds(restLabel) {
  const text = String(restLabel || "");
  const matches = text.match(/\d+/g);
  if (!matches || matches.length === 0) return 60;
  const nums = matches.map(Number);
  return Math.round(nums.reduce((a, b) => a + b, 0) / nums.length);
}

/** @param {number} ms */
export function formatDuration(ms) {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/** @param {WorkoutSession[]} [sessions] */
export function computeStats(sessions = getSessions()) {
  const completed = sessions.filter((s) => s.completedAt);
  let totalSets = 0;
  let totalReps = 0;
  let totalVolume = 0;

  for (const session of completed) {
    for (const ex of session.exercises) {
      for (const set of ex.sets) {
        totalSets += 1;
        totalReps += set.reps;
        totalVolume += set.reps * set.weight;
      }
    }
  }

  return {
    totalSessions: completed.length,
    totalSets,
    totalReps,
    totalVolume: Math.round(totalVolume),
    streak: computeStreak(completed),
  };
}

/** @param {WorkoutSession[]} completed */
function computeStreak(completed) {
  if (completed.length === 0) return 0;

  const dayKeys = new Set(
    completed.map((s) => s.completedAt.slice(0, 10)),
  );
  const sorted = [...dayKeys].sort().reverse();

  const today = new Date();
  const todayKey = toDayKey(today);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = toDayKey(yesterday);

  if (!sorted.includes(todayKey) && !sorted.includes(yesterdayKey)) {
    return 0;
  }

  let streak = 0;
  let cursor = sorted.includes(todayKey) ? today : yesterday;

  while (dayKeys.has(toDayKey(cursor))) {
    streak += 1;
    cursor = new Date(cursor);
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}

/** @param {Date} d */
function toDayKey(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** @param {WorkoutSession[]} [sessions] */
export function computeMuscleBreakdown(sessions = getSessions()) {
  /** @type {Record<string, number>} */
  const counts = {};

  for (const session of sessions) {
    if (!session.completedAt) continue;
    for (const ex of session.exercises) {
      const group = ex.muscleGroup || session.muscleGroup || "other";
      counts[group] = (counts[group] || 0) + ex.sets.length;
    }
  }

  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const max = entries.length ? entries[0][1] : 0;

  return entries.map(([muscleGroup, sets]) => ({
    muscleGroup,
    sets,
    pct: max > 0 ? Math.round((sets / max) * 100) : 0,
  }));
}

/** @param {WorkoutSession[]} [sessions] @param {number} [limit] */
export function getRecentSessions(sessions = getSessions(), limit = 5) {
  return [...sessions]
    .filter((s) => s.completedAt)
    .sort((a, b) => b.completedAt.localeCompare(a.completedAt))
    .slice(0, limit);
}
