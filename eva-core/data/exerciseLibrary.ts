/** Muscle groups used in Eva workout plans and library filters. */
export type MuscleGroup =
  | "biceps"
  | "triceps"
  | "chest"
  | "back"
  | "shoulders"
  | "legs"
  | "core";

export type Difficulty = "beginner" | "intermediate" | "advanced";

/** CSS-only pose key rendered in the library grid and detail modal. */
export type FormIllustration =
  | "curl"
  | "hammer-curl"
  | "push-up"
  | "dip"
  | "overhead-ext"
  | "kickback"
  | "bench-press"
  | "fly"
  | "row"
  | "pull-apart"
  | "superman"
  | "lat-pulldown"
  | "lateral-raise"
  | "shoulder-press"
  | "squat"
  | "lunge"
  | "bridge"
  | "calf-raise"
  | "wall-sit"
  | "jumping-jack"
  | "plank"
  | "crunch"
  | "stretch"
  | "generic";

export interface LibraryExercise {
  id: string;
  name: string;
  muscleGroup: MuscleGroup;
  difficulty: Difficulty;
  equipment: string;
  sets: number;
  reps: string;
  rest: string;
  formTips: string[];
  commonMistakes: string[];
  /** Eva 偶像小貼士 — LUMINA stage / rehearsal context */
  idolTip: string;
  illustration: FormIllustration;
}

export interface PlanDayRef {
  dayId: string;
  weekday: string;
  emoji: string;
  title: string;
}

export interface WeeklyPlanLike {
  days: Array<{
    id: string;
    weekday: string;
    emoji: string;
    title: string;
    exercises: Array<{ id: string }>;
  }>;
}

export const MUSCLE_GROUPS: readonly MuscleGroup[] = [
  "biceps",
  "triceps",
  "chest",
  "back",
  "shoulders",
  "legs",
  "core",
] as const;

export const MUSCLE_GROUP_META: Record<
  MuscleGroup,
  { id: MuscleGroup; label: string; emoji: string }
> = {
  biceps: { id: "biceps", label: "二頭肌", emoji: "💪" },
  triceps: { id: "triceps", label: "三頭肌", emoji: "🔱" },
  chest: { id: "chest", label: "胸肌", emoji: "🫁" },
  back: { id: "back", label: "背肌", emoji: "🦋" },
  shoulders: { id: "shoulders", label: "肩膀", emoji: "🎯" },
  legs: { id: "legs", label: "腿部", emoji: "🦵" },
  core: { id: "core", label: "核心", emoji: "⚡" },
};

export const DIFFICULTY_LABELS: Record<
  Difficulty,
  { label: string; tone: "green" | "yellow" | "red" }
> = {
  beginner: { label: "初級", tone: "green" },
  intermediate: { label: "中級", tone: "yellow" },
  advanced: { label: "進階", tone: "red" },
};

