require("./log.cjs");
const http = require("node:http");
const https = require("node:https");
const crypto = require("node:crypto");
const path = require("node:path");

const eva = require("./index.cjs");
const knowledgeDb = require("./knowledge-db.cjs");
const { kbEnabled } = require("./knowledge.cjs");
const { tencentLkeConfigured } = require("./tencent-lke.cjs");
const { tencentUploadConfigured } = require("./tencent-lke-files.cjs");

function readJsonBody(req, maxBytes = 2 * 1024 * 1024) {
  const limit =
    Number.isFinite(maxBytes) && maxBytes > 0 ? maxBytes : 2 * 1024 * 1024;
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
      if (data.length > limit) {
        reject(new Error("Body too large"));
        req.destroy();
      }
    });
    req.on("end", () => {
      if (!data.trim()) return resolve(null);
      try {
        resolve(JSON.parse(data));
      } catch (err) {
        reject(new Error("Invalid JSON body"));
      }
    });
    req.on("error", reject);
  });
}

function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  });
  res.end(body);
}

function sendSse(res, obj) {
  res.write(`data: ${JSON.stringify(obj)}\n\n`);
}

function ensureApiToken() {
  let token = String(process.env.EVA_API_TOKEN || "").trim();
  if (!token) {
    token = crypto.randomBytes(24).toString("hex");
    process.env.EVA_API_TOKEN = token;
    console.log(`[Eva][API] Generated EVA_API_TOKEN (save to .env): ${token}`);
  }
  return token;
}

function isAllowedMediaHost(hostname) {
  return /(\.myqcloud\.com|\.tencentcloud\.com|\.tencent\.com)$/i.test(
    String(hostname || ""),
  );
}

function proxyMedia(req, res, rawUrl, hops = 0) {
  let target;
  try {
    target = new URL(String(rawUrl || ""));
  } catch {
    sendJson(res, 400, { error: "Invalid media URL" });
    return;
  }
  if (target.protocol !== "https:" && target.protocol !== "http:") {
    sendJson(res, 400, { error: "Invalid media URL" });
    return;
  }
  if (!isAllowedMediaHost(target.hostname)) {
    sendJson(res, 400, { error: "Unsupported media host" });
    return;
  }
  const lib = target.protocol === "https:" ? https : http;
  const maxBytes = 8 * 1024 * 1024;
  const upstream = lib.request(
    {
      protocol: target.protocol,
      hostname: target.hostname,
      port: target.port || (target.protocol === "https:" ? 443 : 80),
      path: `${target.pathname}${target.search}`,
      method: "GET",
      headers: {
        Accept: "*/*",
        "User-Agent": "EvaMedia/1.0",
      },
      family: 4,
      timeout: 25000,
    },
    (up) => {
      if (up.statusCode >= 300 && up.statusCode < 400 && up.headers.location) {
        up.resume();
        if (hops >= 3) {
          sendJson(res, 502, { error: "Too many redirects" });
          return;
        }
        try {
          proxyMedia(req, res, new URL(up.headers.location, target).toString(), hops + 1);
        } catch {
          sendJson(res, 502, { error: "Invalid redirect" });
        }
        return;
      }
      const type = String(up.headers["content-type"] || "application/octet-stream");
      if (up.statusCode >= 400) {
        res.writeHead(up.statusCode, {
          "Content-Type": type,
          "Access-Control-Allow-Origin": "*",
        });
        up.pipe(res);
        return;
      }
      res.writeHead(200, {
        "Content-Type": type,
        "Content-Disposition": "inline",
        "Cache-Control": "private, max-age=3600",
        "Access-Control-Allow-Origin": "*",
      });
      let seen = 0;
      up.on("data", (chunk) => {
        seen += chunk.length;
        if (seen > maxBytes) {
          up.destroy();
          res.destroy();
        }
      });
      up.pipe(res);
    },
  );
  upstream.on("error", () => {
    if (!res.headersSent) sendJson(res, 502, { error: "Media fetch failed" });
    else res.destroy();
  });
  upstream.on("timeout", () => upstream.destroy());
  upstream.end();
}

function checkAuth(req, res, token) {
  const auth = String(req.headers.authorization || "");
  const expected = `Bearer ${token}`;
  if (auth !== expected) {
    sendJson(res, 401, { error: "Unauthorized" });
    return false;
  }
  return true;
}

