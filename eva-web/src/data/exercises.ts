/** Filter tabs shown in the exercise library panel. */
export type MuscleFilter = "all" | "arms" | "legs" | "core";

export type Difficulty = "beginner" | "intermediate" | "advanced";

/** One exercise row in Eva's weekly training library. */
export interface LibraryExercise {
  id: string;
  nameEn: string;
  nameZh: string;
  emoji: string;
  /** Used by filter tabs: 手臂 / 腳 / 核心 */
  filterGroup: Exclude<MuscleFilter, "all">;
  muscleTag: string;
  difficulty: Difficulty;
  /** Exactly three Cantonese form cues. */
  formTips: [string, string, string];
}

export const MUSCLE_FILTERS: { id: MuscleFilter; label: string }[] = [
  { id: "all", label: "全部" },
  { id: "arms", label: "手臂" },
  { id: "legs", label: "腳" },
  { id: "core", label: "核心" },
];

export const DIFFICULTY_LABELS: Record<
  Difficulty,
  { label: string; tone: "green" | "yellow" | "red" }
> = {
  beginner: { label: "初級", tone: "green" },
  intermediate: { label: "中級", tone: "yellow" },
  advanced: { label: "進階", tone: "red" },
};

/** Weekly plan exercises — bicep split + leg day staples from Eva chat. */
export const WEEKLY_PLAN_EXERCISES: LibraryExercise[] = [
  {
    id: "bicep-curl",
    nameEn: "Bicep Curl",
    nameZh: "啞鈴彎舉",
    emoji: "💪",
    filterGroup: "arms",
    muscleTag: "二頭肌",
    difficulty: "beginner",
    formTips: [
      "手肘鎖死喺身側，淨係前臂郁——唔好借膊頭力。",
      "上舉 2 秒、下降 3 秒，離心收縮先會 sharp 啲。",
      "舉到頂峰 pause 半秒，似舞台「比心」定點咁穩。",
    ],
  },
  {
    id: "hammer-curl",
    nameEn: "Hammer Curl",
    nameZh: "錘式彎舉",
    emoji: "🔨",
    filterGroup: "arms",
    muscleTag: "二頭肌 · 肱肌",
    difficulty: "beginner",
    formTips: [
      "手掌相對，好似握 penlight 應援棒咁穩定。",
      "手肘唔好向前伸，全程貼住身體兩側。",
      "左右交替或者同時做都得，保持節奏一致。",
    ],
  },
  {
    id: "concentration-curl",
    nameEn: "Concentration Curl",
    nameZh: "集中彎舉",
    emoji: "🎯",
    filterGroup: "arms",
    muscleTag: "二頭肌 peak",
    difficulty: "beginner",
    formTips: [
      "坐低，手肘抵住大腿內側，專心感受收縮。",
      "舉到最高位 squeeze 1 秒——似影相定點表情。",
      "慢慢放落，唔好甩上甩落借 momentum。",
    ],
  },
  {
    id: "squat",
    nameEn: "Squat",
    nameZh: "深蹲",
    emoji: "🏋️",
    filterGroup: "legs",
    muscleTag: "四頭肌 · 臀",
    difficulty: "beginner",
    formTips: [
      "腳掌穩定貼地，膝頭跟腳尖同一方向。",
      "蹲低時臀部向後坐，胸口保持抬起。",
      "起身用腳跟推地，唔好內扣膝頭。",
    ],
  },
  {
    id: "leg-press",
    nameEn: "Leg Press",
    nameZh: "腿推",
    emoji: "🛞",
    filterGroup: "legs",
    muscleTag: "四頭肌",
    difficulty: "intermediate",
    formTips: [
      "腳板放中間位置，膝頭唔好內扣或者外八。",
      "推到頂唔好鎖死膝頭，保持肌肉 tension。",
      "下放時控制 2–3 秒，唔好讓重量「砸」落去。",
    ],
  },
  {
    id: "lunge",
    nameEn: "Lunge",
    nameZh: "弓箭步",
    emoji: "🚶",
    filterGroup: "legs",
    muscleTag: "四頭肌 · 臀",
    difficulty: "beginner",
    formTips: [
      "前膝唔好超過腳尖太多，後膝 nearly 掂地。",
      "軀幹保持直立，唔好向前傾住落。",
      "推起時用前腳全腳掌发力，穩住核心。",
    ],
  },
  {
    id: "deadlift",
    nameEn: "Deadlift",
    nameZh: "硬拉",
    emoji: "⚡",
    filterGroup: "legs",
    muscleTag: "後鏈 · 臀",
    difficulty: "advanced",
    formTips: [
      "背脊打直，由髖關節 hinge 落去，唔好圓背。",
      "啟動時腳跟貼地，用臀同大腿後側拉起。",
      "槓/啞鈴貼近身體，全程核心收緊保護腰。",
    ],
  },
];

export function filterExercises(filter: MuscleFilter): LibraryExercise[] {
  if (filter === "all") return WEEKLY_PLAN_EXERCISES;
  return WEEKLY_PLAN_EXERCISES.filter((ex) => ex.filterGroup === filter);
}
