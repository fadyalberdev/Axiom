-- Ensure knowledge chunk upserts can target source_type/source_id.
--
-- app.ai.embeddings and backend/scripts/batch_embed.py both call
-- upsert(..., on_conflict="source_type,source_id"). Postgres requires that
-- conflict target to be backed by a unique index or constraint.

drop index if exists public.idx_chunks_source;

create unique index if not exists idx_chunks_source
  on public.knowledge_chunks (source_type, source_id);
