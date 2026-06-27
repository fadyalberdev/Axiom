# AXIOM V2 — Complete Database Schema Reference
> For ERD, Mapping, and Class Diagram use  
> Last extracted: 2026-06-17 (post all migrations)

---

## Active Tables (12 tables post-June 2026 cleanup)

> Removed tables (bookings, booking_disbursements, viewings, messages, conversations,
> blocked_users, listing_applications, housemates, notifications) were dropped on 2026-06-17.

---

## ENUM Types

| Enum Name           | Values                                                                      |
|---------------------|-----------------------------------------------------------------------------|
| `user_role`         | `'user'`, `'admin'`                                                         |
| `listing_category`  | `'for_rent'`, `'for_sale'`, `'shared_housing'`                              |
| `property_type`     | `'apartment'`, `'villa'`, `'studio'`, `'duplex'`, `'penthouse'`, `'commercial'`, `'room'`, `'chalet'`, `'townhouse'`, `'twin_house'`, `'land'`, `'whole_building'`, `'office'` |
| `listing_status`    | `'active'`, `'pending'`, `'rejected'`, `'sold'`, `'rented'`, `'reserved'`, `'booked'` |
| `project_status`    | `'upcoming'`, `'in_progress'`, `'completed'`                                |
| `subscription_plan` | `'free'`, `'trial'`, `'basic'`, `'pro'`, `'agency'`                         |

---

## Table 1: `neighborhoods`

Egyptian city + neighborhood lookup (~70 seeded entries).

| Column       | Type        | Constraints                      |
|--------------|-------------|----------------------------------|
| `id`         | UUID        | PK, DEFAULT gen_random_uuid()    |
| `name`       | TEXT        | NOT NULL                         |
| `name_ar`    | TEXT        | nullable (Arabic name)           |
| `city`       | TEXT        | NOT NULL                         |
| `slug`       | TEXT        | UNIQUE NOT NULL                  |
| `created_at` | TIMESTAMPTZ | DEFAULT now()                    |

**Indexes:** `idx_neighborhoods_city (city)`, `idx_neighborhoods_slug (slug)`

---

## Table 2: `profiles`

Extends `auth.users`. Single user type — no broker/seeker split.

| Column                  | Type        | Constraints                                        |
|-------------------------|-------------|----------------------------------------------------|
| `id`                    | UUID        | PK, FK → `auth.users(id)` ON DELETE CASCADE        |
| `email`                 | TEXT        | NOT NULL                                           |
| `full_name`             | TEXT        | nullable                                           |
| `avatar_url`            | TEXT        | nullable                                           |
| `phone`                 | TEXT        | nullable                                           |
| `whatsapp_number`       | TEXT        | nullable                                           |
| `bio`                   | TEXT        | nullable                                           |
| `role`                  | user_role   | NOT NULL, DEFAULT `'user'`                         |
| `is_verified_seller`    | BOOLEAN     | NOT NULL, DEFAULT false                            |
| `gender`                | TEXT        | CHECK IN (`'male'`, `'female'`)                    |
| `country_code`          | TEXT        | nullable                                           |
| `badges`                | TEXT[]      | NOT NULL, DEFAULT `'{}'`                           |
| `age`                   | INTEGER     | nullable (calculated from birth_date)              |
| `birth_date`            | DATE        | nullable                                           |
| `occupation`            | TEXT        | nullable                                           |
| `lifestyle_preferences` | JSONB       | nullable — `{gender_preference, smoking_allowed, pets_allowed, guests_policy, noise_level, cleanliness, sleep_schedule, occupation_type}` |
| `stripe_account_id`     | TEXT        | nullable                                           |
| `created_at`            | TIMESTAMPTZ | DEFAULT now()                                      |
| `updated_at`            | TIMESTAMPTZ | DEFAULT now()                                      |

**Trigger:** `on_auth_user_created` — auto-inserts row on `auth.users` INSERT.

---

## Table 3: `agencies`

Real estate agencies. One per user (enforced at API layer).

