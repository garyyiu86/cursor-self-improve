import { loadConnection } from "./settings.js";

function authHeaders(extra = {}) {
  const { token } = loadConnection();
  const headers = { ...extra };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

function apiUrl(path) {
  const { baseUrl } = loadConnection();
  return `${baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
}

async function parseJson(res) {
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    const msg = data?.error || data?.message || text || res.statusText;
    throw new Error(String(msg || `HTTP ${res.status}`));
  }
  return data;
}

export async function healthCheck() {
  const res = await fetch(apiUrl("/api/health"), {
    headers: authHeaders(),
  });
  return parseJson(res);
}

export async function loadPrefs() {
  const res = await fetch(apiUrl("/api/prefs"), { headers: authHeaders() });
  return parseJson(res);
}

export async function savePrefs(patch) {
  const res = await fetch(apiUrl("/api/prefs"), {
    method: "PATCH",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(patch || {}),
  });
  return parseJson(res);
}

export async function loadChatHistory() {
  const res = await fetch(apiUrl("/api/history"), { headers: authHeaders() });
  return parseJson(res);
}

export async function saveChatHistory(history) {
  const res = await fetch(apiUrl("/api/history"), {
    method: "PUT",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(history || []),
  });
  return parseJson(res);
}

export async function clearChatHistory() {
  const res = await fetch(apiUrl("/api/history"), {
    method: "DELETE",
    headers: authHeaders(),
  });
  return parseJson(res);
}

/**
 * POST /api/chat → SSE progress. Resolves with final answer string.
 * onProgress({ stage, message })
 */
export async function askChat(messages, { onProgress } = {}) {
  const res = await fetch(apiUrl("/api/chat"), {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json", Accept: "text/event-stream" }),
    body: JSON.stringify({ messages: messages || [] }),
  });

  if (!res.ok) {
    const text = await res.text();
    let msg = text;
    try {
      msg = JSON.parse(text)?.error || text;
    } catch (_) {}
    throw new Error(String(msg || `HTTP ${res.status}`));
  }

  if (!res.body) {
    throw new Error("No response body from /api/chat");
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let answer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });

    let sep;
    while ((sep = buf.indexOf("\n\n")) >= 0) {
      const chunk = buf.slice(0, sep);
      buf = buf.slice(sep + 2);
      const lines = chunk.split(/\r?\n/);
      for (const line of lines) {
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (!payload) continue;
        let info;
        try {
          info = JSON.parse(payload);
        } catch {
          continue;
        }
        const stage = String(info?.stage || "");
        const message = String(info?.message ?? "");
        if (stage === "answer") {
          answer = message;
        } else if (stage === "error") {
          throw new Error(message || "Chat error");
        } else {
          try {
            onProgress?.(info);
          } catch (_) {}
        }
      }
    }
  }

  if (!answer) {
    throw new Error("Chat finished without an answer");
  }
  return answer;
}
