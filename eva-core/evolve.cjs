const fs = require("node:fs");
const path = require("node:path");
const { execFileSync, execSync } = require("node:child_process");
const { getRepoRoot, getDataDir } = require("./env.cjs");
const { loadPersona } = require("./persona.cjs");
const { loadChatHistory } = require("./history.cjs");
const {
  tencentLkeConfigured,
  tencentLkeChat,
  resetTencentConversation,
} = require("./tencent-lke.cjs");
const { cursorApiKey, runCursorPrompt, isExecutorBusyError } = require("./cursor-agent.cjs");

const EVOLVE_SESSION = "tencent-lke-evolve";
const SKIP_DIR = new Set([
  "node_modules",
  "dist",
  ".git",
  "data",
  "backups",
  "android",
  ".cursor",
]);

let evolveLock = false;

function maxRounds() {
  const n = Number(process.env.EVA_EVOLVE_MAX_ROUNDS || 4);
  return Number.isFinite(n) && n > 0 ? Math.min(8, Math.floor(n)) : 4;
}

function normRel(p) {
  return String(p || "")
    .replace(/\\/g, "/")
    .replace(/^\.\//, "")
    .replace(/^\/+/, "");
}

function isForbiddenRel(rel) {
  const n = normRel(rel);
  if (!n) return true;
  if (n === ".env" || n.startsWith(".env.")) return true;
  if (n.startsWith("overlay/data/")) return true;
  if (n.includes("/node_modules/") || n.startsWith("node_modules/")) return true;
  if (n.startsWith("backups/")) return true;
  if (/(^|\/)\.git(\/|$)/.test(n)) return true;
  if (/(credential|secret|private.?key)/i.test(n)) return true;
  return false;
}

function isAllowedRel(rel) {
  const n = normRel(rel);
  if (isForbiddenRel(n)) return false;
  if (n.startsWith("sample/")) return false;
  return (
    n.startsWith("eva-core/") ||
    n.startsWith("eva-web/src/") ||
    n === "eva-web/index.html" ||
    n === "eva-web/package.json" ||
    n.startsWith("overlay/") ||
    n === "EVA.md" ||
    n === "package.json"
  );
}

function git(args, { ignoreError = false } = {}) {
  try {
    return execFileSync("git", args, {
      cwd: getRepoRoot(),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  } catch (err) {
    if (ignoreError) {
      return String(err.stdout || err.stderr || err.message || "").trim();
    }
    throw err;
  }
}

function changedRelPaths() {
  const out = git(["status", "--porcelain"], { ignoreError: true });
  const files = [];
  for (const line of out.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const rel = normRel(line.slice(3).replace(/.* -> /, ""));
    if (rel) files.push(rel);
  }
  return files;
}

function revertDisallowed(files) {
  const reverted = [];
  for (const rel of files) {
    if (isAllowedRel(rel)) continue;
    git(["checkout", "--", rel], { ignoreError: true });
    reverted.push(rel);
    if (!isForbiddenRel(rel)) continue;
    const abs = path.join(getRepoRoot(), rel);
    try {
      if (fs.existsSync(abs) && fs.statSync(abs).isFile()) fs.unlinkSync(abs);
    } catch (_) {}
  }
  return reverted;
}

function collectTree(dir, rel, depth, acc) {
  if (acc.length >= 80 || depth > 3) return;
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  entries.sort((a, b) => a.name.localeCompare(b.name));
  for (const ent of entries) {
    if (acc.length >= 80) return;
    if (ent.name.startsWith(".") && ent.name !== ".env.example") continue;
    if (SKIP_DIR.has(ent.name)) continue;
    const childRel = rel ? `${rel}/${ent.name}` : ent.name;
    const childAbs = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      acc.push(`${childRel}/`);
      collectTree(childAbs, childRel, depth + 1, acc);
    } else if (/\.(cjs|js|ts|tsx|css|html|md|json)$/i.test(ent.name)) {
      acc.push(childRel);
    }
  }
}

function clip(s, n) {
  const t = String(s || "").trim();
  if (t.length <= n) return t;
  return `${t.slice(0, n)}\n…(truncated)`;
}

function formatChatIntent(historyMessages) {
  const src = Array.isArray(historyMessages) && historyMessages.length
    ? historyMessages
    : loadChatHistory();
  const lines = [];
  for (const m of src.slice(-8)) {
    if (!m || (m.role !== "user" && m.role !== "assistant")) continue;
    const c = String(m.content || "");
    if (
      c.startsWith("自動進化") ||
      c.startsWith("Applying with Cursor") ||
      c.startsWith("Cursor apply")
    ) {
      continue;
    }
    lines.push(`${m.role === "user" ? "User" : "Eva"}: ${clip(c, 420)}`);
  }
  return lines.join("\n\n") || "(no recent chat)";
}

function repoSnapshot() {
  const root = getRepoRoot();
  const tree = [];
  collectTree(path.join(root, "eva-core"), "eva-core", 0, tree);
  collectTree(path.join(root, "eva-web", "src"), "eva-web/src", 0, tree);
  collectTree(path.join(root, "overlay"), "overlay", 0, tree);
  const status = git(["status", "-sb"], { ignoreError: true }).slice(0, 1200);
  const log = git(["log", "-5", "--oneline"], { ignoreError: true }).slice(0, 600);
  return [
    "Allowed edit prefixes: eva-core/, eva-web/src/, overlay/ (not overlay/data/), EVA.md, package.json",
    "Never touch: .env, overlay/data, sample/, secrets, git config",
    "",
    "Tree:",
    tree.join("\n"),
    "",
    "git status:",
    status || "(clean)",
    "",
    "recent commits:",
    log || "(none)",
    "",
    "persona:",
    clip(loadPersona(), 280),
  ].join("\n");
}

function plannerSystemRole() {
  return [
    "You are Eva's evolution planner. Reply with one JSON object only.",
    "Default is ALWAYS implement. Round 1 must be implement.",
    "Each round is ONE coherent product improvement. It may touch several files.",
    "Prefer: real UX/bugs/features, chat reliability, overlay/API, accessibility, missing polish.",
    "You MAY create new files under allowed dirs if needed for that improvement.",
    "Forbidden: .env, overlay/data, sample/, secrets, git commit, unrelated refactors.",
    "Do not return action=stop just because the schema mentions it.",
    "Only use action=stop after a successful implement in this same run, and only with a real 粵語 reason of at least 16 characters.",
    "JSON shape:",
    '{"action":"implement","title":"history load timeout","goal":"Stop the chat UI hanging on Loading chat history","userSummary":"載入紀錄失敗要即時顯示，唔好永遠 Loading","files":["eva-web/src/api.js","eva-web/src/main.js"],"acceptance":["fetch times out","empty state shown"],"cursorPrompt":"Add 8s AbortSignal.timeout on /api/history and /api/prefs. If pull fails, render empty/error instead of leaving Loading chat history."}',
  ].join("\n");
}

function isVagueStop(spec) {
  if (!spec || spec.action !== "stop") return false;
  const reason = String(spec.reason || spec.userSummary || "")
    .trim()
    .toLowerCase();
  if (reason.length < 16) return true;
  return /^(stop|none|ok|n\/a|already good|no change|沒有|冇|停)$/i.test(reason);
}

function extractJsonObject(text) {
  const s = String(text || "");
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fence ? fence[1] : s;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(raw.slice(start, end + 1));
  } catch {
    return null;
  }
}

function parseSpec(text) {
  const obj = extractJsonObject(text);
  if (!obj || typeof obj !== "object") return null;
  const action = String(obj.action || "").trim().toLowerCase();
  const userSummary = String(obj.userSummary || "").trim();
  if (action === "stop") {
    return {
      action: "stop",
      reason: String(obj.reason || obj.goal || "stop").trim() || "stop",
      userSummary,
    };
  }
  if (action !== "implement") return null;
  const files = Array.isArray(obj.files)
    ? obj.files.map((f) => normRel(f)).filter(Boolean)
    : [];
  const allowedFiles = files.filter(isAllowedRel).slice(0, 8);
  if (!allowedFiles.length) return null;
  return {
    action: "implement",
    title: String(obj.title || "improvement").trim() || "improvement",
    goal: String(obj.goal || "").trim(),
    userSummary,
    files: allowedFiles,
    acceptance: Array.isArray(obj.acceptance)
      ? obj.acceptance.map((x) => String(x || "").trim()).filter(Boolean).slice(0, 6)
      : [],
    cursorPrompt: clip(String(obj.cursorPrompt || obj.goal || "").trim(), 2400),
  };
}

function describeChanges(files) {
  const list = Array.isArray(files) ? files.filter(Boolean) : [];
  if (!list.length) return { diffStat: "", diff: "" };
  const tracked = [];
  const untracked = [];
  for (const rel of list) {
    const listed = git(["ls-files", "--", rel], { ignoreError: true });
    if (listed) tracked.push(rel);
    else untracked.push(rel);
  }
  let diffStat = tracked.length
    ? git(["diff", "--stat", "--", ...tracked], { ignoreError: true })
    : "";
  const diff = tracked.length
    ? git(["diff", "--", ...tracked], { ignoreError: true })
    : "";
  if (untracked.length) {
    diffStat = [diffStat, untracked.map((f) => `${f} (new)`).join("\n")]
      .filter(Boolean)
      .join("\n");
  }
  return { diffStat: clip(diffStat, 1500), diff: clip(diff, 6000) };
}

function evolveLogJsonPath() {
  return path.join(getDataDir(), "evolve-log.json");
}

function evolveLogMdPath() {
  return path.join(getDataDir(), "evolve-log.md");
}

function loadEvolveHistory() {
  try {
    const raw = JSON.parse(fs.readFileSync(evolveLogJsonPath(), "utf8"));
    if (Array.isArray(raw)) return raw;
    if (Array.isArray(raw?.runs)) return raw.runs;
    if (raw && raw.startedAt) return [raw];
  } catch (_) {}
  return [];
}

function tencentRequestFrom(spec, raw) {
  const s = spec && typeof spec === "object" ? spec : {};
  return {
    raw: clip(raw, 3500),
    action: s.action || "",
    title: s.title || "",
    goal: s.goal || "",
    userSummary: s.userSummary || "",
    filesRequested: Array.isArray(s.files) ? s.files : [],
    cursorPrompt: clip(s.cursorPrompt || "", 2400),
    acceptance: Array.isArray(s.acceptance) ? s.acceptance : [],
    stopReason: s.reason || "",
  };
}

function failReasonFor(status, extra = {}) {
  const detail = clip(String(extra.detail || ""), 400);
  const cursorSummary = clip(String(extra.cursorSummary || ""), 240);
  const verify = clip(String(extra.verify || extra.verifyLog || ""), 400);
  if (status === "ok") return "";
  if (status === "parse-fail") {
    return `騰訊雲回覆解析唔到（要 JSON，action=implement，files 要係允許目錄，最多 8 個檔）。原文開頭：${clip(extra.raw, 180)}`;
  }
  if (status === "stopped") {
    const why = clip(extra.userSummary || extra.stopReason || detail || "", 200);
    if (isVagueStop({ action: "stop", reason: why, userSummary: why })) {
      return "騰訊雲回咗空嘅 {action:stop}，冇講點解停。多數係跟咗 schema 範例，唔代表已經冇嘢可改。";
    }
    return `騰訊雲決定今輪唔改：${why || "stop"}`;
  }
  if (status === "cursor-fail") {
    if (isExecutorBusyError(detail)) {
      return `Cursor 執行器排唔到隊／冇進度，所以騰訊嗰個改動未落地。${detail}`;
    }
    return `Cursor 改 code 失敗：${detail || "未知錯誤"}`;
  }
  if (status === "verify-fail") {
    return `Cursor 有改檔但檢查唔過（語法或 eva-web build）。${verify || detail}`;
  }
  if (status === "no-change") {
    const reverted = extra.reverted?.length
      ? ` 另有唔准改嘅檔被還原：${extra.reverted.join(", ")}。`
      : "";
    return `Cursor 跑完但允許目錄冇檔案變動。${cursorSummary ? `Cursor 話：${cursorSummary}` : "可能已經改過、或者改咗唔准動嘅檔。"}${reverted}`;
  }
  return detail || String(status);
}

function formatChatSummary(results, rounds) {
  const applied = results.filter((r) => r.status === "ok" && r.files?.length);
  const lines = ["自動進化"];
  if (applied.length) {
    lines.push("呢次改咗：");
    applied.forEach((r, i) => {
      const what = clip(r.userSummary || r.goal || r.title, 80).replace(/\s+/g, " ");
      const names = (r.files || [])
        .map((f) => String(f).split("/").pop())
        .slice(0, 8)
        .join("、");
      lines.push(`${i + 1}. ${what}${names ? `（${names}）` : ""}`);
    });
  } else {
    lines.push("呢輪未有成功落地嘅改動。");
  }
  for (const r of results) {
    const want = clip(
      r.userSummary || r.goal || r.tencentRequest?.cursorPrompt || r.title || "",
      56,
    ).replace(/\s+/g, " ");
    if (r.status === "ok") continue;
    if (r.status === "stopped") {
      lines.push(`第${r.round}輪騰訊要求停：${clip(r.failReason || want, 80)}`);
      continue;
    }
    const asked = want ? `想改「${want}」` : "有方案";
    lines.push(
      `第${r.round}輪騰訊${asked}；實現唔到：${clip(r.failReason || r.detail || r.status, 90)}`,
    );
  }
  lines.push(`詳細 log：overlay/data/evolve-log.md（${results.length}/${rounds} 輪）`);
  return lines.join("\n");
}

function formatMdRun(run) {
  const bits = [
    "",
    `## ${String(run.startedAt || "").replace("T", " ").slice(0, 19)}  （${run.results?.length || 0}/${run.rounds} 輪）`,
    "",
    String(run.chatSummary || "").trim(),
    "",
  ];
  for (const r of run.results || []) {
    const req = r.tencentRequest || {};
    bits.push(`### 第${r.round}輪 [${r.status}] ${r.title || r.action}`);
    bits.push(`- 騰訊要求：${clip(req.userSummary || req.goal || req.title || r.userSummary || r.goal || r.title || "（空）", 200)}`);
    if (req.filesRequested?.length) {
      bits.push(`- 騰訊指定檔：${req.filesRequested.join(", ")}`);
    }
    if (req.cursorPrompt) bits.push(`- 騰訊交畀 Cursor 嘅任務：${clip(req.cursorPrompt, 600)}`);
    if (req.acceptance?.length) bits.push(`- 驗收：${req.acceptance.join("；")}`);
    if (req.raw) bits.push(`- 騰訊原文：\n\`\`\`\n${clip(req.raw, 2500)}\n\`\`\``);
    if (r.failReason) bits.push(`- 實現唔到原因：${r.failReason}`);
    if (r.files?.length) bits.push(`- 實際改動檔：${r.files.join(", ")}`);
    if (r.reverted?.length) bits.push(`- 已還原：${r.reverted.join(", ")}`);
    if (r.diffStat) bits.push(`- diff stat：\n\`\`\`\n${r.diffStat}\n\`\`\``);
    if (r.cursorSummary) bits.push(`- Cursor 回覆：${clip(r.cursorSummary, 1000)}`);
    if (r.verify) bits.push(`- 檢查：${clip(r.verify, 800)}`);
    if (r.diff) bits.push(`- diff：\n\`\`\`\n${clip(r.diff, 4000)}\n\`\`\``);
    if (r.detail && r.status !== "ok" && r.detail !== r.failReason) {
      bits.push(`- 技術詳情：${clip(r.detail, 800)}`);
    }
    bits.push("");
  }
  return bits.join("\n");
}

function saveEvolveLog(run) {
  try {
    const dir = getDataDir();
    fs.mkdirSync(dir, { recursive: true });
    const all = loadEvolveHistory();
    all.push(run);
    const kept = all.slice(-40).map((item) => ({
      ...item,
      results: (item.results || []).map(({ diff, ...rest }) => rest),
    }));
    fs.writeFileSync(evolveLogJsonPath(), JSON.stringify(kept, null, 2), "utf8");
    const mdPath = evolveLogMdPath();
    let md = "";
    try {
      md = fs.existsSync(mdPath) ? fs.readFileSync(mdPath, "utf8") : "";
    } catch (_) {}
    md += formatMdRun(run);
    if (md.length > 200000) md = md.slice(-150000);
    fs.writeFileSync(mdPath, md, "utf8");
  } catch (err) {
    console.warn("[Eva] Failed to save evolve-log:", err?.message || err);
  }
}

function fileExcerpt(rel, maxChars = 4000) {
  const n = normRel(rel);
  if (!n || !isAllowedRel(n)) return "";
  const abs = path.join(getRepoRoot(), n);
  try {
    if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) return `(missing ${n})`;
    return clip(fs.readFileSync(abs, "utf8"), maxChars);
  } catch {
    return `(unreadable ${n})`;
  }
}