function startServer(options = {}) {
  const token = ensureApiToken();
  const host = String(options.host || process.env.EVA_API_HOST || "0.0.0.0").trim();
  const port = Number(options.port || process.env.EVA_API_PORT || 8787);

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
    const pathname = url.pathname;

    if (req.method === "OPTIONS") {
      res.writeHead(204, {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Authorization, Content-Type",
        "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
      });
      res.end();
      return;
    }

    if (req.method === "GET" && pathname === "/api/media") {
      proxyMedia(req, res, url.searchParams.get("u"));
      return;
    }

    if (!checkAuth(req, res, token)) return;

    try {
      if (req.method === "GET" && pathname === "/api/health") {
        const prefs = eva.loadPrefs();
        sendJson(res, 200, {
          ok: true,
          kb: kbEnabled() && knowledgeDb.isReady(),
          chatMode: prefs.chatMode || "eva",
          tencent: tencentLkeConfigured(),
          tencentUpload: tencentUploadConfigured(),
        });
        return;
      }

      if (req.method === "GET" && pathname === "/api/history") {
        sendJson(res, 200, eva.loadChatHistory());
        return;
      }

      if (req.method === "PUT" && pathname === "/api/history") {
        const body = await readJsonBody(req);
        if (!Array.isArray(body)) {
          sendJson(res, 400, { error: "Expected array body" });
          return;
        }
        sendJson(res, 200, eva.saveChatHistory(body));
        return;
      }

      if (req.method === "DELETE" && pathname === "/api/history") {
        sendJson(res, 200, eva.clearChatHistory());
        return;
      }

      if (req.method === "GET" && pathname === "/api/prefs") {
        sendJson(res, 200, eva.loadPrefs());
        return;
      }

      if (req.method === "PATCH" && pathname === "/api/prefs") {
        const body = await readJsonBody(req);
        sendJson(res, 200, eva.savePrefs(body || {}));
        return;
      }

      if (req.method === "POST" && pathname === "/api/chat") {
        const body = await readJsonBody(req, 12 * 1024 * 1024);
        const messages = body?.messages;
        if (!Array.isArray(messages)) {
          sendJson(res, 400, { error: "Expected { messages: [...] }" });
          return;
        }

        res.writeHead(200, {
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Headers": "Authorization, Content-Type",
        });

        let answer = "";
        try {
          answer = await eva.askChat(messages, {
            attachments: body?.attachments,
            onProgress: (info) => {
              const stage = info?.stage || "think";
              const message = String(info?.message ?? "");
              if (stage === "done") return;
              sendSse(res, { stage, message });
            },
          });
          sendSse(res, { stage: "answer", message: answer });
          sendSse(res, { stage: "done", message: "完成" });
        } catch (err) {
          console.error("[Eva][API] /api/chat error:", err?.stack || err?.message || err);
          sendSse(res, {
            stage: "error",
            message: `Server error: ${String(err?.message || err)}`,
          });
        }
        res.end();
        return;
      }

      sendJson(res, 404, { error: "Not found" });
    } catch (err) {
      if (!res.headersSent) {
        sendJson(res, 500, { error: String(err?.message || err) });
      } else {
        try {
          sendSse(res, { stage: "error", message: String(err?.message || err) });
          res.end();
        } catch (_) {}
      }
    }
  });

  return new Promise((resolve, reject) => {
    server.on("error", reject);
    server.listen(port, host, () => {
      console.log(`[Eva][API] Listening on http://${host}:${port}`);
      resolve(server);
    });
  });
}

if (require.main === module) {
  const repoRoot = path.join(__dirname, "..");
  const overlayData = path.join(repoRoot, "overlay", "data");
  eva.loadEnvFile(repoRoot);
  eva.setDataDir(overlayData);
  (async () => {
    try {
      await eva.initKnowledgeDb();
    } catch (err) {
      console.warn("[Eva][KB] init skipped:", err?.message || err);
    }
    await startServer();
    eva.warmLlmModel().catch(() => {});
  })().catch((err) => {
    console.error("[Eva][API] Failed to start:", err?.message || err);
    process.exit(1);
  });
}

module.exports = { startServer, ensureApiToken };