| Column        | Type        | Constraints                                  |
|---------------|-------------|----------------------------------------------|
| `id`          | UUID        | PK, DEFAULT gen_random_uuid()                |
| `owner_id`    | UUID        | NOT NULL, FK → `profiles(id)` ON DELETE CASCADE |
| `name`        | TEXT        | NOT NULL                                     |
| `slug`        | TEXT        | UNIQUE NOT NULL                              |
| `description` | TEXT        | nullable                                     |
| `logo_url`    | TEXT        | nullable                                     |
| `banner_url`  | TEXT        | nullable                                     |
| `website`     | TEXT        | nullable                                     |
| `phone`       | TEXT        | nullable                                     |
| `email`       | TEXT        | nullable                                     |
| `city`        | TEXT        | nullable                                     |
| `founded_year`| INTEGER     | nullable                                     |
| `verified`    | BOOLEAN     | NOT NULL, DEFAULT false                      |
| `created_at`  | TIMESTAMPTZ | DEFAULT now()                                |
| `updated_at`  | TIMESTAMPTZ | DEFAULT now()                                |

**Indexes:** `idx_agencies_owner (owner_id)`

---

## Table 4: `projects`

Real estate development projects, belonging to an agency.

| Column           | Type           | Constraints                                    |
|------------------|----------------|------------------------------------------------|
| `id`             | UUID           | PK, DEFAULT gen_random_uuid()                  |
| `agency_id`      | UUID           | NOT NULL, FK → `agencies(id)` ON DELETE CASCADE |
| `title`          | TEXT           | NOT NULL                                       |
| `slug`           | TEXT           | UNIQUE NOT NULL                                |
| `description`    | TEXT           | nullable                                       |
| `image_url`      | TEXT           | nullable                                       |
| `starting_price` | NUMERIC        | nullable                                       |
| `units_total`    | INTEGER        | nullable                                       |
| `completion_pct` | INTEGER        | NOT NULL, DEFAULT 0, CHECK 0–100               |
| `status`         | project_status | NOT NULL, DEFAULT `'upcoming'`                 |
| `key_features`   | TEXT[]         | NOT NULL, DEFAULT `'{}'`                       |
| `created_at`     | TIMESTAMPTZ    | DEFAULT now()                                  |
| `updated_at`     | TIMESTAMPTZ    | DEFAULT now()                                  |

**Indexes:** `idx_projects_agency (agency_id)`

---

## Table 5: `universities`

University entities. Listings can be tagged with a university (near-campus housing).

| Column          | Type        | Constraints                      |
|-----------------|-------------|----------------------------------|
| `id`            | UUID        | PK, DEFAULT gen_random_uuid()    |
| `owner_id`      | UUID        | nullable, FK → `profiles(id)`    |
| `name`          | TEXT        | NOT NULL                         |
| `slug`          | TEXT        | UNIQUE NOT NULL                  |
| `description`   | TEXT        | nullable                         |
| `logo_url`      | TEXT        | nullable                         |
| `banner_url`    | TEXT        | nullable                         |
| `website`       | TEXT        | nullable                         |
| `phone`         | TEXT        | nullable                         |
| `email`         | TEXT        | nullable                         |
| `city`          | TEXT        | nullable                         |
| `type`          | TEXT        | nullable (e.g. `'public'`, `'private'`) |
| `student_count` | INTEGER     | nullable                         |
| `accreditation` | TEXT        | nullable                         |
| `founded_year`  | INTEGER     | nullable                         |
| `verified`      | BOOLEAN     | DEFAULT false                    |
| `created_at`    | TIMESTAMPTZ | DEFAULT now()                    |

---

## Table 6: `listings`

All property types in one table. `category` drives which optional field groups apply.

