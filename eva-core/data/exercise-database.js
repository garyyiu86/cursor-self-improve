/** @typedef {'biceps'|'triceps'|'quads'|'core'|'full-body'} TargetMuscle */

/**
 * @typedef {Object} ExerciseEntry
 * @property {string} id
 * @property {string} name
 * @property {TargetMuscle} targetMuscle
 * @property {string} muscleLabel
 * @property {number} difficulty 1–5
 * @property {number} sets
 * @property {string} reps
 * @property {string} idolDescription LUMINA 偶像舞台／排練情境
 * @property {string} icon Emoji icon
 * @property {string} [tip] Form cue in Cantonese
 */

/** @type {Record<TargetMuscle, { label: string; emoji: string }>} */
export const MUSCLE_META = {
  biceps: { label: "二頭肌", emoji: "💪" },
  triceps: { label: "三頭肌", emoji: "🔱" },
  quads: { label: "四頭肌", emoji: "🦵" },
  core: { label: "核心", emoji: "⚡" },
  "full-body": { label: "全身", emoji: "✨" },
};

/** @type {ExerciseEntry[]} */
export const EXERCISE_DATABASE = [
  // —— biceps ——
  {
    id: "dumbbell-curl",
    name: "Dumbbell Bicep Curl（啞鈴彎舉）",
    targetMuscle: "biceps",
    muscleLabel: "二頭肌",
    difficulty: 2,
    sets: 3,
    reps: "12–15",
    icon: "💪",
    tip: "手肘鎖死，淨係前臂郁——上 2 秒、落 3 秒。",
    idolDescription:
      "似舞台上做「比心」定點咁穩；LUMINA 排舞老師話控制比力度更重要。",
  },
  {
    id: "hammer-curl",
    name: "Hammer Curl（錘式彎舉）",
    targetMuscle: "biceps",
    muscleLabel: "二頭肌",
    difficulty: 2,
    sets: 3,
    reps: "12–15",
    icon: "🔨",
    tip: "手掌相對，好似握 penlight 應援棒咁穩。",
    idolDescription: "巡演 hotel room 拎水樽都得——手臂線條 backstage 都 keep 住。",
  },
  {
    id: "concentration-curl",
    name: "Concentration Curl（集中彎舉）",
    targetMuscle: "biceps",
    muscleLabel: "二頭肌",
    difficulty: 2,
    sets: 3,
    reps: "12–15",
    icon: "🎯",
    tip: "坐低專注 peak 收縮，似影相定點表情。",
    idolDescription: "二頭 peak 最 sharp，舞台 close-up 手臂靠呢招。",
  },
  {
    id: "incline-curl",
    name: "Incline Dumbbell Curl（上斜彎舉）",
    targetMuscle: "biceps",
    muscleLabel: "二頭肌",
    difficulty: 3,
    sets: 3,
    reps: "10–12",
    icon: "📐",
    tip: "上斜拉長長頭，離心 3 秒放落。",
    idolDescription: "慢動作定點同離心收縮一樣——愈 control 線條愈靚。",
  },
  {
    id: "band-curl",
    name: "Band Bicep Curl（彈力帶彎舉）",
    targetMuscle: "biceps",
    muscleLabel: "二頭肌",
    difficulty: 1,
    sets: 3,
    reps: "15–20",
    icon: "🎀",
    tip: "帶愈拉長阻力愈大，頂峰 pause 1 秒。",
    idolDescription: "排練間隙 5 分鐘 pump——巡演秘密武器。",
  },
  // —— triceps ——
  {
    id: "tricep-pushdown",
    name: "Tricep Pushdown（三頭下壓）",
    targetMuscle: "triceps",
    muscleLabel: "三頭肌",
    difficulty: 2,
    sets: 3,
    reps: "12–15",
    icon: "⬇️",
    tip: "手肘貼身，淨係前臂郁；頂點 squeeze 1 秒。",
    idolDescription: "推 mic stand、比愛心後收——手臂後側線條靠呢招。",
  },
  {
    id: "overhead-extension",
    name: "Overhead Tricep Extension（過頂伸展）",
    targetMuscle: "triceps",
    muscleLabel: "三頭肌",
    difficulty: 3,
    sets: 3,
    reps: "10–12",
    icon: "🙆",
    tip: "手肘指天，核心收緊唔好拱背。",
    idolDescription: "舉手應援動作要穩——長頭練完手臂後側更立體。",
  },
  {
    id: "diamond-pushup",
    name: "Diamond Push-up（鑽石掌上壓）",
    targetMuscle: "triceps",
    muscleLabel: "三頭肌",
    difficulty: 3,
    sets: 3,
    reps: "8–12",
    icon: "💎",
    tip: "拇指食指砌菱形，身體成一直線。",
    idolDescription: "舞台 floor dance 要撐地——三頭同核心一齊醒。",
  },
  {
    id: "kickback",
    name: "Tricep Kickback（三頭後踢）",
    targetMuscle: "triceps",
    muscleLabel: "三頭肌",
    difficulty: 2,
    sets: 3,
    reps: "12–15",
    icon: "🦵",
    tip: "上臂平行地面，只郁前臂。",
    idolDescription: "背對鏡子 check 手臂線條——idol 細節位。",
  },
  {
    id: "close-grip-pushup",
    name: "Close-grip Push-up（窄距掌上壓）",
    targetMuscle: "triceps",
    muscleLabel: "三頭肌",
    difficulty: 2,
    sets: 3,
    reps: "10–15",
    icon: "🤏",
    tip: "手距窄過肩，手肘貼身落下。",
    idolDescription: "零器材都做到——hotel workout 必備。",
  },
  // —— quads / legs ——
  {
    id: "bodyweight-squat",
    name: "Bodyweight Squat（自重深蹲）",
    targetMuscle: "quads",
    muscleLabel: "四頭肌",
    difficulty: 2,
    sets: 3,
    reps: "15–20",
    icon: "🏋️",
    tip: "膝頭同腳尖方向一致，蹲到大腿平行。",
    idolDescription: "舞台 jump 落地要穩——四頭係彈跳力之本。",
  },
  {
    id: "goblet-squat",
    name: "Goblet Squat（高腳杯深蹲）",
    targetMuscle: "quads",
    muscleLabel: "四頭肌",
    difficulty: 2,
    sets: 3,
    reps: "12–15",
    icon: "🏆",
    tip: "啞鈴貼胸，背打直，蹲低啲。",
    idolDescription: "拎水瓶當 dumbbell 都得——排舞後補 leg day。",
  },
  {
    id: "walking-lunge",
    name: "Walking Lunge（行箭步）",
    targetMuscle: "quads",
    muscleLabel: "四頭肌",
    difficulty: 3,
    sets: 3,
    reps: "10/腿",
    icon: "🚶",
    tip: "後膝 nearly 掂地，前膝唔過腳尖。",
    idolDescription: "T 台 walk 要穩——單腿平衡同四頭一齊練。",
  },
  {
    id: "leg-press",
    name: "Leg Press（腿推）",
    targetMuscle: "quads",
    muscleLabel: "四頭肌",
    difficulty: 3,
    sets: 4,
    reps: "10–12",
    icon: "🛞",
    tip: "腳板中位，唔好鎖死膝頭頂。",
    idolDescription: "gym day 主力動作——jump 編舞前後都要 leg strength。",
  },
  {
    id: "step-up",
    name: "Step-up（踏台）",
    targetMuscle: "quads",
    muscleLabel: "四頭肌",
    difficulty: 2,
    sets: 3,
    reps: "12/腿",
    icon: "🪜",
    tip: "全腳掌踏穩，用 front leg 推起。",
    idolDescription: "舞台升降台 step 要輕——日常練就唔會喘。",
  },
  // —— core ——
  {
    id: "plank",
    name: "Plank（平板支撐）",
    targetMuscle: "core",
    muscleLabel: "核心",
    difficulty: 2,
    sets: 3,
    reps: "30–45s",
    icon: "🧱",
    tip: "臀唔好翹、腰唔好沉，呼吸順。",
    idolDescription: "長時間 stand mic 都要 core——唔好喺舞台度晃。",
  },
  {
    id: "dead-bug",
    name: "Dead Bug（死蟲）",
    targetMuscle: "core",
    muscleLabel: "核心",
    difficulty: 2,
    sets: 3,
    reps: "10/邊",
    icon: "🐛",
    tip: "腰貼地，對角手腳慢慢伸。",
    idolDescription: "floor dance 轉身靠 core 穩——似慢動作編舞控制。",
  },
  {
    id: "bicycle-crunch",
    name: "Bicycle Crunch（單車捲腹）",
    targetMuscle: "core",
    muscleLabel: "核心",
    difficulty: 2,
    sets: 3,
    reps: "20/邊",
    icon: "🚴",
    tip: "肘碰對側膝，另一隻腳伸直。",
    idolDescription: "crop top 舞台裝——腹斜線條靠 rotation。",
  },
  {
    id: "hollow-hold",
    name: "Hollow Hold（空心支撐）",
    targetMuscle: "core",
    muscleLabel: "核心",
    difficulty: 4,
    sets: 3,
    reps: "20–30s",
    icon: "🌙",
    tip: "腰貼地，手腳離地形成 banana 形。",
    idolDescription: "高難度 floor pose 要 core lock——進階 idol 必練。",
  },
  {
    id: "russian-twist",
    name: "Russian Twist（俄羅斯轉體）",
    targetMuscle: "core",
    muscleLabel: "核心",
    difficulty: 3,
    sets: 3,
    reps: "16–20",
    icon: "🌀",
    tip: "腳離地，轉動來自胸椎。",
    idolDescription: "twist 編舞動作——腰要穩先轉得靚。",
  },
  // —— full body ——
  {
    id: "burpee",
    name: "Burpee（波比跳）",
    targetMuscle: "full-body",
    muscleLabel: "全身",
    difficulty: 4,
    sets: 3,
    reps: "8–10",
    icon: "🔥",
    tip: "胸掂地、跳起 clap——一個動作唔停。",
    idolDescription: "encore 前最後一首要爆 energy——全身 cardio 王。",
  },
  {
    id: "mountain-climber",
    name: "Mountain Climber（登山者）",
    targetMuscle: "full-body",
    muscleLabel: "全身",
    difficulty: 3,
    sets: 3,
    reps: "30s",
    icon: "⛰️",
    tip: "plank 姿勢，膝快交替拉向胸。",
    idolDescription: "快歌編舞 warmup——心率上得嚟又唔洗器材。",
  },
  {
    id: "jumping-jack",
    name: "Jumping Jack（開合跳）",
    targetMuscle: "full-body",
    muscleLabel: "全身",
    difficulty: 1,
    sets: 3,
    reps: "30–45s",
    icon: "⭐",
    tip: "落地輕，膝微曲吸收衝力。",
    idolDescription: "排練前 30 秒開場——全場氣氛即刻熱。",
  },
  {
    id: "thruster",
    name: "Dumbbell Thruster（火箭推）",
    targetMuscle: "full-body",
    muscleLabel: "全身",
    difficulty: 4,
    sets: 3,
    reps: "10–12",
    icon: "🚀",
    tip: "深蹲接 overhead press 一氣呵成。",
    idolDescription: "squat jump + 舉手——似 finale pose 爆發力。",
  },
  {
    id: "bear-crawl",
    name: "Bear Crawl（熊爬）",
    targetMuscle: "full-body",
    muscleLabel: "全身",
    difficulty: 3,
    sets: 3,
    reps: "20m",
    icon: "🐻",
    tip: "膝離地 5cm，對角手腳同步。",
    idolDescription: "floor dance 入場 crawl——肩、core、腿一齊 burn。",
  },
];

/** @param {string} id */
export function getExerciseById(id) {
  return EXERCISE_DATABASE.find((ex) => ex.id === id) ?? null;
}

/** @param {TargetMuscle} muscle */
export function getExercisesByMuscle(muscle) {
  return EXERCISE_DATABASE.filter((ex) => ex.targetMuscle === muscle);
}

/** @param {number} maxDifficulty 1–5 */
export function getExercisesByMaxDifficulty(maxDifficulty) {
  return EXERCISE_DATABASE.filter((ex) => ex.difficulty <= maxDifficulty);
}
