const { app, BrowserWindow, screen, Menu, Tray, nativeImage, ipcMain } = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const crypto = require("node:crypto");
const eva = require("../eva-core");
const knowledgeDb = require("./knowledge-db.cjs");
const { startServer } = require("../eva-core/server.cjs");

let apiServer = null;

const CHAR_WIDTH = 140;
const CHAR_HEIGHT = 180;
const CHAT_WIDTH = 360;
const WINDOW_WIDTH = CHAT_WIDTH + CHAR_WIDTH;
const WINDOW_HEIGHT = 420;
const MARGIN = 12;

let mainWindow = null;
let tray = null;
let dragOffset = null;
let allowQuit = false;
let reloadTimer = null;
let isRelaunching = false;
let askInFlight = 0;
let pendingReloadReason = null;
let isFatalExiting = false;

function fatalExit(reason, err) {
  if (isFatalExiting) return;
  isFatalExiting = true;
  console.error(`[Eva] Fatal (${reason}) — exiting app.`);
  if (err !== undefined && err !== null) {
    console.error(err?.stack || err?.message || err);
  }
  allowQuit = true;
  try {
    knowledgeDb.closeKnowledgeDb().catch(() => {});
  } catch (_) {}
  try {
    if (typeof app !== "undefined" && app.isReady?.()) {
      app.exit(1);
      return;
    }
  } catch (_) {}
  process.exit(1);
}

/** Log only — do not kill Eva / trigger overlay-runner restart. Chat errors go via API SSE. */
function reportNonFatal(kind, err) {
  console.error(`[Eva] ${kind} (non-fatal):`, err?.stack || err?.message || err);
}

process.on("uncaughtException", (err) => reportNonFatal("uncaughtException", err));
process.on("unhandledRejection", (reason) => reportNonFatal("unhandledRejection", reason));

const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  console.warn("[Eva] Already running — exiting this instance.");
  app.exit(0);
}

function focusEvaWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.setAlwaysOnTop(true, "screen-saver");
  mainWindow.moveTop();
  mainWindow.focus();
}

app.on("second-instance", () => {
  console.log("[Eva] Second launch detected — focusing existing window.");
  focusEvaWindow();
});

function overlayDataDir() {
  const dir = path.join(__dirname, "data");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function windowBoundsPath() {
  return path.join(overlayDataDir(), "window-bounds.json");
}

function defaultPosition() {
  const { workArea } = screen.getPrimaryDisplay();
  return {
    x: Math.round(workArea.x + workArea.width - WINDOW_WIDTH - MARGIN),
    y: Math.round(workArea.y + workArea.height - WINDOW_HEIGHT - MARGIN),
    width: WINDOW_WIDTH,
    height: WINDOW_HEIGHT,
  };
}

function isBoundsOnAnyDisplay(bounds) {
  const displays = screen.getAllDisplays();
  const cx = bounds.x + Math.floor(bounds.width / 2);
  const cy = bounds.y + Math.floor(bounds.height / 2);
  return displays.some((d) => {
    const b = d.bounds;
    return cx >= b.x && cy >= b.y && cx < b.x + b.width && cy < b.y + b.height;
  });
}

function loadWindowBounds() {
  try {
    const p = windowBoundsPath();
    if (!fs.existsSync(p)) return defaultPosition();
    const saved = JSON.parse(fs.readFileSync(p, "utf8"));
    const bounds = {
      x: Number(saved.x),
      y: Number(saved.y),
      width: WINDOW_WIDTH,
      height: WINDOW_HEIGHT,
    };
    if (![bounds.x, bounds.y].every(Number.isFinite)) return defaultPosition();
    if (!isBoundsOnAnyDisplay(bounds)) return defaultPosition();
    return bounds;
  } catch {
    return defaultPosition();
  }
}

let saveBoundsTimer = null;
function saveWindowBounds() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const b = mainWindow.getBounds();
  const payload = {
    x: b.x,
    y: b.y,
    width: WINDOW_WIDTH,
    height: WINDOW_HEIGHT,
    savedAt: new Date().toISOString(),
  };
  try {
    fs.writeFileSync(windowBoundsPath(), JSON.stringify(payload, null, 2), "utf8");
  } catch (err) {
    console.warn("[Eva] Failed to save window bounds:", err?.message || err);
  }
}

