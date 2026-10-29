/** One exercise row in a daily routine. */
export interface RoutineExercise {
  name: string;
  sets: number;
  reps: string;
  rest: string;
  tip?: string;
}

export type RoutineDayType =
  | "workout"
  | "recovery"
  | "technique"
  | "cardio"
  | "free"
  | "rest";

export type RoutineStepPhase = "warm-up" | "main" | "cool-down";

/** One ordered step when flattening a day (warm-up → main → cool-down). */
export interface RoutineDayStep {
  phase: RoutineStepPhase;
  order: number;
  exercise: RoutineExercise;
}

/** A single day inside the bicep weekly plan. */
export interface RoutineDay {
  id: string;
  dayIndex: number;
  weekday: string;
  emoji: string;
  title: string;
  duration: string;
  type: RoutineDayType;
  /** Optional short warm-up block before main work. */
  warmUp?: RoutineExercise[];
  exercises: RoutineExercise[];
  /** Optional cool-down / stretch block after main work. */
  coolDown?: RoutineExercise[];
  note?: string;
}

/** Structured bicep weekly plan — source of truth for HTML/card rendering. */
export interface BicepWeeklyPlanData {
  id: "bicep-weekly";
  title: string;
  subtitle: string;
  motto: string;
  days: RoutineDay[];
  reminders: string[];
  /** Target main sessions per week (Mon / Wed / Fri). */
  weeklyTarget: number;
}

