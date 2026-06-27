-- ============================================================
-- AXIOM V2 — Comprehensive Schema Migration
-- Version: 001
-- Date: 2026-03-02
-- Description: Complete V2 schema for the current retained tables.
--   Fixes missing core fields (bedrooms, bathrooms, size_sqm),
--   adds neighborhoods lookup, Egypt-specific listing fields,
--   and lifestyle preferences for AI matching.
--
-- Run in Supabase SQL Editor (or via Alembic migration).
-- Assumes: pgvector extension already enabled.
-- ============================================================

-- ── Extensions ──────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS vector;


-- ── Enum Types ───────────────────────────────────────────────────────────────

-- Single user role. 'admin' is granted manually, never set on signup.
CREATE TYPE user_role AS ENUM ('user', 'admin');

-- listing_category drives which nullable fields are relevant.
CREATE TYPE listing_category AS ENUM ('for_rent', 'for_sale', 'shared_housing');

-- Physical property type — independent of category.
-- Includes Egypt-market types: chalet, townhouse, twin_house, land, whole_building, office.
CREATE TYPE property_type AS ENUM (
  'apartment', 'villa', 'studio', 'duplex', 'penthouse',
  'commercial', 'room', 'chalet', 'townhouse', 'twin_house',
  'land', 'whole_building', 'office'
);

-- pending = awaiting admin review (new listing or flagged by AI fraud score)
-- active  = approved, visible to all users
-- rejected = rejected by admin (owner notified with reason)
-- sold/rented = deal closed (owner marks manually)
CREATE TYPE listing_status AS ENUM ('active', 'pending', 'rejected', 'sold', 'rented');

CREATE TYPE project_status     AS ENUM ('upcoming', 'in_progress', 'completed');
CREATE TYPE viewing_status     AS ENUM ('pending', 'confirmed', 'cancelled', 'completed');


-- ── Table 1: neighborhoods ────────────────────────────────────────────────────
-- Egyptian city + neighborhood lookup. Pre-seeded (~70 entries).
-- Enables consistent filtering, autocomplete, and area-based recommendations.

