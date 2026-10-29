const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { getDataDir } = require("./env.cjs");
const { nowMs, logTiming } = require("./timing.cjs");
const { prepareTencentAttachments } = require("./tencent-lke-files.cjs");
const { installSystemCa } = require("./tls-ca.cjs");

try {
  require("node:dns").setDefaultResultOrder("ipv4first");
} catch (_) {}

const {
  MODEL_BALANCE_CODE,
  createBalanceExhaustedError,
  isModelBalanceError,
  modelBalanceFallbackMessage,
  throwIfModelBalanceError,
} = require("./fallback-messages.cjs");

const DEFAULT_BASE = "https://wss.lke.tencentcloud.com";
const DEFAULT_PATH = "/adp/v2/chat";

function isTencentBalanceError(input) {
  return isModelBalanceError(input);
}

function tencentBalanceFriendlyMessage() {
  return modelBalanceFallbackMessage();
}

function balanceExhaustedError(rawDetail) {
  return createBalanceExhaustedError(rawDetail);
}

function throwIfBalanceError(rawDetail) {
  throwIfModelBalanceError(rawDetail);
}

function sessionFileName(sessionName) {
  const raw = String(sessionName || "tencent-lke").trim() || "tencent-lke";
  return `${raw.replace(/[^a-zA-Z0-9_-]/g, "") || "tencent-lke"}.json`;
}

function sessionPath(sessionName) {
  return path.join(getDataDir(), sessionFileName(sessionName));
}

function isEphemeralSession(sessionName) {
  const name = String(sessionName || "").trim();
  return name === "tencent-lke-drill" || /-drill$/i.test(name);
}

function newConversationId() {
  return crypto.randomUUID();
}

function newRequestId() {
  return crypto.randomUUID();
}

function tencentLkeConfigured() {
  return Boolean(String(process.env.TENCENT_LKE_APP_KEY || "").trim());
}

function isAbortTimeout(err) {
  const name = String(err?.name || "");
  const msg = String(err?.message || err || "");
  return (
    name === "TimeoutError" ||
    name === "AbortError" ||
    /aborted due to timeout|The operation was aborted|TimeoutError/i.test(msg)
  );
}

function wrapChatNetworkError(err) {
  if (isAbortTimeout(err)) {
    return new Error("騰訊雲對話超時。圖片分析可能較慢，請再試一次。");
  }
  const cause = err?.cause;
  const bits = [err?.message, err?.code, cause?.code, cause?.syscall, cause?.message]
    .filter(Boolean)
    .join(" | ");
  if (isConnectFail(err)) {
    return new Error(
      `Tencent connect timeout (${DEFAULT_BASE.replace(/^https?:\/\//, "")}:443). ${bits}`.slice(0, 360),
    );
  }
  return new Error(`連線騰訊雲對話失敗：${bits}`.slice(0, 360));
}

function isConnectFail(err) {
  const cause = err?.cause;
  const blob = [err?.message, err?.code, cause?.code, cause?.message, cause?.cause?.code]
    .filter(Boolean)
    .join(" ");
  return /UND_ERR_CONNECT_TIMEOUT|Connect Timeout|ENOTFOUND|EAI_AGAIN|ETIMEDOUT|ECONNRESET|UND_ERR_SOCKET|EHOSTUNREACH/i.test(
    blob,
  );
}