function filesExcerpts(files) {
  const list = Array.isArray(files) ? files.filter(Boolean) : [];
  if (!list.length) return "";
  const per = list.length <= 2 ? 5000 : list.length <= 4 ? 2800 : 1400;
  return list
    .map((rel) => {
      const body = fileExcerpt(rel, per);
      return `--- ${rel} ---\n${body || "(missing or new file)"}`;
    })
    .join("\n\n");
}

function buildCursorTask(spec) {
  const files = Array.isArray(spec.files) ? spec.files : [];
  return [
    "Implement one coherent Eva product improvement. Do not spawn subagents. Do not commit.",
    "You may edit or create files under: eva-core/, eva-web/src/, overlay/ (not overlay/data/), EVA.md, package.json.",
    "Forbidden: .env, secrets, overlay/data, sample/, git config.",
    "Prefer the listed files; add nearby files in those dirs only if required for this goal.",
    "When done, briefly summarize files changed.",
    "",
    `Title: ${clip(spec.title, 120)}`,
    `Goal: ${clip(spec.goal || spec.cursorPrompt || spec.title, 1600)}`,
    spec.acceptance.length ? `Acceptance: ${spec.acceptance.join("; ")}` : "",
    files.length ? `Primary files:\n${files.map((f) => `- ${f}`).join("\n")}` : "",
    "",
    filesExcerpts(files),
    "",
    "Repo sketch:",
    clip(repoSnapshot(), 5000),
  ]
    .filter(Boolean)
    .join("\n");
}

