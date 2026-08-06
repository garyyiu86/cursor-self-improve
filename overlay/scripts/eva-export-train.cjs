/**
 * Export Eva training JSONL (Alpaca + ShareGPT) for LoRA.
 *
 * Modes:
 *   kb         — knowledge base only (facts / self-drill)
 *   personal   — persona + chat history + style seeds (default bias for vibe)
 *   mixed      — personal heavy + some KB (facts still in Eva voice)
 *
 * Usage:
 *   npm run eva:export-train -- --mode personal
 *   npm run eva:export-train -- --mode mixed
 *   npm run eva:export-train -- --mode kb --self-drill-only
 */
require("../../eva-core/log.cjs");
const path = require("node:path");
const fs = require("node:fs");

const { loadEnvFile, getRepoRoot, getDataDir } = require("../../eva-core/env.cjs");
const { loadChatHistory } = require("../../eva-core/history.cjs");
const kb = require("../../eva-core/knowledge-db.cjs");

function parseArgs(argv) {
  const root = getRepoRoot();
  const envMode = String(process.env.EVA_EXPORT_MODE || "").trim().toLowerCase();
  const out = {
    outDir: path.join(root, "training", "data"),
    outFile: "",
    limit: Math.max(0, Number(process.env.EVA_EXPORT_TRAIN_LIMIT || 10000)),
    minChars: Math.max(0, Number(process.env.EVA_EXPORT_TRAIN_MIN_CHARS || 12)),
    selfDrillOnly: process.env.EVA_EXPORT_SELF_DRILL_ONLY === "1",
    includePersona: process.env.EVA_EXPORT_INCLUDE_PERSONA !== "0",
    mode: ["kb", "personal", "mixed"].includes(envMode) ? envMode : "personal",
    chatLimit: Math.max(0, Number(process.env.EVA_EXPORT_CHAT_LIMIT || 200)),
    personalRepeat: Math.max(1, Number(process.env.EVA_EXPORT_PERSONAL_REPEAT || 3)),
    kbRatio: Math.min(1, Math.max(0, Number(process.env.EVA_EXPORT_KB_RATIO || 0.25))),
    styleFile: path.join(root, "training", "data", "eva-style-seeds.jsonl"),
    help: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--out" || a === "-o") {
      out.outFile = path.resolve(argv[++i] || "");
    } else if (a === "--limit" || a === "-n") {
      out.limit = Math.max(0, Number(argv[++i] || out.limit));
    } else if (a === "--min-chars") {
      out.minChars = Math.max(0, Number(argv[++i] || out.minChars));
    } else if (a === "--self-drill-only") {
      out.selfDrillOnly = true;
    } else if (a === "--no-persona") {
      out.includePersona = false;
    } else if (a === "--mode" || a === "-m") {
      const m = String(argv[++i] || "").trim().toLowerCase();
      if (["kb", "personal", "mixed"].includes(m)) out.mode = m;
    } else if (a === "--personal") {
      out.mode = "personal";
    } else if (a === "--chat-limit") {
      out.chatLimit = Math.max(0, Number(argv[++i] || out.chatLimit));
    } else if (a === "--personal-repeat") {
      out.personalRepeat = Math.max(1, Number(argv[++i] || out.personalRepeat));
    } else if (a === "--kb-ratio") {
      out.kbRatio = Math.min(1, Math.max(0, Number(argv[++i] || out.kbRatio)));
    } else if (a === "--style-file") {
      out.styleFile = path.resolve(argv[++i] || out.styleFile);
    } else if (a === "--help" || a === "-h") {
      out.help = true;
    }
  }
  return out;
}

function loadPersonaText() {
  try {
    const live = path.join(getDataDir(), "persona.txt");
    const seed = path.join(getRepoRoot(), "overlay", "persona.txt");
    const p = fs.existsSync(live) ? live : seed;
    if (!fs.existsSync(p)) return "";
    return fs.readFileSync(p, "utf8").trim().slice(0, 3500);
  } catch {
    return "";
  }
}

function stripNotesNoise(notes) {
  let s = String(notes || "").trim();
  s = s.replace(/^\[self-drill\/[^\]]+\]\s*/i, "");
  const lines = s.split(/\r?\n/);
  const kept = [];
  for (const line of lines) {
    if (/^\s*•/.test(line)) break;
    if (/https?:\/\//i.test(line) && line.trim().startsWith("http")) continue;
    kept.push(line);
  }
  return kept.join("\n").trim();
}

