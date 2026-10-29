import {
  getDayByIndex,
  getTodayDayIndex,
  type WeeklyDay,
  type WeeklyExercise,
} from "../data/weeklyPlan";

const STORAGE_KEY = "eva-guided-workout-sets-v1";

export type SetProgressKeys = Set<string>;

export interface DaySetProgress {
  done: number;
  total: number;
  pct: number;
  complete: boolean;
  trackable: boolean;
}

function hasStorage(): boolean {
  return typeof globalThis !== "undefined" && !!globalThis.localStorage;
}

/** Stable key for one set: `${dayId}:${exerciseId}:s${setIndex}` */
export function setProgressKey(
  dayId: string,
  exerciseId: string,
  setIndex: number,
): string {
  return `${dayId}:${exerciseId}:s${setIndex}`;
}

export function loadSetProgress(): SetProgressKeys {
  if (!hasStorage()) return new Set();
  try {
    const raw = globalThis.localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((k): k is string => typeof k === "string"));
  } catch {
    return new Set();
  }
}

export function saveSetProgress(keys: SetProgressKeys): void {
  if (!hasStorage()) return;
  try {
    globalThis.localStorage.setItem(STORAGE_KEY, JSON.stringify([...keys]));
  } catch {
    // quota / private mode
  }
}

export function isSetDone(
  dayId: string,
  exerciseId: string,
  setIndex: number,
  keys: SetProgressKeys,
): boolean {
  return keys.has(setProgressKey(dayId, exerciseId, setIndex));
}

export function toggleSet(
  dayId: string,
  exerciseId: string,
  setIndex: number,
  done: boolean,
  keys: SetProgressKeys,
): SetProgressKeys {
  const next = new Set(keys);
  const key = setProgressKey(dayId, exerciseId, setIndex);
  if (done) next.add(key);
  else next.delete(key);
  saveSetProgress(next);
  return next;
}

function countTotalSets(exercises: WeeklyExercise[]): number {
  return exercises.reduce((n, ex) => n + Math.max(1, ex.sets || 1), 0);
}

function countDoneSets(
  dayId: string,
  exercises: WeeklyExercise[],
  keys: SetProgressKeys,
): number {
  let done = 0;
  for (const ex of exercises) {
    const setCount = Math.max(1, ex.sets || 1);
    for (let i = 0; i < setCount; i++) {
      if (isSetDone(dayId, ex.id, i, keys)) done++;
    }
  }
  return done;
}

export function computeDaySetProgress(
  day: WeeklyDay,
  keys: SetProgressKeys,
): DaySetProgress {
  const exercises = day.exercises || [];
  if (exercises.length === 0) {
    return { done: 0, total: 0, pct: 0, complete: false, trackable: false };
  }
  const total = countTotalSets(exercises);
  const done = countDoneSets(day.id, exercises, keys);
  const pct = total ? Math.round((done / total) * 100) : 0;
  return {
    done,
    total,
    pct,
    complete: total > 0 && done === total,
    trackable: true,
  };
}

export function isDayFullyComplete(day: WeeklyDay, keys: SetProgressKeys): boolean {
  const prog = computeDaySetProgress(day, keys);
  return prog.trackable && prog.complete;
}

export function isExerciseFullyComplete(
  dayId: string,
  exercise: WeeklyExercise,
  keys: SetProgressKeys,
): boolean {
  const setCount = Math.max(1, exercise.sets || 1);
  for (let i = 0; i < setCount; i++) {
    if (!isSetDone(dayId, exercise.id, i, keys)) return false;
  }
  return true;
}

export function getTodaySetProgress(keys: SetProgressKeys, day?: WeeklyDay): DaySetProgress {
  const target = day ?? getDayByIndex(getTodayDayIndex());
  return computeDaySetProgress(target, keys);
}
