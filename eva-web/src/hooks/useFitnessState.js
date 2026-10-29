import { useCallback, useEffect, useMemo, useState } from "react";
import {
  computePlanStats,
  generateWeeklyPlan,
  getProgress,
  trackProgress,
} from "../../../eva-core/services/fitness-planner.js";

const STORAGE_KEY = "eva-fitness-state-v1";

/** @typedef {import('../../../eva-core/services/fitness-planner.js').FitnessGoal} FitnessGoal */
/** @typedef {import('../../../eva-core/services/fitness-planner.js').UserLevel} UserLevel */

function readStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function writeStorage(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    /* quota / private mode */
  }
}

function defaultState() {
  return {
    selectedGoal: "tone",
    level: "beginner",
    daysPerWeek: 3,
    activePlan: generateWeeklyPlan("tone", "beginner", 3),
    exerciseCompletions: {},
    progressHistory: [],
    streak: 0,
    lastActiveDate: null,
  };
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function computeStreak(lastActiveDate, currentStreak) {
  if (!lastActiveDate) return 0;
  const today = todayKey();
  if (lastActiveDate === today) return currentStreak;
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yKey = yesterday.toISOString().slice(0, 10);
  if (lastActiveDate === yKey) return currentStreak;
  return 0;
}

export function useFitnessState() {
  const [state, setState] = useState(() => {
    const saved = readStorage();
    if (saved?.activePlan) {
      return {
        ...defaultState(),
        ...saved,
        streak: computeStreak(saved.lastActiveDate, saved.streak || 0),
      };
    }
    return defaultState();
  });

  useEffect(() => {
    writeStorage(state);
  }, [state]);

  const completionSet = useMemo(() => {
    const planId = state.activePlan?.id;
    if (!planId) return new Set();
    return new Set(state.exerciseCompletions[planId] || []);
  }, [state.activePlan?.id, state.exerciseCompletions]);

  const stats = useMemo(
    () =>
      state.activePlan
        ? computePlanStats(state.activePlan, [...completionSet])
        : { total: 0, completed: 0, pct: 0 },
    [state.activePlan, completionSet],
  );

  const regeneratePlan = useCallback(() => {
    const plan = generateWeeklyPlan(
      state.selectedGoal,
      state.level,
      state.daysPerWeek,
    );
    setState((prev) => ({
      ...prev,
      activePlan: plan,
      exerciseCompletions: {
        ...prev.exerciseCompletions,
        [plan.id]: [],
      },
    }));
  }, [state.selectedGoal, state.level, state.daysPerWeek]);

  const setSelectedGoal = useCallback((goal) => {
    setState((prev) => ({ ...prev, selectedGoal: goal }));
  }, []);

  const setLevel = useCallback((level) => {
    setState((prev) => ({ ...prev, level }));
  }, []);

  const setDaysPerWeek = useCallback((days) => {
    setState((prev) => ({ ...prev, daysPerWeek: days }));
  }, []);

  const toggleExercise = useCallback((exerciseId) => {
    setState((prev) => {
      const planId = prev.activePlan?.id;
      if (!planId) return prev;

      const current = new Set(prev.exerciseCompletions[planId] || []);
      const wasDone = current.has(exerciseId);
      if (wasDone) current.delete(exerciseId);
      else current.add(exerciseId);

      const completedList = [...current];
      trackProgress(planId, completedList);

      const today = todayKey();
      let streak = prev.streak;
      let lastActiveDate = prev.lastActiveDate;

      if (!wasDone && completedList.length > 0) {
        if (lastActiveDate === today) {
          /* same day */
        } else {
          const yesterday = new Date();
          yesterday.setDate(yesterday.getDate() - 1);
          const yKey = yesterday.toISOString().slice(0, 10);
          streak = lastActiveDate === yKey ? streak + 1 : 1;
          lastActiveDate = today;
        }
      }

      const progressEntry = {
        planId,
        completedCount: completedList.length,
        at: new Date().toISOString(),
        snapshot: getProgress(planId),
      };

      return {
        ...prev,
        exerciseCompletions: {
          ...prev.exerciseCompletions,
          [planId]: completedList,
        },
        streak,
        lastActiveDate,
        progressHistory: [...prev.progressHistory.slice(-49), progressEntry],
      };
    });
  }, []);

  const isExerciseDone = useCallback(
    (exerciseId) => completionSet.has(exerciseId),
    [completionSet],
  );

  return {
    activePlan: state.activePlan,
    selectedGoal: state.selectedGoal,
    level: state.level,
    daysPerWeek: state.daysPerWeek,
    exerciseCompletions: state.exerciseCompletions,
    progressHistory: state.progressHistory,
    streak: state.streak,
    stats,
    setSelectedGoal,
    setLevel,
    setDaysPerWeek,
    regeneratePlan,
    toggleExercise,
    isExerciseDone,
  };
}
