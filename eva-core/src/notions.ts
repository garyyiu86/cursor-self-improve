/** Follow-up prompts Eva can surface in chat after a logged workout. */
export interface DebriefQuestion {
  key: string;
  prompt: string;
  optional: boolean;
}

export const DEBRIEF_QUESTIONS = {
  intro: "練完啦？幫我回憶一下今次訓練～",
  hardestExercise: {
    key: "hardestExercise",
    prompt: "今日邊個動作最吃力？",
    optional: false,
  },
  difficultyRating: {
    key: "difficultyRating",
    prompt: "整體難度 1–5 點評？",
    optional: true,
  },
  feelNote: {
    key: "feelNote",
    prompt: "有咩想同我講？（酸痛、狀態、心情都得）",
    optional: true,
  },
  hint: "訓練完同我傾感受，我會記低喺「上次回顧」～",
} as const satisfies Record<string, string | DebriefQuestion>;

/** Ordered prompts for a natural debrief flow in chat. */
export function getDebriefPromptSequence(): DebriefQuestion[] {
  return [
    DEBRIEF_QUESTIONS.hardestExercise,
    DEBRIEF_QUESTIONS.difficultyRating,
    DEBRIEF_QUESTIONS.feelNote,
  ];
}
