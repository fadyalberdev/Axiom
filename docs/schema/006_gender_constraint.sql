-- ============================================================
-- Migration 006: Tighten gender CHECK to male/female only
-- Run in Supabase SQL Editor.
-- ============================================================

-- Null out any existing 'other' values before adding constraint
UPDATE profiles SET gender = NULL WHERE gender = 'other';

ALTER TABLE profiles
  DROP CONSTRAINT IF EXISTS profiles_gender_check;

ALTER TABLE profiles
  ADD CONSTRAINT profiles_gender_check
    CHECK (gender IN ('male', 'female'));
