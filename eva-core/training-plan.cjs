const TRAINING_PLAN_RE =
  /(?:二頭肌|肱二|bicep|手臂線條|手臂线条).{0,24}(?:訓練|训练|計劃|计划|表|workout|plan)|(?:訓練表|训练表|training\s*plan|workout\s*plan).{0,24}(?:二頭|肱二|bicep|手臂)|bicep-weekly/i;

function isTrainingPlanRequest(text) {
  return TRAINING_PLAN_RE.test(String(text || "").trim());
}

/** Short intro + inline card marker (no raw exercise bullet list). */
function formatTrainingPlanReply(lang) {
  if (lang === "en") {
    return (
      "Done~ Here's your **bicep line weekly plan**! Tick each move as you go 💪\n\n" +
      ":::training-plan bicep-weekly:::\n\n" +
      "Tap a checkbox when you finish a set — I'll cheer you on~ ✊"
    );
  }
  if (lang === "zh-Hans") {
    return (
      "搞定～这是你的 **二头肌线条每周训练表**！跟着做就逐项 tick 啦 💪\n\n" +
      ":::training-plan bicep-weekly:::\n\n" +
      "做完一个就点 checkbox，我在旁边给你打气～ ✊"
    );
  }
  return (
    "搞掂～呢個係你嘅 **二頭肌線條每週訓練表**！跟住做就逐項 tick 啦 💪\n\n" +
    ":::training-plan bicep-weekly:::\n\n" +
    "做完一個就撳 checkbox，我喺度幫你打氣～ ✊"
  );
}

/** Persist biceps beginner plan when Eva generates it in chat (fire-and-forget). */
function persistChatTrainingPlan() {
  import("./services/trainingService.js")
    .then(({ generateAndSavePlan }) => {
      generateAndSavePlan("biceps", "beginner", "chat");
    })
    .catch((err) => {
      console.warn("[Eva][training] chat save skipped:", err?.message || err);
    });
}

module.exports = {
  isTrainingPlanRequest,
  formatTrainingPlanReply,
  persistChatTrainingPlan,
};
