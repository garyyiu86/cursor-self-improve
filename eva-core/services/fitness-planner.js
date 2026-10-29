import {
  EXERCISE_DATABASE,
  MUSCLE_META,
  getExercisesByMaxDifficulty,
  getExercisesByMuscle,
} from "../data/exercise-database.js";

/** @typedef {'tone'|'strength'|'stage'|'endurance'} FitnessGoal */
/** @typedef {'beginner'|'intermediate'|'advanced'} UserLevel */

const WEEKDAY_NAMES = ["一", "二", "三", "四", "五", "六", "日"];

/** @type {Record<FitnessGoal, { label: string; emoji: string; muscles: import('../data/exercise-database.js').TargetMuscle[] }>} */
export const GOAL_META = {
  tone: {
    label: "線條塑形",
    emoji: "💫",
    muscles: ["biceps", "triceps", "core"],
  },
  strength: {
    label: "力量提升",
    emoji: "🏋️",
    muscles: ["quads", "full-body"],
  },
  stage: {
    label: "舞台體能",
    emoji: "🎤",
    muscles: ["full-body", "core", "quads"],
  },
  endurance: {
    label: "耐力持久",
    emoji: "🔥",
    muscles: ["core", "quads", "full-body"],
  },
};

/** @type {Record<UserLevel, number>} max difficulty dots */
const LEVEL_MAX_DIFFICULTY = {
  beginner: 2,
  intermediate: 3,
  advanced: 5,
};

/** @type {Record<UserLevel, number>} sets multiplier */
const LEVEL_SETS = {
  beginner: 3,
  intermediate: 3,
  advanced: 4,
};

/** @type {Map<string, { planId: string; completed: string[]; updatedAt: string }>} */
const progressStore = new Map();

/**
 * @param {FitnessGoal} goal
 * @returns {{ focusAreas: string[]; tip: string; emoji: string }}
 */
export function getRecommendation(goal) {
  const meta = GOAL_META[goal] || GOAL_META.tone;
  const focusAreas = meta.muscles.map((m) => MUSCLE_META[m]?.label || m);
  const tips = {
    tone: "手臂同核心一齊練，舞台 close-up 線條會更 sharp～",
    strength: "四頭同全身 compound 動作先，jump 編舞先頂得順。",
    stage: "全身 + core 平衡練，encore 都唔會散架。",
    endurance: "短休息、多組數——似排練連跳三首咁嘅 stamina。",
  };
  return {
    focusAreas,
    tip: tips[goal] || tips.tone,
    emoji: meta.emoji,
  };
}

/**
 * @param {import('../data/exercise-database.js').ExerciseEntry} exercise
 * @param {UserLevel} userLevel
 * @returns {string}
 */
export function generateExerciseDescription(exercise, userLevel) {
  const levelNote = {
    beginner: "初學唔使急，動作靚先加重～",
    intermediate: "你有底子啦，控制離心會更靚！",
    advanced: "高階了？試下加重或者加多一組，舞台爆發力會更穩。",
  };
  const tip = exercise.tip || "記住呼吸同 form，唔好求快。";
  const idol = exercise.idolDescription || "";
  const sets = LEVEL_SETS[userLevel] || exercise.sets;
  return `「${exercise.name}」——${tip} ${idol} 建議 ${sets} 組 × ${exercise.reps}。${levelNote[userLevel] || levelNote.beginner}`;
}

/** @param {FitnessGoal} goal @param {UserLevel} level */
function pickExercisesForDay(goal, level, dayIndex) {
  const meta = GOAL_META[goal] || GOAL_META.tone;
  const maxDiff = LEVEL_MAX_DIFFICULTY[level] || 2;
  const pool = getExercisesByMaxDifficulty(maxDiff);
  const focusMuscle = meta.muscles[dayIndex % meta.muscles.length];
  const primary = getExercisesByMuscle(focusMuscle).filter(
    (ex) => ex.difficulty <= maxDiff,
  );
  const secondary = pool.filter(
    (ex) => ex.targetMuscle !== focusMuscle && ex.difficulty <= maxDiff,
  );

  const pick = (list, count, offset) => {
    if (list.length === 0) return [];
    const out = [];
    for (let i = 0; i < count; i += 1) {
      out.push(list[(dayIndex + i + offset) % list.length]);
    }
    return out;
  };

  const exercises = [
    ...pick(primary, 2, 0),
    ...pick(secondary, 1, dayIndex),
  ];

  const unique = [];
  const seen = new Set();
  for (const ex of exercises) {
    if (!seen.has(ex.id)) {
      seen.add(ex.id);
      unique.push(ex);
    }
  }
  return unique.slice(0, 3);
}

