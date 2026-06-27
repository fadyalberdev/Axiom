# AXIOM V2 — Backend Reference

The backend is a **FastAPI** application that talks to **Supabase** (PostgreSQL + Auth)
and a local **Ollama** instance for AI inference.

**Location:** `G:\AI\Newstart\backend\`  
**Runs on:** `http://localhost:8000`  
**Docs UI:** `http://localhost:8000/docs` (Swagger) / `/redoc`

---

## Stack at a Glance

| Layer          | Technology                                    |
| -------------- | --------------------------------------------- |
| Framework      | FastAPI (Python)                              |
| Database       | Supabase / PostgreSQL + pgvector              |
| Auth           | Supabase Auth (JWT, ES256 / HS256)            |
| AI inference   | Ollama (`axiom-llm`, `nomic-embed-text`)      |
| Contact flow   | WhatsApp lead capture through `/api/leads`     |
| SMS OTP        | Twilio Verify                                 |
| Object storage | Supabase Storage (listing images)             |
| Config         | `.env` via Pydantic `Settings`                |

---

## Application Entry Point — `main.py`

```python
app = FastAPI(version="2.0.0")
app.add_middleware(CORSMiddleware, origins=[frontend_url, "localhost:3000"])

# Routers
/api/auth          ← authentication & profiles
/api/listings      ← property CRUD + search
/api/dashboard     ← unified user dashboard
/api/agencies      ← agency pages
/api/blog          ← blog articles
/api/admin         ← admin panel
/api/ai            ← all AI features
/api/uploads       ← image upload to Supabase Storage
/api/projects      ← real estate projects
/api/leads         ← WhatsApp lead capture
/api/universities  ← university area pages
/api/subscriptions ← owner plan checkout/status

GET /api/health → { "status": "ok", "version": "2.0.0" }
```

---

## Configuration — `config.py`

All values loaded from `.env`:

```
SUPABASE_URL
SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
JWT_SECRET
FRONTEND_URL
ENVIRONMENT              # development | production
OLLAMA_BASE_URL          # http://localhost:11434
OLLAMA_MODEL             # axiom-llm
OLLAMA_EMBED_MODEL       # nomic-embed-text
ADMIN_USERNAME
ADMIN_PASSWORD
REDIS_URL                # optional
SENTRY_DSN               # optional
TWILIO_ACCOUNT_SID
TWILIO_AUTH_TOKEN
TWILIO_VERIFY_SERVICE_SID
```

---

## Database Client — `database.py`

Two Supabase clients are created at startup:

| Client            | Key used         | Purpose                                            |
| ----------------- | ---------------- | -------------------------------------------------- |
| `supabase_client` | Anon key         | Auth operations (signup, login)                    |
| `supabase_admin`  | Service role key | All server-side DB reads/writes — **bypasses RLS** |

The service role client is used for every router operation so Row Level Security
policies are enforced at the application layer (auth checks in dependencies),
not the DB layer.

---

## Authentication — `auth/` and `dependencies.py`

### JWT validation

```
Authorization: Bearer <supabase-jwt>
```

1. Try ES256 decode using Supabase JWKS endpoint.
2. Fallback to HS256 using `JWT_SECRET` from config.
3. Load user profile from `profiles` table by `sub` claim.

### Dependency functions

| Function              | Returns           | Raises                       |
| --------------------- | ----------------- | ---------------------------- |
| `get_current_user()`  | `Profile`         | 401 if invalid/missing token |
| `get_optional_user()` | `Profile \| None` | Never raises                 |
| `get_admin_user()`    | `Profile`         | 403 if role ≠ admin          |

### Auth endpoints — `POST /api/auth/...`

| Endpoint                 | Purpose                                                                        |
| ------------------------ | ------------------------------------------------------------------------------ |
| `POST /signup`           | Create Supabase user (email_confirm=true); DB trigger auto-creates profile row |
| `POST /login`            | Validate credentials; returns Supabase session tokens                          |
| `GET /me`                | Return authenticated user's full profile                                       |
| `PUT /me`                | Update profile fields (name, phone, avatar, bio, lifestyle_preferences)        |
| `POST /send-phone-otp`   | Send 6-digit SMS via Twilio Verify                                             |
| `POST /verify-phone-otp` | Verify OTP code                                                                |

---

## Listings — `listings/router.py`

### Endpoints

