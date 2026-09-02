/**
 * Eva self-drill (常識): 自問 → Tavily 查證自答 → 寫入 Postgres KB。
 * 唔 fine-tune 模型；用搜尋結果擴充知識庫，避免純幻覺自我強化。
 *
 * Usage:
 *   npm run eva:self-drill
 *   npm run eva:self-drill -- --limit 8
 *   npm run eva:self-drill -- --limit 0          # 一次過跑晒種子題（唔截斷）
 *   npm run eva:self-drill -- --infinite           # 一路出題答到 Ctrl+C
 *   npm run eva:self-drill -- --infinite --batch 5
 *   npm run eva:self-drill -- --gen 5
 *   npm run eva:self-drill -- --no-llm
 *   npm run eva:self-drill -- --force
 *   npm run eva:self-drill -- --mode tencent
 *   npm run eva:self-drill -- --mode tencent --infinite
 */
require("../../eva-core/log.cjs");
const path = require("node:path");
const fs = require("node:fs");

const { loadEnvFile, getRepoRoot } = require("../../eva-core/env.cjs");
const { tavilySearchRaw, formatTavilyNotes, tavilyEnabled } = require("../../eva-core/tavily.cjs");
const { llmChatOnce } = require("../../eva-core/llm.cjs");
const { tencentLkeConfigured, tencentLkeChat } = require("../../eva-core/tencent-lke.cjs");
const kb = require("../../eva-core/knowledge-db.cjs");

const DRILL_SESSION = "tencent-lke-drill";
const DRILL_MODES = new Set(["eva", "tencent"]);

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function parseArgs(argv) {
  const out = {
    file: path.join(getRepoRoot(), "overlay", "data", "self-drill-common-sense.txt"),
    limit: Math.max(0, Number(process.env.EVA_SELF_DRILL_LIMIT || 10)),
    gen: Math.max(0, Number(process.env.EVA_SELF_DRILL_GEN || 5)),
    batch: Math.max(1, Number(process.env.EVA_SELF_DRILL_BATCH || 0)),
    delayMs: Math.max(0, Number(process.env.EVA_SELF_DRILL_DELAY_MS || 1200)),
    roundDelayMs: Math.max(0, Number(process.env.EVA_SELF_DRILL_ROUND_DELAY_MS || 3000)),
    force: false,
    skipExisting: true,
    useLlm: true,
    infinite: false,
    help: false,
    mode: String(process.env.EVA_SELF_DRILL_MODE || "eva").trim().toLowerCase() || "eva",
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--file" || a === "-f") {
      out.file = path.resolve(argv[++i] || out.file);
    } else if (a === "--limit" || a === "-n") {
      out.limit = Math.max(0, Number(argv[++i] || out.limit));
    } else if (a === "--gen" || a === "-g") {
      out.gen = Math.max(0, Number(argv[++i] || out.gen));
    } else if (a === "--batch" || a === "-b") {
      out.batch = Math.max(1, Number(argv[++i] || out.batch));
    } else if (a === "--delay") {
      out.delayMs = Math.max(0, Number(argv[++i] || out.delayMs));
    } else if (a === "--round-delay") {
      out.roundDelayMs = Math.max(0, Number(argv[++i] || out.roundDelayMs));
    } else if (a === "--force") {
      out.force = true;
      out.skipExisting = false;
    } else if (a === "--no-llm") {
      out.useLlm = false;
    } else if (a === "--infinite" || a === "-i" || a === "--loop") {
      out.infinite = true;
    } else if (a === "--mode") {
      out.mode = String(argv[++i] || out.mode).trim().toLowerCase();
    } else if (a === "--tencent") {
      out.mode = "tencent";
    } else if (a === "--help" || a === "-h") {
      out.help = true;
    }
  }
  if (!out.batch) out.batch = out.gen > 0 ? out.gen : 5;
  if (!DRILL_MODES.has(out.mode)) out.mode = "eva";
  return out;
}

const DEFAULT_TOPICS = [
  "天氣同季節",
  "人體健康常識",
  "飲食營養",
  "地球同天文",
  "植物同動物",
  "物理日常現象",
  "化學生活常識",
  "地理同國家",
  "歷史大事",
  "香港生活常識",
  "交通安全",
  "環保同能源",
  "電腦同網絡",
  "數學生活應用",
  "海洋同氣候",
  "電器同家居",
  "傳染病同防疫",
  "運動同睡眠",
  "貨幣同經濟常識",
  "時間同曆法",
];

function defaultSeedText() {
  return [
    "# Eva 常識自問自答題庫",
    "# 主題行：畀 LLM／騰訊雲自行擴成問題",
    "# Q: 現成問題（可選；冇都得，程式會自己出題）",
    "",
    ...DEFAULT_TOPICS,
    "",
  ].join("\n");
}

