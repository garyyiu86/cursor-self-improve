const MODEL_BALANCE_CODE = "460032";
const BALANCE_EXHAUSTED_ERR_CODE = "TENCENT_BALANCE_EXHAUSTED";

function isModelBalanceError(input) {
  const s = String(
    input?.rawDetail || input?.message || input?.Message || input?.Code || input || "",
  );
  return (
    new RegExp(`\\b${MODEL_BALANCE_CODE}\\b`).test(s) ||
    /(应用)?模型余额不足|餘額不足|余额不足/i.test(s)
  );
}

/** 星野玲 — 粵語 + 日系 idol tone when model quota is exhausted. */
function modelBalanceFallbackMessage() {
  return "⚠️ 玲今日把聲用緊嘅能源有啲唔夠⋯⋯主辦方會盡快 recharge（充值）！你可以一陣再同我傾過。多謝你等陣～";
}

function createBalanceExhaustedError(rawDetail) {
  const raw = String(rawDetail || "").trim();
  console.error(`[Eva][model] balance exhausted (${MODEL_BALANCE_CODE}):`, raw);
  const err = new Error(modelBalanceFallbackMessage());
  err.code = BALANCE_EXHAUSTED_ERR_CODE;
  err.tencentCode = MODEL_BALANCE_CODE;
  err.rawDetail = raw;
  return err;
}

function throwIfModelBalanceError(rawDetail) {
  if (isModelBalanceError(rawDetail)) throw createBalanceExhaustedError(rawDetail);
}

module.exports = {
  MODEL_BALANCE_CODE,
  BALANCE_EXHAUSTED_ERR_CODE,
  isModelBalanceError,
  modelBalanceFallbackMessage,
  createBalanceExhaustedError,
  throwIfModelBalanceError,
};
