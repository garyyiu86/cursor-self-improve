/** @typedef {import("./workoutStorage.js").WorkoutSession} WorkoutSession */

/**
 * @typedef {Object} PersonalRecord
 * @property {string} id
 * @property {string} label
 * @property {string} emoji
 * @property {number|null} value
 * @property {string} unit
 * @property {string|null} detail
 * @property {string|null} achievedAt
 */

/**
 * @typedef {Object} ChartPoint
 * @property {string} date
 * @property {number} value
 * @property {string} label
 */

/**
 * @typedef {Object} Achievement
 * @property {string} id
 * @property {string} label
 * @property {string} emoji
 * @property {string} description
 * @property {boolean} unlocked
 * @property {string|null} unlockedAt
 */

/**
 * @typedef {Object} MuscleBalanceEntry
 * @property {string} muscleGroup
 * @property {number} sets
 * @property {number} pct
 */

/** @param {WorkoutSession[]} sessions */
function completedSessions(sessions) {
  return sessions.filter((s) => s.completedAt);
}

/** @param {WorkoutSession[]} sessions */
export function hasProgressData(sessions) {
  return completedSessions(sessions).some((s) =>
    s.exercises.some((ex) => ex.sets.length > 0),
  );
}

/** @param {WorkoutSession[]} sessions */
export function computePersonalRecords(sessions) {
  const completed = completedSessions(sessions);

  /** @type {{ weight: number, reps: number, volume: number, exerciseName: string, achievedAt: string } | null} */
  let heaviest = null;
  /** @type {{ weight: number, reps: number, volume: number, exerciseName: string, achievedAt: string } | null} */
  let bestSetVolume = null;
  /** @type {{ reps: number, weight: number, exerciseName: string, achievedAt: string } | null} */
  let mostReps = null;
  /** @type {{ volume: number, dayTitle: string, achievedAt: string } | null} */
  let bestSessionVolume = null;

  for (const session of completed) {
    let sessionVolume = 0;

    for (const ex of session.exercises) {
      for (const set of ex.sets) {
        const volume = set.reps * set.weight;
        sessionVolume += volume;

        if (!heaviest || set.weight > heaviest.weight) {
          heaviest = {
            weight: set.weight,
            reps: set.reps,
            volume,
            exerciseName: ex.name,
            achievedAt: set.loggedAt || session.completedAt,
          };
        }

        if (!bestSetVolume || volume > bestSetVolume.volume) {
          bestSetVolume = {
            weight: set.weight,
            reps: set.reps,
            volume,
            exerciseName: ex.name,
            achievedAt: set.loggedAt || session.completedAt,
          };
        }

        if (!mostReps || set.reps > mostReps.reps) {
          mostReps = {
            reps: set.reps,
            weight: set.weight,
            exerciseName: ex.name,
            achievedAt: set.loggedAt || session.completedAt,
          };
        }
      }
    }

    if (!bestSessionVolume || sessionVolume > bestSessionVolume.volume) {
      bestSessionVolume = {
        volume: sessionVolume,
        dayTitle: session.dayTitle,
        achievedAt: session.completedAt,
      };
    }
  }

  /** @type {PersonalRecord[]} */
  return [
    {
      id: "heaviest",
      label: "最重單次",
      emoji: "🏋️",
      value: heaviest?.weight ?? null,
      unit: "kg",
      detail: heaviest
        ? `${heaviest.exerciseName.split("（")[0]} · ${heaviest.reps} 下`
        : null,
      achievedAt: heaviest?.achievedAt ?? null,
    },
    {
      id: "set-volume",
      label: "最高組容量",
      emoji: "💥",
      value: bestSetVolume?.volume ?? null,
      unit: "kg",
      detail: bestSetVolume
        ? `${bestSetVolume.reps} × ${bestSetVolume.weight} kg`
        : null,
      achievedAt: bestSetVolume?.achievedAt ?? null,
    },
    {
      id: "most-reps",
      label: "單組最多下",
      emoji: "🔥",
      value: mostReps?.reps ?? null,
      unit: "下",
      detail: mostReps
        ? `${mostReps.exerciseName.split("（")[0]} · ${mostReps.weight} kg`
        : null,
      achievedAt: mostReps?.achievedAt ?? null,
    },
    {
      id: "session-volume",
      label: "單堂最高容量",
      emoji: "📈",
      value: bestSessionVolume?.volume ?? null,
      unit: "kg",
      detail: bestSessionVolume?.dayTitle ?? null,
      achievedAt: bestSessionVolume?.achievedAt ?? null,
    },
  ];
}

/** @param {WorkoutSession[]} sessions */
export function computeWeightProgression(sessions) {
  /** @type {Map<string, { maxWeight: number, label: string }>} */
  const byDay = new Map();

  for (const session of completedSessions(sessions)) {
    const dayKey = session.completedAt.slice(0, 10);
    let dayMax = byDay.get(dayKey)?.maxWeight ?? 0;

    for (const ex of session.exercises) {
      for (const set of ex.sets) {
        if (set.weight > dayMax) dayMax = set.weight;
      }
    }

    if (dayMax > 0) {
      const date = new Date(dayKey);
      byDay.set(dayKey, {
        maxWeight: dayMax,
        label: date.toLocaleDateString("zh-HK", { month: "short", day: "numeric" }),
      });
    }
  }

  return [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, { maxWeight, label }]) => ({
      date,
      value: maxWeight,
      label,
    }));
}

