const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("companion", {
  askChat: (history) => ipcRenderer.invoke("ask-chat", history),
  applyWithCursor: (history) => ipcRenderer.invoke("apply-with-cursor", history),
  askCopilot: (prompt) => ipcRenderer.invoke("ask-copilot", prompt),
  loadChatHistory: () => ipcRenderer.invoke("load-chat-history"),
  saveChatHistory: (history) => ipcRenderer.invoke("save-chat-history", history),
  clearChatHistory: () => ipcRenderer.invoke("clear-chat-history"),
  loadPrefs: () => ipcRenderer.invoke("load-prefs"),
  savePrefs: (patch) => ipcRenderer.invoke("save-prefs", patch),
  dragStart: (screenX, screenY) => ipcRenderer.send("drag-start", screenX, screenY),
  dragMove: (screenX, screenY) => ipcRenderer.send("drag-move", screenX, screenY),
  dragEnd: () => ipcRenderer.send("drag-end"),
});