function verifyChanged(files) {
  const root = getRepoRoot();
  const logs = [];
  let ok = true;
  for (const rel of files.filter(isAllowedRel)) {
    if (!/\.(cjs|js)$/i.test(rel)) continue;
    const abs = path.join(root, rel);
    if (!fs.existsSync(abs)) continue;
    try {
      execFileSync(process.execPath, ["--check", abs], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      });
      logs.push(`syntax ok: ${rel}`);
    } catch (err) {
      ok = false;
      logs.push(`syntax fail: ${rel}\n${clip(err.stderr || err.stdout || err.message, 1500)}`);
    }
  }
  const webTouched = files.some((f) => f.startsWith("eva-web/"));
  if (webTouched) {
    try {
      execSync("npm run eva:web:build", {
        cwd: root,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      });
      logs.push("eva-web build ok");
    } catch (err) {
      ok = false;
      logs.push(`eva-web build fail:\n${clip(err.stderr || err.stdout || err.message, 2000)}`);
    }
  }
  const extra = String(process.env.EVA_EVOLVE_TEST_CMD || "").trim();
  if (extra) {
    try {
      execSync(extra, {
        cwd: root,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      });
      logs.push(`test cmd ok: ${extra}`);
    } catch (err) {
      ok = false;
      logs.push(`test cmd fail:\n${clip(err.stderr || err.stdout || err.message, 2000)}`);
    }
  }
  return { ok, log: logs.join("\n") || "no verify steps" };
}