function ensureSeedFile(filePath) {
  if (fs.existsSync(filePath) && fs.statSync(filePath).size > 0) return false;
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const template = path.join(getRepoRoot(), "overlay", "self-drill-common-sense.txt");
  if (fs.existsSync(template)) {
    fs.copyFileSync(template, filePath);
  } else {
    fs.writeFileSync(filePath, `${defaultSeedText()}\n`, "utf8");
  }
  console.log(`[eva:self-drill] 已建立預設題庫 ${filePath}`);
  return true;
}

function loadSeedFile(filePath) {
  ensureSeedFile(filePath);
  const questions = [];
  const topics = [];
  if (fs.existsSync(filePath)) {
    for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      if (/^Q[:：]\s*/i.test(trimmed)) {
        const q = trimmed.replace(/^Q[:：]\s*/i, "").trim();
        if (q) questions.push(q);
        continue;
      }
      if (/^主題[:：]\s*/.test(trimmed)) {
        const t = trimmed.replace(/^主題[:：]\s*/, "").trim();
        if (t) topics.push(t);
        continue;
      }
      topics.push(trimmed);
    }
  }
  if (!topics.length) {
    topics.push(...DEFAULT_TOPICS);
    console.log("[eva:self-drill] 檔案冇主題，改用內建常識主題自行出題");
  }
  return { questions, topics };
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function uniqueQuestions(list) {
  const seen = new Set();
  const out = [];
  for (const q of list) {
    const key = String(q || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(String(q).trim());
  }
  return out;
}

function parseGeneratedQuestions(text, max) {
  const lines = String(text || "")
    .split(/\r?\n/)
    .map((l) => l.replace(/^[\s\-*•\d.、)）]+/, "").trim())
    .filter(Boolean)
    .map((l) => l.replace(/^Q[:：]\s*/i, "").trim())
    .filter((l) => l.length >= 6 && /[？?]/.test(l));
  return uniqueQuestions(lines).slice(0, max);
}

async function tencentDrillChat(userText, systemRole) {
  return tencentLkeChat(userText, {
    systemRole,
    sessionName: DRILL_SESSION,
  });
}

async function generateQuestionsFromTopics(topics, count, { mode } = {}) {
  if (!count || !topics.length) return [];
  const picked = shuffle(topics).slice(0, Math.min(8, topics.length));
  const promptUser = [
    `請就以下主題產出剛好 ${count} 條常識問答題（只要問題）：`,
    ...picked.map((t) => `- ${t}`),
  ].join("\n");
  const promptSystem = [
    "你係常識出題助手。只輸出問題清單，每行一條，用繁體中文。",
    "題目要係可查證嘅常識／科普／日常知識，唔好意見題、唔好私人問題。",
    "每條以問號結尾。唔好編號以外嘅解釋。",
    "每次要出唔同角度嘅新題，避免重複老套同一條。",
  ].join("\n");

  if (mode === "tencent") {
    console.log(
      `[eva:self-drill] 騰訊雲出題 ×${count} topics=${picked.slice(0, 4).join("、")}${picked.length > 4 ? "…" : ""}`,
    );
    const text = await tencentDrillChat(promptUser, promptSystem);
    return parseGeneratedQuestions(text, count);
  }

  const drillLlm = String(process.env.EVA_SELF_DRILL_LLM || "ollama").trim().toLowerCase() || "ollama";
  const prevLlm = process.env.EVA_LLM;
  process.env.EVA_LLM = drillLlm;
  console.log(
    `[eva:self-drill] LLM 出題 ×${count} via ${drillLlm} topics=${picked.slice(0, 4).join("、")}${picked.length > 4 ? "…" : ""}`,
  );
  try {
    const text = await llmChatOnce({
      label: "self-drill/gen",
      temperature: 0.85,
      numPredict: 400,
      numCtx: 2048,
      messages: [
        { role: "system", content: promptSystem },
        { role: "user", content: promptUser },
      ],
    });
    return parseGeneratedQuestions(text, count);
  } finally {
    if (prevLlm === undefined) delete process.env.EVA_LLM;
    else process.env.EVA_LLM = prevLlm;
  }
}