function pickAnswer(entry) {
  const a = String(entry.answer || "").trim();
  if (a.length >= 8) return a;
  return stripNotesNoise(entry.notes);
}

function systemPrompt(persona, mode) {
  const bits = [
    "你是 Eva（伊娃），住在使用者桌面／手機裡的動漫風同伴。",
    "你不是客服、不是搜尋引擎。用口語化繁體中文（可帶粵語語氣詞）回答。",
    "預設 1–3 句；先有情緒／反應，再講重點。",
    "唔好假謙虛開場；唔肯定就直講一次。",
  ];
  if (mode === "personal" || mode === "mixed") {
    bits.push("這批樣本主要學習你的個性、語氣與陪伴感；事實要準，但必須用 Eva 的聲音說。");
  }
  if (persona) {
    bits.push("人設（必須遵守）：");
    bits.push(persona);
  }
  return bits.join("\n");
}

function toAlpaca(system, instruction, output) {
  return { instruction, input: "", output, system };
}

function toShareGpt(system, instruction, output) {
  return {
    conversations: [
      { from: "system", value: system },
      { from: "human", value: instruction },
      { from: "gpt", value: output },
    ],
  };
}

function pushPair(alpaca, sharegpt, system, user, assistant, minChars) {
  const instruction = String(user || "").trim();
  const output = String(assistant || "").trim();
  if (!instruction || output.length < minChars) return false;
  alpaca.push(toAlpaca(system, instruction, output));
  sharegpt.push(toShareGpt(system, instruction, output));
  return true;
}

function loadStyleSeeds(filePath) {
  if (!fs.existsSync(filePath)) return [];
  const out = [];
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    try {
      const o = JSON.parse(t);
      if (o.user && o.assistant) out.push(o);
    } catch {
      /* skip */
    }
  }
  return out;
}

/** Extract style samples embedded in persona.txt (User: … → …) */
function parsePersonaInlineSamples(persona) {
  const out = [];
  const re =
    /User:\s*[「"]([^」"]+)[」"]\s*→\s*[「"]([^」"]+)[」"]/gi;
  let m;
  while ((m = re.exec(persona))) {
    out.push({ user: m[1], assistant: m[2] });
  }
  return out;
}

function pairsFromChatHistory(limit, minChars) {
  const hist = loadChatHistory();
  const pairs = [];
  for (let i = 0; i < hist.length - 1; i++) {
    const a = hist[i];
    const b = hist[i + 1];
    if (!a || !b) continue;
    if (a.role !== "user" || b.role !== "assistant") continue;
    const u = String(a.content || "").trim();
    const s = String(b.content || "").trim();
    if (!u || s.length < minChars) continue;
    // Skip pure tool/error dumps
    if (/^Server error:|^Error:|Traceback/i.test(s)) continue;
    pairs.push({ user: u, assistant: s });
  }
  if (limit > 0 && pairs.length > limit) {
    return pairs.slice(-limit);
  }
  return pairs;
}