function progress(onProgress, stage, message) {
  try {
    onProgress?.({ stage, message });
  } catch (_) {}
}

function plannerProgress(onProgress) {
  return (info) => {
    if (info?.stage === "stream") {
      progress(onProgress, "think", "騰訊雲正在寫方案…");
      return;
    }
    const msg = String(info?.message || "").trim();
    if (!msg) return;
    if (msg.startsWith("{") || /"action"\s*:/.test(msg)) {
      progress(onProgress, "think", "騰訊雲正在寫方案…");
      return;
    }
    progress(onProgress, info?.stage || "think", msg);
  };
}

async function askPlanner(userText, onProgress, { requireImplement = false } = {}) {
  const fwd = plannerProgress(onProgress);
  progress(onProgress, "think", "騰訊雲正在想進化方案…");
  const text = await tencentLkeChat(userText, {
    onProgress: fwd,
    systemRole: plannerSystemRole(),
    sessionName: EVOLVE_SESSION,
  });
  let spec = parseSpec(text);
  const needsRetry =
    !spec || (requireImplement && spec.action !== "implement") || isVagueStop(spec);
  if (!needsRetry) return { spec, raw: text };

  progress(
    onProgress,
    "think",
    requireImplement || isVagueStop(spec)
      ? "騰訊雲未出改動方案，要求再出一個 implement…"
      : "方案格式唔啱，請騰訊雲用 JSON 再出一次…",
  );
  const retry = await tencentLkeChat(
    [
      requireImplement || isVagueStop(spec)
        ? "Do NOT return {\"action\":\"stop\"}. That is invalid for this turn."
        : "Previous reply was not valid JSON.",
      "Reply with ONLY an implement JSON object.",
      "Required: action=implement, files[] under eva-web/src or eva-core or overlay (not overlay/data), userSummary in 粵語, cursorPrompt describing the change.",
      "One coherent improvement per round; several related files is OK (max 8).",
      "Example files: eva-web/src/main.js and eva-web/src/api.js",
      "Your previous text was:",
      clip(text, 1200),
    ].join("\n"),
    {
      onProgress: fwd,
      systemRole: plannerSystemRole(),
      sessionName: EVOLVE_SESSION,
    },
  );
  spec = parseSpec(retry);
  return { spec, raw: retry || text };
}

