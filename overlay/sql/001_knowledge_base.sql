-- Eva knowledge base schema
CREATE EXTENSION IF NOT EXISTS pg_trgm;

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
);

CREATE UNIQUE INDEX IF NOT EXISTS knowledge_entries_query_norm_uidx
  ON knowledge_entries (query_norm);

CREATE INDEX IF NOT EXISTS knowledge_entries_keywords_gin
  ON knowledge_entries USING GIN (keywords);

CREATE INDEX IF NOT EXISTS knowledge_entries_query_trgm
  ON knowledge_entries USING GIN (query gin_trgm_ops);

CREATE INDEX IF NOT EXISTS knowledge_entries_notes_trgm
  ON knowledge_entries USING GIN (notes gin_trgm_ops);

CREATE INDEX IF NOT EXISTS knowledge_entries_updated_at_idx
  ON knowledge_entries (updated_at DESC);