| Column                  | Type             | Constraints                                            |
|-------------------------|------------------|--------------------------------------------------------|
| `id`                    | UUID             | PK, DEFAULT gen_random_uuid()                          |
| `owner_id`              | UUID             | NOT NULL, FK → `profiles(id)` ON DELETE CASCADE        |
| `agency_id`             | UUID             | nullable, FK → `agencies(id)` ON DELETE SET NULL       |
| `project_id`            | UUID             | nullable, FK → `projects(id)` ON DELETE SET NULL       |
| `neighborhood_id`       | UUID             | nullable, FK → `neighborhoods(id)` ON DELETE SET NULL  |
| `university_id`         | UUID             | nullable, FK → `universities(id)` ON DELETE SET NULL   |
| **Core**                |                  |                                                        |
| `title`                 | TEXT             | NOT NULL                                               |
| `description`           | TEXT             | nullable                                               |
| `category`              | listing_category | NOT NULL                                               |
| `property_type`         | property_type    | NOT NULL                                               |
| `price`                 | NUMERIC          | NOT NULL, CHECK >= 0                                   |
| `currency`              | TEXT             | NOT NULL, DEFAULT `'EGP'`                              |
| `price_period`          | TEXT             | nullable (`'/month'`, `'/year'`, `'/sqm'`)             |
| **Location**            |                  |                                                        |
| `location`              | TEXT             | NOT NULL (display string)                              |
| `full_address`          | TEXT             | nullable                                               |
| `city`                  | TEXT             | NOT NULL                                               |
| `compound_name`         | TEXT             | nullable                                               |
| `latitude`              | NUMERIC          | nullable                                               |
| `longitude`             | NUMERIC          | nullable                                               |
| **Physical**            |                  |                                                        |
| `bedrooms`              | INTEGER          | nullable                                               |
| `bathrooms`             | INTEGER          | nullable                                               |
| `size_sqm`              | NUMERIC          | nullable                                               |
| `floor_number`          | INTEGER          | nullable                                               |
| `total_floors`          | INTEGER          | nullable                                               |
| **Media**               |                  |                                                        |
| `images`                | TEXT[]           | NOT NULL, DEFAULT `'{}'`                               |
| `amenities`             | TEXT[]           | NOT NULL, DEFAULT `'{}'`                               |
| **Rental fields**       |                  |                                                        |
| `lease_type`            | TEXT             | CHECK IN (`'monthly'`, `'yearly'`, `'daily'`)          |
| `min_stay_months`       | INTEGER          | nullable                                               |
| `available_date`        | DATE             | nullable                                               |
| **Sale fields**         |                  |                                                        |
| `payment_plan`          | JSONB            | nullable — `{type, down_payment_pct, monthly_installment, years}` |
| `delivery_date`         | DATE             | nullable                                               |
| `title_deed_status`     | TEXT             | CHECK IN (`'ready'`, `'off_plan'`, `'pending'`)        |
| **Shared housing fields**|                 |                                                        |
| `room_type`             | TEXT             | CHECK IN (`'ensuite'`, `'private'`, `'shared'`)        |
| `lifestyle_preferences` | JSONB            | nullable — `{gender_preference, smoking_allowed, pets_allowed, guests_policy, noise_level, cleanliness, sleep_schedule, occupation_type}` |
| `total_spots`           | INTEGER          | nullable                                               |
| `filled_spots`          | INTEGER          | DEFAULT 0                                              |
| `availability`          | TEXT             | nullable (`'available'`, `'limited'`, `'full'`)        |
| `furnishing`            | TEXT             | nullable (`'furnished'`, `'semi_furnished'`, `'unfurnished'`) |
| `utilities_included`    | BOOLEAN          | DEFAULT false                                          |
| `bathroom_type`         | TEXT             | nullable (`'private'`, `'shared'`, `'ensuite'`)        |
| `private_amenities`     | TEXT[]           | NOT NULL, DEFAULT `'{}'`                               |
| `shared_amenities`      | TEXT[]           | NOT NULL, DEFAULT `'{}'`                               |
| **Status & AI**         |                  |                                                        |
| `status`                | listing_status   | NOT NULL, DEFAULT `'pending'`                          |
| `fraud_score`           | FLOAT            | NOT NULL, DEFAULT 0                                    |
| `embedding`             | VECTOR(768)      | nullable (pgvector, cosine ops)                        |
| `views_count`           | INTEGER          | NOT NULL, DEFAULT 0                                    |
| `is_new`                | BOOLEAN          | NOT NULL, DEFAULT true                                 |
| `verified`              | BOOLEAN          | NOT NULL, DEFAULT false                                |
| `paused_at`             | TIMESTAMPTZ      | nullable (subscription lapse)                          |
| `deleted_at`            | TIMESTAMPTZ      | nullable (soft delete)                                 |
| `created_at`            | TIMESTAMPTZ      | DEFAULT now()                                          |
| `updated_at`            | TIMESTAMPTZ      | DEFAULT now()                                          |

