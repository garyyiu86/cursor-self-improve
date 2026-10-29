const { WebSocketServer } = require("ws");

const PING_MS = 20_000;
const PONG_TIMEOUT_MS = 35_000;

/** @type {import("ws").WebSocket[] | null} */
let clients = null;
let pingTimer = null;

function sendJson(ws, payload) {
  if (ws.readyState !== ws.OPEN) return;
  try {
    ws.send(JSON.stringify(payload));
  } catch (_) {}
}

function broadcast(payload) {
  if (!clients) return;
  for (const ws of clients) {
    sendJson(ws, payload);
  }
}

function startPingLoop() {
  if (pingTimer) return;
  pingTimer = setInterval(() => {
    if (!clients) return;
    const now = Date.now();
    for (const ws of clients) {
      if (ws.__evaLastPong && now - ws.__evaLastPong > PONG_TIMEOUT_MS) {
        try {
          ws.terminate();
        } catch (_) {}
        continue;
      }
      sendJson(ws, { type: "ping", ts: now });
    }
  }, PING_MS);
}

function stopPingLoop() {
  if (!pingTimer) return;
  clearInterval(pingTimer);
  pingTimer = null;
}

function attachWsSync(server, options = {}) {
  const getToken = options.getToken || (() => "");
  const loadHistory = options.loadHistory || (() => []);

  const wss = new WebSocketServer({ noServer: true });
  clients = new Set();

  wss.on("connection", (ws) => {
    ws.__evaLastPong = Date.now();
    clients.add(ws);
    sendJson(ws, { type: "sync", history: loadHistory() });

    ws.on("message", (raw) => {
      let msg;
      try {
        msg = JSON.parse(String(raw || ""));
      } catch {
        return;
      }
      if (msg?.type === "pong") {
        ws.__evaLastPong = Date.now();
      }
    });

    ws.on("close", () => {
      clients.delete(ws);
      if (clients.size === 0) stopPingLoop();
    });

    ws.on("error", () => {
      try {
        ws.close();
      } catch (_) {}
    });

    startPingLoop();
  });

  server.on("upgrade", (req, socket, head) => {
    let pathname = "/";
    try {
      pathname = new URL(req.url || "/", "http://localhost").pathname;
    } catch (_) {}
    if (pathname !== "/api/ws") return;

    const url = new URL(req.url || "/", "http://localhost");
    const token = String(url.searchParams.get("token") || "").trim();
    const expected = String(getToken() || "").trim();
    if (!expected || token !== expected) {
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
      socket.destroy();
      return;
    }

    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit("connection", ws, req);
    });
  });

  return {
    broadcastHistory(history) {
      broadcast({ type: "sync", history: Array.isArray(history) ? history : loadHistory() });
    },
    close() {
      stopPingLoop();
      if (clients) {
        for (const ws of clients) {
          try {
            ws.close();
          } catch (_) {}
        }
        clients.clear();
      }
      try {
        wss.close();
      } catch (_) {}
      clients = null;
    },
  };
}

module.exports = { attachWsSync };
