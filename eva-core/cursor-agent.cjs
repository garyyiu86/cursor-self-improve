const { getRepoRoot } = require("./env.cjs");
const { installSystemCa } = require("./tls-ca.cjs");

function cursorApiKey() {
  return String(process.env.CURSOR_API_KEY || "").trim();
}

function cursorModelId() {
  return String(process.env.EVA_EVOLVE_CURSOR_MODEL || "composer-2.5").trim() || "composer-2.5";
}

function cursorModel() {
  const id = cursorModelId();
  const fastOff = String(process.env.EVA_EVOLVE_CURSOR_FAST || "0").trim() === "0";
  if (fastOff) return { id };
  return { id, params: [{ id: "fast", value: "true" }] };
}

function hardTimeoutMs() {
  const n = Number(process.env.EVA_EVOLVE_CURSOR_TIMEOUT_MS || 720000);
  return Number.isFinite(n) && n >= 30000 ? n : 720000;
}

function idleTimeoutMs() {
  const n = Number(process.env.EVA_EVOLVE_CURSOR_IDLE_MS || 240000);
  return Number.isFinite(n) && n >= 15000 ? n : 240000;
}

function firstEventGraceMs() {
  const n = Number(process.env.EVA_EVOLVE_CURSOR_GRACE_MS || 300000);
  return Number.isFinite(n) && n >= 15000 ? n : 300000;
}

function createTimeoutMs() {
  const n = Number(process.env.EVA_EVOLVE_CURSOR_CREATE_MS || 45000);
  return Number.isFinite(n) && n >= 5000 ? n : 45000;
}

function forceLocalRun() {
  return String(process.env.EVA_EVOLVE_CURSOR_FORCE || "").trim() === "1";
}

const EXECUTOR_BUSY_HINT =
  "只開 Cursor IDE 睇檔／手打 code 唔會阻。會阻嘅係同一個 repo 已經有 Agent 對話（包括 Cursor 入面呢個 chat）。請等嗰個對話停，或者另開一個唔係 Agent 嘅視窗，再跑 npm run eva:evolve。";

function argPath(args) {
  if (!args || typeof args !== "object") return "";
  const raw =
    args.path ||
    args.file ||
    args.target ||
    args.file_path ||
    args.filePath ||
    args.relative_path ||
    "";
  return String(raw || "").replace(/\\/g, "/").slice(-72);
}

const STALL_AFTER_START =
  "Cursor 接咗任務但之後冇再出改檔／思考事件。常見原因：Cursor IDE 同一個 repo 開住 Agent 對話（執行器排隊），或 Electron 未用系統 CA 連 Cursor API。";

function formatCursorEvent(event) {
  const type = String(event?.type || "");
  if (type === "tool_call") {
    const name = String(event.name || "tool");
    const status = String(event.status || "");
    const extra = argPath(event.args);
    if (status === "running") {
      return extra ? `Cursor 正在 ${name}：${extra}` : `Cursor 正在 ${name}`;
    }
    if (status === "error") {
      return `Cursor 工具失敗：${name}`;
    }
    return `Cursor 完成 ${name}`;
  }
  if (type === "thinking") {
    const t = String(event.text || "")
      .replace(/\s+/g, " ")
      .trim();
    if (t.length >= 8) return `Cursor 思考：${t.slice(-80)}`;
    return "Cursor 思考中";
  }
  if (type === "assistant") return "Cursor 正在寫結果";
  if (type === "status") {
    const st = String(event.status || "");
    if (st && st !== "RUNNING" && st !== "CREATING") return `Cursor 狀態：${st}`;
  }
  return null;
}

function isWorkEvent(event) {
  const type = String(event?.type || "");
  return (
    type === "tool_call" ||
    type === "thinking" ||
    type === "assistant" ||
    type === "usage"
  );
}

function isExecutorBusyError(err) {
  const msg = String(err?.message || err || "");
  return /執行器|冇回傳進度|冇進度|冇新進度|接咗任務但/.test(msg);
}

async function disposeAgent(agent) {
  if (!agent) return;
  try {
    if (typeof agent[Symbol.asyncDispose] === "function") {
      await agent[Symbol.asyncDispose]();
      return;
    }
  } catch (_) {}
  try {
    if (typeof agent.close === "function") await agent.close();
  } catch (_) {}
}

async function cancelRun(run) {
  if (!run) return;
  try {
    if (typeof run.supports === "function" && !run.supports("cancel")) return;
    if (typeof run.cancel === "function") await run.cancel();
  } catch (err) {
    console.warn("[Eva][cursor] cancel failed:", err?.message || err);
  }
}

function withTimeout(promise, ms, label) {
  let timer = null;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`${label} 逾時（${Math.round(ms / 1000)} 秒）`));
    }, ms);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