CREATE TABLE neighborhoods (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text        NOT NULL,          -- 'Maadi'
  name_ar    text,                          -- 'المعادي'
  city       text        NOT NULL,          -- 'Cairo'
  slug       text        UNIQUE NOT NULL,   -- 'maadi-cairo'
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_neighborhoods_city ON neighborhoods (city);
CREATE INDEX idx_neighborhoods_slug ON neighborhoods (slug);

ALTER TABLE neighborhoods ENABLE ROW LEVEL SECURITY;
CREATE POLICY neighborhoods_public_read ON neighborhoods FOR SELECT USING (true);
-- Admin writes enforced at FastAPI layer via service role key.


-- ── Table 2: profiles ────────────────────────────────────────────────────────
-- Extends Supabase auth.users. Single user type (no broker/seeker split).

CREATE TABLE profiles (
  id                    uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email                 text        NOT NULL,
  full_name             text,
  avatar_url            text,
  phone                 text,
  bio                   text,
  role                  user_role   NOT NULL DEFAULT 'user',
  is_verified_seller    boolean     NOT NULL DEFAULT false,
  gender                text        CHECK (gender IN ('male', 'female', 'other')),
  country_code          text,
  badges                text[]      NOT NULL DEFAULT '{}',
  age                   integer,
  occupation            text,
  -- lifestyle_preferences: used for AI roommate compatibility matching.
  -- Schema: { gender_preference, smoking_allowed, pets_allowed, guests_policy,
  --           noise_level, cleanliness, sleep_schedule, occupation_type }
  lifestyle_preferences jsonb,
  created_at            timestamptz DEFAULT now(),
  updated_at            timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY profiles_public_read ON profiles FOR SELECT USING (true);
CREATE POLICY profiles_self_write  ON profiles FOR ALL   USING (id = auth.uid());

-- Auto-insert trigger: creates profiles row when a new auth.users row is inserted.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url, role, is_verified_seller)
  VALUES (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url',
    'user',
    false
  );
  RETURN new;
END;
$$;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ── Table 3: agencies ────────────────────────────────────────────────────────

CREATE TABLE agencies (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id    uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name        text        NOT NULL,
  slug        text        UNIQUE NOT NULL,
  description text,
  logo_url    text,
  banner_url  text,
  website     text,
  phone       text,
  email       text,
  city        text,
  verified    boolean     NOT NULL DEFAULT false,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

CREATE INDEX idx_agencies_owner ON agencies (owner_id);


-- ── Table 4: projects ────────────────────────────────────────────────────────

CREATE TABLE projects (
  id              uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id       uuid          NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  title           text          NOT NULL,
  slug            text          UNIQUE NOT NULL,
  description     text,
  image_url       text,
  starting_price  numeric,
  units_total     integer,
  completion_pct  integer       NOT NULL DEFAULT 0 CHECK (completion_pct BETWEEN 0 AND 100),
  status          project_status NOT NULL DEFAULT 'upcoming',
  key_features    text[]        NOT NULL DEFAULT '{}',
  gallery_images  text[]        NOT NULL DEFAULT '{}',
  brochure_url    text,
  created_at      timestamptz   DEFAULT now(),
  updated_at      timestamptz   DEFAULT now()
);

CREATE INDEX idx_projects_agency ON projects (agency_id);


-- ── Table 5: listings ────────────────────────────────────────────────────────
-- All property types in one table. category field determines which optional
-- field groups are relevant.

CREATE TABLE listings (
  id             uuid             PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id       uuid             NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  agency_id      uuid             REFERENCES agencies(id) ON DELETE SET NULL,
  project_id     uuid             REFERENCES projects(id) ON DELETE SET NULL,

  -- ── Core ──
  title          text             NOT NULL,
  description    text,
  category       listing_category NOT NULL,
  property_type  property_type    NOT NULL,
  price          numeric          NOT NULL CHECK (price >= 0),
  currency       text             NOT NULL DEFAULT 'EGP',
  price_period   text,            -- '/month', '/year', '/sqm' etc.

  -- ── Location ──
  location       text             NOT NULL,   -- display string
  full_address   text,
  city           text             NOT NULL,
  neighborhood_id uuid            REFERENCES neighborhoods(id) ON DELETE SET NULL,
  compound_name  text,            -- e.g. 'Palm Hills', 'Hyde Park'
  latitude       numeric,
  longitude      numeric,

  -- ── Physical attributes ──
  bedrooms       integer,
  bathrooms      integer,
  size_sqm       numeric,
  floor_number   integer,
  total_floors   integer,

  -- ── Media & tags ──
  images         text[]           NOT NULL DEFAULT '{}',
  amenities      text[]           NOT NULL DEFAULT '{}',

  -- ── Rental fields (for_rent + shared_housing) ──
  lease_type     text             CHECK (lease_type IN ('monthly', 'yearly', 'daily')),
  min_stay_months integer,
  available_date date,            -- when unit is available from

  -- ── Sale fields (for_sale) ──
  -- payment_plan schema: { type, down_payment_pct, monthly_installment, years }
  payment_plan   jsonb,
  delivery_date  date,            -- off-plan delivery date
  title_deed_status text          CHECK (title_deed_status IN ('ready', 'off_plan', 'pending')),

  -- ── Shared housing fields (shared_housing only) ──
  room_type      text             CHECK (room_type IN ('ensuite', 'private', 'shared')),
  -- lifestyle_preferences schema: { gender_preference, smoking_allowed, pets_allowed,
  --   guests_policy, noise_level, cleanliness, sleep_schedule, occupation_type }
  lifestyle_preferences jsonb,
  total_spots    integer,
  filled_spots   integer          DEFAULT 0,
  availability   text,            -- 'available', 'limited', 'full'
  furnishing     text,            -- 'furnished', 'semi_furnished', 'unfurnished'
  utilities_included boolean      DEFAULT false,
  bathroom_type  text,            -- 'private', 'shared', 'ensuite'
  private_amenities text[]        NOT NULL DEFAULT '{}',
  shared_amenities  text[]        NOT NULL DEFAULT '{}',

  -- ── Status & AI ──
  status         listing_status   NOT NULL DEFAULT 'pending',
  fraud_score    float            NOT NULL DEFAULT 0,
  embedding      vector(768),     -- pgvector: generated from title + description + amenities
  views_count    integer          NOT NULL DEFAULT 0,
  is_new         boolean          NOT NULL DEFAULT true,
  verified       boolean          NOT NULL DEFAULT false,

  -- ── Soft delete ──
  deleted_at     timestamptz,
  created_at     timestamptz      DEFAULT now(),
  updated_at     timestamptz      DEFAULT now()
);

-- Hot path indexes
CREATE INDEX idx_listings_category    ON listings (category, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_listings_city        ON listings (city)             WHERE deleted_at IS NULL;
CREATE INDEX idx_listings_neighborhood ON listings (neighborhood_id) WHERE neighborhood_id IS NOT NULL;
CREATE INDEX idx_listings_price       ON listings (price)            WHERE deleted_at IS NULL;
CREATE INDEX idx_listings_bedrooms    ON listings (bedrooms)         WHERE bedrooms IS NOT NULL;
CREATE INDEX idx_listings_owner       ON listings (owner_id)         WHERE deleted_at IS NULL;
CREATE INDEX idx_listings_project     ON listings (project_id)       WHERE project_id IS NOT NULL;
CREATE INDEX idx_listings_pending     ON listings (status)           WHERE status = 'pending';
CREATE INDEX idx_listings_lease_type  ON listings (lease_type)       WHERE lease_type IS NOT NULL;
CREATE INDEX idx_listings_title_deed  ON listings (title_deed_status) WHERE title_deed_status IS NOT NULL;

-- pgvector HNSW index for semantic search
CREATE INDEX idx_listings_embedding ON listings
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

ALTER TABLE listings ENABLE ROW LEVEL SECURITY;
CREATE POLICY listings_public_read ON listings
  FOR SELECT USING (status = 'active' AND deleted_at IS NULL);
CREATE POLICY listings_owner_all ON listings
  FOR ALL USING (owner_id = auth.uid());


-- ── Table 8: favorites ───────────────────────────────────────────────────────

CREATE TABLE favorites (
  user_id    uuid        NOT NULL REFERENCES profiles(id)  ON DELETE CASCADE,
  listing_id uuid        NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (user_id, listing_id)
);

CREATE INDEX idx_favorites_user ON favorites (user_id);

ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;
CREATE POLICY favorites_own ON favorites FOR ALL USING (user_id = auth.uid());


-- ── Table 9: conversations ───────────────────────────────────────────────────

CREATE TABLE conversations (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a_id       uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  user_b_id       uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  listing_id      uuid        REFERENCES listings(id) ON DELETE SET NULL,
  last_message_at timestamptz,
  created_at      timestamptz DEFAULT now()
);

-- Prevents duplicate threads between the same two users on the same listing
CREATE UNIQUE INDEX idx_conversations_unique ON conversations (
  LEAST(user_a_id, user_b_id),
  GREATEST(user_a_id, user_b_id),
  COALESCE(listing_id, '00000000-0000-0000-0000-000000000000'::uuid)
);

ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY conversations_participants ON conversations
  FOR ALL USING (user_a_id = auth.uid() OR user_b_id = auth.uid());

-- Enable Realtime on conversations
ALTER PUBLICATION supabase_realtime ADD TABLE conversations;


-- ── Table 10: messages ───────────────────────────────────────────────────────

CREATE TABLE messages (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid        NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id       uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  text            text,
  attachment_url  text,
  attachment_name text,
  attachment_size text,
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX idx_messages_conversation ON messages (conversation_id, created_at DESC);

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY messages_participant ON messages
  FOR ALL USING (
    conversation_id IN (
      SELECT id FROM conversations
      WHERE user_a_id = auth.uid() OR user_b_id = auth.uid()
    )
  );

-- Trigger: update conversations.last_message_at on new message
CREATE OR REPLACE FUNCTION public.update_conversation_last_message()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE conversations SET last_message_at = NEW.created_at WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_new_message
  AFTER INSERT ON messages
  FOR EACH ROW EXECUTE FUNCTION public.update_conversation_last_message();

-- Enable Realtime on messages
ALTER PUBLICATION supabase_realtime ADD TABLE messages;


-- ── Table 12: blog_posts ─────────────────────────────────────────────────────

CREATE TABLE blog_posts (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id    uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title        text        NOT NULL,
  slug         text        UNIQUE NOT NULL,
  lead         text,
  category     text,
  image_url    text,
  content      jsonb       NOT NULL DEFAULT '[]', -- block-based content array
  tags         text[]      NOT NULL DEFAULT '{}',
  read_time    text,
  is_published boolean     NOT NULL DEFAULT false,
  published_at timestamptz,
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now()
);

CREATE INDEX idx_blog_posts_published ON blog_posts (is_published, published_at DESC)
  WHERE is_published = true;


-- ── Table 13: viewings ───────────────────────────────────────────────────────

CREATE TABLE viewings (
  id           uuid           PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id   uuid           NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  requester_id uuid           NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  owner_id     uuid           NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  scheduled_at timestamptz    NOT NULL,
  status       viewing_status NOT NULL DEFAULT 'pending',
  notes        text,
  created_at   timestamptz    DEFAULT now(),
  updated_at   timestamptz    DEFAULT now()
);

CREATE INDEX idx_viewings_listing   ON viewings (listing_id);
CREATE INDEX idx_viewings_requester ON viewings (requester_id);
CREATE INDEX idx_viewings_owner     ON viewings (owner_id);


-- ── Key Database Functions ───────────────────────────────────────────────────

-- Semantic similarity search using pgvector.
-- Hard filters run first, then cosine similarity re-ranks results.
CREATE OR REPLACE FUNCTION match_listings(
  query_embedding   vector(768),
  match_threshold   float        DEFAULT 0.5,
  match_count       integer      DEFAULT 20,
  filter_category   listing_category DEFAULT NULL,
  filter_city       text         DEFAULT NULL,
  filter_neighborhood_id uuid   DEFAULT NULL,
  filter_min_price  numeric      DEFAULT NULL,
  filter_max_price  numeric      DEFAULT NULL,
  filter_min_beds   integer      DEFAULT NULL,
  filter_max_beds   integer      DEFAULT NULL,
  filter_lease_type text         DEFAULT NULL,
  filter_room_type  text         DEFAULT NULL
)
RETURNS TABLE (
  id         uuid,
  title      text,
  similarity float
)
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT
    l.id,
    l.title,
    1 - (l.embedding <=> query_embedding) AS similarity
  FROM listings l
  WHERE
    l.status = 'active'
    AND l.deleted_at IS NULL
    AND l.embedding IS NOT NULL
    AND (filter_category   IS NULL OR l.category        = filter_category)
    AND (filter_city       IS NULL OR l.city            ILIKE filter_city)
    AND (filter_neighborhood_id IS NULL OR l.neighborhood_id = filter_neighborhood_id)
    AND (filter_min_price  IS NULL OR l.price           >= filter_min_price)
    AND (filter_max_price  IS NULL OR l.price           <= filter_max_price)
    AND (filter_min_beds   IS NULL OR l.bedrooms        >= filter_min_beds)
    AND (filter_max_beds   IS NULL OR l.bedrooms        <= filter_max_beds)
    AND (filter_lease_type IS NULL OR l.lease_type      = filter_lease_type)
    AND (filter_room_type  IS NULL OR l.room_type       = filter_room_type)
    AND 1 - (l.embedding <=> query_embedding) >= match_threshold
  ORDER BY l.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Atomic favorite toggle. Returns true if favorited, false if unfavorited.
CREATE OR REPLACE FUNCTION toggle_favorite(p_user_id uuid, p_listing_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  existing_id uuid;
BEGIN
  SELECT listing_id INTO existing_id
  FROM favorites WHERE user_id = p_user_id AND listing_id = p_listing_id;

  IF existing_id IS NOT NULL THEN
    DELETE FROM favorites WHERE user_id = p_user_id AND listing_id = p_listing_id;
    RETURN false;
  ELSE
    INSERT INTO favorites (user_id, listing_id) VALUES (p_user_id, p_listing_id);
    RETURN true;
  END IF;
END;
$$;

-- Atomic view count increment.
CREATE OR REPLACE FUNCTION increment_listing_views(p_listing_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE listings SET views_count = views_count + 1 WHERE id = p_listing_id;
END;
$$;

-- Returns conversations for a user with unread counts.
CREATE OR REPLACE FUNCTION get_user_conversations(p_user_id uuid)
RETURNS TABLE (
  conversation_id uuid,
  other_user_id   uuid,
  listing_id      uuid,
  last_message_at timestamptz,
  unread_count    bigint
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    CASE WHEN c.user_a_id = p_user_id THEN c.user_b_id ELSE c.user_a_id END,
    c.listing_id,
    c.last_message_at,
    COUNT(m.id) FILTER (WHERE m.sender_id != p_user_id) AS unread_count
  FROM conversations c
  LEFT JOIN messages m ON m.conversation_id = c.id
  WHERE c.user_a_id = p_user_id OR c.user_b_id = p_user_id
  GROUP BY c.id
  ORDER BY c.last_message_at DESC NULLS LAST;
END;
$$;

-- ── Seed Data: neighborhoods ─────────────────────────────────────────────────
-- ~70 major Egyptian cities and their key neighborhoods.

INSERT INTO neighborhoods (name, name_ar, city, slug) VALUES
  -- Cairo
  ('Maadi',             'المعادي',          'Cairo',    'maadi-cairo'),
  ('Zamalek',           'الزمالك',          'Cairo',    'zamalek-cairo'),
  ('Heliopolis',        'مصر الجديدة',       'Cairo',    'heliopolis-cairo'),
  ('Nasr City',         'مدينة نصر',         'Cairo',    'nasr-city-cairo'),
  ('Dokki',             'الدقي',            'Cairo',    'dokki-cairo'),
  ('Mohandessin',       'المهندسين',         'Cairo',    'mohandessin-cairo'),
  ('New Cairo',         'القاهرة الجديدة',    'Cairo',    'new-cairo'),
  ('5th Settlement',    'التجمع الخامس',      'Cairo',    '5th-settlement-cairo'),
  ('Rehab City',        'مدينة الرحاب',       'Cairo',    'rehab-cairo'),
  ('Madinaty',          'مدينتي',           'Cairo',    'madinaty-cairo'),
  ('Garden City',       'جاردن سيتي',        'Cairo',    'garden-city-cairo'),
  ('Downtown Cairo',    'وسط البلد',         'Cairo',    'downtown-cairo'),
  ('Abbassia',          'العباسية',          'Cairo',    'abbassia-cairo'),
  ('Shubra',            'شبرا',             'Cairo',    'shubra-cairo'),
  ('Ain Shams',         'عين شمس',          'Cairo',    'ain-shams-cairo'),
  ('Hadayek El Kobba',  'حدائق القبة',        'Cairo',    'hadayek-kobba-cairo'),
  ('Badr City',         'مدينة بدر',         'Cairo',    'badr-city-cairo'),
  ('Shorouk City',      'مدينة الشروق',       'Cairo',    'shorouk-cairo'),
  ('Obour City',        'مدينة العبور',       'Cairo',    'obour-cairo'),
  ('El Tagamoa',        'التجمع',            'Cairo',    'tagamoa-cairo'),
  ('Katameya',          'القطامية',          'Cairo',    'katameya-cairo'),
  ('Mokattam',          'المقطم',            'Cairo',    'mokattam-cairo'),
  ('Helwan',            'حلوان',            'Cairo',    'helwan-cairo'),
  ('Manyal',            'المنيل',            'Cairo',    'manyal-cairo'),
  -- Giza
  ('Sheikh Zayed',      'الشيخ زايد',         'Giza',     'sheikh-zayed-giza'),
  ('6th of October',    'السادس من أكتوبر',    'Giza',     '6th-october-giza'),
  ('Haram',             'الهرم',             'Giza',     'haram-giza'),
  ('Agouza',            'العجوزة',           'Giza',     'agouza-giza'),
  ('Imbaba',            'إمبابة',            'Giza',     'imbaba-giza'),
  ('Faisal',            'فيصل',             'Giza',     'faisal-giza'),
  ('Kerdasa',           'كرداسة',            'Giza',     'kerdasa-giza'),
  ('Boulaq El Dakrour', 'بولاق الدكرور',       'Giza',     'bulaq-dakrour-giza'),
  ('Hadayek El Ahram',  'حدائق الأهرام',       'Giza',     'hadayek-ahram-giza'),
  -- New Capital
  ('R2 District',       'حي R2',             'New Capital', 'r2-new-capital'),
  ('R3 District',       'حي R3',             'New Capital', 'r3-new-capital'),
  ('R7 District',       'حي R7',             'New Capital', 'r7-new-capital'),
  ('Downtown District', 'منطقة وسط المدينة',   'New Capital', 'downtown-new-capital'),
  ('Financial District','الحي المالي',         'New Capital', 'financial-new-capital'),
  -- Alexandria
  ('Smouha',            'سموحة',             'Alexandria', 'smouha-alex'),
  ('Gleem',             'جليم',              'Alexandria', 'gleem-alex'),
  ('Stanly',            'ستانلي',            'Alexandria', 'stanly-alex'),
  ('Kafr Abdo',         'كفر عبده',           'Alexandria', 'kafr-abdo-alex'),
  ('Sidi Gaber',        'سيدي جابر',          'Alexandria', 'sidi-gaber-alex'),
  ('Roushdy',           'رشدي',              'Alexandria', 'roushdy-alex'),
  ('Ibrahimia',         'إبراهيمية',          'Alexandria', 'ibrahimia-alex'),
  ('Miami',             'ميامي',             'Alexandria', 'miami-alex'),
  ('Agami',             'العجمي',            'Alexandria', 'agami-alex'),
  ('Montazah',          'المنتزه',            'Alexandria', 'montazah-alex'),
  ('El Mandara',        'المندرة',            'Alexandria', 'mandara-alex'),
  ('Cleopatra',         'كليوباترا',          'Alexandria', 'cleopatra-alex'),
  -- North Coast
  ('Sahel',             'الساحل الشمالي',      'North Coast', 'sahel-north-coast'),
  ('Marina',            'مارينا',             'North Coast', 'marina-north-coast'),
  ('Marassi',           'مراسي',              'North Coast', 'marassi-north-coast'),
  ('Hacienda Bay',      'هاسيندا باي',         'North Coast', 'hacienda-north-coast'),
  ('Sidi Abd El Rahman', 'سيدي عبد الرحمن',   'North Coast', 'sidi-abdelrahman'),
  ('El Alamein',        'العلمين',            'North Coast', 'alamein-north-coast'),
  -- Ain Sokhna
  ('Porto Sokhna',      'بورتو السخنة',        'Ain Sokhna', 'porto-sokhna'),
  ('Mountain View Sokhna', 'ماونتن فيو السخنة', 'Ain Sokhna', 'mv-sokhna'),
  ('Ain Sokhna Downtown', 'السخنة',            'Ain Sokhna', 'ain-sokhna-downtown'),
  -- Hurghada
  ('El Mamsha',         'الممشى',             'Hurghada',   'mamsha-hurghada'),
  ('Downtown Hurghada', 'وسط الغردقة',         'Hurghada',   'downtown-hurghada'),
  ('El Gouna',          'الجونة',             'Hurghada',   'gouna-hurghada'),
  ('Sahl Hasheesh',     'سهل حشيش',           'Hurghada',   'sahl-hasheesh'),
  -- Sharm El Sheikh
  ('Naama Bay',         'خليج نعمة',           'Sharm El Sheikh', 'naama-bay'),
  ('Hadaba',            'الحدبة',             'Sharm El Sheikh', 'hadaba-sharm'),
  ('Sharks Bay',        'خليج الشارك',         'Sharm El Sheikh', 'sharks-bay'),
  ('Nabq',              'نبق',               'Sharm El Sheikh', 'nabq-sharm'),
  -- Mansoura
  ('Mansoura Downtown', 'وسط المنصورة',        'Mansoura',   'downtown-mansoura'),
  ('New Mansoura',      'المنصورة الجديدة',     'Mansoura',   'new-mansoura'),
  -- Luxor & Aswan
  ('Luxor City',        'الأقصر',             'Luxor',      'luxor-city'),
  ('Aswan City',        'أسوان',              'Aswan',      'aswan-city');
