import { loadConnection } from "./settings.js";

const BACKOFF_BASE_MS = 400;
const BACKOFF_MAX_MS = 8000;
const STALE_MS = 45_000;

function wsUrlFromConnection({ baseUrl, token }) {
  const u = new URL(String(baseUrl || "http://127.0.0.1:8787"));
  u.protocol = u.protocol === "https:" ? "wss:" : "ws:";
  u.pathname = "/api/ws";
  u.search = "";
  if (token) u.searchParams.set("token", token);
  return u.toString();
}

/**
 * Live chat-history sync over /api/ws with keep-alive and silent-drop reconnect.
 * Local chat history is never cleared on disconnect — only merged on sync.
 */
export function createWsSyncClient({
  onSync,
  shouldApply = () => true,
  onStatusChange,
} = {}) {
  let ws = null;
  let reconnectTimer = null;
  let staleTimer = null;
  let stopped = true;
  let attempt = 0;
  let connected = false;

  function setConnected(next) {
    if (connected === next) return;
    connected = next;
    onStatusChange?.(next);
  }

  function clearReconnectTimer() {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  }

  function clearStaleTimer() {
    if (staleTimer) {
      clearTimeout(staleTimer);
      staleTimer = null;
    }
  }

  function touchActivity() {
    clearStaleTimer();
    staleTimer = setTimeout(() => {
      try {
        ws?.close(4000, "stale");
      } catch (_) {}
    }, STALE_MS);
  }

  function scheduleReconnect() {
    if (stopped) return;
    clearReconnectTimer();
    const delay = Math.min(BACKOFF_MAX_MS, BACKOFF_BASE_MS * 2 ** attempt);
    attempt += 1;
    reconnectTimer = setTimeout(connect, delay);
  }

  function handleMessage(event) {
    touchActivity();
    let msg;
    try {
      msg = JSON.parse(String(event.data || ""));
    } catch {
      return;
    }
    if (msg?.type === "ping") {
      try {
        ws?.send(JSON.stringify({ type: "pong", ts: msg.ts || Date.now() }));
      } catch (_) {}
      return;
    }
    if (msg?.type === "sync" && Array.isArray(msg.history)) {
      if (shouldApply()) onSync?.(msg.history);
    }
  }

  function connect() {
    if (stopped) return;
    clearReconnectTimer();

    const conn = loadConnection();
    if (!conn.baseUrl || !conn.token) {
      setConnected(false);
      scheduleReconnect();
      return;
    }

    let next;
    try {
      next = new WebSocket(wsUrlFromConnection(conn));
    } catch (err) {
      console.warn("[Eva] ws connect failed", err);
      setConnected(false);
      scheduleReconnect();
      return;
    }

    ws = next;

    next.addEventListener("open", () => {
      attempt = 0;
      setConnected(true);
      touchActivity();
    });

    next.addEventListener("message", handleMessage);

    next.addEventListener("close", () => {
      if (ws !== next) return;
      ws = null;
      setConnected(false);
      clearStaleTimer();
      scheduleReconnect();
    });

    next.addEventListener("error", () => {
      try {
        next.close();
      } catch (_) {}
    });
  }

  return {
    start() {
      stopped = false;
      attempt = 0;
      connect();
    },
    stop() {
      stopped = true;
      clearReconnectTimer();
      clearStaleTimer();
      setConnected(false);
      try {
        ws?.close(1000, "stop");
      } catch (_) {}
      ws = null;
    },
    restart() {
      this.stop();
      this.start();
    },
    isConnected() {
      return connected;
    },
  };
}