| Method | Path                              | Auth             | Notes                                                                          |
| ------ | --------------------------------- | ---------------- | ------------------------------------------------------------------------------ |
| GET    | `/api/listings`                   | None             | Paginated (12/page); filters: category, city, price, bedrooms, sort_by         |
| GET    | `/api/listings/{id}`              | None             | Full detail + 6 similar listings; increments views_count                       |
| POST   | `/api/listings`                   | Required         | Creates with status=pending; triggers fraud scoring + embeddings in background |
| PUT    | `/api/listings/{id}`              | Required (owner) | Updates; re-generates RAG chunk                                                |
| DELETE | `/api/listings/{id}`              | Required (owner) | Soft-delete (sets deleted_at); removes from knowledge_chunks                   |
| POST   | `/api/listings/{id}/favorite`     | Required         | Toggle favorite via RPC                                                        |

### Background tasks on POST/PUT

```
embed_listing()        → updates listings.embedding (768-dim vector)
embed_listing_chunk()  → upserts knowledge_chunks row for RAG
_score_and_approve()   → fraud scoring; auto-approves if score < 0.4
```

### Listing status lifecycle

```
submit → pending → (admin approves) → active
                 → (admin rejects) → rejected
active → sold | rented (owner update)
```

### Data model highlights

**Core fields:**
`title`, `description`, `category` (for_rent|for_sale|shared_housing),
`property_type`, `price`, `currency`, `location`, `city`, `full_address`,
`compound_name`, `images[]`, `bedrooms`, `bathrooms`, `size_sqm`,
`floor_number`, `amenities[]`, `verified`, `views_count`,
`embedding` (vector 768), `status`, `owner_id`, `agency_id`, `project_id`

**Rental extras:**
`lease_type`, `min_stay_months`, `available_date`

**Sale extras:**
`payment_plan` (JSONB), `delivery_date`, `title_deed_status`

**Shared housing extras:**
`room_type`, `lifestyle_preferences` (JSONB), `total_spots`, `filled_spots`,
`availability`, `furnishing`, `utilities_included`, `bathroom_type`,
`private_amenities[]`, `shared_amenities[]`

---

## Dashboard — `dashboard/router.py`

### `GET /api/dashboard/me`

Single endpoint that returns everything the dashboard page needs:

```json
{
  "profile": { "full_name", "avatar_url", "is_verified_seller", "bio", "phone" },
  "analytics": {
    "total_views": 0,
    "active_listings": 0,
    "pending_approval": 0,
    "saved_properties": 0
  },
  "listings": [ ...user's own listings ],
  "listings_count": 0,
  "active_count": 0,
  "pending_count": 0,
  "liked_properties": [ ...favorites ],
  "liked_count": 0
}
```

---

## Retired Surfaces

Booking, viewing-request, in-app messaging, in-app notifications, shared-housing
applications, and housemate tables/routes have been removed. Shared housing now
uses the unified listing model, and listers manage occupied spots directly with
`filled_spots`.

---

## Admin Panel — `admin/router.py`

Admin auth uses a separate JWT (not Supabase) issued on `POST /api/admin/auth/login`
with `ADMIN_USERNAME` / `ADMIN_PASSWORD` from config (24-hour expiry).

### Endpoints

| Category | Endpoint                                 | Notes                                       |
| -------- | ---------------------------------------- | ------------------------------------------- |
| Auth     | `POST /api/admin/auth/login`             | Returns admin JWT                           |
| Listings | `GET /api/admin/listings?status=pending` | Pending queue (paginated)                   |
| Listings | `PUT /api/admin/listings/{id}/approve`   | status → active, notify owner               |
| Listings | `PUT /api/admin/listings/{id}/reject`    | status → rejected with reason               |
| Users    | `GET /api/admin/users`                   | All users (paginated)                       |
| Users    | `PUT /api/admin/users/{id}/verify`       | Grant is_verified_seller badge              |
| Stats    | `GET /api/admin/stats`                   | Totals: users, listings by status, leads, content |

---

## Ollama Client — `ollama_client.py`

`OllamaClient` wraps all calls to the local Ollama server.

| Method                            | HTTP call          | Timeout | Returns               |
| --------------------------------- | ------------------ | ------- | --------------------- |
| `health()`                        | GET /api/tags      | 2 s     | bool                  |
| `generate(prompt, system)`        | POST /api/generate | 60 s    | str                   |
| `embed(text)`                     | POST /api/embed    | 15 s    | list[float] (768-dim) |
| `generate_stream(prompt, system)` | POST /api/generate | 120 s   | async token generator |
| `chat_stream(messages)`           | POST /api/chat     | 120 s   | async token generator |

