-- 002_message_requests.sql
-- Add request status to conversations
ALTER TABLE conversations ADD COLUMN status text NOT NULL DEFAULT 'accepted';
ALTER TABLE conversations ADD COLUMN initiated_by uuid REFERENCES profiles(id) ON DELETE SET NULL;

-- Index for filtering by status
CREATE INDEX idx_conversations_status ON conversations(status);

-- Blocked users table
CREATE TABLE blocked_users (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id  uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  blocked_id  uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reason      text,
  created_at  timestamptz DEFAULT now(),
  UNIQUE(blocker_id, blocked_id)
);

-- RLS for blocked_users
ALTER TABLE blocked_users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own blocks"
  ON blocked_users FOR ALL
  USING (blocker_id = auth.uid());
