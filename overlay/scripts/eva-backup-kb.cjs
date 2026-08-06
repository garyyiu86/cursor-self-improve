/**
 * Export Postgres KB → backups/kb/eva_kb_latest.json (+ SQL dump if docker up).
 *
 *   npm run eva:backup-kb
 *   node overlay/scripts/eva-backup-kb.cjs
 */
require("../../eva-core/log.cjs");
const path = require("node:path");
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

const { loadEnvFile, getRepoRoot } = require("../../eva-core/env.cjs");
const kb = require("../../eva-core/knowledge-db.cjs");

async function main() {
  loadEnvFile();
  if (!process.env.EVA_DATABASE_URL && !process.env.DATABASE_URL) {
    process.env.EVA_DATABASE_URL = "postgres://eva:eva@127.0.0.1:5433/eva_kb";
  }

  const root = getRepoRoot();
  const outDir = path.join(root, "backups", "kb");
  const archiveDir = path.join(outDir, "archive");
  fs.mkdirSync(archiveDir, { recursive: true });

  const ok = await kb.initKnowledgeDb();
  if (!ok) {
    console.error("[eva:backup-kb] KB init failed. Is Postgres up? (npm run kb:up)");
    process.exit(1);
  }

  const rows = await kb.listKnowledgeEntries({ limit: 100000, minAnswerLen: 0 });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const payload = {
    exportedAt: new Date().toISOString(),
    count: rows.length,
    databaseUrlHost: "local-docker-eva-postgres",
    entries: rows.map((e) => ({
      id: e.id,
      query: e.query,
      keywords: e.keywords,
      answer: e.answer,
      notes: e.notes,
      sources: e.sources,
      createdAt: e.createdAt,
      updatedAt: e.updatedAt,
      hitCount: e.hitCount,
    })),
  };

  const latestJson = path.join(outDir, "eva_kb_latest.json");
  const archiveJson = path.join(archiveDir, `eva_kb_${stamp}.json`);
  const jsonText = JSON.stringify(payload, null, 2) + "\n";
  fs.writeFileSync(latestJson, jsonText, "utf8");
  fs.writeFileSync(archiveJson, jsonText, "utf8");

  let sqlPath = null;
  try {
    const sql = execFileSync(
      "docker",
      ["exec", "eva-postgres", "pg_dump", "-U", "eva", "-d", "eva_kb", "--no-owner", "--no-acl"],
      { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
    );
    sqlPath = path.join(outDir, "eva_kb_latest.sql");
    fs.writeFileSync(sqlPath, sql, "utf8");
    fs.writeFileSync(path.join(archiveDir, `eva_kb_${stamp}.sql`), sql, "utf8");
  } catch (err) {
    console.warn(
      "[eva:backup-kb] SQL dump skipped (docker/pg_dump):",
      err?.message || err,
    );
  }

  // prune archive: keep last 14 of each type
  pruneArchive(archiveDir, 14);

  const meta = {
    exportedAt: payload.exportedAt,
    count: payload.count,
    latestJson: path.relative(root, latestJson).replace(/\\/g, "/"),
    latestSql: sqlPath ? path.relative(root, sqlPath).replace(/\\/g, "/") : null,
    archiveJson: path.relative(root, archiveJson).replace(/\\/g, "/"),
  };
  fs.writeFileSync(path.join(outDir, "backup-meta.json"), JSON.stringify(meta, null, 2) + "\n");

  console.log(`[eva:backup-kb] count=${payload.count}`);
  console.log(`[eva:backup-kb] ${meta.latestJson}`);
  if (meta.latestSql) console.log(`[eva:backup-kb] ${meta.latestSql}`);

  await kb.closeKnowledgeDb();
}

function pruneArchive(dir, keep) {
  const groups = { ".json": [], ".sql": [] };
  for (const name of fs.readdirSync(dir)) {
    const ext = path.extname(name);
    if (!groups[ext]) continue;
    const full = path.join(dir, name);
    groups[ext].push({ full, mtime: fs.statSync(full).mtimeMs });
  }
  for (const list of Object.values(groups)) {
    list.sort((a, b) => b.mtime - a.mtime);
    for (const item of list.slice(keep)) {
      try {
        fs.unlinkSync(item.full);
      } catch {
        /* ignore */
      }
    }
  }
}

main().catch((err) => {
  console.error("[eva:backup-kb]", err);
  process.exit(1);
});
