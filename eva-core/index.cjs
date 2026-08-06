require("./log.cjs");
const knowledgeDb = require("./knowledge-db.cjs");
const { loadEnvFile, setDataDir, getDataDir } = require("./env.cjs");
const { askChat } = require("./ask.cjs");
const { warmLlmModel } = require("./llm.cjs");
const { loadPrefs, savePrefs } = require("./prefs.cjs");
const { loadChatHistory, saveChatHistory, clearChatHistory } = require("./history.cjs");
const { loadPersona } = require("./persona.cjs");

module.exports = {
  askChat,
  warmLlmModel,
  loadPrefs,
  savePrefs,
  loadChatHistory,
  saveChatHistory,
  clearChatHistory,
  loadPersona,
  initKnowledgeDb: knowledgeDb.initKnowledgeDb,
  closeKnowledgeDb: knowledgeDb.closeKnowledgeDb,
  loadEnvFile,
  setDataDir,
  getDataDir,
};