/** Exercises referenced by workout plans — enriched with form guides. */
export const EXERCISE_LIBRARY: LibraryExercise[] = [
  {
    id: "dumbbell-bicep-curl",
    name: "Dumbbell Bicep Curl（啞鈴彎舉）",
    muscleGroup: "biceps",
    difficulty: "beginner",
    equipment: "啞鈴",
    sets: 3,
    reps: "12–15",
    rest: "45–60s",
    formTips: [
      "手肘鎖緊喺身側，淨係前臂郁——上舉 2 秒、下降 3 秒。",
      "舉到頂峰 pause 半秒，感受二頭 peak 收縮。",
      "全程核心收緊，唔好向後仰借腰力。",
    ],
    commonMistakes: [
      "手肘向前飛出去，變成借膊頭力。",
      "用 momentum 甩上甩落，離心 phase 完全冇控制。",
      "重量太重導致身體搖晃。",
    ],
    idolTip:
      "似舞台上你做「比心」動作咁定點；LUMINA 排舞老師話控制比力度更重要。",
    illustration: "curl",
  },
  {
    id: "hammer-curl",
    name: "Hammer Curl（錘式彎舉）",
    muscleGroup: "biceps",
    difficulty: "beginner",
    equipment: "啞鈴",
    sets: 3,
    reps: "12–15",
    rest: "45–60s",
    formTips: [
      "手掌相對，好似握住 penlight（應援棒）咁穩定。",
      "手肘貼住身體兩側，全程唔好向前伸。",
      "左右交替或同步都得，保持節奏一致。",
    ],
    commonMistakes: [
      "手腕彎曲變成抓握錯誤角度。",
      "聳肩借力，膊頭向上提。",
      "只做上半幅幅度，底部冇完全伸展。",
    ],
    idolTip: "排舞休息期間隨手拎水樽都得——肱肌同前臂一齊練，手臂睇落更厚。",
    illustration: "hammer-curl",
  },
  {
    id: "concentration-curl",
    name: "Concentration Curl（集中彎舉）",
    muscleGroup: "biceps",
    difficulty: "beginner",
    equipment: "啞鈴",
    sets: 3,
    reps: "12–15",
    rest: "45–60s",
    formTips: [
      "坐低，手肘抵住大腿內側，專心 peak 收縮。",
      "舉到最高位 squeeze 1 秒——似影相定點表情。",
      "慢慢放落，唔好借 momentum 甩上。",
    ],
    commonMistakes: [
      "手肘離開大腿，穩定度下降。",
      "身體向一邊扭轉借力。",
      "下降太快，離心收縮冇feel到。",
    ],
    idolTip: "二頭肌 peak 位最 sharp，舞台 close-up 手臂線條靠呢招。",
    illustration: "curl",
  },
  {
    id: "incline-dumbbell-curl",
    name: "Incline Dumbbell Curl（上斜彎舉）",
    muscleGroup: "biceps",
    difficulty: "beginner",
    equipment: "啞鈴 + 上斜凳",
    sets: 3,
    reps: "12–15",
    rest: "45–60s",
    formTips: [
      "上斜角度拉長長頭，離心 3 秒放落去。",
      "手肘向後固定，唔好向前滑。",
      "全程肩胛貼實凳背，唔好聳肩。",
    ],
    commonMistakes: [
      "凳角度太陡變成肩前束主導。",
      "手肘向前移，減少二頭刺激。",
      "離心 phase 直接「跌」落去。",
    ],
    idolTip: "離心收縮同舞台上「慢動作定點」一樣——愈控制得好，線條愈靚。",
    illustration: "curl",
  },
  {
    id: "reverse-curl",
    name: "Reverse Curl（反握彎舉）",
    muscleGroup: "biceps",
    difficulty: "beginner",
    equipment: "啞鈴 / 槓铃",
    sets: 3,
    reps: "12–15",
    rest: "45–60s",
    formTips: [
      "反握（掌心向下），前臂同肱肌一齊練。",
      "手肘貼身，幅度由完全伸展到 peak 收縮。",
      "手腕保持中立，唔好過度後仰。",
    ],
    commonMistakes: [
      "手腕過度伸展導致不適。",
      "用太大重量變成甩動。",
      "只做半程，底部冇伸展前臂。",
    ],
    idolTip: "推應援棒、mic stand 都要前臂穩定——偶像手臂唔係淨係二頭。",
    illustration: "hammer-curl",
  },
  {
    id: "band-curl",
    name: "Band Bicep Curl（彈力帶彎舉）",
    muscleGroup: "biceps",
    difficulty: "beginner",
    equipment: "彈力帶",
    sets: 3,
    reps: "15–20",
    rest: "40s",
    formTips: [
      "帶愈拉長阻力愈大，頂峰 pause 1 秒。",
      "腳踩穩帶子，核心收緊唔好搖。",
      "控制回程，唔好被帶子彈返。",
    ],
    commonMistakes: [
      "帶子太鬆，全程冇張力。",
      "身體前後擺動借力。",
      "手肘向前飛。",
    ],
    idolTip: "酒店 room tour 都做得——巡演時保持 pump 嘅秘密武器。",
    illustration: "curl",
  },
  {
    id: "preacher-curl",
    name: "Preacher Curl（牧師椅彎舉）",
    muscleGroup: "biceps",
    difficulty: "intermediate",
    equipment: "牧師椅 + 啞鈴",
    sets: 3,
    reps: "10–12",
    rest: "60s",
    formTips: [
      "上臂貼實 pad，唔好借 momentum 甩上。",
      "底部完全伸展但唔鎖死肘關節。",
      "頂峰 squeeze 1 秒再慢慢下降。",
    ],
    commonMistakes: [
      "臀部離開凳面，穩定度下降。",
      "底部反彈借力。",
      "重量過大變成半幅動作。",
    ],
    idolTip: "隔離動作，似 solo 舞台位——唔靠隊形，靠自己 control。",
    illustration: "curl",
  },
  {
    id: "slow-tempo-curl",
    name: "Slow Tempo Curl（慢节奏弯举）",
    muscleGroup: "core",
    difficulty: "beginner",
    equipment: "啞鈴 / 轻重量",
    sets: 2,
    reps: "10",
    rest: "60s",
    formTips: [
      "上 3 秒、下 4 秒——意念控制肌肉收縮。",
      "唔追重量，feel 到二頭/fire 就得。",
      "呼吸配合：用力呼、放鬆吸。",
    ],
    commonMistakes: [
      "節奏唔穩，中間加速。",
      "重量仍然太重。",
      "忽略核心穩定，身體擺動。",
    ],
    idolTip: "周四轻量技术日：排舞老师话「feel the muscle, not the weight」。",
    illustration: "curl",
  },
  {
    id: "push-up",
    name: "Push-up（掌上壓）",
    muscleGroup: "triceps",
    difficulty: "beginner",
    equipment: "自重",
    sets: 2,
    reps: "12",
    rest: "60s",
    formTips: [
      "身體成一直線，核心收緊唔好塌腰。",
      "手肘約 45° 向後，胸口接近地面。",
      "當 warm-up 用都得，唔使 push 到力竭。",
    ],
    commonMistakes: [
      "臀部太高或太低，唔成一直線。",
      "手肘完全向外開，肩膊壓力大。",
      "只做上半幅，底部冇到位。",
    ],
    idolTip: "朝早化妝前 2 組就夠——LUMINA 日常排練 combo 第一式。",
    illustration: "push-up",
  },
  {
    id: "tricep-dip-chair",
    name: "Chair Tricep Dip（椅背撐體）",
    muscleGroup: "triceps",
    difficulty: "beginner",
    equipment: "椅子",
    sets: 3,
    reps: "10–12",
    rest: "45s",
    formTips: [
      "手肘向後，身體貼近椅邊下降。",
      "膊頭向下沉，唔好聳肩。",
      "推起時三頭发力，頂端唔鎖死肘。",
    ],
    commonMistakes: [
      "手肘向外開，肩前束代償。",
      "下降太深導致肩不适。",
      "用腳蹬地過多借力。",
    ],
    idolTip: "backstage 等出場前偷偷做兩組，push 手勢會更有力。",
    illustration: "dip",
  },
  {
    id: "overhead-tricep-extension",
    name: "Overhead Tricep Extension（過頂臂屈伸）",
    muscleGroup: "triceps",
    difficulty: "beginner",
    equipment: "啞鈴",
    sets: 3,
    reps: "12–15",
    rest: "45–60s",
    formTips: [
      "手肘指向天花板，淨係前臂郁。",
      "核心收緊，下背唔好過度反弓。",
      "伸展到底 squeeze 1 秒。",
    ],
    commonMistakes: [
      "手肘向外開，變成肩主導。",
      "上背過度後仰。",
      "幅度不足，底部冇 stretch。",
    ],
    idolTip: "舉 mic 過頭動作嘅力量來源——三頭線條喺 side profile 好搶眼。",
    illustration: "overhead-ext",
  },
  {
    id: "tricep-kickback",
    name: "Tricep Kickback（三頭後踢）",
    muscleGroup: "triceps",
    difficulty: "beginner",
    equipment: "啞鈴",
    sets: 3,
    reps: "12–15",
    rest: "45s",
    formTips: [
      "上臂固定同身平行，全幅伸展時 squeeze 1 秒。",
      "俯身時背打直，唔好圓背。",
      "只做前臂伸展，上臂唔郁。",
    ],
    commonMistakes: [
      "上臂跟住前臂一齊郁。",
      "用太大重量變成划船。",
      "聳肩，斜方肌代償。",
    ],
    idolTip: "排舞「推手」動作嘅延伸——手臂後線要 sharp。",
    illustration: "kickback",
  },
  {
    id: "close-grip-push-up",
    name: "Close-Grip Push-up（窄距掌上壓）",
    muscleGroup: "triceps",
    difficulty: "intermediate",
    equipment: "自重",
    sets: 3,
    reps: "10–12",
    rest: "60s",
    formTips: [
      "手距窄過肩，手肘貼身向後。",
      "胸口下降接近手，三頭主導。",
      "核心收緊，成一直線。",
    ],
    commonMistakes: [
      "手距仍然太闊，變成胸主導。",
      "手肘向外開。",
      "塌腰或撅臀。",
    ],
    idolTip: "比標準 push-up 更考三頭——似 fast choreography 嘅爆發力訓練。",
    illustration: "push-up",
  },
  {
    id: "skull-crusher",
    name: "Skull Crusher（仰卧臂屈伸）",
    muscleGroup: "triceps",
    difficulty: "intermediate",
    equipment: "啞鈴 / 槓铃",
    sets: 3,
    reps: "10–12",
    rest: "60s",
    formTips: [
      "手肘固定方向，槓/啞鈴降落到額頭附近。",
      "上臂垂直地面，唔好向前滑。",
      "推起時三頭发力，唔借胸肌。",
    ],
    commonMistakes: [
      "手肘向外飄。",
      "下降過快撞額頭（名符其實 skull crusher）。",
      "上臂角度改變，變成混合動作。",
    ],
    idolTip: "舞台 lighting 下手臂后侧线条靠三头长头——进阶才加。",
    illustration: "overhead-ext",
  },
  {
    id: "standard-push-up",
    name: "Standard Push-up（標準掌上壓）",
    muscleGroup: "chest",
    difficulty: "beginner",
    equipment: "自重",
    sets: 3,
    reps: "12",
    rest: "60s",
    formTips: [
      "身體成一直線，胸口接近地面。",
      "手肘約 45°，肩胛穩定。",
      "推起時胸肌 squeeze，頂端唔鎖死肘。",
    ],
    commonMistakes: [
      "只做半幅 push-up。",
      "塌腰，下背代償。",
      "頭部先落，唔係胸口 lead。",
    ],
    idolTip: "開場前 warm-up 必備——上半身 push 動作嘅基礎。",
    illustration: "push-up",
  },
  {
    id: "incline-push-up",
    name: "Incline Push-up（上斜掌上壓）",
    muscleGroup: "chest",
    difficulty: "beginner",
    equipment: "自重 + 矮枱",
    sets: 3,
    reps: "12–15",
    rest: "45s",
    formTips: [
      "手放高於腳，角度愈斜愈易。",
      "胸口向枱面下降，核心收緊。",
      "推起時感受上胸发力。",
    ],
    commonMistakes: [
      "枱太高變成几乎垂直推。",
      "臀部太高，角度錯。",
      "手肘完全向外。",
    ],
    idolTip: "新手偶像版——先練上胸線，再挑戰平地。",
    illustration: "push-up",
  },
  {
    id: "dumbbell-floor-press",
    name: "Dumbbell Floor Press（地板卧推）",
    muscleGroup: "chest",
    difficulty: "beginner",
    equipment: "啞鈴",
    sets: 3,
    reps: "10–12",
    rest: "60s",
    formTips: [
      "手肘觸地即推起，唔好彈。",
      "肩胛收紧，全程貼地。",
      "控制離心 2 秒再推起。",
    ],
    commonMistakes: [
      "手肘觸地反彈借力。",
      "手腕不穩，啞鈴晃動。",
      "幅度過大超出肩安全范围。",
    ],
    idolTip: "後台地毡都做到——安全版卧推，巡演必备。",
    illustration: "bench-press",
  },
  {
    id: "chest-fly-band",
    name: "Band Chest Fly（彈力帶夾胸）",
    muscleGroup: "chest",
    difficulty: "beginner",
    equipment: "彈力帶",
    sets: 3,
    reps: "15",
    rest: "45s",
    formTips: [
      "手肘微曲，胸前合拢时 squeeze。",
      "帶子固定喺身后，幅度由開到合。",
      "膊頭向下沉，唔好聳肩。",
    ],
    commonMistakes: [
      "手肘鎖死變成直臂。",
      "用肩前束代償。",
      "帶子鬆弛時冇張力。",
    ],
    idolTip: "似张开双手回应粉丝——胸肌中缝靠呢招。",
    illustration: "fly",
  },
  {
    id: "wide-push-up",
    name: "Wide Push-up（寬距掌上壓）",
    muscleGroup: "chest",
    difficulty: "intermediate",
    equipment: "自重",
    sets: 3,
    reps: "10–12",
    rest: "60s",
    formTips: [
      "手距宽过肩，手肘约 45°。",
      "胸口下降至手肘高度。",
      "核心收緊，成一直線。",
    ],
    commonMistakes: [
      "手距過寬傷肩。",
      "塌腰或撅臀。",
      "只做上半幅。",
    ],
    idolTip: "大动作 choreography 需要胸肌支撑——宽距刺激外胸。",
    illustration: "push-up",
  },
  {
    id: "dumbbell-bench-press",
    name: "Dumbbell Bench Press（啞鈴卧推）",
    muscleGroup: "chest",
    difficulty: "intermediate",
    equipment: "啞鈴 + 凳",
    sets: 3,
    reps: "8–12",
    rest: "90s",
    formTips: [
      "肩胛收紧贴凳，下放控制 2 秒。",
      "啞鈴轨迹略呈弧線向胸口。",
      "推起時胸肌发力，頂端唔碰撞。",
    ],
    commonMistakes: [
      "聳肩離開凳面。",
      "下放過快砸胸。",
      "手肘完全向外 90°。",
    ],
    idolTip: "力量型 stage 动作（lift 队友）嘅底层训练。",
    illustration: "bench-press",
  },
  {
    id: "band-pull-apart",
    name: "Band Pull-apart（彈力帶後拉）",
    muscleGroup: "back",
    difficulty: "beginner",
    equipment: "彈力帶",
    sets: 2,
    reps: "15",
    rest: "45s",
    formTips: [
      "雙手伸直向前，向兩側拉開帶子。",
      "膊頭平衡收尾，肩胛向後夾。",
      "拉到底 pause 1 秒再慢慢回。",
    ],
    commonMistakes: [
      "聳肩，斜方肌代償。",
      "手肘彎曲太多變成划船。",
      "帶子太鬆冇張力。",
    ],
    idolTip: "改善 round shoulder——长时间 mic 手姿势嘅解药。",
    illustration: "pull-apart",
  },
  {
    id: "superman-hold",
    name: "Superman Hold（超人式）",
    muscleGroup: "back",
    difficulty: "beginner",
    equipment: "自重",
    sets: 3,
    reps: "20s hold",
    rest: "30s",
    formTips: [
      "同时举手和腿，下背唔好过度反弓。",
      "用背肌同臀发力，唔好只頂腰。",
      "視線向下，頸保持中立。",
    ],
    commonMistakes: [
      "过度反弓下背。",
      "只舉手唔舉腿。",
      "憋气唔呼吸。",
    ],
    idolTip: "趴地版「起飞」——练竖脊肌，改善 stage 站姿。",
    illustration: "superman",
  },
  {
    id: "inverted-row",
    name: "Inverted Row（反向划船）",
    muscleGroup: "back",
    difficulty: "beginner",
    equipment: "低杠 / 桌底",
    sets: 3,
    reps: "10–12",
    rest: "60s",
    formTips: [
      "身体成一直线，胸口拉向杠。",
      "肩胛先動再拉，唔好只用手臂。",
      "控制下降，唔好直接跌落。",
    ],
    commonMistakes: [
      "臀部下垂，唔成一直線。",
      "拉不到胸，只做半程。",
      "聳肩。",
    ],
    idolTip: "pull 动作基础——拉 fans 上台互动要背肌发力。",
    illustration: "row",
  },
  {
    id: "dumbbell-row",
    name: "Single-Arm Dumbbell Row（單臂划船）",
    muscleGroup: "back",
    difficulty: "beginner",
    equipment: "啞鈴 + 凳",
    sets: 3,
    reps: "10–12",
    rest: "60s",
    formTips: [
      "拉向腰际，肩胛骨先動。",
      "背打直，唔好旋转躯干借力。",
      "顶峰 squeeze 1 秒再慢慢放。",
    ],
    commonMistakes: [
      "用 momentum 甩上。",
      "圆背，下背风险。",
      "拉向胸口太高，背阔刺激少。",
    ],
    idolTip: "单边控制——似 solo 位独立发力，唔靠队友借力。",
    illustration: "row",
  },
  {
    id: "lat-pulldown-band",
    name: "Band Lat Pulldown（彈力帶下拉）",
    muscleGroup: "back",
    difficulty: "beginner",
    equipment: "彈力帶 + 高锚点",
    sets: 3,
    reps: "12–15",
    rest: "45s",
    formTips: [
      "肘部向腰下拉，唔好耸肩。",
      "胸口略向天，背阔主导。",
      "控制回程，唔被带子弹返。",
    ],
    commonMistakes: [
      "只用手臂拉，背阔冇参与。",
      "身体过度后仰。",
      "耸肩到耳朵。",
    ],
    idolTip: "V 形背線舞台背影杀——lat 阔先似 idol 比例。",
    illustration: "lat-pulldown",
  },
  {
    id: "face-pull-band",
    name: "Band Face Pull（彈力帶面拉）",
    muscleGroup: "back",
    difficulty: "intermediate",
    equipment: "彈力帶",
    sets: 3,
    reps: "15",
    rest: "45s",
    formTips: [
      "拉向面部，外旋手肘。",
      "膊頭向下沉，后束发力。",
      "顶峰 pause，感受上背。",
    ],
    commonMistakes: [
      "拉太低变划船。",
      "没有外旋，肩旋转不足。",
      "身体前后摆。",
    ],
    idolTip: "肩后束 + 上背——长期 rehearsal 改善 posture。",
    illustration: "pull-apart",
  },
  {
    id: "lateral-raise",
    name: "Lateral Raise（側平舉）",
    muscleGroup: "shoulders",
    difficulty: "beginner",
    equipment: "啞鈴",
    sets: 3,
    reps: "12–15",
    rest: "45s",
    formTips: [
      "举到肩高就够，唔好耸肩借力。",
      "手肘微曲，像倒水咁向側舉。",
      "控制下降 2 秒。",
    ],
    commonMistakes: [
      "举太高超过肩，斜方肌代償。",
      "用甩动借力。",
      "重量太重变 upright row。",
    ],
    idolTip: "肩线宽先似 idol 比例——舞台 silhouette 靠呢招。",
    illustration: "lateral-raise",
  },
  {
    id: "front-raise",
    name: "Front Raise（前平舉）",
    muscleGroup: "shoulders",
    difficulty: "beginner",
    equipment: "啞鈴",
    sets: 3,
    reps: "12",
    rest: "45s",
    formTips: [
      "交替或同步，控制下降 2 秒。",
      "举到肩高，唔好超过。",
      "核心收緊，唔好向後仰。",
    ],
    commonMistakes: [
      "身体摇摆借力。",
      "耸肩。",
      "幅度过大伤肩。",
    ],
    idolTip: "举手回应粉丝——前束力量同线条。",
    illustration: "lateral-raise",
  },
  {
    id: "pike-push-up",
    name: "Pike Push-up（派克掌上壓）",
    muscleGroup: "shoulders",
    difficulty: "beginner",
    equipment: "自重",
    sets: 3,
    reps: "8–10",
    rest: "60s",
    formTips: [
      "臀部向天，头向地下降。",
      "手距约肩宽，手肘向後。",
      "推起时肩主导，唔借胸太多。",
    ],
    commonMistakes: [
      "臀部不够高，变标准 push-up。",
      "头先落地，颈压力大。",
      "手肘完全向外。",
    ],
    idolTip: "无器械版 overhead press——hotel workout 首选。",
    illustration: "push-up",
  },
  {
    id: "arm-circle-hold",
    name: "Arm Circle Hold（手臂画圈）",
    muscleGroup: "shoulders",
    difficulty: "beginner",
    equipment: "自重",
    sets: 2,
    reps: "30s each dir",
    rest: "20s",
    formTips: [
      "小幅度、慢速度，肩膊放松。",
      "先向前再向后，各 30 秒。",
      "呼吸自然，唔好憋气。",
    ],
    commonMistakes: [
      "幅度太大变成甩动。",
      "速度太快。",
      "耸肩。",
    ],
    idolTip: "排舞前 shoulder mobility——预防 rehearsal 拉伤。",
    illustration: "stretch",
  },
  {
    id: "band-shoulder-press",
    name: "Band Shoulder Press（彈力帶肩推）",
    muscleGroup: "shoulders",
    difficulty: "intermediate",
    equipment: "彈力帶",
    sets: 3,
    reps: "10–12",
    rest: "60s",
    formTips: [
      "核心收紧，手完全伸直时唔锁死肘。",
      "带子在脚下固定，轨迹垂直向上。",
      "下降控制 2 秒到耳旁。",
    ],
    commonMistakes: [
      "下背过度反弓。",
      "只推半程。",
      "耸肩借力。",
    ],
    idolTip: "举灯牌、荧光棒 overhead 动作嘅力量源。",
    illustration: "shoulder-press",
  },
  {
    id: "reverse-fly",
    name: "Reverse Fly（反向飛鳥）",
    muscleGroup: "shoulders",
    difficulty: "intermediate",
    equipment: "啞鈴",
    sets: 3,
    reps: "12–15",
    rest: "45s",
    formTips: [
      "俯身，手肘微曲向两侧打开。",
      "肩胛向後夾，后束发力。",
      "顶峰 pause 1 秒。",
    ],
    commonMistakes: [
      "用太大重量变划船。",
      "圆背。",
      " momentum 甩起。",
    ],
    idolTip: "改善 round shoulder——背肌舞台 posture 关键。",
    illustration: "fly",
  },
  {
    id: "bodyweight-squat",
    name: "Bodyweight Squat（徒手深蹲）",
    muscleGroup: "legs",
    difficulty: "beginner",
    equipment: "自重",
    sets: 3,
    reps: "15",
    rest: "45s",
    formTips: [
      "腳掌穩定、膝頭跟腳尖方向，全身協調先有力。",
      "蹲低时臀部向後坐，胸口保持抬起。",
      "起身用腳跟推地，唔好內扣膝頭。",
    ],
    commonMistakes: [
      "膝头内扣。",
      "脚跟离地。",
      "蹲不够深或过度前倾。",
    ],
    idolTip: "激烈 choreography 嘅根基——跳完一整首靠腿力。",
    illustration: "squat",
  },
  {
    id: "lunge",
    name: "Walking Lunge（弓箭步）",
    muscleGroup: "legs",
    difficulty: "beginner",
    equipment: "自重",
    sets: 3,
    reps: "10 each leg",
    rest: "60s",
    formTips: [
      "前膝唔好超过脚尖太多，躯干直立。",
      "后膝 nearly 掂地，推起用前脚。",
      "核心收緊保持平衡。",
    ],
    commonMistakes: [
      "步幅太短或太长。",
      "前膝内扣。",
      "上身过度前倾。",
    ],
    idolTip: "舞台走位 lunging——单腿稳定练 balance。",
    illustration: "lunge",
  },
  {
    id: "glute-bridge",
    name: "Glute Bridge（臀桥）",
    muscleGroup: "legs",
    difficulty: "beginner",
    equipment: "自重",
    sets: 3,
    reps: "15",
    rest: "45s",
    formTips: [
      "顶峰 squeeze 臀肌 2 秒，唔好过度顶腰。",
      "脚距约肩宽，脚跟发力。",
      "下巴微收，视线向天。",
    ],
    commonMistakes: [
      "过度顶腰，下背代償。",
      "脚太远或太近。",
      "顶峰没有 squeeze。",
    ],
    idolTip: "jump landing 缓冲——臀肌发力保护膝头。",
    illustration: "bridge",
  },
  {
    id: "calf-raise",
    name: "Calf Raise（提踵）",
    muscleGroup: "legs",
    difficulty: "beginner",
    equipment: "自重 / 台阶",
    sets: 3,
    reps: "15–20",
    rest: "40s",
    formTips: [
      "全程幅度，顶端 pause 1 秒。",
      "台阶边缘下降时 stretch 小腿。",
      "膝微曲固定，唔好弹跳。",
    ],
    commonMistakes: [
      "只做上半幅。",
      "弹跳借力。",
      "脚内八或外八不稳。",
    ],
    idolTip: "高跟鞋 / 舞台靴踮脚——小腿线条同 stability。",
    illustration: "calf-raise",
  },
  {
    id: "wall-sit",
    name: "Wall Sit（靠墻静蹲）",
    muscleGroup: "legs",
    difficulty: "beginner",
    equipment: "自重",
    sets: 3,
    reps: "30–45s",
    rest: "45s",
    formTips: [
      "大腿平行地面，膝 90°。",
      "背贴墙，手放膝上或交叉胸前。",
      "呼吸平稳，唔好憋气。",
    ],
    commonMistakes: [
      "膝超过脚尖太多。",
      "没蹲够深。",
      "手推大腿借力。",
    ],
    idolTip: "encore 安可曲 long pose——腿力耐力训练。",
    illustration: "wall-sit",
  },
  {
    id: "jumping-jack",
    name: "Jumping Jack（開合跳）",
    muscleGroup: "legs",
    difficulty: "beginner",
    equipment: "自重",
    sets: 3,
    reps: "30s",
    rest: "30s",
    formTips: [
      "輕鬆節奏帶心率，落地轻柔。",
      "手举过顶时完全伸展。",
      "核心收緊，唔好塌腰。",
    ],
    commonMistakes: [
      "落地太重伤膝。",
      "节奏乱。",
      "手只做半程。",
    ],
    idolTip: "全身燃脂 combo——LUMINA 周三训练日 cardio 首选。",
    illustration: "jumping-jack",
  },
  {
    id: "plank",
    name: "Plank（平板支撑）",
    muscleGroup: "core",
    difficulty: "beginner",
    equipment: "自重",
    sets: 3,
    reps: "30–45s",
    rest: "30s",
    formTips: [
      "身体成一直线，唔好塌腰或撅臀。",
      "肘在肩正下方，前臂平行。",
      "呼吸自然，收緊腹横肌。",
    ],
    commonMistakes: [
      "塌腰，下背受压。",
      "撅臀，变倒 V。",
      "憋气。",
    ],
    idolTip: "任何 stage 动作嘅核心——mic 手、dance break 都靠呢个。",
    illustration: "plank",
  },
  {
    id: "dead-bug",
    name: "Dead Bug（死虫式）",
    muscleGroup: "core",
    difficulty: "beginner",
    equipment: "自重",
    sets: 3,
    reps: "10 each side",
    rest: "30s",
    formTips: [
      "下背贴地，对侧手脚伸展。",
      "慢速控制，唔好赶。",
      "伸展时呼气，收返时吸气。",
    ],
    commonMistakes: [
      "下背离地。",
      "手脚伸展时身体扭转。",
      "速度太快。",
    ],
    idolTip: "anti-rotation 核心——快速转身 choreography 唔会乱。",
    illustration: "plank",
  },
  {
    id: "bicycle-crunch",
    name: "Bicycle Crunch（自行车卷腹）",
    muscleGroup: "core",
    difficulty: "beginner",
    equipment: "自重",
    sets: 3,
    reps: "20 total",
    rest: "30s",
    formTips: [
      "肘碰对侧膝，速度可控。",
      "下背贴地，唔好拉颈。",
      "转体用核心带动。",
    ],
    commonMistakes: [
      "拉颈借力。",
      "只做快频唔控制。",
      "下背拱起。",
    ],
    idolTip: "crop top 舞台造型——腹斜线靠 oblique 刺激。",
    illustration: "crunch",
  },
  {
    id: "arm-stretch-hold",
    name: "Arm & Shoulder Stretch（手臂肩膊拉伸）",
    muscleGroup: "core",
    difficulty: "beginner",
    equipment: "自重",
    sets: 1,
    reps: "30s each",
    rest: "—",
    formTips: [
      "手臂同膊頭伸展 5 分鐘——Active Recovery 必备。",
      "每侧 hold 30 秒，呼吸放松。",
      "拉伸到有轻微张力就得，唔好痛。",
    ],
    commonMistakes: [
      "弹震式拉伸。",
      "hold 时间太短。",
      "耸肩，拉伸不到位。",
    ],
    idolTip: "LUMINA 夜晚拉伸 routine——排舞后放松先可以第二日继续。",
    illustration: "stretch",
  },
  {
    id: "hollow-hold",
    name: "Hollow Hold（空心式）",
    muscleGroup: "core",
    difficulty: "intermediate",
    equipment: "自重",
    sets: 3,
    reps: "20–30s",
    rest: "30s",
    formTips: [
      "下背贴地，手脚离地保持 tension。",
      "下巴微收，视线向脚。",
      "呼吸短促稳定，唔好憋气。",
    ],
    commonMistakes: [
      "下背离地。",
      "手脚抬太高变 V-sit。",
      "颈过度用力。",
    ],
    idolTip: "空中 jump 落地稳定——核心 isometric 力量。",
    illustration: "plank",
  },
  {
    id: "russian-twist",
    name: "Russian Twist（俄罗斯转体）",
    muscleGroup: "core",
    difficulty: "intermediate",
    equipment: "自重",
    sets: 3,
    reps: "20 total",
    rest: "30s",
    formTips: [
      "转体用核心带动，唔好只用手甩。",
      "脚可贴地或离地，视能力。",
      "控制节奏，每边 pause 半秒。",
    ],
    commonMistakes: [
      "只用手甩，核心冇参与。",
      "圆背。",
      "速度太快失控。",
    ],
    idolTip: "twist 编舞动作——旋转发力从 core 开始。",
    illustration: "crunch",
  },
];