function upsample(list, times) {
  if (times <= 1) return [...list];
  const out = [];
  for (let t = 0; t < times; t++) out.push(...list);
  return out;
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

async function main() {
  loadEnvFile();
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(`eva:export-train — export JSONL for LoRA

  npm run eva:export-train -- --mode personal   # persona + chat + style (default)
  npm run eva:export-train -- --mode mixed      # personal + some KB
  npm run eva:export-train -- --mode kb
  npm run eva:export-train -- --personal-repeat 5 --chat-limit 300`);
    return;
  }

  const persona = args.includePersona ? loadPersonaText() : "";
  const system = systemPrompt(persona, args.mode);
  const alpaca = [];
  const sharegpt = [];
  const stats = { style: 0, chat: 0, kb: 0, skipped: 0 };

  // --- personal sources ---
  if (args.mode === "personal" || args.mode === "mixed") {
    const style = [
      ...loadStyleSeeds(args.styleFile),
      ...parsePersonaInlineSamples(persona),
    ];
    const chat = pairsFromChatHistory(args.chatLimit, args.minChars);
    const personal = upsample(
      [
        ...style.map((p) => ({ ...p, _src: "style" })),
        ...chat.map((p) => ({ ...p, _src: "chat" })),
      ],
      args.personalRepeat,
    );

    for (const p of personal) {
      const ok = pushPair(alpaca, sharegpt, system, p.user, p.assistant, args.minChars);
      if (!ok) {
        stats.skipped += 1;
        continue;
      }
      if (p._src === "style") stats.style += 1;
      else stats.chat += 1;
    }
  }

  // --- KB sources ---
  let kbRows = [];
  if (args.mode === "kb" || args.mode === "mixed") {
    if (!process.env.EVA_DATABASE_URL && !process.env.DATABASE_URL) {
      process.env.EVA_DATABASE_URL = "postgres://eva:eva@127.0.0.1:5433/eva_kb";
    }
    const ok = await kb.initKnowledgeDb();
    if (!ok) {
      if (args.mode === "kb") {
        console.error("[eva:export-train] KB init failed");
        process.exit(1);
      }
      console.warn("[eva:export-train] KB unavailable — continue without KB rows");
    } else {
      kbRows = await kb.listKnowledgeEntries({
        limit: args.limit || 10000,
        minAnswerLen: Math.max(args.minChars, 24),
        selfDrillOnly: args.selfDrillOnly,
      });
      if (args.mode === "mixed" && args.kbRatio < 1) {
        const n = Math.max(0, Math.floor(kbRows.length * args.kbRatio));
        kbRows = shuffle(kbRows).slice(0, n);
      }
      const factSystem =
        system +
        "\n對事實題：先一句反應，再用口語講重點；唔好條列 dump，除非用家要求。";
      for (const entry of kbRows) {
        const ok = pushPair(
          alpaca,
          sharegpt,
          factSystem,
          entry.query,
          pickAnswer(entry),
          Math.max(args.minChars, 24),
        );
        if (!ok) stats.skipped += 1;
        else stats.kb += 1;
      }
      await kb.closeKnowledgeDb();
    }
  }

  let finalAlpaca = shuffle(alpaca);
  let finalShare = shuffle(sharegpt);
  // keep pairs aligned: rebuild share from alpaca order
  finalShare = finalAlpaca.map((r) => toShareGpt(r.system, r.instruction, r.output));
  if (args.limit > 0 && finalAlpaca.length > args.limit) {
    finalAlpaca = finalAlpaca.slice(0, args.limit);
    finalShare = finalShare.slice(0, args.limit);
  }

  fs.mkdirSync(args.outDir, { recursive: true });
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const alpacaPath =
    args.outFile ||
    path.join(args.outDir, `eva-${args.mode}-alpaca-${stamp}.jsonl`);
  const shareOut = args.outFile
    ? path.join(
        path.dirname(alpacaPath),
        path.basename(alpacaPath, path.extname(alpacaPath)) + ".sharegpt.jsonl",
      )
    : alpacaPath.replace(/\.jsonl$/i, "") + ".sharegpt.jsonl";

  fs.writeFileSync(
    alpacaPath,
    finalAlpaca.map((r) => JSON.stringify(r)).join("\n") + (finalAlpaca.length ? "\n" : ""),
    "utf8",
  );
  fs.writeFileSync(
    shareOut,
    finalShare.map((r) => JSON.stringify(r)).join("\n") + (finalShare.length ? "\n" : ""),
    "utf8",
  );

  const meta = {
    exportedAt: new Date().toISOString(),
    mode: args.mode,
    count: finalAlpaca.length,
    stats,
    personalRepeat: args.personalRepeat,
    chatLimit: args.chatLimit,
    kbRatio: args.kbRatio,
    includePersona: args.includePersona,
    alpaca: alpacaPath,
    sharegpt: shareOut,
  };
  const metaPath = path.join(path.dirname(alpacaPath), "eva-export-meta.json");
  fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2), "utf8");

  console.log(
    `[eva:export-train] mode=${args.mode} wrote ${finalAlpaca.length} (style=${stats.style} chat=${stats.chat} kb=${stats.kb} skipped=${stats.skipped})`,
  );
  console.log(`[eva:export-train] alpaca:   ${alpacaPath}`);
  console.log(`[eva:export-train] sharegpt: ${shareOut}`);
  console.log(`[eva:export-train] meta:     ${metaPath}`);
  if (finalAlpaca.length < 30) {
    console.warn(
      "[eva:export-train] 個性樣本偏少。多傾偈、改 persona，或加 training/data/eva-style-seeds.jsonl",
    );
  }
}

main().catch((err) => {
  console.error("[eva:export-train]", err);
  process.exit(1);
});