**Indexes:** `idx_listings_category`, `idx_listings_city`, `idx_listings_neighborhood`, `idx_listings_price`, `idx_listings_bedrooms`, `idx_listings_owner`, `idx_listings_project`, `idx_listings_pending`, `idx_listings_lease_type`, `idx_listings_title_deed`, `idx_listings_embedding` (HNSW vector)

---

## Table 7: `favorites`

Junction table: user ↔ listing saved relationship.

| Column       | Type        | Constraints                                         |
|--------------|-------------|-----------------------------------------------------|
| `user_id`    | UUID        | NOT NULL, FK → `profiles(id)` ON DELETE CASCADE     |
| `listing_id` | UUID        | NOT NULL, FK → `listings(id)` ON DELETE CASCADE     |
| `created_at` | TIMESTAMPTZ | DEFAULT now()                                       |

**Primary Key:** `(user_id, listing_id)` composite  
**Indexes:** `idx_favorites_user (user_id)`

---

## Table 8: `blog_posts`

CMS content managed by admin users.

| Column        | Type        | Constraints                                      |
|---------------|-------------|--------------------------------------------------|
| `id`          | UUID        | PK, DEFAULT gen_random_uuid()                    |
| `author_id`   | UUID        | NOT NULL, FK → `profiles(id)` ON DELETE CASCADE  |
| `title`       | TEXT        | NOT NULL                                         |
| `slug`        | TEXT        | UNIQUE NOT NULL                                  |
| `lead`        | TEXT        | nullable (subtitle/excerpt)                      |
| `category`    | TEXT        | nullable                                         |
| `image_url`   | TEXT        | nullable                                         |
| `content`     | JSONB       | NOT NULL, DEFAULT `'[]'` (block-based array)     |
| `tags`        | TEXT[]      | NOT NULL, DEFAULT `'{}'`                         |
| `read_time`   | TEXT        | nullable                                         |
| `is_published`| BOOLEAN     | NOT NULL, DEFAULT false                          |
| `published_at`| TIMESTAMPTZ | nullable                                         |
| `created_at`  | TIMESTAMPTZ | DEFAULT now()                                    |
| `updated_at`  | TIMESTAMPTZ | DEFAULT now()                                    |

**Indexes:** `idx_blog_posts_published (is_published, published_at DESC) WHERE is_published = true`

---

## Table 9: `leads`

WhatsApp contact lead capture — one per user-listing pair.

| Column          | Type        | Constraints                                         |
|-----------------|-------------|-----------------------------------------------------|
| `id`            | UUID        | PK, DEFAULT gen_random_uuid()                       |
| `user_id`       | UUID        | NOT NULL, FK → `profiles(id)` ON DELETE CASCADE     |
| `listing_id`    | UUID        | NOT NULL, FK → `listings(id)` ON DELETE CASCADE     |
| `agency_id`     | UUID        | nullable, FK → `agencies(id)` ON DELETE SET NULL    |
| `contact_name`  | TEXT        | NOT NULL                                            |
| `contact_phone` | TEXT        | NOT NULL                                            |
| `source`        | TEXT        | NOT NULL, CHECK = `'whatsapp_click'`                |
| `is_billable`   | BOOLEAN     | NOT NULL, DEFAULT false                             |
| `created_at`    | TIMESTAMPTZ | NOT NULL, DEFAULT now()                             |

