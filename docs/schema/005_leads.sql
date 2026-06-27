-- Migration: 005_leads.sql
-- Creates the leads table for WhatsApp contact lead capture

CREATE TABLE IF NOT EXISTS leads (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  listing_id    uuid NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  agency_id     uuid REFERENCES agencies(id) ON DELETE SET NULL,
  contact_name  text NOT NULL,
  contact_phone text NOT NULL,
  source        text NOT NULL CHECK (source IN ('whatsapp_click', 'schedule_viewing')),
  is_billable   boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, listing_id)
);

CREATE INDEX IF NOT EXISTS leads_agency_id_idx ON leads(agency_id);
CREATE INDEX IF NOT EXISTS leads_listing_id_idx ON leads(listing_id);
CREATE INDEX IF NOT EXISTS leads_created_at_idx ON leads(created_at DESC);

-- RLS: admin reads all; users read their own
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_all_leads" ON leads
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "user_own_leads" ON leads
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "user_insert_leads" ON leads
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
