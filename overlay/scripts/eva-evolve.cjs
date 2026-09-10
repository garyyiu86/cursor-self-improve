/**
 * Eva auto-evolve: 騰訊雲想方案 → Cursor 改 code → 語法／web build 驗收 → 回流。
 *
 * Usage:
 *   npm run eva:evolve
 *   npm run eva:evolve -- --rounds 4
 */
require("../../eva-core/log.cjs");
const path = require("node:path");
const { loadEnvFile, setDataDir, getRepoRoot } = require("../../eva-core/env.cjs");
const { runEvolveLoop } = require("../../eva-core/evolve.cjs");
const { loadChatHistory } = require("../../eva-core/history.cjs");

function parseArgs(argv) {
  const out = { rounds: 0, help: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--rounds" || a === "-n") {
      out.rounds = Math.max(0, Number(argv[++i] || 0));
    } else if (a === "--help" || a === "-h") {
      out.help = true;
    }
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log("Usage: npm run eva:evolve -- [--rounds N]");
    return;
  }
  const root = getRepoRoot();
  loadEnvFile(root);
  setDataDir(path.join(root, "overlay", "data"));

  const result = await runEvolveLoop({
    maxRounds: args.rounds || undefined,
    historyMessages: loadChatHistory(),
    onProgress: (info) => {
      const msg = String(info?.message || "").trim();
      if (msg) console.log(`[evolve] ${msg}`);
    },
  });
  const chat = result?.chatSummary || result?.summary || result;
  console.log("\n" + chat);
  if (result?.summary && result.summary !== chat) {
    console.log("\n" + result.summary);
  }
  console.log("\n詳情：overlay/data/evolve-log.md");
}

main().catch((err) => {
  console.error(err?.stack || err?.message || err);
  process.exit(1);
});
