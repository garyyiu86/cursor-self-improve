/**
 * Actively warm Eva KB: Tavily search each query → save into Postgres.
 *
 * Usage:
 *   npm.cmd run kb:warmup
 *   npm.cmd run kb:warmup -- --limit 15
 *   npm.cmd run kb:warmup -- --file overlay/data/kb-warmup-topics.txt
 *   npm.cmd run kb:warmup -- --query "香港人口大約幾多" --query "什麼是 LLM"
 *   npm.cmd run kb:warmup -- --force
 *   npm.cmd run kb:warmup -- --delay 2000
 */
const path = require("node:path");
const fs = require("node:fs");

function loadEnvFile() {
  const envPath = path.join(__dirname, "..", "..", ".env");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const i = trimmed.indexOf("=");
    if (i <= 0) continue;
    const key = trimmed.slice(0, i).trim();
    let value = trimmed.slice(i + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function parseArgs(argv) {
  const out = {
    file: path.join(__dirname, "..", "data", "kb-warmup-topics.txt"),
    queries: [],
    limit: 0,
    delayMs: Number(process.env.EVA_KB_WARMUP_DELAY_MS || 1200),
    force: false,
    skipExisting: true,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--file" || a === "-f") {
      out.file = path.resolve(argv[++i] || out.file);
    } else if (a === "--query" || a === "-q") {
      const q = String(argv[++i] || "").trim();
      if (q) out.queries.push(q);
    } else if (a === "--limit" || a === "-n") {
      out.limit = Math.max(0, Number(argv[++i] || 0));
    } else if (a === "--delay") {
      out.delayMs = Math.max(0, Number(argv[++i] || out.delayMs));
    } else if (a === "--force") {
      out.force = true;
      out.skipExisting = false;
    } else if (a === "--help" || a === "-h") {
      out.help = true;
    }
  }
  return out;
}

function loadQueriesFromFile(filePath) {
  if (!fs.existsSync(filePath)) return [];
  return fs
    .readFileSync(filePath, "utf8")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"));
}

function formatTavilyNotes(raw) {
  const lines = [];
  if (raw?.answer) {
    lines.push(String(raw.answer).trim());
    lines.push("");
  }
  for (const r of raw?.sources || []) {
    lines.push(`• ${r.title}`);
    if (r.snippet) lines.push(`  ${r.snippet}`);
    if (r.url) lines.push(`  ${r.url}`);
    lines.push("");
  }
  return lines.join("\n").trim();
}

async function tavilySearchRaw(query) {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) throw new Error("Missing TAVILY_API_KEY in .env");

  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      search_depth: "basic",
      include_answer: true,
      max_results: 5,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Tavily error ${res.status}: ${body.slice(0, 300)}`);
  }
  const data = await res.json();
  const sources = (Array.isArray(data.results) ? data.results : [])
    .slice(0, 5)
    .map((r) => ({
      title: String(r.title || "Result"),
      url: String(r.url || ""),
      snippet: String(r.content || "").trim().slice(0, 280),
    }));
  return {
    answer: String(data.answer || "").trim(),
    sources,
  };
}

async function main() {
  loadEnvFile();
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(`kb:warmup — Tavily → Postgres KB

  npm.cmd run kb:warmup
  npm.cmd run kb:warmup -- --limit 10
  npm.cmd run kb:warmup -- --query "香港人口" --query "什麼是 AI"
  npm.cmd run kb:warmup -- --file path/to/topics.txt --force
  npm.cmd run kb:warmup -- --delay 2000`);
    return;
  }

  if (!process.env.EVA_DATABASE_URL && !process.env.DATABASE_URL) {
    process.env.EVA_DATABASE_URL = "postgres://eva:eva@127.0.0.1:5433/eva_kb";
  }
  if (!process.env.TAVILY_API_KEY) {
    console.error("[kb:warmup] Missing TAVILY_API_KEY");
    process.exit(1);
  }

  const kb = require("../knowledge-db.cjs");
  const ok = await kb.initKnowledgeDb();
  if (!ok) {
    console.error("[kb:warmup] KB init failed. Is Postgres up? (npm run kb:up)");
    process.exit(1);
  }

  let queries = args.queries.length
    ? args.queries
    : loadQueriesFromFile(args.file);
  if (!queries.length) {
    console.error(`[kb:warmup] No queries. Edit ${args.file} or pass --query`);
    process.exit(1);
  }
  if (args.limit > 0) queries = queries.slice(0, args.limit);

  const minScore = Number(process.env.EVA_KB_MIN_SCORE || 7);
  const before = await kb.countKnowledgeEntries();
  console.log(
    `[kb:warmup] start count=${before} queries=${queries.length} delay=${args.delayMs}ms skipExisting=${args.skipExisting}`,
  );

  let saved = 0;
  let skipped = 0;
  let failed = 0;
  let empty = 0;

  for (let i = 0; i < queries.length; i++) {
    const query = queries[i];
    const tag = `[${i + 1}/${queries.length}]`;
    try {
      if (args.skipExisting) {
        const hits = await kb.searchKnowledgeBase(query, 1);
        const top = hits[0];
        if (top && top.score >= minScore) {
          console.log(`${tag} skip (KB score=${top.score.toFixed(1)}) ${query}`);
          skipped += 1;
          continue;
        }
      }

      console.log(`${tag} Tavily… ${query}`);
      const raw = await tavilySearchRaw(query);
      const notes = formatTavilyNotes(raw);
      if (!notes) {
        console.warn(`${tag} empty result — ${query}`);
        empty += 1;
      } else {
        const entry = await kb.addKnowledgeEntry({
          query,
          answer: raw.answer,
          notes,
          sources: raw.sources,
        });
        saved += 1;
        console.log(`${tag} saved ${entry.id}`);
      }
    } catch (err) {
      failed += 1;
      console.warn(`${tag} FAIL ${query}: ${err?.message || err}`);
    }

    if (i < queries.length - 1 && args.delayMs > 0) {
      await sleep(args.delayMs);
    }
  }

  const after = await kb.countKnowledgeEntries();
  console.log(
    `[kb:warmup] done saved=${saved} skipped=${skipped} empty=${empty} failed=${failed} count ${before}→${after}`,
  );
  await kb.closeKnowledgeDb();
}

main().catch((err) => {
  console.error("[kb:warmup]", err);
  process.exit(1);
});
