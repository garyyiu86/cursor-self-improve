const { Pool } = require("pg");

let pool = null;
let ready = false;
let initPromise = null;

function databaseUrl() {
  return (
    process.env.EVA_DATABASE_URL ||
    process.env.DATABASE_URL ||
    ""
  ).trim();
}

function tokenizeForKb(text) {
  const s = String(text || "").toLowerCase();
  const parts = s
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 2);
  const cjk = s.replace(/[^\u4e00-\u9fff]/g, "");
  for (let i = 0; i < cjk.length - 1; i++) {
    parts.push(cjk.slice(i, i + 2));
  }
  return [...new Set(parts)];
}

function mapRow(row) {
  return {
    id: row.id,
    query: row.query,
    keywords: row.keywords || [],
    answer: row.answer || "",
    notes: row.notes || "",
    sources: row.sources || [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    hitCount: Number(row.hit_count || 0),
  };
}

async function ensureSchema(client) {
  await client.query(`CREATE EXTENSION IF NOT EXISTS pg_trgm`);
  await client.query(`
    CREATE TABLE IF NOT EXISTS knowledge_entries (
      id            TEXT PRIMARY KEY,
      query         TEXT NOT NULL,
      query_norm    TEXT NOT NULL,
      keywords      TEXT[] NOT NULL DEFAULT '{}',
      answer        TEXT NOT NULL DEFAULT '',
      notes         TEXT NOT NULL DEFAULT '',
      sources       JSONB NOT NULL DEFAULT '[]'::jsonb,
      hit_count     INTEGER NOT NULL DEFAULT 1,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await client.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS knowledge_entries_query_norm_uidx
      ON knowledge_entries (query_norm)
  `);
  await client.query(`
    CREATE INDEX IF NOT EXISTS knowledge_entries_keywords_gin
      ON knowledge_entries USING GIN (keywords)
  `);
  await client.query(`
    CREATE INDEX IF NOT EXISTS knowledge_entries_query_trgm
      ON knowledge_entries USING GIN (query gin_trgm_ops)
  `);
  await client.query(`
    CREATE INDEX IF NOT EXISTS knowledge_entries_notes_trgm
      ON knowledge_entries USING GIN (notes gin_trgm_ops)
  `);
  await client.query(`
    CREATE INDEX IF NOT EXISTS knowledge_entries_updated_at_idx
      ON knowledge_entries (updated_at DESC)
  `);
}

function getPool() {
  const url = databaseUrl();
  if (!url) return null;
  if (!pool) {
    pool = new Pool({
      connectionString: url,
      max: 4,
      idleTimeoutMillis: 30_000,
    });
    pool.on("error", (err) => {
      console.warn("[Eva][KB] Postgres pool error:", err?.message || err);
    });
  }
  return pool;
}

async function initKnowledgeDb() {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    const p = getPool();
    if (!p) {
      ready = false;
      console.warn(
        "[Eva][KB] No EVA_DATABASE_URL / DATABASE_URL — knowledge base disabled until configured.",
      );
      return false;
    }
    const client = await p.connect();
    try {
      await ensureSchema(client);
      ready = true;
      console.log("[Eva][KB] Postgres knowledge base ready");
      return true;
    } finally {
      client.release();
    }
  })().catch((err) => {
    ready = false;
    initPromise = null;
    console.warn("[Eva][KB] Postgres init failed:", err?.message || err);
    return false;
  });
  return initPromise;
}

function isReady() {
  return ready;
}

async function searchKnowledgeBase(query, limit = 3) {
  await initKnowledgeDb();
  const p = getPool();
  if (!p || !ready) return [];

  const tokens = tokenizeForKb(query).slice(0, 30);
  const q = String(query || "").trim();
  if (!q) return [];

  const { rows } = await p.query(
    `
    WITH q AS (
      SELECT
        $1::text AS query_text,
        lower($1::text) AS query_norm,
        $2::text[] AS tokens
    )
    SELECT
      e.*,
      (
        CASE
          WHEN e.query_norm = q.query_norm THEN 12
          WHEN e.query_norm LIKE '%' || q.query_norm || '%' THEN 8
          WHEN similarity(e.query, q.query_text) > 0.2 THEN 6
          ELSE 0
        END
        + (
          SELECT COALESCE(SUM(
            CASE
              WHEN t = ANY(e.keywords) THEN 3
              WHEN e.query ILIKE '%' || t || '%' THEN 1.5
              WHEN e.notes ILIKE '%' || t || '%' THEN 1
              WHEN e.answer ILIKE '%' || t || '%' THEN 1
              ELSE 0
            END
          ), 0)
          FROM unnest(q.tokens) AS t
        )
        + LEAST(3, e.hit_count * 0.05)
        + similarity(e.query, q.query_text) * 4
      )::float AS score
    FROM knowledge_entries e, q
    WHERE
      e.query_norm = q.query_norm
      OR e.query_norm LIKE '%' || q.query_norm || '%'
      OR similarity(e.query, q.query_text) > 0.12
      OR e.keywords && q.tokens
      OR e.notes ILIKE '%' || split_part(q.query_text, E'\\n', 1) || '%'
    ORDER BY score DESC, e.updated_at DESC
    LIMIT $3
    `,
    [q, tokens, limit],
  );

  const hits = rows
    .map((row) => ({
      entry: mapRow(row),
      score: Number(row.score || 0),
    }))
    .filter((h) => h.score >= 4);

  if (hits.length) {
    const ids = hits.map((h) => h.entry.id);
    await p.query(
      `
      UPDATE knowledge_entries
      SET hit_count = hit_count + 1, updated_at = NOW()
      WHERE id = ANY($1::text[])
      `,
      [ids],
    );
  }

  return hits;
}