export const BICEP_WEEKLY_PLAN: BicepWeeklyPlanData = {
  id: "bicep-weekly",
  title: "二頭肌線條每週訓練表",
  subtitle: "偶像級 7 日 schedule（Mon · Wed · Fri 主訓練）",
  motto: "楽しむことが一番",
  weeklyTarget: 3,
  days: [
    {
      id: "day-mon",
      dayIndex: 0,
      weekday: "一",
      emoji: "🌕",
      title: "二頭肌主訓練（Curl + Hammer + Push-up）",
      duration: "~20min",
      type: "workout",
      warmUp: [
        {
          name: "Arm Circles（手臂繞圈）",
          sets: 2,
          reps: "10 each way",
          rest: "15s",
          tip: "由細圈到大圈，膊頭放鬆。",
        },
        {
          name: "Light Band Curl（輕彈力帶彎舉）",
          sets: 2,
          reps: "12",
          rest: "20s",
          tip: "唔追重量，只係喚醒二頭同手肘關節。",
        },
      ],
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
      coolDown: [
        {
          name: "Bicep Wall Stretch（二頭牆壁拉伸）",
          sets: 2,
          reps: "25s each",
          rest: "10s",
          tip: "手掌貼牆，慢慢轉身感受拉伸，唔彈。",
        },
      ],
    },
    {
      id: "day-tue",
      dayIndex: 1,
      weekday: "二",
      emoji: "🌑",
      title: "Active Recovery（拉伸放鬆）",
      duration: "15min",
      type: "recovery",
      warmUp: [
        {
          name: "Shoulder Rolls（聳肩繞圈）",
          sets: 2,
          reps: "8 each way",
          rest: "10s",
          tip: "輕鬆帶動上背，唔使用力。",
        },
      ],
      exercises: [
        {
          name: "Arm Stretch Hold（手臂拉伸）",
          sets: 2,
          reps: "30s each",
          rest: "15s",
          tip: "輕鬆拉伸就得，唔使 push 到力竭。",
        },
      ],
      note: "輕鬆拉伸就得，唔使 push 到力竭。",
    },
    {
      id: "day-wed",
      dayIndex: 2,
      weekday: "三",
      emoji: "🔥",
      title: "全身燃脂＋Concentration Curl",
      duration: "~20min",
      type: "cardio",
      warmUp: [
        {
          name: "March in Place（原地踏步）",
          sets: 2,
          reps: "30s",
          rest: "15s",
          tip: "輕鬆帶心率，排舞前都適用。",
        },
      ],
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
      coolDown: [
        {
          name: "Deep Breathing + Arm Shake（深呼吸放鬆）",
          sets: 2,
          reps: "30s",
          rest: "10s",
          tip: "甩甩手臂，慢慢呼吸，心率落返嚟。",
        },
      ],
    },
    {
      id: "day-thu",
      dayIndex: 3,
      weekday: "四",
      emoji: "🌊",
      title: "輕量技術日（意念控制肌肉收縮）",
      duration: "~15min",
      type: "technique",
      warmUp: [
        {
          name: "Wrist Circles（手腕繞圈）",
          sets: 2,
          reps: "10 each way",
          rest: "10s",
          tip: "慢速控制日更要暖關節。",
        },
      ],
      exercises: [
        {
          name: "Slow Tempo Curl（慢速彎舉）",
          sets: 3,
          reps: "10–12",
          rest: "45–60s",
          tip: "上舉 2 秒 → 下降 3–4 秒，控制比力度更重要。",
        },
        {
          name: "Hammer Curl（錘式彎舉）",
          sets: 2,
          reps: "12",
          rest: "45s",
          tip: "輕重量專注 form，唔追重量。",
        },
      ],
      note: "控制比力度更重要——上舉 2 秒 → 下降 3–4 秒。",
    },
    {
      id: "day-fri",
      dayIndex: 4,
      weekday: "五",
      emoji: "💪",
      title: "二頭肌主訓練（Incline + Reverse Curl）",
      duration: "~20min",
      type: "workout",
      warmUp: [
        {
          name: "Arm Circles（手臂繞圈）",
          sets: 2,
          reps: "10 each way",
          rest: "15s",
        },
        {
          name: "Light Hammer Curl（輕錘式彎舉）",
          sets: 2,
          reps: "12",
          rest: "20s",
          tip: "用輕重量喚醒前臂同二頭。",
        },
      ],
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
      coolDown: [
        {
          name: "Forearm Stretch（前臂拉伸）",
          sets: 2,
          reps: "25s each",
          rest: "10s",
          tip: "反握拉伸前臂，配合深呼吸。",
        },
      ],
    },
    {
      id: "day-sat",
      dayIndex: 5,
      weekday: "六",
      emoji: "🎵",
      title: "自由活動 — 跳舞／行山／游水都得！",
      duration: "隨心",
      type: "free",
      exercises: [],
      note: "LUMINA 休息日都可以輕鬆排舞或 cardio——開心就得 ✨",
    },
    {
      id: "day-sun",
      dayIndex: 6,
      weekday: "日",
      emoji: "😴",
      title: "完全休息 — 肌肉修復先係關鍵",
      duration: "—",
      type: "rest",
      exercises: [],
      note: "肌肉喺休息時先會生長——今日好好瞓 💤",
    },
  ],
  reminders: [
    "用中輕重量（12–15 下做到力竭就夠）",
    "控制節奏：上舉 2 秒 → 下降 3 秒（離心收縮先係線條秘密）",
    "體脂配合先睇到線條，記得飲食都要留意下～",
    "每星期 2–3 次主訓練就夠，休息 45–60 秒 keep 住 pump",
  ],
};

/** Flatten warm-up → main → cool-down into one ordered step list. */
export function flattenRoutineDaySteps(day: RoutineDay): RoutineDayStep[] {
  const steps: RoutineDayStep[] = [];
  let order = 0;

  for (const exercise of day.warmUp ?? []) {
    steps.push({ phase: "warm-up", order: order++, exercise });
  }
  for (const exercise of day.exercises) {
    steps.push({ phase: "main", order: order++, exercise });
  }
  for (const exercise of day.coolDown ?? []) {
    steps.push({ phase: "cool-down", order: order++, exercise });
  }

  return steps;
}

/** Resolve the plan day for a calendar date (Mon=0 … Sun=6). */
export function getRoutineDayForDate(
  date: Date = new Date(),
  plan: BicepWeeklyPlanData = BICEP_WEEKLY_PLAN,
): RoutineDay {
  const jsDay = date.getDay();
  const dayIndex = jsDay === 0 ? 6 : jsDay - 1;
  return plan.days.find((d) => d.dayIndex === dayIndex) ?? plan.days[0];
}

/** Main lifting days used for weekly consistency targets. */
export function getMainWorkoutDays(
  plan: BicepWeeklyPlanData = BICEP_WEEKLY_PLAN,
): RoutineDay[] {
  return plan.days.filter((d) => d.type === "workout" || d.type === "cardio");
}