function connectTimeoutMs() {
  const n = Number(process.env.TENCENT_LKE_CONNECT_MS || 45000);
  return Number.isFinite(n) && n >= 5000 ? n : 45000;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

let _tencentHttp = null;
function tencentHttp() {
  if (_tencentHttp) return _tencentHttp;
  try {
    const { Agent, fetch: undiciFetch } = require("undici");
    const ms = connectTimeoutMs();
    _tencentHttp = {
      fetch: undiciFetch,
      dispatcher: new Agent({
        connectTimeout: ms,
        headersTimeout: 180000,
        bodyTimeout: 0,
        connections: 4,
        connect: {
          timeout: ms,
          family: 4,
        },
      }),
    };
  } catch {
    _tencentHttp = { fetch: global.fetch, dispatcher: undefined };
  }
  return _tencentHttp;
}

async function fetchTencent(url, init, { attempts = 3 } = {}) {
  const { fetch: doFetch, dispatcher } = tencentHttp();
  let last;
  for (let i = 1; i <= attempts; i++) {
    try {
      return await doFetch(url, dispatcher ? { ...init, dispatcher } : init);
    } catch (err) {
      last = err;
      if (init?.signal?.aborted) throw err;
      if (!isConnectFail(err) || i >= attempts) throw err;
      const wait = 1500 * i;
      console.warn(
        `[Eva] Tencent connect retry ${i}/${attempts} in ${wait}ms:`,
        err?.cause?.code || err?.code || err?.message,
      );
      await sleep(wait);
    }
  }
  throw last;
}

function startWatchdog(controller, { idleMs, hardMs }) {
  const started = Date.now();
  let idleTimer = null;
  const armIdle = () => {
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      try {
        controller.abort();
      } catch (_) {}
    }, idleMs);
  };
  const hardTimer = setTimeout(() => {
    try {
      controller.abort();
    } catch (_) {}
  }, hardMs);
  armIdle();
  return {
    bump() {
      if (Date.now() - started >= hardMs) return;
      armIdle();
    },
    clear() {
      if (idleTimer) clearTimeout(idleTimer);
      clearTimeout(hardTimer);
    },
  };
}

function getTencentLkeConfig() {
  const appKey = String(process.env.TENCENT_LKE_APP_KEY || "").trim();
  const visitorId =
    String(process.env.TENCENT_LKE_VISITOR_ID || "").trim() || "eva-visitor";
  const baseUrl = String(
    process.env.TENCENT_LKE_BASE_URL || DEFAULT_BASE,
  )
    .trim()
    .replace(/\/$/, "");
  const timeoutMs = Number(process.env.TENCENT_LKE_TIMEOUT_MS || 120000);
  return {
    provider: "tencent",
    model: "lke-adp",
    appKey,
    visitorId,
    baseUrl,
    chatUrl: `${baseUrl}${DEFAULT_PATH}`,
    timeoutMs: Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 120000,
  };
}

function loadTencentSession(sessionName) {
  const isDefault = !sessionName || sessionName === "tencent-lke";
  const envConv = String(
    isDefault
      ? process.env.TENCENT_LKE_CONVERSATION_ID || ""
      : process.env.TENCENT_LKE_DRILL_CONVERSATION_ID || "",
  ).trim();
  if (isEphemeralSession(sessionName)) {
    return { conversationId: envConv || newConversationId() };
  }
  try {
    const p = sessionPath(sessionName);
    const raw = fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, "utf8")) : {};
    const conversationId =
      envConv || String(raw.conversationId || "").trim() || newConversationId();
    return { conversationId };
  } catch {
    return { conversationId: envConv || newConversationId() };
  }
}

function saveTencentSession(session, sessionName) {
  if (isEphemeralSession(sessionName)) return session;
  const dir = getDataDir();
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    sessionPath(sessionName),
    JSON.stringify(
      {
        conversationId: session.conversationId,
        updatedAt: new Date().toISOString(),
      },
      null,
      2,
    ),
    "utf8",
  );
  return session;
}

function resetTencentConversation(sessionName) {
  const session = { conversationId: newConversationId() };
  saveTencentSession(session, sessionName);
  return session;
}

function collectContentPieces(contents) {
  const parts = [];
  const list = Array.isArray(contents) ? contents : [];
  for (const c of list) {
    const type = String(c?.Type || "").toLowerCase();
    if ((type === "text" || !type) && c?.Text) {
      parts.push(String(c.Text));
    }
    const url = String(c?.Image?.Url || c?.Image?.url || "").trim();
    if ((type === "image" || url) && /^https?:\/\//i.test(url)) {
      const md = `![](${url})`;
      if (!parts.includes(md)) parts.push(md);
    }
  }
  return parts;
}

