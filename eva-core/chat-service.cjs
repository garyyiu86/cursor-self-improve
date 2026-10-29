const {
  BALANCE_EXHAUSTED_ERR_CODE,
  isModelBalanceError,
  modelBalanceFallbackMessage,
} = require("./fallback-messages.cjs");

/**
 * Map chat pipeline errors to user-facing replies.
 * Returns { kind: "fallback", message } for graceful degradation, else null.
 */
function resolveBalanceFallback(err, { logTag = "[Eva][chat]" } = {}) {
  const rawDetail = String(err?.rawDetail || err?.message || err);
  if (err?.code === BALANCE_EXHAUSTED_ERR_CODE || isModelBalanceError(rawDetail)) {
    console.error(`${logTag} model balance exhausted:`, rawDetail);
    return { kind: "fallback", message: modelBalanceFallbackMessage(), rawDetail };
  }
  return null;
}

/**
 * Drop the trailing assistant turn so the model can answer the last user message again.
 */
function stripLastAssistantReply(messages) {
  const out = Array.isArray(messages) ? messages.slice() : [];
  for (let i = out.length - 1; i >= 0; i--) {
    if (out[i]?.role === "assistant") {
      out.splice(i, 1);
      break;
    }
  }
  return out;
}

module.exports = {
  resolveBalanceFallback,
  stripLastAssistantReply,
};