All methods return empty/falsy values on exceptions — **no raises propagate to callers**.  
Per-token streaming timeout is 30 seconds to prevent hangs on stalled responses.

---

## Database Schema

### Core tables

| Table                  | Key columns                                                                                     | Notes                                |
| ---------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------ |
| `neighborhoods`        | id, name, name_ar, city, slug                                                                   | Lookup table for location filters    |
| `profiles`             | id (= auth.users.id), email, full_name, role, is_verified_seller, lifestyle_preferences (JSONB) | Auto-created by DB trigger on signup |
| `agencies`             | id, owner_id, name, slug, verified                                                              | Agency pages                         |
| `projects`             | id, agency_id, title, description, image_url                                                    | Real estate development projects     |
| `listings`             | id, owner_id, category, status, embedding (vector 768), fraud_score, deleted_at                 | Full property data                   |
| `listings_images`      | id, listing_id, url                                                                             | S3/Storage URLs                      |
| `favorites`            | user_id, listing_id                                                                             | Toggled via RPC                      |
| `knowledge_chunks`     | id, source_type, source_id, chunk_text, embedding (vector 768), metadata (JSONB)                | RAG corpus                           |
| `leads`                | id, user_id, listing_id, agency_id, contact_name, contact_phone, source, is_billable            | WhatsApp lead capture                |
| `subscriptions`        | user_id, plan, status, stripe_customer_id, stripe_subscription_id                               | Owner listing plans                  |

### Enums

```sql
listing_category: for_rent | for_sale | shared_housing
property_type:    apartment | villa | studio | duplex | penthouse | commercial
                  | room | chalet | townhouse | twin_house | land
                  | whole_building | office
listing_status:   active | pending | rejected | sold | rented
```

### Key RPC functions

| RPC                                                                 | Purpose                                 |
| ------------------------------------------------------------------- | --------------------------------------- |
| `match_listings(query_embedding, threshold, count, category, city)` | pgvector cosine similarity search       |
| `hybrid_search_chunks(query_text, query_embedding, ...)`            | BM25 + vector Reciprocal Rank Fusion    |
| `toggle_favorite(user_id, listing_id)`                              | INSERT or DELETE from favorites         |
| `increment_listing_views(listing_id)`                               | Atomic views_count increment            |
| `get_user_conversations(user_id)`                                   | Conversations with partner profile data |

### Indexes

| Table              | Index type        | Column     |
| ------------------ | ----------------- | ---------- |
| `knowledge_chunks` | HNSW (cosine)     | embedding  |
| `knowledge_chunks` | GIN (English FTS) | chunk_text |
| `listings`         | HNSW (cosine)     | embedding  |

---

## Request / Response Conventions

- All timestamps: ISO 8601 (`2026-04-24T10:30:00Z`)
- Pagination: `?page=1&limit=12` → response includes `total`, `page`, `limit`, `results`
- Errors: `{ "detail": "human-readable message" }` with appropriate HTTP status code
- Auth errors: 401 (missing/invalid token), 403 (insufficient role)
- Not found: 404 with `{ "detail": "Resource not found" }`
- Validation errors: 422 (FastAPI default Pydantic validation)

---

## Directory Structure

```
backend/
├── main.py                  ← FastAPI app, router registration
├── config.py                ← Settings loaded from .env
├── database.py              ← Supabase client instances
├── dependencies.py          ← JWT auth dependency functions
├── app/
│   ├── auth/
│   │   └── router.py
│   ├── listings/
│   │   └── router.py
│   ├── dashboard/
│   │   └── router.py
│   ├── admin/
│   │   └── router.py
│   ├── agencies/
│   │   └── router.py
│   ├── projects/
│   │   └── router.py
│   ├── blog/
│   │   └── router.py
│   ├── uploads/
│   │   └── router.py
│   └── ai/
│       ├── router.py        ← All AI endpoints
│       ├── ollama_client.py ← Ollama HTTP wrapper
│       ├── rag.py           ← RAGRetriever (hybrid search, citations)
│       ├── embeddings.py    ← Listing + chunk embedding generation
│       └── fraud.py         ← Fraud scoring pipeline
└── tests/
    └── conftest.py
```
