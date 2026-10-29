require("./log.cjs");
const http = require("node:http");
const https = require("node:https");
const crypto = require("node:crypto");
const path = require("node:path");

const eva = require("./index.cjs");
const knowledgeDb = require("./knowledge-db.cjs");
const { kbEnabled } = require("./knowledge.cjs");
const { tencentLkeConfigured } = require("./tencent-lke.cjs");
const { resolveBalanceFallback, stripLastAssistantReply } = require("./chat-service.cjs");
const { tencentUploadConfigured } = require("./tencent-lke-files.cjs");
const { attachWsSync } = require("./ws-sync.cjs");

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
        const saved = eva.saveChatHistory(body);
        wsSync?.broadcastHistory(saved);
        sendJson(res, 200, saved);
        return;
      }

      if (req.method === "DELETE" && pathname === "/api/history") {
        const cleared = eva.clearChatHistory();
        wsSync?.broadcastHistory(cleared);
        sendJson(res, 200, cleared);
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

      if (req.method === "GET" && pathname === "/api/workout/library") {
        const { getExercises, MUSCLE_GROUPS, MUSCLE_GROUP_META } = await import(
          "./services/exerciseLibrary.js"
        );
        const muscleGroup = String(url.searchParams.get("muscleGroup") || "").trim();
        const difficulty = String(url.searchParams.get("difficulty") || "").trim();
        const filter = {};
        if (muscleGroup) filter.muscleGroup = muscleGroup;
        if (difficulty) filter.difficulty = difficulty;
        sendJson(res, 200, {
          muscleGroups: MUSCLE_GROUPS,
          meta: MUSCLE_GROUP_META,
          exercises: getExercises(filter),
        });
        return;
      }

      if (req.method === "GET" && pathname === "/api/workout/plan") {
        const { generateWeeklyPlan } = await import("./services/workoutGenerator.js");
        const muscleGroup = String(url.searchParams.get("muscleGroup") || "biceps").trim();
        const difficulty = String(url.searchParams.get("difficulty") || "beginner").trim();
        sendJson(res, 200, generateWeeklyPlan(muscleGroup, difficulty));
        return;
      }

      if (req.method === "GET" && pathname === "/api/workout/progress") {
        const tracker = await import("./services/workoutTracker.js");
        const planId = String(url.searchParams.get("planId") || "biceps-beginner-weekly").trim();
        const state = tracker.loadProgress(planId);
        sendJson(res, 200, {
          ...state,
          streak: tracker.computeStreak(state.completedDays),
        });
        return;
      }

      if (req.method === "GET" && pathname === "/api/workout/progress-stats") {
        const { getProgressStatsForPlan } = await import("./services/progressStats.js");
        const { generateWeeklyPlan } = await import("./services/workoutGenerator.js");
        const planId = String(url.searchParams.get("planId") || "biceps-beginner-weekly").trim();
        const muscleGroup = String(url.searchParams.get("muscleGroup") || "biceps").trim();
        const difficulty = String(url.searchParams.get("difficulty") || "beginner").trim();
        const yearParam = url.searchParams.get("year");
        const monthParam = url.searchParams.get("month");
        const options = {};
        if (yearParam != null && yearParam !== "") {
          options.year = Number(yearParam);
        }
        if (monthParam != null && monthParam !== "") {
          options.month = Number(monthParam);
        }
        const plan = generateWeeklyPlan(muscleGroup, difficulty);
        sendJson(res, 200, getProgressStatsForPlan(planId, plan, options));
        return;
      }

      if (req.method === "PATCH" && pathname === "/api/workout/progress") {
        const body = await readJsonBody(req);
        const planId = String(body?.planId || "biceps-beginner-weekly").trim();
        const dayId = String(body?.dayId || "").trim();
        const exerciseId = String(body?.exerciseId || "").trim();
        const done = body?.done !== false;
        if (!dayId || !exerciseId) {
          sendJson(res, 400, { error: "Expected planId, dayId, exerciseId" });
          return;
        }
        const { generateWeeklyPlan } = await import("./services/workoutGenerator.js");
        const tracker = await import("./services/workoutTracker.js");
        const muscleGroup = String(body?.muscleGroup || "biceps").trim();
        const difficulty = String(body?.difficulty || "beginner").trim();
        const plan = generateWeeklyPlan(muscleGroup, difficulty);
        const current = tracker.loadProgress(planId);
        const result = tracker.toggleExercise(plan, dayId, exerciseId, done, current);
        sendJson(res, 200, {
          ...result.state,
          streak: result.streak,
          milestone: result.milestone,
          dayProgress: result.dayProgress,
        });
        return;
      }

      if (req.method === "GET" && pathname === "/api/events") {
        const { getUpcomingEvents } = await import("./services/event-service.js");
        sendJson(res, 200, { events: getUpcomingEvents() });
        return;
      }

      const eventMatch = pathname.match(/^\/api\/events\/([^/]+)$/);
      if (req.method === "GET" && eventMatch) {
        const { getEventById, getSetlist, getCheeringGuide, getCountdown } =
          await import("./services/event-service.js");
        const eventId = decodeURIComponent(eventMatch[1]);
        const event = getEventById(eventId);
        if (!event) {
          sendJson(res, 404, { error: "Event not found" });
          return;
        }
        sendJson(res, 200, {
          event,
          setlist: getSetlist(eventId),
          cheeringGuide: getCheeringGuide(eventId),
          countdown: getCountdown(event.date),
        });
        return;
      }

      if (req.method === "GET" && pathname === "/api/training-plans") {
        const { listTrainingPlans } = await import("./services/trainingService.js");
        sendJson(res, 200, { plans: listTrainingPlans() });
        return;
      }

      const trainingPlanMatch = pathname.match(/^\/api\/training-plans\/([^/]+)$/);
      if (req.method === "GET" && trainingPlanMatch) {
        const { getTrainingPlanById } = await import("./services/trainingService.js");
        const plan = getTrainingPlanById(decodeURIComponent(trainingPlanMatch[1]));
        if (!plan) {
          sendJson(res, 404, { error: "Training plan not found" });
          return;
        }
        sendJson(res, 200, plan);
        return;
      }

      if (req.method === "POST" && pathname === "/api/training-plans") {
        const body = await readJsonBody(req);
        const muscleGroup = String(body?.muscleGroup || "biceps").trim();
        const difficulty = String(body?.difficulty || "beginner").trim();
        const source = body?.source === "chat" ? "chat" : "planner";
        const { generateAndSavePlan } = await import("./services/trainingService.js");
        sendJson(res, 201, generateAndSavePlan(muscleGroup, difficulty, source));
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
        const chatMessages =
          body?.regenerate === true ? stripLastAssistantReply(messages) : messages;
        try {
          answer = await eva.askChat(chatMessages, {
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
          const fallback = resolveBalanceFallback(err, { logTag: "[Eva][API]" });
          if (fallback) {
            sendSse(res, { stage: "answer", message: fallback.message });
            sendSse(res, { stage: "done", message: "完成" });
          } else {
            console.error("[Eva][API] /api/chat error:", err?.stack || err?.message || err);
            sendSse(res, {
              stage: "error",
              message: `Server error: ${String(err?.message || err)}`,
            });
          }
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

  let wsSync = attachWsSync(server, {
    getToken: () => token,
    loadHistory: () => eva.loadChatHistory(),
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
    await startServer();
    eva.initKnowledgeDb().catch((err) => {
      console.warn("[Eva][KB] init skipped:", err?.message || err);
    });
    eva.warmLlmModel().catch(() => {});
  })().catch((err) => {
    console.error("[Eva][API] Failed to start:", err?.message || err);
    process.exit(1);
  });
}

module.exports = { startServer, ensureApiToken };
