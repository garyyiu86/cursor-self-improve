const fs = require("node:fs");
const path = require("node:path");
const { getDataDir } = require("./env.cjs");

function chatHistoryPath() {
  return path.join(getDataDir(), "chat-history.json");
}

function loadChatHistory() {
  try {
    const p = chatHistoryPath();
    if (!fs.existsSync(p)) return [];
    const raw = JSON.parse(fs.readFileSync(p, "utf8"));
    return Array.isArray(raw) ? raw : [];
  } catch (err) {
    console.warn("[Eva] Failed to load chat history:", err?.message || err);
    return [];
  }
}

function saveChatHistory(historyMessages) {
  const dir = getDataDir();
  fs.mkdirSync(dir, { recursive: true });
  const history = Array.isArray(historyMessages) ? historyMessages : [];
  const trimmed = history.slice(-500);
  fs.writeFileSync(chatHistoryPath(), JSON.stringify(trimmed, null, 2), "utf8");
  return trimmed;
}

function clearChatHistory() {
  const p = chatHistoryPath();
  if (fs.existsSync(p)) fs.unlinkSync(p);
  try {
    require("./tencent-lke.cjs").resetTencentConversation();
  } catch (_) {}
  return [];
}

function resolveHistoryForModel(incoming) {
  const clean = (arr) =>
    (Array.isArray(arr) ? arr : [])
      .filter((m) => m && (m.role === "user" || m.role === "assistant"))
      .filter((m) => {
        const c = String(m.content ?? "");
        return (
          !c.startsWith("Applying with Cursor") &&
          !c.startsWith("Cursor apply result:") &&
          !c.startsWith("Cursor apply failed:")
        );
      })
      .map((m) => ({
        role: m.role === "assistant" ? "assistant" : "user",
        content: String(m.content ?? ""),
      }));

  const fromUi = clean(incoming);
  const fromDisk = clean(loadChatHistory());
  const MAX = 16;

  let base = fromUi.length >= fromDisk.length ? fromUi.slice() : fromDisk.slice();
  const lastUi = fromUi[fromUi.length - 1];
  if (lastUi?.role === "user") {
    const lastBase = base[base.length - 1];
    if (!lastBase || lastBase.content !== lastUi.content || lastBase.role !== "user") {
      if (!(lastBase?.role === "user" && lastBase.content === lastUi.content)) {
        base.push(lastUi);
      }
    }
  }

  while (base.length && base[0].role === "assistant") base.shift();
  return base.slice(-MAX);
}

module.exports = {
  loadChatHistory,
  saveChatHistory,
  clearChatHistory,
  resolveHistoryForModel,
};
