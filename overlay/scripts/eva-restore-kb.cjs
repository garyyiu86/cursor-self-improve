/**
 * Restore KB from backups/kb/eva_kb_latest.json into Postgres.
 *
 *   npm run kb:restore
 *   node overlay/scripts/eva-restore-kb.cjs
 *   node overlay/scripts/eva-restore-kb.cjs --file backups/kb/eva_kb_latest.json
 */
require("../../eva-core/log.cjs");
const path = require("node:path");
const fs = require("node:fs");

const { loadEnvFile, getRepoRoot } = require("../../eva-core/env.cjs");
const kb = require("../../eva-core/knowledge-db.cjs");

function parseArgs(argv) {
  const out = { file: "", replace: true };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--file" && argv[i + 1]) {
      out.file = argv[++i];
    } else if (a === "--merge") {
      out.replace = false;
    }
  }
  return out;
}

function defaultBackupPath(root) {
  return path.join(root, "backups", "kb", "eva_kb_latest.json");
}

function loadBackup(filePath) {
  const raw = JSON.parse(fs.readFileSync(filePath, "utf8"));
  const entries = Array.isArray(raw?.entries) ? raw.entries : Array.isArray(raw) ? raw : [];
  if (!entries.length) {
    throw new Error(`No entries in backup: ${filePath}`);
  }
  return { meta: raw, entries };
}

async function restoreEntries(pool, entries, { replace }) {
  if (replace) {
    await pool.query("TRUNCATE TABLE knowledge_entries");
  }

  let inserted = 0;
  for (const e of entries) {
    const query = String(e.query || "").trim();
    if (!query) continue;
    const queryNorm = query.toLowerCase();
    const keywords = Array.isArray(e.keywords) && e.keywords.length
      ? e.keywords
      : kb.tokenizeForKb(query).slice(0, 40);
    const id = String(e.id || "").trim() || `kb_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    const sources = Array.isArray(e.sources) ? e.sources : [];
    const hitCount = Math.max(1, Number(e.hitCount || e.hit_count || 1));
    const createdAt = e.createdAt || e.created_at || new Date().toISOString();
    const updatedAt = e.updatedAt || e.updated_at || createdAt;

    await pool.query(
      `
      INSERT INTO knowledge_entries (
        id, query, query_norm, keywords, answer, notes, sources, hit_count, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4::text[], $5, $6, $7::jsonb, $8, $9::timestamptz, $10::timestamptz
      )
      ON CONFLICT (query_norm) DO UPDATE SET
        answer = EXCLUDED.answer,
        notes = EXCLUDED.notes,
        sources = EXCLUDED.sources,
        keywords = EXCLUDED.keywords,
        hit_count = GREATEST(knowledge_entries.hit_count, EXCLUDED.hit_count),
        updated_at = EXCLUDED.updated_at
      `,
      [
        id,
        query,
        queryNorm,
        keywords,
        String(e.answer || ""),
        String(e.notes || ""),
        JSON.stringify(sources),
        hitCount,
        createdAt,
        updatedAt,
      ],
    );
    inserted += 1;
  }
  return inserted;
}

async function main() {
  loadEnvFile();
  if (!process.env.EVA_DATABASE_URL && !process.env.DATABASE_URL) {
    process.env.EVA_DATABASE_URL = "postgres://eva:eva@127.0.0.1:5433/eva_kb";
  }

  const root = getRepoRoot();
  const args = parseArgs(process.argv.slice(2));
  const filePath = path.resolve(root, args.file || defaultBackupPath(root));
  if (!fs.existsSync(filePath)) {
    console.error(`[eva:restore-kb] Backup not found: ${filePath}`);
    process.exit(1);
  }

  const { meta, entries } = loadBackup(filePath);
  console.log(
    `[eva:restore-kb] file=${path.relative(root, filePath)} entries=${entries.length} exportedAt=${meta.exportedAt || "?"}`,
  );

  const ok = await kb.initKnowledgeDb();
  if (!ok) {
    console.error("[eva:restore-kb] KB init failed. Is Postgres up? (npm run kb:up)");
    process.exit(1);
  }

  const pool = kb.getPool();
  if (!pool) {
    console.error("[eva:restore-kb] No database pool");
    process.exit(1);
  }

  try {
    const before = await kb.countKnowledgeEntries();
    const n = await restoreEntries(pool, entries, { replace: args.replace });
    const after = await kb.countKnowledgeEntries();
    console.log(
      `[eva:restore-kb] ${args.replace ? "replaced" : "merged"} wrote=${n} before=${before} after=${after}`,
    );
  } finally {
    await kb.closeKnowledgeDb();
  }
}

main().catch((err) => {
  console.error("[eva:restore-kb]", err);
  process.exit(1);
});
