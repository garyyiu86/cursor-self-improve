/**
 * Create/init Eva Postgres knowledge DB schema.
 * Usage:
 *   set EVA_DATABASE_URL=postgres://eva:eva@127.0.0.1:5432/eva_kb
 *   npm.cmd run kb:init
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

async function main() {
  loadEnvFile();
  if (!process.env.EVA_DATABASE_URL && !process.env.DATABASE_URL) {
    process.env.EVA_DATABASE_URL = "postgres://eva:eva@127.0.0.1:5433/eva_kb";
    console.log("[kb:init] Using default", process.env.EVA_DATABASE_URL);
  }

  const kb = require("../knowledge-db.cjs");
  const ok = await kb.initKnowledgeDb();
  if (!ok) {
    console.error("[kb:init] Failed. Is Postgres running and EVA_DATABASE_URL correct?");
    process.exit(1);
  }
  const n = await kb.countKnowledgeEntries();
  console.log(`[kb:init] OK — knowledge_entries count=${n}`);
  await kb.closeKnowledgeDb();
}

main().catch((err) => {
  console.error("[kb:init]", err);
  process.exit(1);
});
