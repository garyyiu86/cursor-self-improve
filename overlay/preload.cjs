const { contextBridge, ipcRenderer } = require("electron");

const connection = {
  baseUrl: String(process.env.EVA_WEB_API_BASE || "http://127.0.0.1:8787").replace(/\/$/, ""),
  token: String(process.env.EVA_API_TOKEN || "").trim(),
};

contextBridge.exposeInMainWorld("__EVA_PLATFORM__", "desktop");
contextBridge.exposeInMainWorld("__EVA_CONNECTION__", connection);

contextBridge.exposeInMainWorld("companion", {
  isDesktop: true,
  // Shared eva-web uses HTTP API; legacy overlay/app.html still uses IPC below.
  askChat: (history, extra) => ipcRenderer.invoke("ask-chat", history, extra || {}),
  applyWithCursor: (history) => ipcRenderer.invoke("apply-with-cursor", history),
  askCopilot: (prompt) => ipcRenderer.invoke("ask-copilot", prompt),
  loadChatHistory: () => ipcRenderer.invoke("load-chat-history"),
  saveChatHistory: (history) => ipcRenderer.invoke("save-chat-history", history),
  clearChatHistory: () => ipcRenderer.invoke("clear-chat-history"),
  loadPrefs: () => ipcRenderer.invoke("load-prefs"),
  savePrefs: (patch) => ipcRenderer.invoke("save-prefs", patch),
  onProgress: (callback) => {
    if (typeof callback !== "function") return () => {};
    const handler = (_event, info) => callback(info || {});
    ipcRenderer.on("eva-progress", handler);
    return () => ipcRenderer.removeListener("eva-progress", handler);
  },
  dragStart: (screenX, screenY) => ipcRenderer.send("drag-start", screenX, screenY),
  dragMove: (screenX, screenY) => ipcRenderer.send("drag-move", screenX, screenY),
  dragEnd: () => ipcRenderer.send("drag-end"),
});
