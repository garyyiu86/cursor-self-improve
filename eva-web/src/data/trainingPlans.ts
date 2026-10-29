/** One exercise row in a workout day. */
export interface TrainingExercise {
  name: string;
  sets: number;
  reps: string;
  rest: string;
  tip: string;
}

/** A main lifting day in the 3-day split (Mon / Wed / Fri). */
export interface TrainingWorkoutDay {
  id: "day1" | "day2" | "day3";
  weekday: string;
  emoji: string;
  title: string;
  duration: string;
  exercises: TrainingExercise[];
}

/** Full-week schedule row (matches chat recap table). */
export interface TrainingScheduleDay {
  weekday: string;
  emoji: string;
  label: string;
  duration: string;
}

/** Structured bicep weekly plan — inline alternative to bicep-weekly-plan.html. */
export interface BicepWeeklyPlan {
  id: "bicep-weekly";
  title: string;
  subtitle: string;
  motto: string;
  /** 3-day split: Mon / Wed / Fri main sessions */
  workoutDays: TrainingWorkoutDay[];
  /** 7-day overview from chat */
  schedule: TrainingScheduleDay[];
  reminders: string[];
}

export const BICEP_WEEKLY_PLAN: BicepWeeklyPlan = {
  id: "bicep-weekly",
  title: "二頭肌線條每週訓練表",
  subtitle: "偶像級 3 天主訓練（Mon · Wed · Fri）",
  motto: "楽しむことが一番",
  workoutDays: [
    {
      id: "day1",
      weekday: "一",
      emoji: "🌕",
      title: "二頭肌主訓練（Curl + Hammer + Push-up）",
      duration: "~20min",
      exercises: [
        {
          name: "Dumbbell Bicep Curl（啞鈴彎舉）",
          sets: 3,
          reps: "12–15",
          rest: "45–60s",
          tip: "鎖緊手肘唔好郁，淨係前臂郁——上舉 2 秒、下降 3 秒。",
        },
        {
          name: "Hammer Curl（錘式彎舉）",
          sets: 3,
          reps: "12–15",
          rest: "45–60s",
          tip: "手掌相對，好似握住 penlight（應援棒）咁穩定。",
        },
        {
          name: "Push-up（掌上壓）",
          sets: 2,
          reps: "12",
          rest: "60s",
          tip: "唔使完美，當 warm-up 同三頭協同，保持核心收緊。",
        },
      ],
    },
    {
      id: "day2",
      weekday: "三",
      emoji: "🔥",
      title: "全身燃脂＋Concentration Curl",
      duration: "~20min",
      exercises: [
        {
          name: "Jumping Jack（開合跳）",
          sets: 3,
          reps: "30s",
          rest: "30s",
          tip: "輕鬆節奏帶心率，排舞前 warm-up 都適用。",
        },
        {
          name: "Bodyweight Squat（徒手深蹲）",
          sets: 3,
          reps: "15",
          rest: "45s",
          tip: "腳掌穩定、膝頭跟腳尖方向，全身協調先有力。",
        },
        {
          name: "Concentration Curl（集中彎舉）",
          sets: 3,
          reps: "12–15",
          rest: "45–60s",
          tip: "坐低做，專注 peak 收縮——似影相定點表情咁。",
        },
      ],
    },
    {
      id: "day3",
      weekday: "五",
      emoji: "💪",
      title: "二頭肌主訓練（Incline + Reverse Curl）",
      duration: "~20min",
      exercises: [
        {
          name: "Incline Dumbbell Curl（上斜彎舉）",
          sets: 3,
          reps: "12–15",
          rest: "45–60s",
          tip: "上斜角度拉長長頭，離心 3 秒放落去先 sharp。",
        },
        {
          name: "Reverse Curl（反握彎舉）",
          sets: 3,
          reps: "12–15",
          rest: "45–60s",
          tip: "前臂同肱肌一齊練，手臂線條會更完整。",
        },
        {
          name: "Band Pull-apart（彈力帶後拉）",
          sets: 2,
          reps: "15",
          rest: "45s",
          tip: "膊頭平衡收尾，舞台 posture 都會穩啲。",
        },
      ],
    },
  ],
  schedule: [
    { weekday: "一", emoji: "🌕", label: "二頭肌主訓練（Curl + Hammer + Push-up）", duration: "~20min" },
    { weekday: "二", emoji: "🌑", label: "Active Recovery（拉伸放鬆）", duration: "15min" },
    { weekday: "三", emoji: "🔥", label: "全身燃脂＋Concentration Curl", duration: "~20min" },
    { weekday: "四", emoji: "🌊", label: "輕量技術日（意念控制肌肉收縮）", duration: "~15min" },
    { weekday: "五", emoji: "💪", label: "二頭肌主訓練（Incline + Reverse Curl）", duration: "~20min" },
    { weekday: "六", emoji: "🎵", label: "自由活動 — 跳舞／行山／游水都得！", duration: "隨心" },
    { weekday: "日", emoji: "😴", label: "完全休息 — 肌肉修復先係關鍵", duration: "—" },
  ],
  reminders: [
    "用中輕重量（12–15 下做到力竭就夠）",
    "控制節奏：上舉 2 秒 → 下降 3 秒（離心收縮先係線條秘密）",
    "體脂配合先睇到線條，記得飲食都要留意下～",
  ],
};

const PLANS: Record<string, BicepWeeklyPlan> = {
  "bicep-weekly": BICEP_WEEKLY_PLAN,
};

/** Resolve a plan id from chat markers (fence block or legacy HTML link). */
export function getPlanById(id: string): BicepWeeklyPlan | null {
  return PLANS[String(id || "").trim()] ?? null;
}

const BICEP_PLAN_MARKERS = ["bicep-weekly-plan", "bicep-weekly", "二頭肌線條每週訓練表"];

/** Detect chat links / alt text that should render the inline plan card. */
export function isBicepWeeklyPlanReference(href: string, alt = ""): boolean {
  const hay = `${href} ${alt}`.toLowerCase();
  return BICEP_PLAN_MARKERS.some((m) => hay.includes(m.toLowerCase()));
}