async function drillOne(query, { skipExisting, minScore, tag, mode }) {
  if (skipExisting) {
    const hits = await kb.searchKnowledgeBase(query, 1);
    const top = hits[0];
    if (top && top.score >= minScore) {
      console.log(`${tag} skip (KB score=${top.score.toFixed(1)}) ${query}`);
      return "skipped";
    }
  }

  if (mode === "tencent") {
    console.log(`${tag} 自問 → 騰訊雲自答… ${query}`);
    let tavilyNotes = "";
    let sources = [];
    let tavilyAnswer = "";
    if (tavilyEnabled()) {
      try {
        const raw = await tavilySearchRaw(query);
        tavilyNotes = formatTavilyNotes(raw);
        sources = raw.sources || [];
        tavilyAnswer = String(raw.answer || "").trim();
      } catch (err) {
        console.warn(`${tag} Tavily optional fail: ${err?.message || err}`);
      }
    }
    const systemRole = [
      "你係常識解答助手。用簡潔繁體中文回答一條可查證嘅常識題。",
      "只輸出答案正文，唔好客套、唔好標題。",
      "如果資料不足就講明唔肯定，唔好編造數字、人名、日期。",
      tavilyNotes && tavilyNotes !== "(No Tavily results)"
        ? `已搜尋到以下資料，請據此作答（可改寫，唔好原文照抄）：\n${tavilyNotes.slice(0, 3500)}`
        : "",
    ]
      .filter(Boolean)
      .join("\n");
    const answer = String(await tencentDrillChat(query, systemRole) || "").trim();
    if (!answer) {
      console.warn(`${tag} empty — ${query}`);
      return "empty";
    }
    const notes = [`[self-drill/tencent]`, answer];
    if (tavilyNotes && tavilyNotes !== "(No Tavily results)") {
      notes.push("", tavilyNotes);
    }
    const entry = await kb.addKnowledgeEntry({
      query,
      answer: tavilyAnswer || answer,
      notes: notes.join("\n"),
      sources,
    });
    console.log(`${tag} 自答已入 KB id=${entry.id}`);
    return "saved";
  }

  console.log(`${tag} 自問 → Tavily 查證… ${query}`);
  const raw = await tavilySearchRaw(query);
  const notes = formatTavilyNotes(raw);
  if (!String(notes || "").trim() || notes === "(No Tavily results)") {
    console.warn(`${tag} empty — ${query}`);
    return "empty";
  }

  const entry = await kb.addKnowledgeEntry({
    query,
    answer: raw.answer,
    notes: `[self-drill/常識]\n${notes}`,
    sources: raw.sources,
  });
  console.log(`${tag} 自答已入 KB id=${entry.id}`);
  return "saved";
}

async function drillBatch(questions, args, minScore, totals) {
  for (let i = 0; i < questions.length; i++) {
    if (totals.stopping) break;
    const query = questions[i];
    const tag = `[${i + 1}/${questions.length}]`;
    try {
      const status = await drillOne(query, {
        skipExisting: args.skipExisting,
        minScore,
        tag,
        mode: args.mode,
      });
      if (status === "saved") totals.saved += 1;
      else if (status === "skipped") totals.skipped += 1;
      else if (status === "empty") totals.empty += 1;
    } catch (err) {
      totals.failed += 1;
      console.warn(`${tag} FAIL ${query}: ${err?.message || err}`);
    }
    if (i < questions.length - 1 && args.delayMs > 0 && !totals.stopping) {
      await sleep(args.delayMs);
    }
  }
}

async function collectOnce(args, seed) {
  let questions = [...seed.questions];
  if (args.useLlm && args.gen > 0 && seed.topics.length) {
    try {
      const generated = await generateQuestionsFromTopics(seed.topics, args.gen, {
        mode: args.mode,
      });
      console.log(`[eva:self-drill] LLM 產出 ${generated.length} 條`);
      questions = questions.concat(generated);
    } catch (err) {
      console.warn(`[eva:self-drill] LLM 出題失敗，改用種子題: ${err?.message || err}`);
    }
  } else if (!args.useLlm) {
    console.log("[eva:self-drill] --no-llm：只用檔案 Q:");
  }
  questions = uniqueQuestions(shuffle(questions));
  if (args.limit > 0) questions = questions.slice(0, args.limit);
  return questions;
}

async function collectRound(args, seed, round) {
  const n = args.batch;
  if (args.useLlm && seed.topics.length) {
    try {
      const generated = await generateQuestionsFromTopics(seed.topics, n, {
        mode: args.mode,
      });
      console.log(`[eva:self-drill] round ${round} LLM 產出 ${generated.length} 條`);
      if (generated.length) return uniqueQuestions(shuffle(generated));
    } catch (err) {
      console.warn(`[eva:self-drill] round ${round} LLM 出題失敗: ${err?.message || err}`);
    }
  }
  // fallback：打亂種子題（多數會 skip；仍可 --force）
  const fallback = uniqueQuestions(shuffle(seed.questions)).slice(0, n);
  console.log(`[eva:self-drill] round ${round} fallback 種子題 ×${fallback.length}`);
  return fallback;
}