async function runCursorPrompt(prompt, { cwd, onProgress } = {}) {
  const apiKey = cursorApiKey();
  if (!apiKey) {
    throw new Error(
      "Missing CURSOR_API_KEY in .env. Create one at https://cursor.com/dashboard/api",
    );
  }
  const text = String(prompt || "").trim();
  if (!text) throw new Error("Empty Cursor prompt.");

  installSystemCa();

  const hardMs = hardTimeoutMs();
  const idleMs = idleTimeoutMs();
  const graceMs = firstEventGraceMs();
  const { Agent } = await import("@cursor/sdk");

  const notify = (message) => {
    try {
      onProgress?.({ stage: "think", message });
    } catch (_) {}
  };

  notify("正在啟動 Cursor Agent…");
  const agent = await withTimeout(
    Agent.create({
      apiKey,
      model: cursorModel(),
      mode: "agent",
      local: { cwd: cwd || getRepoRoot(), settingSources: [] },
    }),
    createTimeoutMs(),
    "啟動 Cursor Agent",
  );

  const started = Date.now();
  let lastEvent = Date.now();
  let sawWork = false;
  let inFlightTools = 0;
  let run = null;
  let stopping = false;
  let stopReason = "";

  const elapsedSec = () => Math.max(1, Math.round((Date.now() - started) / 1000));

  const markWork = (tip) => {
    lastEvent = Date.now();
    sawWork = true;
    if (tip) notify(`${tip}（${elapsedSec()}s）`);
  };

  const requestStop = (reason) => {
    if (stopping) return;
    stopping = true;
    stopReason = reason;
    console.warn("[Eva][cursor] stopping:", reason, "run", run?.id || "-");
    notify(reason);
    cancelRun(run).catch(() => {});
  };

  const tick = setInterval(() => {
    const elapsed = Date.now() - started;
    const idle = Date.now() - lastEvent;
    if (inFlightTools > 0) {
      notify(`Cursor 工具仍在跑（${inFlightTools}）…已過 ${elapsedSec()} 秒`);
      if (elapsed >= hardMs) {
        requestStop(`Cursor 超過 ${Math.round(hardMs / 1000)} 秒仍未完成，已取消。`);
      }
      return;
    }
    if (!sawWork) {
      notify(
        `Cursor 已接單，尚未開始改檔（已等 ${elapsedSec()} 秒）。${EXECUTOR_BUSY_HINT}`,
      );
      if (elapsed >= graceMs) {
        requestStop(
          `Cursor 本地執行器 ${Math.round(graceMs / 1000)} 秒內冇真正改檔。${EXECUTOR_BUSY_HINT}`,
        );
      }
      return;
    }
    notify(`Cursor 改緊 code…已過 ${elapsedSec()} 秒`);
    if (elapsed >= hardMs) {
      requestStop(`Cursor 超過 ${Math.round(hardMs / 1000)} 秒仍未完成，已取消。`);
    } else if (idle >= idleMs) {
      requestStop(
        `Cursor 開始之後 ${Math.round(idleMs / 1000)} 秒冇新進度，已取消。${STALL_AFTER_START}`,
      );
    }
  }, 15000);

  try {
    const sendOpts = {
      mode: "agent",
      onDelta: ({ update } = {}) => {
        const kind = String(update?.type || "");
        if (
          kind.includes("tool") ||
          kind.includes("text") ||
          kind.includes("thinking")
        ) {
          markWork(null);
        }
      },
      onStep: ({ step }) => {
        const kind = String(step?.type || "step");
        markWork(`Cursor 步驟：${kind}`);
      },
    };
    if (forceLocalRun()) {
      sendOpts.local = { force: true };
    }

    run = await withTimeout(agent.send(text, sendOpts), 30000, "送出 Cursor 任務");
    console.log(
      "[Eva][cursor] run",
      run.id,
      "agent",
      run.agentId || agent.agentId,
      "force",
      forceLocalRun(),
    );
    notify(
      `已交俾 Cursor 本地執行器（上限 ${Math.round(hardMs / 1000)} 秒；等第一下進度 ${Math.round(graceMs / 1000)} 秒）`,
    );

    const streamDone = (async () => {
      try {
        for await (const event of run.stream()) {
          const type = String(event?.type || "");
          const status = String(event?.status || "");
          if (type === "tool_call") {
            if (status === "running") inFlightTools += 1;
            if (status === "completed" || status === "error") {
              inFlightTools = Math.max(0, inFlightTools - 1);
            }
          }
          if (isWorkEvent(event)) {
            markWork(formatCursorEvent(event));
          }
        }
      } catch (err) {
        if (!stopping) {
          console.warn("[Eva][cursor] stream ended:", err?.message || err);
        }
      }
    })();

    const result = await withTimeout(
      run.wait(),
      hardMs + 5000,
      "等待 Cursor 完成",
    );
    await Promise.race([streamDone, new Promise((r) => setTimeout(r, 1500))]);

    if (stopping || result.status === "cancelled") {
      throw new Error(
        stopReason ||
          `Cursor 已取消（${elapsedSec()} 秒）。${EXECUTOR_BUSY_HINT}`,
      );
    }
    if (result.status === "error") {
      const msg = String(result.error?.message || "").trim();
      throw new Error(
        `Cursor agent error (run ${result.id})${msg ? `: ${msg}` : ""}`,
      );
    }
    return (
      String(result.result ?? "").trim() ||
      "(Cursor finished with empty summary)"
    );
  } finally {
    clearInterval(tick);
    if (stopping) {
      await cancelRun(run);
    }
    await disposeAgent(agent);
  }
}

module.exports = {
  cursorApiKey,
  cursorModelId,
  runCursorPrompt,
  hardTimeoutMs,
  isExecutorBusyError,
};