**Unique Constraint:** `(user_id, listing_id)`  
**Indexes:** `leads_agency_id_idx`, `leads_listing_id_idx`, `leads_created_at_idx`

---

## Table 10: `subscriptions`

Owner subscription plans. One row per user (1-1 with profiles).

| Column                   | Type              | Constraints                                 |
|--------------------------|-------------------|---------------------------------------------|
| `id`                     | UUID              | PK, DEFAULT gen_random_uuid()               |
| `user_id`                | UUID              | NOT NULL, UNIQUE, FK → `profiles(id)`       |
| `plan`                   | subscription_plan | NOT NULL, DEFAULT `'free'`                  |
| `status`                 | TEXT              | NOT NULL, DEFAULT `'active'`, CHECK IN (`'active'`, `'trialing'`, `'past_due'`, `'canceled'`) |
| `stripe_customer_id`     | TEXT              | nullable                                    |
| `stripe_subscription_id` | TEXT              | UNIQUE, nullable                            |
| `trial_used`             | BOOLEAN           | NOT NULL, DEFAULT false                     |
| `trial_ends_at`          | TIMESTAMPTZ       | nullable                                    |
| `current_period_end`     | TIMESTAMPTZ       | nullable                                    |
| `ai_descriptions_used`   | INTEGER           | NOT NULL, DEFAULT 0                         |
| `ai_period_start`        | TIMESTAMPTZ       | NOT NULL, DEFAULT now()                     |
| `created_at`             | TIMESTAMPTZ       | NOT NULL, DEFAULT now()                     |
| `updated_at`             | TIMESTAMPTZ       | NOT NULL, DEFAULT now()                     |

**Indexes:** `idx_subscriptions_user (user_id)`

---

## Table 11: `payments`

Platform payment ledger — source of truth for every Stripe charge.

| Column                     | Type         | Constraints                                     |
|----------------------------|--------------|-------------------------------------------------|
| `id`                       | UUID         | PK, DEFAULT gen_random_uuid()                   |
| `user_id`                  | UUID         | NOT NULL, FK → `profiles(id)`                   |
| `listing_id`               | UUID         | nullable, FK → `listings(id)`                   |
| `kind`                     | TEXT         | NOT NULL, CHECK IN (`'verification'`, `'application_fee'`, `'subscription'`) |
| `amount`                   | NUMERIC(12,2)| NOT NULL                                        |
| `currency`                 | TEXT         | NOT NULL, DEFAULT `'egp'`                       |
| `stripe_payment_intent_id` | TEXT         | UNIQUE, nullable                                |
| `status`                   | TEXT         | NOT NULL, DEFAULT `'pending'`, CHECK IN (`'pending'`, `'succeeded'`, `'refunded'`, `'failed'`) |
| `created_at`               | TIMESTAMPTZ  | NOT NULL, DEFAULT now()                         |
| `refunded_at`              | TIMESTAMPTZ  | nullable                                        |

**Indexes:** `idx_payments_user (user_id, created_at DESC)`, `idx_payments_listing (listing_id)`

---

## Table 12: `knowledge_chunks`

AI RAG (Retrieval-Augmented Generation) vector store. One chunk per source entity.

| Column        | Type        | Constraints                                              |
|---------------|-------------|----------------------------------------------------------|
| `id`          | UUID        | PK, DEFAULT gen_random_uuid()                            |
| `source_type` | TEXT        | NOT NULL, CHECK IN (`'listing'`, `'neighborhood'`, `'blog'`) |
| `source_id`   | TEXT        | NOT NULL (ID of the source record as string)             |
| `chunk_text`  | TEXT        | NOT NULL                                                 |
| `embedding`   | VECTOR(768) | nullable (pgvector HNSW index)                           |
| `metadata`    | JSONB       | NOT NULL, DEFAULT `'{}'`                                 |
| `created_at`  | TIMESTAMPTZ | DEFAULT now()                                            |
| `updated_at`  | TIMESTAMPTZ | DEFAULT now()                                            |