async function addKnowledgeEntry({ query, answer, notes, sources }) {
  await initKnowledgeDb();
  const p = getPool();
  if (!p || !ready) {
    throw new Error("Postgres knowledge base is not ready");
  }

  const q = String(query || "").trim();
  const qNorm = q.toLowerCase();
  const keywords = tokenizeForKb(q).slice(0, 40);
  const id = `kb_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const src = Array.isArray(sources) ? sources : [];

  const { rows } = await p.query(
    `
    INSERT INTO knowledge_entries (
      id, query, query_norm, keywords, answer, notes, sources, hit_count, created_at, updated_at
    ) VALUES (
      $1, $2, $3, $4::text[], $5, $6, $7::jsonb, 1, NOW(), NOW()
    )
    ON CONFLICT (query_norm) DO UPDATE SET
      answer = COALESCE(NULLIF(EXCLUDED.answer, ''), knowledge_entries.answer),
      notes = COALESCE(NULLIF(EXCLUDED.notes, ''), knowledge_entries.notes),
      sources = CASE
        WHEN EXCLUDED.sources = '[]'::jsonb THEN knowledge_entries.sources
        ELSE EXCLUDED.sources
      END,
      keywords = (
        SELECT ARRAY(
          SELECT DISTINCT unnest(knowledge_entries.keywords || EXCLUDED.keywords)
        )
      ),
      hit_count = knowledge_entries.hit_count + 1,
      updated_at = NOW()
    RETURNING *
    `,
    [
      id,
      q,
      qNorm,
      keywords,
      String(answer || "").trim(),
      String(notes || "").trim(),
      JSON.stringify(src),
    ],
  );

  const entry = mapRow(rows[0]);
  console.log(`[Eva][KB] saved ${entry.id} (${entry.query.slice(0, 60)})`);
  return entry;
}

async function countKnowledgeEntries() {
  await initKnowledgeDb();
  const p = getPool();
  if (!p || !ready) return 0;
  const { rows } = await p.query(`SELECT COUNT(*)::int AS n FROM knowledge_entries`);
  return Number(rows[0]?.n || 0);
}

/**
 * List KB rows for export / training (newest first).
 * @param {{ limit?: number, offset?: number, minAnswerLen?: number, selfDrillOnly?: boolean }} opts
 */
async function listKnowledgeEntries(opts = {}) {
  await initKnowledgeDb();
  const p = getPool();
  if (!p || !ready) return [];

  const limit = Math.max(1, Math.min(50_000, Number(opts.limit || 10_000)));
  const offset = Math.max(0, Number(opts.offset || 0));
  const minAnswerLen = Math.max(0, Number(opts.minAnswerLen || 0));
  const selfDrillOnly = Boolean(opts.selfDrillOnly);

  const where = [];
  const params = [];
  if (selfDrillOnly) {
    params.push("%[self-drill/%");
    where.push(`notes ILIKE $${params.length}`);
  }
  if (minAnswerLen > 0) {
    params.push(minAnswerLen);
    where.push(
      `(char_length(COALESCE(NULLIF(answer, ''), notes)) >= $${params.length})`,
    );
  }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  params.push(limit);
  const limIdx = params.length;
  params.push(offset);
  const offIdx = params.length;

  const { rows } = await p.query(
    `
    SELECT *
    FROM knowledge_entries
    ${whereSql}
    ORDER BY updated_at DESC
    LIMIT $${limIdx} OFFSET $${offIdx}
    `,
    params,
  );
  return rows.map(mapRow);
}

async function closeKnowledgeDb() {
  if (pool) {
    await pool.end();
    pool = null;
    ready = false;
    initPromise = null;
  }
}

module.exports = {
  initKnowledgeDb,
  isReady,
  searchKnowledgeBase,
  addKnowledgeEntry,
  countKnowledgeEntries,
  listKnowledgeEntries,
  closeKnowledgeDb,
  tokenizeForKb,
  databaseUrl,
};