function scheduleSaveWindowBounds() {
  if (saveBoundsTimer) clearTimeout(saveBoundsTimer);
  saveBoundsTimer = setTimeout(saveWindowBounds, 250);
}

function createMainWindow() {
  const pos = loadWindowBounds();
  mainWindow = new BrowserWindow({
    width: WINDOW_WIDTH,
    height: WINDOW_HEIGHT,
    x: pos.x,
    y: pos.y,
    frame: false,
    transparent: true,
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: false,
    alwaysOnTop: true,
    hasShadow: false,
    show: false,
    backgroundColor: "#00000000",
    title: "Eva",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.setAlwaysOnTop(true, "screen-saver");
  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  loadEvaWeb(mainWindow);

  mainWindow.once("ready-to-show", () => {
    const saved = loadWindowBounds();
    mainWindow.setBounds({
      x: saved.x,
      y: saved.y,
      width: WINDOW_WIDTH,
      height: WINDOW_HEIGHT,
    });
    mainWindow.show();
    mainWindow.moveTop();
    mainWindow.focus();
  });

  mainWindow.on("move", () => scheduleSaveWindowBounds());
  mainWindow.on("moved", () => scheduleSaveWindowBounds());

  mainWindow.on("close", (e) => {
    saveWindowBounds();
    if (!allowQuit) {
      e.preventDefault();
      mainWindow.show();
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function evaWebDistIndex() {
  return path.join(__dirname, "..", "eva-web", "dist", "index.html");
}

function loadEvaWeb(win) {
  const devUrl = String(process.env.EVA_WEB_URL || "").trim();
  if (devUrl) {
    console.log("[Eva] Loading eva-web from EVA_WEB_URL:", devUrl);
    win.loadURL(devUrl);
    return;
  }
  const distIndex = evaWebDistIndex();
  if (fs.existsSync(distIndex)) {
    console.log("[Eva] Loading eva-web dist:", distIndex);
    win.loadFile(distIndex);
    return;
  }
  // Fallback to legacy overlay HTML while dist is missing
  const legacy = path.join(__dirname, "app.html");
  console.warn(
    "[Eva] eva-web/dist missing — run `npm run eva:web:build`. Falling back to overlay/app.html",
  );
  win.loadFile(legacy);
}

function restartEva(reason = "manual", { force = false } = {}) {
  if (!force && askInFlight > 0) {
    pendingReloadReason = reason || "deferred";
    console.log(`[Eva] Reload deferred until chat finishes (${pendingReloadReason})`);
    try {
      mainWindow?.webContents?.send("eva-progress", {
        stage: "reload",
        message: "程式有更新，答完這題後會重載…",
      });
    } catch (_) {}
    return;
  }
  if (isRelaunching) return;
  isRelaunching = true;
  pendingReloadReason = null;
  if (reloadTimer) {
    clearTimeout(reloadTimer);
    reloadTimer = null;
  }
  const restartCode = Number(process.env.EVA_RESTART_EXIT_CODE || 75);
  console.log(`[Eva] Restarting (${reason})...`);
  saveWindowBounds();
  allowQuit = true;
  if (process.env.EVA_UNDER_RUNNER === "1") {
    app.exit(restartCode);
    return;
  }
  app.relaunch();
  app.exit(0);
}

function flushDeferredReload() {
  if (askInFlight > 0 || !pendingReloadReason || isRelaunching) return;
  const reason = pendingReloadReason;
  pendingReloadReason = null;
  console.log(`[Eva] Chat finished — reloading (${reason})`);
  if (reloadTimer) clearTimeout(reloadTimer);
  reloadTimer = setTimeout(() => restartEva(reason, { force: true }), 400);
}

function scheduleFileReload(name) {
  const reason = `file change: ${name}`;
  if (askInFlight > 0) {
    pendingReloadReason = reason;
    console.log(`[Eva] Reload deferred until chat finishes (${reason})`);
    try {
      mainWindow?.webContents?.send("eva-progress", {
        stage: "reload",
        message: "程式有更新，答完這題後會重載…",
      });
    } catch (_) {}
    return;
  }
  if (reloadTimer) clearTimeout(reloadTimer);
  reloadTimer = setTimeout(() => restartEva(reason, { force: true }), 600);
}

function fileContentHash(filePath) {
  try {
    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) return null;
    const buf = fs.readFileSync(filePath);
    return crypto.createHash("sha256").update(buf).digest("hex");
  } catch {
    return null;
  }
}

function watchForUpdates() {
  // Default OFF — set EVA_AUTO_RELOAD=1 to re-enable file-watch restarts.
  if (process.env.EVA_AUTO_RELOAD !== "1") {
    console.log("[Eva] Auto-reload disabled (set EVA_AUTO_RELOAD=1 to enable)");
    return;
  }

  const evaCoreDir = path.join(__dirname, "..", "eva-core");
  const watchFiles = [
    path.join(__dirname, "main.cjs"),
    path.join(__dirname, "preload.cjs"),
    path.join(__dirname, "app.html"),
    path.join(__dirname, "knowledge-db.cjs"),
    path.join(evaCoreDir, "index.cjs"),
    path.join(evaCoreDir, "ask.cjs"),
    path.join(evaCoreDir, "llm.cjs"),
    path.join(evaCoreDir, "knowledge.cjs"),
    path.join(evaCoreDir, "server.cjs"),
    path.join(__dirname, "..", "eva-web", "dist", "index.html"),
    path.join(__dirname, "..", "package.json"),
    path.join(__dirname, "..", ".env"),
  ];

  /** @type {Map<string, string|null>} */
  const fingerprints = new Map();
  for (const filePath of watchFiles) {
    fingerprints.set(filePath, fileContentHash(filePath));
  }

  const onMaybeChanged = (filePath) => {
    const name = path.basename(filePath);
    if (reloadTimer) clearTimeout(reloadTimer);
    reloadTimer = setTimeout(() => {
      reloadTimer = null;
      const prev = fingerprints.get(filePath);
      const next = fileContentHash(filePath);
      if (next == null) return;
      if (prev === next) return;
      fingerprints.set(filePath, next);
      console.log(`[Eva] Content changed: ${name}`);
      scheduleFileReload(name);
    }, 800);
  };

  for (const filePath of watchFiles) {
    try {
      if (!fs.existsSync(filePath)) {
        console.warn("[Eva] Watch skip (missing):", filePath);
        continue;
      }
      fs.watch(filePath, { persistent: true }, () => onMaybeChanged(filePath));
      console.log("[Eva] Watching for content changes:", filePath);
    } catch (err) {
      console.warn("[Eva] Watch failed for", filePath, err?.message || err);
    }
  }
}

function createTray() {
  const iconPath = path.join(__dirname, "..", "assets", "anime-girl-mascot.png");
  const icon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });
  tray = new Tray(icon.isEmpty() ? nativeImage.createEmpty() : icon);
  tray.setToolTip("Eva");
  tray.setContextMenu(
    Menu.buildFromTemplate([
      {
        label: "Show",
        click: () => {
          if (!mainWindow || mainWindow.isDestroyed()) createMainWindow();
          else focusEvaWindow();
        },
      },
      {
        label: "Restart Eva",
        click: () => restartEva("tray", { force: true }),
      },
      { type: "separator" },
      {
        label: "Quit",
        click: () => {
          allowQuit = true;
          app.quit();
        },
      },
    ]),
  );
  tray.on("double-click", () => focusEvaWindow());
}

async function applyWithCursor(historyMessages) {
  const apiKey = process.env.CURSOR_API_KEY;
  if (!apiKey) {
    throw new Error(
      "Missing CURSOR_API_KEY in .env. Create one at https://cursor.com/dashboard/api",
    );
  }

  const history = Array.isArray(historyMessages) ? historyMessages : [];
  const transcript = history
    .filter((m) => m && (m.role === "user" || m.role === "assistant"))
    .filter((m) => {
      const c = String(m.content ?? "");
      return (
        !c.startsWith("Applying with Cursor") &&
        !c.startsWith("Cursor apply result:") &&
        !c.startsWith("Cursor apply failed:")
      );
    })
    .map((m) => {
      const ts = m.ts ? ` [${m.ts}]` : "";
      return `${m.role === "user" ? "User" : "Eva"}${ts}: ${m.content}`;
    })
    .join("\n\n");

  if (!transcript.trim()) {
    throw new Error("No chat history to apply.");
  }

  const projectRoot = path.join(__dirname, "..");
  const { Agent } = await import("@cursor/sdk");

  const result = await Agent.prompt(
    [
      "You are Cursor Agent working inside this repository.",
      "The user confirmed they want you to APPLY code changes based on the Eva chat below.",
      "Implement the requested changes with minimal, focused edits.",
      "Do not expand scope. Prefer editing existing files over creating new ones unless needed.",
      "When done, briefly summarize what files you changed.",
      "",
      "=== Eva chat transcript ===",
      transcript,
      "=== end transcript ===",
    ].join("\n"),
    {
      apiKey,
      model: { id: "composer-2.5" },
      local: { cwd: projectRoot },
    },
  );

  if (result.status === "error") {
    throw new Error(`Cursor agent error (run ${result.id})`);
  }

  return String(result.result ?? "").trim() || "(Cursor finished with empty summary)";
}

async function askChat(historyMessages, { onProgress } = {}) {
  askInFlight += 1;
  try {
    return await eva.askChat(historyMessages, { onProgress });
  } finally {
    askInFlight = Math.max(0, askInFlight - 1);
    flushDeferredReload();
  }
}

ipcMain.handle("ask-chat", async (event, historyMessages) => {
  return askChat(historyMessages, {
    onProgress: (info) => {
      try {
        event.sender.send("eva-progress", info || {});
      } catch (_) {}
    },
  });
});

ipcMain.handle("apply-with-cursor", async (_event, historyMessages) => {
  askInFlight += 1;
  try {
    return await applyWithCursor(historyMessages);
  } finally {
    askInFlight = Math.max(0, askInFlight - 1);
    flushDeferredReload();
  }
});

ipcMain.handle("load-chat-history", async () => eva.loadChatHistory());
ipcMain.handle("save-chat-history", async (_event, historyMessages) =>
  eva.saveChatHistory(historyMessages),
);
ipcMain.handle("clear-chat-history", async () => eva.clearChatHistory());
ipcMain.handle("load-prefs", async () => eva.loadPrefs());
ipcMain.handle("save-prefs", async (_event, patch) => eva.savePrefs(patch || {}));
ipcMain.handle("load-persona", async () => eva.loadPersona());
ipcMain.handle("ask-copilot", async (_event, prompt) => {
  return askChat([{ role: "user", content: String(prompt ?? "") }]);
});

ipcMain.on("drag-start", (_event, screenX, screenY) => {
  if (!mainWindow) return;
  const b = mainWindow.getBounds();
  dragOffset = { dx: screenX - b.x, dy: screenY - b.y };
});

ipcMain.on("drag-move", (_event, screenX, screenY) => {
  if (!mainWindow || !dragOffset) return;
  mainWindow.setPosition(
    Math.round(screenX - dragOffset.dx),
    Math.round(screenY - dragOffset.dy),
  );
});

ipcMain.on("drag-end", () => {
  dragOffset = null;
  saveWindowBounds();
});

app.whenReady().then(async () => {
  if (!gotSingleInstanceLock) return;
  eva.loadEnvFile(path.join(__dirname, ".."));
  eva.setDataDir(overlayDataDir());
  try {
    await knowledgeDb.initKnowledgeDb();
  } catch (err) {
    console.warn("[Eva][KB] init skipped:", err?.message || err);
  }
  try {
    if (process.env.EVA_EMBEDDED_API !== "0") {
      apiServer = await startServer();
      console.log("[Eva] Embedded API server ready for eva-web / Android clients");
    }
  } catch (err) {
    // Port in use (e.g. npm run eva:server already running) — UI can still use it
    console.warn("[Eva] Embedded API not started:", err?.message || err);
  }
  createMainWindow();
  createTray();
  watchForUpdates();
  eva.warmLlmModel().catch(() => {});
});

app.on("render-process-gone", (_event, _webContents, details) => {
  fatalExit("render-process-gone", details);
});

app.on("child-process-gone", (_event, details) => {
  if (details?.type === "GPU" || details?.reason === "crashed") {
    fatalExit("child-process-gone", details);
  }
});

app.on("before-quit", () => {
  saveWindowBounds();
  allowQuit = true;
  try {
    apiServer?.close?.();
  } catch (_) {}
  knowledgeDb.closeKnowledgeDb().catch(() => {});
});

app.on("window-all-closed", (e) => {
  e.preventDefault();
});