**Unique Index:** `idx_chunks_source (source_type, source_id)`  
**Indexes:** `idx_chunks_fts` (GIN full-text), `idx_chunks_embedding` (HNSW vector)

---

## Relationship Summary (Foreign Keys)

```
auth.users (Supabase)
  └── profiles.id  (1:1 extension)

profiles
  ├── agencies.owner_id         (1:N — one user can own one agency)
  ├── universities.owner_id     (1:N)
  ├── listings.owner_id         (1:N — user owns many listings)
  ├── blog_posts.author_id      (1:N — user authors many posts)
  ├── favorites.user_id         (1:N)
  ├── leads.user_id             (1:N)
  ├── subscriptions.user_id     (1:1 — one subscription per user)
  └── payments.user_id          (1:N)

agencies
  ├── projects.agency_id        (1:N — agency has many projects)
  ├── listings.agency_id        (1:N)
  └── leads.agency_id           (1:N)

projects
  └── listings.project_id       (1:N)

neighborhoods
  └── listings.neighborhood_id  (1:N)

universities
  └── listings.university_id    (1:N)

listings
  ├── favorites.listing_id      (1:N — many users can favorite)
  ├── leads.listing_id          (1:N)
  └── payments.listing_id       (1:N)
```

---

## ER-to-Relational Mapping (from ERD)

Relational schema derived from the conceptual ERD by applying standard mapping rules:
PKs are <u>underlined</u>, foreign keys are marked `*FK*`, each **multivalued attribute**
(phone, images) becomes its own relation, and the **derived attribute** `age` is not stored.

### Strong entities

```
user( user_id, full_name, email, gender, role, DOB )
       └ PK: user_id        (age is derived from DOB → not stored)

Blog_post( Blog_id, title, category, is_published, user_id* )
       └ PK: Blog_id        FK user_id → user        (creates)

Listing( listing_id, title, category, description, property_type,
         price, status, bathrooms, bedrooms, city,
         owner_id*, project_id*, agency_id*, university_id* )
       └ PK: listing_id
         FK owner_id      → user        (owns)
         FK project_id    → Project     (contains)
         FK agency_id     → Agency      (contains)
         FK university_id → University  (Near)

Lead( lead_id, source, contact_name, contact_phone, listing_id* )
       └ PK: lead_id        FK listing_id → Listing   (Generates)

Project( Project_id, Title, description, start_price, status )
       └ PK: Project_id

Agency( Agency_id, name, description, price, city )
       └ PK: Agency_id

University( University_id, name, description, type, city )
       └ PK: University_id

Payment( Payment_id, amount, status, payment_method, user_id* )
       └ PK: Payment_id     FK user_id → user        (generates)

Subscription( Subscription_id, time_end, status, plan, user_id* )
       └ PK: Subscription_id  FK user_id → user      (has)

Housemate( housemate_id, name, occupation, gender, listing_id* )
       └ PK: housemate_id   FK listing_id → Listing  (Contains)

KnowledgeChunk( knowledge_id, source, chunk_text, listing_id* )
       └ PK: knowledge_id   FK listing_id → Listing  (Generated from)
```

### Multivalued-attribute relations

```
user_phone( user_id*, phone )
       └ PK: (user_id, phone)        FK user_id → user

project_phone( Project_id*, phone )
       └ PK: (Project_id, phone)     FK Project_id → Project

agency_phone( Agency_id*, phone )
       └ PK: (Agency_id, phone)      FK Agency_id → Agency

university_phone( University_id*, phone )
       └ PK: (University_id, phone)  FK University_id → University

listing_image( listing_id*, image_url )
       └ PK: (listing_id, image_url) FK listing_id → Listing
```

### Relationship → FK placement summary