async function runEvolveLoop(options = {}) {
  if (evolveLock) {
    throw new Error("自動進化已在進行中。");
  }
  if (!tencentLkeConfigured()) {
    throw new Error("騰訊雲未設定 AppKey。請在 .env 填 TENCENT_LKE_APP_KEY。");
  }
  if (!cursorApiKey()) {
    throw new Error(
      "Missing CURSOR_API_KEY in .env. Create one at https://cursor.com/dashboard/api",
    );
  }

  const rounds = Math.min(
    8,
    Math.max(1, Number(options.maxRounds) || maxRounds()),
  );
  const onProgress = options.onProgress;
  const historyMessages = options.historyMessages;
  const startedAt = new Date().toISOString();
  const results = [];

  evolveLock = true;
  try {
    resetTencentConversation(EVOLVE_SESSION);
    progress(onProgress, "think", `自動進化開始，最多 ${rounds} 輪`);

    for (let i = 1; i <= rounds; i++) {
      const snapshot = repoSnapshot();
      const intent = formatChatIntent(historyMessages);
      const prior = results
        .map(
          (r) =>
            `Round ${r.round}: ${r.title || r.action} | ${r.status} | ${clip(r.detail, 400)}`,
        )
        .join("\n");

      const ask = [
        `Round ${i}/${rounds}. ${i === 1 ? "You MUST return action=implement with one coherent improvement (several related files OK)." : "Return implement for another improvement, or stop only with a long 粵語 reason."}`,
        "Do not reply {\"action\":\"stop\"} with no reason.",
        "Prefer real UX/bugs/features over tiny CSS-only tweaks. No secrets, no overlay/data, no commit.",
        "",
        "Recent user chat (intent, may be empty):",
        intent,
        "",
        prior ? `Previous evolve rounds:\n${prior}` : "No previous rounds this run.",
        "",
        "Repo sketch:",
        clip(snapshot, 6000),
      ].join("\n");

      progress(onProgress, "think", `第 ${i}/${rounds} 輪：騰訊雲想方案…`);
      const { spec, raw } = await askPlanner(ask, onProgress, {
        requireImplement: i === 1,
      });
      if (!spec) {
        const tencentRequest = tencentRequestFrom(null, raw);
        results.push({
          round: i,
          action: "stop",
          status: "parse-fail",
          title: "",
          userSummary: "",
          tencentRequest,
          failReason: failReasonFor("parse-fail", { raw, detail: clip(raw, 400) }),
          detail: clip(raw, 800),
        });
        console.warn("[Eva][evolve] parse-fail round", i);
        break;
      }
      const tencentRequest = tencentRequestFrom(spec, raw);
      if (spec.action === "stop") {
        const firstRoundEmpty = i === 1 || isVagueStop(spec);
        results.push({
          round: i,
          action: "stop",
          status: firstRoundEmpty && i === 1 ? "parse-fail" : "stopped",
          title: spec.reason,
          userSummary: spec.userSummary || spec.reason,
          tencentRequest,
          failReason:
            i === 1
              ? "第一輪騰訊只回 {action:stop} 冇出改動方案（多數抄咗 schema）。已要求改出 implement 仍然停。"
              : failReasonFor("stopped", {
                  userSummary: spec.userSummary,
                  stopReason: spec.reason,
                  detail: spec.reason,
                }),
          detail: spec.reason,
        });
        progress(onProgress, "think", `騰訊雲停咗：${clip(spec.userSummary || spec.reason, 80)}`);
        break;
      }

      progress(
        onProgress,
        "think",
        `第 ${i}/${rounds} 輪：${clip(spec.userSummary || spec.title, 60)} — Cursor 改 code…`,
      );
      let cursorSummary = "";
      try {
        cursorSummary = await runCursorPrompt(buildCursorTask(spec), {
          onProgress,
        });
      } catch (err) {
        const detail = String(err?.message || err);
        results.push({
          round: i,
          action: "implement",
          status: "cursor-fail",
          title: spec.title,
          goal: spec.goal,
          userSummary: spec.userSummary,
          tencentRequest,
          failReason: failReasonFor("cursor-fail", { detail }),
          detail,
        });
        console.warn("[Eva][evolve] cursor-fail", spec.title, clip(detail, 200));
        progress(onProgress, "think", `Cursor 失敗：${clip(detail, 180)}`);
        if (isExecutorBusyError(detail)) {
          break;
        }
        continue;
      }

      const changed = changedRelPaths();
      const reverted = revertDisallowed(changed);
      const kept = changedRelPaths().filter(isAllowedRel);
      const verify = verifyChanged(kept);
      const diffs = describeChanges(kept);
      const status =
        verify.ok && kept.length ? "ok" : verify.ok ? "no-change" : "verify-fail";
      const detail = [
        cursorSummary,
        kept.length ? `changed: ${kept.join(", ")}` : "changed: (none)",
        reverted.length ? `reverted: ${reverted.join(", ")}` : "",
        verify.log,
      ]
        .filter(Boolean)
        .join("\n");

      results.push({
        round: i,
        action: "implement",
        status,
        title: spec.title,
        goal: spec.goal,
        userSummary: spec.userSummary,
        tencentRequest,
        failReason: failReasonFor(status, {
          detail,
          cursorSummary,
          verify: verify.log,
          reverted,
        }),
        files: kept,
        reverted,
        cursorSummary: clip(cursorSummary, 1500),
        verify: verify.log,
        diffStat: diffs.diffStat,
        diff: diffs.diff,
        detail: clip(detail, 2500),
      });
      console.log(
        "[Eva][evolve]",
        `round ${i}/${rounds} ${status} ${spec.title} files=${kept.join(",") || "-"}`,
      );
      progress(
        onProgress,
        "think",
        `第 ${i}/${rounds} 輪${status === "ok" ? "完成" : status === "no-change" ? "無改動" : "檢查失敗"}：${clip(spec.userSummary || spec.title, 60)}`,
      );

      if (!kept.length) {
        continue;
      }
    }

    const lines = results.map((r) => {
      const files = r.files?.length ? ` → ${r.files.join(", ")}` : "";
      return `- 第${r.round}輪 ${r.title || r.action} [${r.status}]${files}`;
    });
    const summary = [
      `自動進化完成（${results.length}/${rounds} 輪）`,
      lines.join("\n") || "- （冇跑到任何一輪）",
    ].join("\n");
    const chatSummary = formatChatSummary(results, rounds);

    saveEvolveLog({
      startedAt,
      endedAt: new Date().toISOString(),
      rounds,
      results,
      summary,
      chatSummary,
    });
    console.log("[Eva][evolve]\n" + chatSummary);
    progress(onProgress, "think", chatSummary);
    return { chatSummary, summary, logFile: "overlay/data/evolve-log.md" };
  } finally {
    evolveLock = false;
  }
}

module.exports = {
  runEvolveLoop,
  parseSpec,
  isAllowedRel,
  maxRounds,
  formatChatSummary,
  isVagueStop,
};
