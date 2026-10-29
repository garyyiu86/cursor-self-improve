import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const WORKOUT_MILESTONES = [3, 7, 14, 30];

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "..", "data");
const PROGRESS_FILE = path.join(DATA_DIR, "workout-progress.json");

function ensureDataDir() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readAllProgress() {
  try {
    if (!fs.existsSync(PROGRESS_FILE)) return {};
    const raw = JSON.parse(fs.readFileSync(PROGRESS_FILE, "utf8"));
    return raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  } catch (err) {
    console.warn("[Eva][workout] Failed to load progress:", err?.message || err);
    return {};
  }
}

function writeAllProgress(all) {
  ensureDataDir();
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(all, null, 2), "utf8");
}

export function exerciseProgressKey(dayId, exerciseId) {
  return `${dayId}:${exerciseId}`;
}

export function toDayKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function emptyProgress(planId) {
  return {
    planId,
    completedExercises: [],
    completedDays: [],
    celebratedMilestones: [],
    updatedAt: new Date().toISOString(),
  };
}

export function loadProgress(planId) {
  const all = readAllProgress();
  return all[planId] ? structuredClone(all[planId]) : emptyProgress(planId);
}

export function saveProgress(state) {
  const all = readAllProgress();
  const next = { ...state, updatedAt: new Date().toISOString() };
  all[state.planId] = next;
  writeAllProgress(all);
  return next;
}

export function isExerciseDone(dayId, exerciseId, state) {
  return state.completedExercises.includes(exerciseProgressKey(dayId, exerciseId));
}

export function computeDayProgress(day, state) {
  const exercises = day.exercises || [];
  if (exercises.length === 0) {
    return { done: 0, total: 0, pct: 0, complete: false, trackable: false };
  }
  const total = exercises.length;
  let done = 0;
  for (const ex of exercises) {
    if (isExerciseDone(day.id, ex.id, state)) done += 1;
  }
  const pct = total ? Math.round((done / total) * 100) : 0;
  return { done, total, pct, complete: total > 0 && done === total, trackable: true };
}

export function computeWeekProgress(plan, state) {
  let done = 0;
  let total = 0;
  for (const day of plan.days) {
    const prog = computeDayProgress(day, state);
    if (!prog.trackable) continue;
    done += prog.done;
    total += prog.total;
  }
  const pct = total ? Math.round((done / total) * 100) : 0;
  return { done, total, pct, complete: total > 0 && done === total, trackable: total > 0 };
}

export function computeStreak(completedDays) {
  if (completedDays.length === 0) return 0;
  const dayKeys = new Set(completedDays);
  const today = new Date();
  const todayKey = toDayKey(today);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = toDayKey(yesterday);
  if (!dayKeys.has(todayKey) && !dayKeys.has(yesterdayKey)) return 0;

  let streak = 0;
  let cursor = dayKeys.has(todayKey) ? today : yesterday;
  while (dayKeys.has(toDayKey(cursor))) {
    streak += 1;
    cursor = new Date(cursor);
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function detectMilestone(streak, celebrated) {
  for (const m of WORKOUT_MILESTONES) {
    if (streak === m && !celebrated.includes(m)) return m;
  }
  return null;
}

function maybeLogCompletedDay(day, state, date = new Date()) {
  const prog = computeDayProgress(day, state);
  if (!prog.complete) return state;
  const key = toDayKey(date);
  if (state.completedDays.includes(key)) return state;
  return { ...state, completedDays: [...state.completedDays, key].sort() };
}

export function toggleExercise(plan, dayId, exerciseId, done, state, date = new Date()) {
  const key = exerciseProgressKey(dayId, exerciseId);
  let completed = [...state.completedExercises];
  const has = completed.includes(key);
  if (done && !has) completed.push(key);
  else if (!done && has) completed = completed.filter((k) => k !== key);

  let next = { ...state, planId: plan.id, completedExercises: completed };
  const day = plan.days.find((d) => d.id === dayId);
  if (day) {
    next = maybeLogCompletedDay(day, next, date);
    if (!computeDayProgress(day, next).complete) {
      const dayKey = toDayKey(date);
      next = { ...next, completedDays: next.completedDays.filter((d) => d !== dayKey) };
    }
  }

  const streak = computeStreak(next.completedDays);
  let milestone = null;
  if (done) {
    milestone = detectMilestone(streak, next.celebratedMilestones);
    if (milestone != null) {
      next = { ...next, celebratedMilestones: [...next.celebratedMilestones, milestone] };
    }
  }

  const saved = saveProgress(next);
  const dayProgress = day
    ? computeDayProgress(day, saved)
    : { done: 0, total: 0, pct: 0, complete: false, trackable: false };

  return { state: saved, dayProgress, streak, milestone };
}

export function resetProgress(planId) {
  return saveProgress(emptyProgress(planId));
}

export function getTodayDayIndex(date = new Date()) {
  const jsDay = date.getDay();
  return jsDay === 0 ? 6 : jsDay - 1;
}

export function getTodayDay(plan, date = new Date()) {
  const idx = getTodayDayIndex(date);
  return plan.days[idx] ?? plan.days[0];
}