| Relationship          | Type | Mapped via                          |
|-----------------------|------|-------------------------------------|
| user **creates** Blog post  | 1:N | `Blog_post.user_id`        |
| user **owns** Listing       | 1:N | `Listing.owner_id`         |
| user **has** Subscription   | 1:N | `Subscription.user_id`     |
| user **generates** Payment  | 1:N | `Payment.user_id`          |
| Listing **Generates** Lead  | 1:N | `Lead.listing_id`          |
| Project **contains** Listing| 1:N | `Listing.project_id`       |
| Agency **contains** Listing | 1:N | `Listing.agency_id`        |
| Listing **Near** University | N:1 | `Listing.university_id`    |
| Listing **Contains** Housemate | 1:N | `Housemate.listing_id`  |
| Listing **Generated from** KnowledgeChunk | 1:N | `KnowledgeChunk.listing_id` |

---

## Mapping Table (Logical → Physical)

| Entity          | Table Name         | PK Type    | Soft Delete | Timestamps          |
|-----------------|--------------------|------------|-------------|---------------------|
| User Profile    | `profiles`         | UUID (FK)  | No          | created_at, updated_at |
| Neighborhood    | `neighborhoods`    | UUID       | No          | created_at          |
| Agency          | `agencies`         | UUID       | No          | created_at, updated_at |
| Project         | `projects`         | UUID       | No          | created_at, updated_at |
| University      | `universities`     | UUID       | No          | created_at          |
| Listing         | `listings`         | UUID       | Yes (deleted_at) | created_at, updated_at |
| Favorite        | `favorites`        | Composite  | No          | created_at          |
| Blog Post       | `blog_posts`       | UUID       | No          | created_at, updated_at |
| Lead            | `leads`            | UUID       | No          | created_at          |
| Subscription    | `subscriptions`    | UUID       | No          | created_at, updated_at |
| Payment         | `payments`         | UUID       | No          | created_at, refunded_at |
| Knowledge Chunk | `knowledge_chunks` | UUID       | No          | created_at, updated_at |

---

## Class Diagram Attributes Summary

### Profile
```
+ id: UUID
+ email: String
+ full_name: String?
+ avatar_url: String?
+ phone: String?
+ whatsapp_number: String?
+ bio: String?
+ role: UserRole {user, admin}
+ is_verified_seller: Boolean
+ gender: String? {male, female}
+ country_code: String?
+ badges: String[]
+ age: Integer?
+ birth_date: Date?
+ occupation: String?
+ lifestyle_preferences: JSON?
+ stripe_account_id: String?
+ created_at: DateTime
+ updated_at: DateTime
```

### Agency
```
+ id: UUID
+ owner_id: UUID → Profile
+ name: String
+ slug: String
+ description: String?
+ logo_url: String?
+ banner_url: String?
+ website: String?
+ phone: String?
+ email: String?
+ city: String?
+ founded_year: Integer?
+ verified: Boolean
+ created_at: DateTime
+ updated_at: DateTime
```

### Project
```
+ id: UUID
+ agency_id: UUID → Agency
+ title: String
+ slug: String
+ description: String?
+ image_url: String?
+ starting_price: Decimal?
+ units_total: Integer?
+ completion_pct: Integer (0-100)
+ status: ProjectStatus {upcoming, in_progress, completed}
+ key_features: String[]
+ created_at: DateTime
+ updated_at: DateTime
```

### University
```
+ id: UUID
+ owner_id: UUID? → Profile
+ name: String
+ slug: String
+ description: String?
+ logo_url: String?
+ banner_url: String?
+ website: String?
+ phone: String?
+ email: String?
+ city: String?
+ type: String?
+ student_count: Integer?
+ accreditation: String?
+ founded_year: Integer?
+ verified: Boolean
+ created_at: DateTime
```

### Neighborhood
```
+ id: UUID
+ name: String
+ name_ar: String?
+ city: String
+ slug: String
+ created_at: DateTime
```