async function main() {
  loadEnvFile();
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(`eva:self-drill — 常識自問自答 → Postgres KB

  npm run eva:self-drill
  npm run eva:self-drill -- --limit 8
  npm run eva:self-drill -- --limit 0            # 一次過：唔截斷（種子題+今次 gen）
  npm run eva:self-drill -- --infinite           # 無限循環至 Ctrl+C（每輪 LLM 新題）
  npm run eva:self-drill -- --infinite --batch 5
  npm run eva:self-drill -- --gen 5
  npm run eva:self-drill -- --no-llm
  npm run eva:self-drill -- --force
  npm run eva:self-drill -- --delay 1500
  npm run eva:self-drill -- --round-delay 3000
  npm run eva:self-drill -- --mode tencent
  npm run eva:self-drill -- --mode tencent --infinite`);
    return;
  }

  if (!process.env.EVA_DATABASE_URL && !process.env.DATABASE_URL) {
    process.env.EVA_DATABASE_URL = "postgres://eva:eva@127.0.0.1:5433/eva_kb";
  }
  if (args.mode === "tencent") {
    if (!tencentLkeConfigured()) {
      console.error("[eva:self-drill] --mode tencent 需要 TENCENT_LKE_APP_KEY");
      process.exit(1);
    }
  } else if (!tavilyEnabled()) {
    console.error("[eva:self-drill] 需要 TAVILY_API_KEY（用搜尋查證，避免幻覺入 KB）");
    process.exit(1);
  }

  const ok = await kb.initKnowledgeDb();
  if (!ok) {
    console.error("[eva:self-drill] KB init failed. 先跑 npm run kb:up && npm run kb:init");
    process.exit(1);
  }

  const seed = loadSeedFile(args.file);
  if (!seed.questions.length && !seed.topics.length) {
    console.error(`[eva:self-drill] 冇問題／主題。請改 ${args.file}`);
    process.exit(1);
  }

  if (args.infinite && !args.useLlm) {
    console.warn("[eva:self-drill] --infinite + --no-llm：種子題會重複，多數 skip；建議唔加 --no-llm");
  }
  if (args.infinite && args.useLlm && !seed.topics.length) {
    console.error("[eva:self-drill] --infinite 需要檔案入面有主題行畀 LLM 出新題");
    process.exit(1);
  }

  const minScore = Number(process.env.EVA_KB_MIN_SCORE || 7);
  const before = await kb.countKnowledgeEntries();
  const totals = { saved: 0, skipped: 0, empty: 0, failed: 0, stopping: false };

  const onStop = () => {
    if (totals.stopping) return;
    totals.stopping = true;
    console.log("\n[eva:self-drill] 收到停止訊號，完成而家呢條就收工…（再按一次可強制結束）");
  };
  process.on("SIGINT", onStop);
  process.on("SIGTERM", onStop);

  if (args.infinite) {
    console.log(
      `[eva:self-drill] ∞ infinite mode=${args.mode} batch=${args.batch} delay=${args.delayMs}ms roundDelay=${args.roundDelayMs}ms — Ctrl+C 停止`,
    );
    console.log(`[eva:self-drill] KB count=${before}`);
    let round = 0;
    while (!totals.stopping) {
      round += 1;
      const questions = await collectRound(args, seed, round);
      if (!questions.length) {
        console.warn(`[eva:self-drill] round ${round} 冇題，等下一輪…`);
        await sleep(args.roundDelayMs || 3000);
        continue;
      }
      console.log(`[eva:self-drill] ——— round ${round} n=${questions.length} ———`);
      await drillBatch(questions, args, minScore, totals);
      if (totals.stopping) break;
      if (args.roundDelayMs > 0) await sleep(args.roundDelayMs);
    }
  } else {
    const questions = await collectOnce(args, seed);
    if (!questions.length) {
      console.error(`[eva:self-drill] 冇問題。請加 Q: 入 ${args.file}`);
      process.exit(1);
    }
    console.log(
      `[eva:self-drill] start mode=${args.mode} count=${before} n=${questions.length} delay=${args.delayMs}ms skipExisting=${args.skipExisting}`,
    );
    await drillBatch(questions, args, minScore, totals);
  }

  const after = await kb.countKnowledgeEntries();
  console.log(
    `[eva:self-drill] done saved=${totals.saved} skipped=${totals.skipped} empty=${totals.empty} failed=${totals.failed} count ${before}→${after}`,
  );
  await kb.closeKnowledgeDb();
}

main().catch((err) => {
  console.error("[eva:self-drill]", err);
  process.exit(1);
});