function extractReplyText(payload, { replyOnly = false } = {}) {
  const messages = payload?.Response?.Messages || payload?.Messages || [];
  const replies = [];
  for (const msg of messages) {
    const kind = String(msg?.Type || msg?.Name || "").toLowerCase();
    if (kind && kind !== "reply") continue;
    replies.push(...collectContentPieces(msg?.Contents));
  }
  if (replies.length) return replies.join("\n").trim();
  if (replyOnly) return "";
  const fallback = [];
  for (const msg of messages) {
    fallback.push(...collectContentPieces(msg?.Contents));
  }
  return fallback.join("\n").trim();
}

function looksLikeJsonReply(text) {
  const s = String(text || "");
  return /\{[\s\S]*"action"\s*:/.test(s);
}

function assembleByKind(kindById, buffers, wantKinds) {
  const allow = new Set(
    (Array.isArray(wantKinds) ? wantKinds : [wantKinds]).map((k) =>
      String(k || "").toLowerCase(),
    ),
  );
  const keys = [...buffers.keys()].filter((k) => {
    const id = k.split(":")[0];
    return allow.has(String(kindById.get(id) || "").toLowerCase());
  });
  keys.sort((a, b) => {
    const [idA, idxA] = a.split(":");
    const [idB, idxB] = b.split(":");
    if (idA !== idB) return idA.localeCompare(idB);
    return Number(idxA) - Number(idxB);
  });
  return keys.map((k) => buffers.get(k) || "").join("");
}

function assembleBuffers(kindById, buffers) {
  return assembleByKind(kindById, buffers, "reply");
}

function parseSseBlock(block) {
  let eventName = "";
  const dataLines = [];
  for (const rawLine of String(block || "").split(/\r?\n/)) {
    const line = rawLine.trimEnd();
    if (!line || line.startsWith(":")) continue;
    if (line.startsWith("event:")) {
      eventName = line.slice(6).trim().replace(/^"|"$/g, "");
      continue;
    }
    if (line.startsWith("data:")) {
      dataLines.push(line.slice(5).trim());
    }
  }
  const dataStr = dataLines.join("\n").trim();
  if (!dataStr) return null;
  let payload;
  try {
    payload = JSON.parse(dataStr);
  } catch {
    return { eventName, payload: null, raw: dataStr };
  }
  const type = String(payload?.Type || eventName || "").trim();
  return { eventName: type || eventName, payload, raw: dataStr };
}

async function tencentLkeChat(userText, { onProgress, onToken, systemRole, sessionName, attachments, timeoutMs, idleMs, replyOnly, planner } = {}) {
  installSystemCa();
  const cfg = getTencentLkeConfig();
  if (!cfg.appKey) {
    throw new Error(
      "Tencent LKE AppKey missing. Set TENCENT_LKE_APP_KEY in .env, then choose 騰訊雲 mode.",
    );
  }
  const session = loadTencentSession(sessionName);
  saveTencentSession(session, sessionName);

  const progress = (stage, message) => {
    try {
      onProgress?.({ stage, message });
    } catch (_) {}
  };

  let text = String(userText || "").trim();
  let extraContents = [];
  if (Array.isArray(attachments) && attachments.length) {
    progress("think", "正在處理附件…");
    const prepared = await prepareTencentAttachments({
      attachments,
      conversationId: session.conversationId,
      cfg,
      onProgress,
    });
    extraContents = prepared.extraContents || [];
    if (prepared.textPrefix) {
      text = text ? `${prepared.textPrefix}\n\n${text}` : prepared.textPrefix;
    }
    const imageMd = extraContents
      .filter((c) => String(c?.Type || "").toLowerCase() === "image" && c?.Image?.Url)
      .map((c) => `![](${c.Image.Url})`)
      .join("\n");
    if (imageMd) {
      text = text ? `${imageMd}\n${text}` : imageMd;
    }
    console.log(
      `[Eva] Tencent attachments extra=${extraContents.length} types=${extraContents.map((c) => c.Type).join(",") || "none"}`,
    );
  }
  text = text || "請根據附件回答。";

  const role = String(systemRole || "").trim();
  const body = {
    RequestId: newRequestId(),
    ConversationId: session.conversationId,
    AppKey: cfg.appKey,
    Contents: [{ Type: "text", Text: text }, ...extraContents],
    VisitorId: cfg.visitorId,
    Incremental: true,
    EnableMultiIntent: planner ? false : true,
    Stream: "enable",
  };
  if (role) {
    body.SystemRole = role;
  }

  const t0 = nowMs();
  progress("think", extraContents.length ? "附件已就緒，正在連線騰訊雲…" : "正在連線騰訊雲…");
  if (role) {
    console.log(`[Eva] Tencent request with Eva SystemRole chars=${role.length}`);
  }

  const hardMs = Number.isFinite(Number(timeoutMs)) && Number(timeoutMs) > 0
    ? Number(timeoutMs)
    : extraContents.length
      ? Math.max(cfg.timeoutMs, 300000)
      : cfg.timeoutMs;
  const idleWait = Number.isFinite(Number(idleMs)) && Number(idleMs) > 0
    ? Number(idleMs)
    : extraContents.length
      ? 180000
      : Math.min(hardMs, planner || replyOnly ? 150000 : 90000);
  const controller = new AbortController();
  let res;
  try {
    res = await fetchTencent(cfg.chatUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (err) {
    throw wrapChatNetworkError(err);
  }
  const watchdog = startWatchdog(controller, { idleMs: idleWait, hardMs });

  if (!res.ok) {
    watchdog.clear();
    const errBody = await res.text();
    logTiming("Tencent LKE error", t0, `status=${res.status}`);
    throwIfBalanceError(errBody);
    throw new Error(`Tencent LKE error ${res.status}: ${errBody.slice(0, 400)}`);
  }

  const contentType = String(res.headers.get("content-type") || "");
  if (
    !res.body ||
    (contentType.includes("application/json") && !contentType.includes("event-stream"))
  ) {
    watchdog.clear();
    const raw = res.body ? await res.text() : "";
    let parsed = null;
    try {
      parsed = raw ? JSON.parse(raw) : null;
    } catch (_) {}
    const msg =
      parsed?.Error?.Message ||
      parsed?.Message ||
      parsed?.error ||
      raw.slice(0, 400) ||
      "empty body";
    throwIfBalanceError(
      [parsed?.Error?.Code, parsed?.Code, msg, raw.slice(0, 400)].filter(Boolean).join(" "),
    );
    throw new Error(`Tencent LKE unexpected response: ${msg}`);
  }

  const kindById = new Map();
  const buffers = new Map();
  let finalText = "";
  let sseError = null;

  const applyPayload = (parsed) => {
    const payload = parsed?.payload;
    if (!payload) return;
    const type = String(payload.Type || parsed.eventName || "");

    if (type === "error") {
      const err = payload.Error || {};
      const detail = String(
        err.Message || err.Code || payload.Message || payload.Code || "Tencent LKE error",
      );
      if (isTencentBalanceError(detail)) {
        sseError = balanceExhaustedError(detail);
      } else {
        sseError = new Error(detail);
      }
      return;
    }

    if (type === "message.added" || type === "message.processing") {
      const msg = payload.Message || {};
      const id = String(msg.MessageId || payload.MessageId || "");
      const kind = String(msg.Type || msg.Name || "").toLowerCase();
      if (id && kind) kindById.set(id, kind);
      if (kind === "thought") {
        progress("think", String(msg.StatusDesc || "騰訊雲正在思考…"));
      } else if (kind === "reply") {
        progress("think", "騰訊雲正在回答…");
      }
      return;
    }

    if (type === "content.added") {
      const content = payload.Content || {};
      const id = String(payload.MessageId || "");
      const idx = Number.isFinite(Number(payload.ContentIndex))
        ? Number(payload.ContentIndex)
        : 0;
      const key = `${id}:${idx}`;
      const ctype = String(content.Type || "").toLowerCase();
      if (ctype === "text" && content.Text) {
        buffers.set(key, String(content.Text));
      } else if (ctype === "image") {
        const url = String(content.Image?.Url || content.Image?.url || "").trim();
        if (/^https?:\/\//i.test(url)) buffers.set(key, `![](${url})`);
      }
      return;
    }

    if (type === "text.delta" || type === "text.replace") {
      const id = String(payload.MessageId || "");
      const idx = Number.isFinite(Number(payload.ContentIndex))
        ? Number(payload.ContentIndex)
        : 0;
      const key = `${id}:${idx}`;
      const piece = String(payload.Text ?? "");
      if (type === "text.replace") buffers.set(key, piece);
      else buffers.set(key, (buffers.get(key) || "") + piece);
      const kind = kindById.get(id) || "";
      if (kind === "thought") {
        const shown = assembleByKind(kindById, buffers, "thought");
        progress("think", shown ? `思考：${shown.slice(-80)}` : "騰訊雲正在思考…");
      } else if (kind === "reply") {
        const shown = assembleBuffers(kindById, buffers);
        if (shown) {
          try {
            onToken?.(shown);
          } catch (_) {}
          progress("stream", shown.length > 1200 ? `…${shown.slice(-1200)}` : shown);
        }
      }
      return;
    }

    if (type === "response.completed") {
      const fromDone = extractReplyText(payload, { replyOnly: Boolean(replyOnly || planner) });
      const streamed = assembleBuffers(kindById, buffers).trim();
      if (fromDone && streamed.includes("![](") && !fromDone.includes("![](")) {
        finalText = `${fromDone}\n${streamed}`.trim();
      } else {
        finalText = fromDone || streamed;
      }
      if (payload?.Response?.ConversationId) {
        saveTencentSession(
          { conversationId: String(payload.Response.ConversationId) },
          sessionName,
        );
      }
    }
  };

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      watchdog.bump();
      buf += decoder.decode(value, { stream: true });
      let sep;
      while ((sep = buf.indexOf("\n\n")) >= 0) {
        const block = buf.slice(0, sep);
        buf = buf.slice(sep + 2);
        const parsed = parseSseBlock(block);
        if (parsed) applyPayload(parsed);
        if (sseError) throw sseError;
      }
    }
    if (buf.trim()) {
      const parsed = parseSseBlock(buf);
      if (parsed) applyPayload(parsed);
      if (sseError) throw sseError;
    }
  } catch (err) {
    if (isAbortTimeout(err)) {
      const partial = String(assembleBuffers(kindById, buffers) || "").trim();
      if (partial && !(replyOnly || planner)) {
        console.warn("[Eva] Tencent SSE idle/hard timeout, using partial reply");
        logTiming("Tencent LKE chat (partial)", t0, `chars=${partial.length}`);
        return partial;
      }
      if (partial && looksLikeJsonReply(partial)) {
        console.warn("[Eva] Tencent SSE timeout, using partial JSON reply");
        logTiming("Tencent LKE chat (partial json)", t0, `chars=${partial.length}`);
        return partial;
      }
      if (partial) {
        console.warn(
          "[Eva] Tencent SSE timeout; ignoring non-JSON / thought-only partial:",
          partial.slice(0, 120),
        );
      }
      if (replyOnly || planner) {
        throw new Error("騰訊雲規劃超時，未收到完整 JSON 方案。");
      }
      throw wrapChatNetworkError(err);
    }
    throw err;
  } finally {
    watchdog.clear();
  }

  const textOut = String(finalText || assembleBuffers(kindById, buffers) || "").trim();
  logTiming("Tencent LKE chat", t0, `chars=${textOut.length} conv=${session.conversationId}`);
  if (!textOut) {
    throw new Error("Tencent LKE returned an empty reply");
  }
  if ((replyOnly || planner) && !looksLikeJsonReply(textOut)) {
    if (planner) {
      console.log(
        "[Eva] Tencent planner reply is not JSON:",
        textOut.replace(/\s+/g, " ").slice(0, 80),
      );
      return textOut;
    }
    throw new Error(
      `Tencent reply is not JSON (starts: ${textOut.replace(/\s+/g, " ").slice(0, 80)})`,
    );
  }
  return textOut;
}

module.exports = {
  tencentLkeConfigured,
  getTencentLkeConfig,
  loadTencentSession,
  resetTencentConversation,
  tencentLkeChat,
  looksLikeJsonReply,
  isTencentBalanceError,
  tencentBalanceFriendlyMessage,
  TENCENT_BALANCE_CODE: MODEL_BALANCE_CODE,
};