### Listing
```
+ id: UUID
+ owner_id: UUID → Profile
+ agency_id: UUID? → Agency
+ project_id: UUID? → Project
+ neighborhood_id: UUID? → Neighborhood
+ university_id: UUID? → University
+ title: String
+ description: String?
+ category: ListingCategory {for_rent, for_sale, shared_housing}
+ property_type: PropertyType
+ price: Decimal
+ currency: String
+ price_period: String?
+ location: String
+ full_address: String?
+ city: String
+ compound_name: String?
+ latitude: Decimal?
+ longitude: Decimal?
+ bedrooms: Integer?
+ bathrooms: Integer?
+ size_sqm: Decimal?
+ floor_number: Integer?
+ total_floors: Integer?
+ images: String[]
+ amenities: String[]
+ lease_type: String? {monthly, yearly, daily}
+ min_stay_months: Integer?
+ available_date: Date?
+ payment_plan: JSON?
+ delivery_date: Date?
+ title_deed_status: String? {ready, off_plan, pending}
+ room_type: String? {ensuite, private, shared}
+ lifestyle_preferences: JSON?
+ total_spots: Integer?
+ filled_spots: Integer
+ availability: String?
+ furnishing: String?
+ utilities_included: Boolean
+ bathroom_type: String?
+ private_amenities: String[]
+ shared_amenities: String[]
+ status: ListingStatus
+ fraud_score: Float
+ embedding: Vector(768)?
+ views_count: Integer
+ is_new: Boolean
+ verified: Boolean
+ paused_at: DateTime?
+ deleted_at: DateTime?
+ created_at: DateTime
+ updated_at: DateTime
```

### Favorite (Junction)
```
+ user_id: UUID → Profile  [PK]
+ listing_id: UUID → Listing  [PK]
+ created_at: DateTime
```

### BlogPost
```
+ id: UUID
+ author_id: UUID → Profile
+ title: String
+ slug: String
+ lead: String?
+ category: String?
+ image_url: String?
+ content: JSON[]
+ tags: String[]
+ read_time: String?
+ is_published: Boolean
+ published_at: DateTime?
+ created_at: DateTime
+ updated_at: DateTime
```

### Lead
```
+ id: UUID
+ user_id: UUID → Profile
+ listing_id: UUID → Listing
+ agency_id: UUID? → Agency
+ contact_name: String
+ contact_phone: String
+ source: String {whatsapp_click}
+ is_billable: Boolean
+ created_at: DateTime
```

### Subscription
```
+ id: UUID
+ user_id: UUID → Profile  [UNIQUE]
+ plan: SubscriptionPlan {free, trial, basic, pro, agency}
+ status: String {active, trialing, past_due, canceled}
+ stripe_customer_id: String?
+ stripe_subscription_id: String?
+ trial_used: Boolean
+ trial_ends_at: DateTime?
+ current_period_end: DateTime?
+ ai_descriptions_used: Integer
+ ai_period_start: DateTime
+ created_at: DateTime
+ updated_at: DateTime
```

### Payment
```
+ id: UUID
+ user_id: UUID → Profile
+ listing_id: UUID? → Listing
+ kind: String {verification, application_fee, subscription}
+ amount: Decimal(12,2)
+ currency: String
+ stripe_payment_intent_id: String?
+ status: String {pending, succeeded, refunded, failed}
+ created_at: DateTime
+ refunded_at: DateTime?
```

### KnowledgeChunk
```
+ id: UUID
+ source_type: String {listing, neighborhood, blog}
+ source_id: String
+ chunk_text: String
+ embedding: Vector(768)?
+ metadata: JSON
+ created_at: DateTime
+ updated_at: DateTime
```

---

## Stored Functions / RPCs

| Function                     | Purpose                                             |
|------------------------------|-----------------------------------------------------|
| `handle_new_user()`          | Trigger: auto-creates profiles row on auth signup   |
| `match_listings(...)`        | Semantic vector search with hard filters (pgvector) |
| `hybrid_search_chunks(...)`  | Hybrid BM25 + vector RRF search on knowledge_chunks |
| `toggle_favorite(user, lst)` | Atomic favorite add/remove                          |
| `increment_listing_views(id)`| Atomic views_count increment                        |
