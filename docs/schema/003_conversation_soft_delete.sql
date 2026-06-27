-- ============================================================
-- Migration 003: Per-user conversation soft delete
-- Run in Supabase SQL Editor
-- ============================================================

ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS deleted_by_a_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS deleted_by_b_at timestamptz DEFAULT NULL;
