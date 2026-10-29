import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { generateWeeklyPlan } from "./workoutPlanner.js";

const require = createRequire(import.meta.url);
const { getDataDir } = require("../env.cjs");

const MAX_PLANS = 50;

/** @returns {string} */
function plansFilePath() {
  return path.join(getDataDir(), "training-plans.json");
}

/** @returns {import("../models/trainingPlan.ts").SavedTrainingPlan[]} */
function readAllPlans() {
  try {
    const file = plansFilePath();
    if (!fs.existsSync(file)) return [];
    const raw = JSON.parse(fs.readFileSync(file, "utf8"));
    return Array.isArray(raw) ? raw : [];
  } catch (err) {
    console.warn("[Eva][training] Failed to load plans:", err?.message || err);
    return [];
  }
}

/** @param {import("../models/trainingPlan.ts").SavedTrainingPlan[]} plans */
function writeAllPlans(plans) {
  const dir = getDataDir();
  fs.mkdirSync(dir, { recursive: true });
  const trimmed = plans.slice(0, MAX_PLANS);
  fs.writeFileSync(plansFilePath(), JSON.stringify(trimmed, null, 2), "utf8");
  return trimmed;
}

/** @returns {string} */
export function createTrainingPlanId() {
  return `tp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * @param {ReturnType<typeof generateWeeklyPlan>} weekly
 * @param {{ source?: import("../models/trainingPlan.ts").SavedTrainingPlan["source"], muscleGroup?: string, difficulty?: string }} [opts]
 * @returns {import("../models/trainingPlan.ts").SavedTrainingPlan}
 */
export function buildSavedPlan(weekly, opts = {}) {
  const now = new Date().toISOString();
  return {
    id: createTrainingPlanId(),
    createdAt: now,
    source: opts.source || "planner",
    muscleGroup: opts.muscleGroup || weekly.muscleGroup,
    difficulty: opts.difficulty || weekly.difficulty,
    title: weekly.title,
    subtitle: weekly.subtitle,
    motto: weekly.motto,
    days: weekly.days,
    reminders: weekly.reminders,
  };
}

/** @param {import("../models/trainingPlan.ts").SavedTrainingPlan} plan */
export function saveTrainingPlan(plan) {
  const plans = readAllPlans();
  const idx = plans.findIndex((p) => p.id === plan.id);
  if (idx >= 0) {
    plans[idx] = plan;
  } else {
    plans.unshift(plan);
  }
  writeAllPlans(plans);
  return plan;
}

/**
 * Generate a weekly plan and persist it.
 * @param {string} muscleGroup
 * @param {string} difficulty
 * @param {import("../models/trainingPlan.ts").SavedTrainingPlan["source"]} [source]
 */
export function generateAndSavePlan(muscleGroup, difficulty, source = "planner") {
  const weekly = generateWeeklyPlan(muscleGroup, difficulty);
  const saved = buildSavedPlan(weekly, { source, muscleGroup, difficulty });
  return saveTrainingPlan(saved);
}

/** @returns {import("../models/trainingPlan.ts").TrainingPlanSummary[]} */
export function listTrainingPlans() {
  return readAllPlans().map((plan) => ({
    id: plan.id,
    title: plan.title,
    muscleGroup: plan.muscleGroup,
    difficulty: plan.difficulty,
    createdAt: plan.createdAt,
    source: plan.source,
    workoutDayCount: plan.days.filter(
      (d) => d.type === "workout" || d.type === "cardio" || d.type === "technique",
    ).length,
  }));
}

/** @param {string} id */
export function getTrainingPlanById(id) {
  const needle = String(id || "").trim();
  if (!needle) return null;
  return readAllPlans().find((p) => p.id === needle) ?? null;
}
