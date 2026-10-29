/** One exercise in Eva's default weekly guided workout. */
export interface WeeklyExercise {
  id: string;
  name: string;
  sets: number;
  reps: string;
}

/** A single day in the 7-day Eva weekly plan. */
export interface WeeklyDay {
  id: string;
  dayIndex: number;
  weekdayLabel: string;
  shortWeekday: string;
  emoji: string;
  title: string;
  type: "workout" | "recovery" | "technique" | "free" | "rest";
  exercises: WeeklyExercise[];
  note?: string;
}

const PROGRESS_STORAGE_KEY = "eva-guided-workout-exercises-v1";

/** Map key: `${dayId}+${exId}` → checked state */
export function exerciseProgressKey(dayId: string, exId: string): string {
  return `${dayId}+${exId}`;
}

function hasStorage(): boolean {
  return typeof globalThis !== "undefined" && !!globalThis.localStorage;
}

/** Load persisted per-exercise completion map from localStorage. */
export function loadExerciseProgress(): Map<string, boolean> {
  if (!hasStorage()) return new Map();
  try {
    const raw = globalThis.localStorage.getItem(PROGRESS_STORAGE_KEY);
    if (!raw) return new Map();
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return new Map();
    }
    const map = new Map<string, boolean>();
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof key === "string" && value === true) {
        map.set(key, true);
      }
    }
    return map;
  } catch {
    return new Map();
  }
}

/** Persist the exercise completion map to localStorage. */
export function saveExerciseProgress(progress: Map<string, boolean>): void {
  if (!hasStorage()) return;
  try {
    const obj: Record<string, boolean> = {};
    for (const [key, value] of progress) {
      if (value) obj[key] = true;
    }
    globalThis.localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(obj));
  } catch {
    // quota / private mode
  }
}

export function isExerciseDone(
  dayId: string,
  exId: string,
  progress: Map<string, boolean>,
): boolean {
  return progress.get(exerciseProgressKey(dayId, exId)) === true;
}

export function setExerciseDone(
  dayId: string,
  exId: string,
  done: boolean,
  progress: Map<string, boolean>,
): Map<string, boolean> {
  const next = new Map(progress);
  const key = exerciseProgressKey(dayId, exId);
  if (done) next.set(key, true);
  else next.delete(key);
  saveExerciseProgress(next);
  return next;
}

export function isDayFullyComplete(day: WeeklyDay, progress: Map<string, boolean>): boolean {
  if (day.exercises.length === 0) return false;
  return day.exercises.every((ex) => isExerciseDone(day.id, ex.id, progress));
}

/** Monday = 0 … Sunday = 6 */
export function getTodayDayIndex(date: Date = new Date()): number {
  const jsDay = date.getDay();
  return jsDay === 0 ? 6 : jsDay - 1;
}

export const EVA_WEEKLY_PLAN: WeeklyDay[] = [
  {
    id: "mon",
    dayIndex: 0,
    weekdayLabel: "星期一",
    shortWeekday: "一",
    emoji: "🌕",
    title: "主訓練日",
    type: "workout",
    exercises: [
      { id: "mon-curl", name: "Dumbbell Bicep Curl（啞鈴彎舉）", sets: 3, reps: "12" },
      { id: "mon-hammer", name: "Hammer Curl（錘式彎舉）", sets: 3, reps: "12" },
      { id: "mon-pushup", name: "Push-up（掌上壓）", sets: 2, reps: "12" },
    ],
  },
  {
    id: "tue",
    dayIndex: 1,
    weekdayLabel: "星期二",
    shortWeekday: "二",
    emoji: "🌑",
    title: "輕量日",
    type: "recovery",
    exercises: [
      { id: "tue-stretch-arm", name: "手臂拉伸（每邊 30 秒）", sets: 2, reps: "30s" },
      { id: "tue-cat-cow", name: "Cat-Cow 脊椎活動", sets: 2, reps: "10" },
      { id: "tue-walk", name: "輕鬆步行", sets: 1, reps: "15min" },
    ],
  },
  {
    id: "wed",
    dayIndex: 2,
    weekdayLabel: "星期三",
    shortWeekday: "三",
    emoji: "🔥",
    title: "燃脂日",
    type: "workout",
    exercises: [
      { id: "wed-jack", name: "Jumping Jack（開合跳）", sets: 3, reps: "30s" },
      { id: "wed-squat", name: "Bodyweight Squat（徒手深蹲）", sets: 3, reps: "15" },
      { id: "wed-conc", name: "Concentration Curl（集中彎舉）", sets: 3, reps: "12" },
    ],
  },
  {
    id: "thu",
    dayIndex: 3,
    weekdayLabel: "星期四",
    shortWeekday: "四",
    emoji: "🌊",
    title: "輕量日",
    type: "technique",
    exercises: [
      { id: "thu-mind-muscle", name: "意念收縮彎舉（輕重量）", sets: 3, reps: "12" },
      { id: "thu-band", name: "Band Pull-apart（彈力帶後拉）", sets: 2, reps: "15" },
      { id: "thu-core", name: "Dead Bug 核心穩定", sets: 2, reps: "10" },
    ],
  },
  {
    id: "fri",
    dayIndex: 4,
    weekdayLabel: "星期五",
    shortWeekday: "五",
    emoji: "💪",
    title: "主訓練日",
    type: "workout",
    exercises: [
      { id: "fri-incline", name: "Incline Dumbbell Curl（上斜彎舉）", sets: 3, reps: "12" },
      { id: "fri-reverse", name: "Reverse Curl（反握彎舉）", sets: 3, reps: "12" },
      { id: "fri-band", name: "Band Pull-apart（彈力帶後拉）", sets: 2, reps: "15" },
    ],
  },
  {
    id: "sat",
    dayIndex: 5,
    weekdayLabel: "星期六",
    shortWeekday: "六",
    emoji: "🎵",
    title: "自由活動",
    type: "free",
    exercises: [
      { id: "sat-cardio", name: "跳舞／行山／游水（擇一）", sets: 1, reps: "20min" },
      { id: "sat-stretch", name: "全身拉伸收尾", sets: 1, reps: "10min" },
    ],
  },
  {
    id: "sun",
    dayIndex: 6,
    weekdayLabel: "星期日",
    shortWeekday: "日",
    emoji: "😴",
    title: "休息日",
    type: "rest",
    exercises: [],
    note: "今日完全休息，讓肌肉修復生長～",
  },
];

export function getDayByIndex(index: number): WeeklyDay {
  const clamped = ((index % 7) + 7) % 7;
  return EVA_WEEKLY_PLAN[clamped] ?? EVA_WEEKLY_PLAN[0];
}

export function getTodayDay(date: Date = new Date()): WeeklyDay {
  return getDayByIndex(getTodayDayIndex(date));
}