/**
 * @param {number} daysPerWeek
 * @returns {number[]}
 */
function workoutDayIndices(daysPerWeek) {
  const n = Math.min(6, Math.max(2, daysPerWeek));
  const templates = {
    2: [1, 4],
    3: [0, 2, 4],
    4: [0, 1, 3, 5],
    5: [0, 1, 2, 4, 5],
    6: [0, 1, 2, 3, 4, 5],
  };
  return templates[n] || templates[3];
}

/**
 * @param {FitnessGoal} goal
 * @param {UserLevel} level
 * @param {number} daysPerWeek
 */
export function generateWeeklyPlan(goal, level, daysPerWeek = 3) {
  const workoutDays = new Set(workoutDayIndices(daysPerWeek));
  const sets = LEVEL_SETS[level] || 3;
  const planId = `fitness-${goal}-${level}-${Date.now()}`;

  const days = WEEKDAY_NAMES.map((weekday, dayIndex) => {
    const isWorkout = workoutDays.has(dayIndex);
    if (!isWorkout) {
      return {
        dayIndex,
        dayName: `星期${weekday}`,
        type: "rest",
        title: "休息日",
        emoji: "🌸",
        exercises: [],
        completed: false,
      };
    }

    const rawExercises = pickExercisesForDay(goal, level, dayIndex);
    const exercises = rawExercises.map((ex) => ({
      id: ex.id,
      name: ex.name,
      targetMuscle: ex.targetMuscle,
      muscleLabel: ex.muscleLabel,
      difficulty: ex.difficulty,
      icon: ex.icon,
      sets,
      reps: ex.reps,
      tip: ex.tip,
      idolDescription: ex.idolDescription,
      description: generateExerciseDescription(ex, level),
      completed: false,
    }));

    const meta = GOAL_META[goal] || GOAL_META.tone;
    return {
      dayIndex,
      dayName: `星期${weekday}`,
      type: "workout",
      title: `${meta.emoji} ${meta.label}訓練`,
      emoji: meta.emoji,
      exercises,
      completed: false,
    };
  });

  const rec = getRecommendation(goal);
  return {
    id: planId,
    goal,
    level,
    daysPerWeek,
    title: `Eva 健身顧問 · ${GOAL_META[goal]?.label || goal}`,
    motto: "楽しむことが一番 ✨",
    recommendation: rec,
    createdAt: new Date().toISOString(),
    days,
  };
}

/**
 * @param {string} planId
 * @param {string[]} completedExercises exercise ids
 */
export function trackProgress(planId, completedExercises) {
  const unique = [...new Set(completedExercises)];
  const entry = {
    planId,
    completed: unique,
    updatedAt: new Date().toISOString(),
  };
  progressStore.set(planId, entry);
  return {
    ...entry,
    completedCount: unique.length,
  };
}

/** @param {string} planId */
export function getProgress(planId) {
  return progressStore.get(planId) || { planId, completed: [], updatedAt: null };
}

/** @param {{ days: { exercises: { id: string }[]; type: string }[] }} plan */
export function computePlanStats(plan, completedIds = []) {
  const done = new Set(completedIds);
  let total = 0;
  let completed = 0;
  for (const day of plan.days) {
    if (day.type !== "workout") continue;
    for (const ex of day.exercises) {
      total += 1;
      if (done.has(ex.id)) completed += 1;
    }
  }
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
  return { total, completed, pct };
}

export { EXERCISE_DATABASE, MUSCLE_META, GOAL_META as FITNESS_GOALS };