/** @param {WorkoutSession[]} sessions */
export function computeVolumeTrend(sessions) {
  /** @type {Map<string, { volume: number, label: string }>} */
  const byDay = new Map();

  for (const session of completedSessions(sessions)) {
    const dayKey = session.completedAt.slice(0, 10);
    let dayVolume = byDay.get(dayKey)?.volume ?? 0;

    for (const ex of session.exercises) {
      for (const set of ex.sets) {
        dayVolume += set.reps * set.weight;
      }
    }

    if (dayVolume > 0) {
      const date = new Date(dayKey);
      byDay.set(dayKey, {
        volume: Math.round(dayVolume),
        label: date.toLocaleDateString("zh-HK", { month: "short", day: "numeric" }),
      });
    }
  }

  return [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, { volume, label }]) => ({
      date,
      value: volume,
      label,
    }));
}

/** @param {WorkoutSession[]} sessions */
export function computeMuscleBalance(sessions) {
  /** @type {Record<string, number>} */
  const counts = {};
  let total = 0;

  for (const session of completedSessions(sessions)) {
    for (const ex of session.exercises) {
      const group = ex.muscleGroup || session.muscleGroup || "other";
      const n = ex.sets.length;
      if (n === 0) continue;
      counts[group] = (counts[group] || 0) + n;
      total += n;
    }
  }

  if (total === 0) return [];

  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([muscleGroup, sets]) => ({
      muscleGroup,
      sets,
      pct: Math.round((sets / total) * 100),
    }));
}

/** @param {WorkoutSession[]} sessions @param {(s?: WorkoutSession[]) => { streak: number }} [statsFn] */
export function computeAchievements(sessions, statsFn) {
  const completed = completedSessions(sessions);
  const totalSessions = completed.length;

  let totalSets = 0;
  let totalVolume = 0;
  let maxWeight = 0;

  for (const session of completed) {
    for (const ex of session.exercises) {
      for (const set of ex.sets) {
        totalSets += 1;
        totalVolume += set.reps * set.weight;
        if (set.weight > maxWeight) maxWeight = set.weight;
      }
    }
  }

  const streak =
    typeof statsFn === "function"
      ? statsFn(sessions).streak
      : computeStreakFromSessions(completed);

  const muscleGroups = new Set(
    completed.flatMap((s) =>
      s.exercises.filter((ex) => ex.sets.length > 0).map((ex) => ex.muscleGroup || s.muscleGroup),
    ),
  );

  const firstSessionAt = completed.length
    ? [...completed].sort((a, b) => a.completedAt.localeCompare(b.completedAt))[0].completedAt
    : null;

  /** @type {Achievement[]} */
  const defs = [
    {
      id: "first-workout",
      label: "初出茅廬",
      emoji: "🌱",
      description: "完成第一堂訓練",
      check: () => totalSessions >= 1,
      unlockedAt: totalSessions >= 1 ? firstSessionAt : null,
    },
    {
      id: "five-sessions",
      label: "五堂達成",
      emoji: "⭐",
      description: "累積 5 次訓練",
      check: () => totalSessions >= 5,
      unlockedAt:
        totalSessions >= 5
          ? [...completed].sort((a, b) => a.completedAt.localeCompare(b.completedAt))[4]?.completedAt
          : null,
    },
    {
      id: "streak-3",
      label: "三日連續",
      emoji: "🔥",
      description: "連續 3 日有訓練",
      check: () => streak >= 3,
      unlockedAt: streak >= 3 ? completed[0]?.completedAt ?? null : null,
    },
    {
      id: "volume-500",
      label: "半噸里程碑",
      emoji: "💪",
      description: "累積容量達 500 kg",
      check: () => totalVolume >= 500,
      unlockedAt: null,
    },
    {
      id: "sets-50",
      label: "組數達人",
      emoji: "🎯",
      description: "累積 50 組",
      check: () => totalSets >= 50,
      unlockedAt: null,
    },
    {
      id: "heavy-10",
      label: "十公斤俱樂部",
      emoji: "🏆",
      description: "單次舉起 10 kg 或以上",
      check: () => maxWeight >= 10,
      unlockedAt: null,
    },
    {
      id: "muscle-4",
      label: "全面訓練",
      emoji: "🌈",
      description: "訓練過 4 個或以上肌群",
      check: () => muscleGroups.size >= 4,
      unlockedAt: null,
    },
    {
      id: "ten-sessions",
      label: "十堂里程碑",
      emoji: "👑",
      description: "累積 10 次訓練",
      check: () => totalSessions >= 10,
      unlockedAt:
        totalSessions >= 10
          ? [...completed].sort((a, b) => a.completedAt.localeCompare(b.completedAt))[9]?.completedAt
          : null,
    },
  ];

  return defs.map(({ id, label, emoji, description, check, unlockedAt }) => ({
    id,
    label,
    emoji,
    description,
    unlocked: check(),
    unlockedAt: check() ? unlockedAt : null,
  }));
}

/** @param {WorkoutSession[]} completed */
function computeStreakFromSessions(completed) {
  if (completed.length === 0) return 0;
  const dayKeys = new Set(completed.map((s) => s.completedAt.slice(0, 10)));
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

/** @param {Date} d */
function toDayKey(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** @param {string|null} iso */
export function formatAchievedDate(iso) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("zh-HK", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
