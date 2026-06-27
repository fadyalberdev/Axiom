-- ============================================================
-- Migration 004: knowledge_chunks table + hybrid search RPC
-- Phase 7 — AI RAG Enhancement
-- Run in Supabase SQL Editor against project pgaqqseqwtgsuihbswnv
-- ============================================================

-- 1. Create the knowledge_chunks table
CREATE TABLE IF NOT EXISTS knowledge_chunks (
  id          uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type text         NOT NULL CHECK (source_type IN ('listing', 'neighborhood', 'blog')),
  source_id   text         NOT NULL,
  chunk_text  text         NOT NULL,
  embedding   vector(768),
  metadata    jsonb        NOT NULL DEFAULT '{}',
  created_at  timestamptz  DEFAULT now(),
  updated_at  timestamptz  DEFAULT now()
);

-- 2. Indexes

-- Source lookup and upsert target (for re-chunking / invalidation by source)
CREATE UNIQUE INDEX IF NOT EXISTS idx_chunks_source
  ON knowledge_chunks (source_type, source_id);

-- Full-text search GIN index (English)
CREATE INDEX IF NOT EXISTS idx_chunks_fts
  ON knowledge_chunks
  USING gin(to_tsvector('english', chunk_text));

-- HNSW vector similarity index (cosine distance, 768-dim nomic-embed-text)
CREATE INDEX IF NOT EXISTS idx_chunks_embedding
  ON knowledge_chunks
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- 3. Row Level Security (service role bypasses — same pattern as all other tables)
ALTER TABLE knowledge_chunks ENABLE ROW LEVEL SECURITY;
CREATE POLICY chunks_service_all ON knowledge_chunks USING (true) WITH CHECK (true);

-- 4. Hybrid search RPC using Reciprocal Rank Fusion (RRF)
--    Combines full-text BM25-style ranking with semantic vector similarity.
--    Returns up to match_count rows ordered by combined RRF score.
CREATE OR REPLACE FUNCTION hybrid_search_chunks(
  query_text      text,
  query_embedding vector(768),
  match_count     int       DEFAULT 5,
  filter_source   text      DEFAULT NULL,
  filter_metadata jsonb     DEFAULT NULL,
  full_text_weight float    DEFAULT 1.0,
  semantic_weight  float    DEFAULT 1.0,
  rrf_k           int       DEFAULT 50
)
RETURNS TABLE (
  id          uuid,
  source_type text,
  source_id   text,
  chunk_text  text,
  metadata    jsonb,
  score       float
)
LANGUAGE sql AS $$
WITH
  full_text AS (
    SELECT id,
      row_number() OVER (
        ORDER BY ts_rank_cd(
          to_tsvector('english', chunk_text),
          websearch_to_tsquery('english', query_text)
        ) DESC
      ) AS rank_ix
    FROM knowledge_chunks
    WHERE
      to_tsvector('english', chunk_text) @@ websearch_to_tsquery('english', query_text)
      AND (filter_source IS NULL OR source_type = filter_source)
    LIMIT least(match_count, 30) * 2
  ),
  semantic AS (
    SELECT id,
      row_number() OVER (
        ORDER BY embedding <=> query_embedding
      ) AS rank_ix
    FROM knowledge_chunks
    WHERE
      (filter_source IS NULL OR source_type = filter_source)
      AND embedding IS NOT NULL
    LIMIT least(match_count, 30) * 2
  )
SELECT
  kc.id,
  kc.source_type,
  kc.source_id,
  kc.chunk_text,
  kc.metadata,
  (
    COALESCE(1.0 / (rrf_k + ft.rank_ix), 0.0) * full_text_weight +
    COALESCE(1.0 / (rrf_k + sem.rank_ix), 0.0) * semantic_weight
  ) AS score
FROM full_text ft
FULL OUTER JOIN semantic sem ON ft.id = sem.id
JOIN knowledge_chunks kc ON COALESCE(ft.id, sem.id) = kc.id
ORDER BY score DESC
LIMIT least(match_count, 30);
$$;