export type MuscleFilter = "all" | MuscleGroup;

export function getExercises(filter: { muscleGroup?: MuscleGroup } = {}): LibraryExercise[] {
  let list = EXERCISE_LIBRARY.slice();
  if (filter.muscleGroup) {
    list = list.filter((e) => e.muscleGroup === filter.muscleGroup);
  }
  return list;
}

export function getExerciseById(id: string): LibraryExercise | undefined {
  return EXERCISE_LIBRARY.find((e) => e.id === id);
}

/** Unique exercises that appear in a weekly plan (preserves plan order). */
export function getPlanExercises(plan: WeeklyPlanLike): LibraryExercise[] {
  const seen = new Set<string>();
  const result: LibraryExercise[] = [];
  for (const day of plan.days) {
    for (const ex of day.exercises) {
      if (seen.has(ex.id)) continue;
      const entry = getExerciseById(ex.id);
      if (entry) {
        seen.add(ex.id);
        result.push(entry);
      }
    }
  }
  return result;
}

/** Which plan days include this exercise. */
export function findExercisePlanDays(
  plan: WeeklyPlanLike,
  exerciseId: string,
): PlanDayRef[] {
  const refs: PlanDayRef[] = [];
  for (const day of plan.days) {
    if (day.exercises.some((e) => e.id === exerciseId)) {
      refs.push({
        dayId: day.id,
        weekday: day.weekday,
        emoji: day.emoji,
        title: day.title,
      });
    }
  }
  return refs;
}
