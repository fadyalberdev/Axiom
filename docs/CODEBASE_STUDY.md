# AXIOM V2 Codebase Study

Date studied: 2026-06-16

This document is a source-grounded study of the current AXIOM V2 repository. It is intended to be used with `docs/AXIOM_report_prompt.md` when regenerating the graduation report. The old `docs/Broker System Doc.pdf` is useful for chapter flow, motivation, and early project intent, but the code in this repository is the current source of truth.

## 1. Study Scope

The reviewed codebase is a full-stack AXIOM V2 implementation:

| Area | Scope |
| --- | --- |
| Frontend | `frontend/src`, a Next.js 16 App Router project using TypeScript, Tailwind, shadcn/ui-style primitives, Framer Motion, TanStack Query, Zustand, Supabase JS, Stripe Elements, and direct Supabase reads for several public pages |
| Backend | `backend/app`, a FastAPI application with routers for auth, listings, AI, bookings, subscriptions, dashboard, admin, leads, agencies, projects, universities, blog, uploads, notifications, viewings, and shared-housing applications |
| Database | `docs/schema/*.sql` and `backend/sql/*.sql`, covering Supabase/PostgreSQL tables, enums, RLS policies, RPC functions, pgvector search, leads, payments, bookings, and owner subscriptions |
| Tests | `backend/tests`, 123 pytest tests covering auth, listings, AI/RAG, bookings, subscriptions, uploads, leads, admin, agencies, projects, blog, notifications, and dashboard contracts |

Inventory from the source tree:

| File type | Files | Lines |
| --- | ---: | ---: |
| `.tsx` | 168 | 23,205 |
| `.py` | 75 | 10,797 |
| `.ts` | 13 | 3,217 |
| `.sql` | 11 | 1,056 |
| `.css` | 1 | 237 |
| Total | 268 | 38,512 |

Largest implementation files:

| File | Lines | Meaning |
| --- | ---: | --- |
| `frontend/src/app/admin/dashboard/page.tsx` | 2,791 | Main admin console with listings, users, agencies, universities, projects, blog, fraud, bookings, and transaction views |
| `frontend/src/components/dashboard/AddListingModal.tsx` | 1,906 | Three-step listing creation wizard for rent, sale, and shared-housing listings |
| `backend/app/ai/router.py` | 1,318 | Public AI endpoints for search, chat, recommendations, compatibility, descriptions, amenity validation, and article formatting |
| `backend/app/admin/router.py` | 1,146 | Admin API surface |
| `backend/tests/test_ai.py` | 927 | Deep AI, RAG, recommendation, fraud, compatibility, and validation tests |
| `backend/app/listings/router.py` | 799 | Listing CRUD, search, favorites, shared-housing application routes, fraud and embedding background tasks |
| `docs/schema/001_v2_comprehensive_schema.sql` | 679 | Core Supabase schema |
| `frontend/src/lib/supabase-queries.ts` | 676 | Direct Supabase query layer used by public pages |

## 2. Current Product Identity

AXIOM V2 is not the old "Broker Website" described in the early PDF. The current product is an AI-powered real estate platform for Egypt. It supports ordinary users, verified sellers, shared housing, AI-assisted discovery, fraud checks, bookings, subscriptions, WhatsApp lead capture, and an admin approval workflow.

Important current identity rules:

| Old early-report idea | Current implementation |
| --- | --- |
| Separate `broker` and `seeker` roles | Only `user` and `admin` exist in UI/API types. Seller trust is represented by `is_verified_seller` on a profile |
| `broker_id` owner reference | `owner_id` is used for listings and ownership checks |
| Separate `Property` and `Shared_Unit` entities | One `listings` model with `category = for_rent | for_sale | shared_housing` |
| PHP, MySQL, plain HTML/CSS/JS | Next.js frontend, FastAPI backend, Supabase PostgreSQL, Supabase Auth, pgvector, Ollama, Stripe |
| External AI as future idea | Local Ollama plus RAG, embeddings, recommendation, compatibility, description generation, validation, and internal fraud scoring |
| Contact broker / inquiry | WhatsApp lead capture, favorites, viewing requests, shared-housing applications, bookings, dashboard tabs, notifications |

## 3. High-Level Architecture

AXIOM V2 is organized as a frontend/backend split:

| Layer | Key files | Responsibility |
| --- | --- | --- |
| Browser UI | `frontend/src/app/**`, `frontend/src/components/**` | User, public, dashboard, admin, AI, booking, pricing, and content pages |
| Frontend state | `frontend/src/stores/authStore.ts`, `frontend/src/providers/Providers.tsx` | Supabase session initialization, user profile sync, auth actions, QueryClient provider |
| Frontend API layer | `frontend/src/lib/api.ts`, `frontend/src/lib/queries.ts`, `frontend/src/lib/supabase-queries.ts` | Fetch wrapper, backend query/mutation definitions, direct Supabase reads |
| Backend API | `backend/app/main.py`, `backend/app/*/router.py` | FastAPI REST/SSE endpoints |
| Backend services | `backend/app/ai/*.py`, `backend/app/subscriptions/*.py`, `backend/app/bookings/*.py`, `backend/app/stripe_client.py` | AI, RAG, embeddings, fraud, subscriptions, booking lifecycle, Stripe integration |
| Database/Auth/Storage | Supabase through `backend/app/database.py` and `frontend/src/lib/supabase.ts` | PostgreSQL tables, Supabase Auth, Storage signed uploads |
| External/local systems | Ollama, Stripe, Twilio, Railway/Vercel deployment files | LLM inference, payments, SMS OTP compatibility endpoints, deployment |

System flow in plain terms:

1. The user interacts with the Next.js frontend.
2. Supabase Auth manages sessions; the frontend stores the current profile in Zustand.
3. Protected backend requests carry `Authorization: Bearer <supabase-jwt>`.
4. FastAPI validates JWTs, loads profiles, and uses a Supabase service-role client for DB operations.
5. Public browse pages sometimes read directly from Supabase using the browser Supabase client.
6. AI calls go through FastAPI to a local Ollama server and the pgvector-backed RAG schema.
7. Rent/shared-housing booking payments go through Stripe PaymentIntents and Stripe webhooks.
8. Owner subscription plans go through Stripe Checkout and subscription webhooks.

## 4. Backend Study

### 4.1 Application Bootstrap

Source files:

| File | Notes |
| --- | --- |
| `backend/app/main.py` | Creates FastAPI app, CORS, custom security headers, rate limiting, router registration, background loops |
| `backend/app/config.py` | Pydantic settings loaded from `backend/.env` |
| `backend/app/database.py` | Supabase anon and service-role clients |
| `backend/app/dependencies.py` | Supabase JWT validation and auth dependencies |

The backend app is versioned as 2.0.0 and exposes `/api/health`. It installs:

| Middleware | Purpose |
| --- | --- |
| `RateLimitMiddleware` | Limits `/api/ai/*` to 10 requests/minute per IP and auth login/signup to 5 requests/minute per IP |
| `SecurityHeadersMiddleware` | Adds common hardening headers such as `X-Content-Type-Options`, `X-Frame-Options`, and `Referrer-Policy` |
| `CORSMiddleware` | Allows the configured frontend URL and local development origins |

The lifespan startup starts two background workers:

| Worker | Source | Purpose |
| --- | --- | --- |
| Lease checker | `backend/app/bookings/lease_checker.py` | Marks expired active bookings as completed and sends lease-ending notifications |
| Subscription lapse sweep | `backend/app/subscriptions/lapse.py` | Deletes paused listings after the grace period when subscription caps are exceeded |

### 4.2 Authentication and Profiles

Source files:

| File | Notes |
| --- | --- |
| `backend/app/auth/router.py` | Signup, login, profile read/update, phone OTP compatibility endpoints |
| `backend/app/auth/schemas.py` | Auth request/response Pydantic models |
| `backend/app/dependencies.py` | `get_current_user`, `get_optional_user`, `get_admin_user` |
| `frontend/src/stores/authStore.ts` | Supabase session, profile sync, email/password, OAuth, phone OTP, logout |

Current auth model:

| Feature | Implementation |
| --- | --- |
| Role model | `user` or `admin`; no broker/seeker split |
| Seller verification | `profiles.is_verified_seller`, admin-controlled, cosmetic trust badge |
| Signup | Backend creates Supabase Auth user and profile row; frontend then signs in through Supabase |
| Login | Frontend uses Supabase auth; backend `/api/auth/login` exists to validate credentials and return session data |
| JWT validation | Backend validates Supabase JWTs through JWKS ES256, with HS256 fallback using `JWT_SECRET` |
| Phone auth | Frontend uses Supabase phone OTP; backend still contains Twilio Verify endpoints for compatibility |
| Profile update | `/api/auth/me` updates profile fields and syncs some phone data to Supabase Auth |

Report implication: describe Supabase Auth and JWT-protected FastAPI endpoints. Do not describe manual session tables or broker/seeker accounts.

### 4.3 Listings

Source files:

| File | Notes |
| --- | --- |
| `backend/app/listings/router.py` | Search/list/detail/create/update/delete/favorite/application routes |
| `backend/app/listings/schemas.py` | Listing request and response models |
| `frontend/src/lib/queries.ts` | Backend-backed listing query/mutation definitions |
| `frontend/src/lib/supabase-queries.ts` | Direct Supabase listing reads for public pages |
| `frontend/src/components/dashboard/AddListingModal.tsx` | Listing creation UI |

Backend listing API:

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/listings` | Paginated listing search with filters and sorting |
| `GET` | `/api/listings/favorites` | Current user's favorited listings |
| `GET` | `/api/listings/{listing_id}` | Detail page data, similar listings, housemates, owner contact, view increment |
| `POST` | `/api/listings` | Create listing, status starts as `pending`, then background fraud/embedding tasks run |
| `PUT` | `/api/listings/{listing_id}` | Owner-only update |
| `DELETE` | `/api/listings/{listing_id}` | Owner-only soft delete |
| `POST` | `/api/listings/{listing_id}/favorite` | Toggle favorite through Supabase RPC |
| `POST` | `/api/listings/{listing_id}/apply` | Legacy listing-scoped shared-housing application route |
| `GET` | `/api/listings/{listing_id}/applications` | Owner-only applications for a listing |

Core listing model:

| Field group | Fields |
| --- | --- |
| Identity | `id`, `owner_id`, `agency_id`, `project_id` |
| Classification | `category`, `property_type`, `status`, `verified` |
| Location | `location`, `city`, `full_address`, `compound_name`, `latitude`, `longitude` |
| Price and property data | `price`, `currency`, `bedrooms`, `bathrooms`, `size_sqm`, `floor_number`, `amenities`, `images` |
| Rent fields | `lease_type`, `min_stay_months`, `available_date` |
| Sale fields | `payment_plan`, `delivery_date`, `title_deed_status` |
| Shared housing fields | `room_type`, `total_spots`, `filled_spots`, `availability`, `utilities_included`, `bathroom_type`, `private_amenities`, `shared_amenities`, `lifestyle_preferences` |
| AI/search fields | `embedding`, `views_count`, knowledge chunk records |

Listing lifecycle:

1. User submits a listing.
2. Backend inserts it as `pending`.
3. Background fraud scoring and embedding tasks run.
4. Low-risk listings may be auto-approved in code if fraud score is below the internal threshold.
5. Admin can approve to `active` or reject to `rejected`.
6. Booking flow can temporarily lock a listing as `pending_payment`, then mark it `booked`.
7. Completed/vacated bookings can restore a listing to `active`.
8. Subscription lapse logic can pause excess listings.

Important report note: `pending_payment` and `paused` are used in code. Verify that live Supabase enum migrations include those values before presenting the database as fully synchronized.

### 4.4 Shared Housing and Applications

Source files:

| File | Notes |
| --- | --- |
| `backend/app/applications/router.py` | Primary shared-housing application workflow |
| `backend/app/listings/router.py` | Listing-scoped compatibility/applications support |
| `frontend/src/components/shared-housing/**` | Shared-housing search, cards, compatibility, apply modal, resident sections |
| `frontend/src/app/shared-housing/page.tsx` | Shared-housing search page |
| `frontend/src/app/shared-housing/[id]/page.tsx` | Redirects shared-housing detail to `/property/[id]` |

The code treats shared housing as a listing category, not as a separate entity. Shared-housing records use the same `listings` table plus fields such as spots, room type, lifestyle preferences, private/shared amenities, utilities, and housemate records.

Application flow:

1. User views a shared-housing listing.
2. User submits lifestyle/preference information through the application UI.
3. Backend checks that the listing is active, shared-housing, has capacity, is not owned by the applicant, and has no duplicate application.
4. Backend inserts a `listing_applications` row.
5. Compatibility scoring may run in the background.
6. Owner approves or rejects the application.
7. Approval increments `filled_spots` and sends notifications.

Report implication: use "roommate compatibility" and "shared-housing applications", not "shared unit inquiry".

### 4.5 Bookings, Payments, and Stripe

Source files:

| File | Notes |
| --- | --- |
| `backend/app/bookings/router.py` | Booking fee calculation, PaymentIntent creation, booking sync, confirm/refund/vacate |
| `backend/app/bookings/lease_checker.py` | Lease warning and completion background worker |
| `backend/app/stripe_client.py` | Stripe API key setup |
| `backend/app/stripe_webhooks/router.py` | Stripe webhook for PaymentIntents and subscriptions |
| `frontend/src/components/booking/BookingModal.tsx` | Stripe Elements payment UI |
| `frontend/src/app/booking/[id]/page.tsx` | Booking detail and action page |
| `frontend/src/lib/queries.ts` | Booking query/mutation definitions |

Current payment model in code:

| Rule | Implementation |
| --- | --- |
| Online payments | Only rent/shared-housing bookings use online payment |
| Sale listings | Lead generation/WhatsApp contact only; no online sale reservation payment |
| Booking fee | Flat rent booking fee from `settings.rent_booking_fee`, default EGP 2000 |
| Payment destination | Single platform Stripe account |
| Owner payout | No Stripe Connect and no owner payout in current code |
| Ledger values | `platform_cut_pct = 100.0`, `platform_cut_amount = fee`, `owner_amount = 0` |
| Booking status after payment | `pending_confirmation`, then renter confirms to `active` |

Booking endpoints:

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/bookings/fees` | Returns current booking fee configuration |
| `POST` | `/api/bookings/payment-intent` | Creates Stripe PaymentIntent and locks listing as `pending_payment` |
| `POST` | `/api/bookings/sync-payment` | Creates or fetches booking after payment success if webhook timing is delayed |
| `GET` | `/api/bookings/my` | User's renter-side bookings |
| `GET` | `/api/bookings/received` | Owner-side bookings |
| `GET` | `/api/bookings/by-intent/{intent_id}` | Lookup booking by PaymentIntent |
| `GET` | `/api/bookings/{booking_id}` | Booking detail |
| `POST` | `/api/bookings/{booking_id}/confirm` | Renter confirms and activates booking |
| `POST` | `/api/bookings/{booking_id}/refund` | Cancels/refunds an unconfirmed booking and reactivates listing |
| `POST` | `/api/bookings/{booking_id}/vacate` | Completes an active booking and reactivates listing |

Stripe webhook events:

| Event | Result |
| --- | --- |
| `payment_intent.succeeded` | Creates booking from PaymentIntent metadata |
| `payment_intent.canceled` | Reverts `pending_payment` listing to `active` |
| `customer.subscription.created` | Syncs owner subscription row |
| `customer.subscription.updated` | Syncs plan/status/period data |
| `customer.subscription.deleted` | Downgrades/cancels subscription state |

Report correction: do not write that AXIOM currently takes a 5 percent platform cut or pays owners through Stripe. The current code keeps the booking fee in the platform account and stores owner payout as zero.

### 4.6 Owner Subscriptions

Source files:

| File | Notes |
| --- | --- |
| `backend/app/subscriptions/plans.py` | Plan constants, caps, AI quota helpers, listing pause selection |
| `backend/app/subscriptions/service.py` | Subscription lookup/creation, usage counting, AI quota increment |
| `backend/app/subscriptions/router.py` | `/me`, `/start-trial`, `/checkout`, `/cancel` |
| `backend/app/subscriptions/lapse.py` | Pauses/deletes excess listings after grace period |
| `frontend/src/app/pricing/page.tsx` | Pricing and subscription UI |

Plan model:

| Plan | Price | Listing cap | AI description quota |
| --- | ---: | ---: | ---: |
| `free` | EGP 0 | 1 | 0 |
| `trial` | EGP 0 for 7 days | 3 | 50 |
| `basic` | EGP 199/month | 5 | 10 |
| `pro` | EGP 499/month | 20 | 50 |
| `agency` | Contact/custom | 1000 | effectively unlimited |

Subscription endpoints:

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/subscriptions/me` | Current plan, status, caps, usage, remaining quota |
| `POST` | `/api/subscriptions/start-trial` | Starts one 7-day trial |
| `POST` | `/api/subscriptions/checkout` | Creates Stripe Checkout session for `basic` or `pro` |
| `POST` | `/api/subscriptions/cancel` | Schedules cancellation at the period end |

Subscription enforcement:

1. Listing creation checks the effective plan and active listing count.
2. AI description generation checks and increments the owner's monthly quota.
3. Webhook downgrades can call listing pause logic.
4. Lapse worker deletes paused listings after the grace period.

### 4.7 AI, RAG, Embeddings, and Fraud

Source files:

| File | Notes |
| --- | --- |
| `backend/app/ai/router.py` | Public AI endpoints |
| `backend/app/ai/ollama_client.py` | Async Ollama client for generate, chat, stream, and embeddings |
| `backend/app/ai/rag.py` | Hybrid retrieval, context construction, citation formatting |
| `backend/app/ai/embeddings.py` | Listing embedding and knowledge chunk upsert/delete |
| `backend/app/ai/fraud.py` | Price anomaly, owner reputation, and LLM consistency risk scoring |
| `backend/app/ai/market_context.py` | Market-context helpers for AI/fraud prompts |
| `frontend/src/components/ai/ChatDrawer.tsx` | Streaming chatbot UI |
| `frontend/src/components/ai/ChatMessage.tsx` | Chat message rendering, listing/citation UI |

Actual public AI routes in code:

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/api/ai/search` | Natural-language property search with RAG-first behavior and structured filter fallback |
| `POST` | `/api/ai/chat` | SSE streaming chatbot with property intent detection, listing refs, and citations |
| `GET` | `/api/ai/recommendations` | Personalized or fallback listing recommendations |
| `POST` | `/api/ai/compatibility` | Shared-housing compatibility score |
| `POST` | `/api/ai/description` | Bilingual listing description generation |
| `POST` | `/api/ai/validate-amenity` | Amenity moderation/validation |
| `POST` | `/api/ai/format-article` | Blog/article block formatting support for admin content |

Internal AI services:

| Service | Purpose |
| --- | --- |
| `RAGRetriever.retrieve()` | Calls `hybrid_search_chunks`, builds context, and formats citations |
| `embed_listing()` | Stores listing vector embedding in `listings.embedding` |
| `embed_listing_chunk()` | Upserts listing knowledge into `knowledge_chunks` |
| `delete_listing_chunk()` | Removes stale listing knowledge |
| `score_listing()` | Fraud score from price anomaly, owner reputation, and LLM consistency |

Fail-open/fail-soft behavior:

| Area | Behavior |
| --- | --- |
| Search/chat | Return fallback structured or unavailable responses when Ollama is down |
| Description | Returns service unavailable or falls back depending on path |
| Amenity validation | Fails open for malformed/down AI, so users are not blocked unfairly |
| Fraud scoring | Returns low risk if AI/fraud services fail, preventing hard failure on listing creation |

Report correction: describe seven public AI endpoints plus internal embedding and fraud modules. Do not claim "9 endpoints" unless the code changes.

### 4.8 Dashboard

Source files:

| File | Notes |
| --- | --- |
| `backend/app/dashboard/router.py` | Unified dashboard endpoint |
| `frontend/src/app/dashboard/page.tsx` | Dashboard page and tabs |
| `frontend/src/components/dashboard/**` | Profile, stats, listings, viewings, bookings, applications, add listing, settings |

Dashboard endpoint:

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/dashboard/me` | Returns profile, analytics, listings, favorites, viewings, application counts, and dashboard counts |

Frontend dashboard tabs:

| Tab | Component |
| --- | --- |
| Listings | `MyListings` |
| Booking inbox | `BookingsReceivedTab` |
| My bookings | `MyBookingsTab` |
| Applications inbox | `ApplicationsReceivedTab` |
| My applications | `MyApplicationsTab` |
| Saved properties | `LikedProperties` |
| Viewings | `MyViewings` |
| Profile/settings | `ProfileSettings` |

The dashboard is user-owned, not broker-owned. It is where a normal user can both browse and manage owned listings.

### 4.9 Admin System

Source files:

| File | Notes |
| --- | --- |
| `backend/app/admin/router.py` | Admin API |
| `frontend/src/app/admin/login/page.tsx` | Admin login |
| `frontend/src/app/admin/dashboard/page.tsx` | Full admin dashboard |
| `frontend/src/components/admin/**` | Reusable admin modal, table, sidebar, entity picker, rich text editor |

Admin authentication is separate from Supabase user login. It uses `ADMIN_USERNAME`, `ADMIN_PASSWORD`, and an admin JWT secret/setting.

Admin API groups:

| Group | Capabilities |
| --- | --- |
| Auth | Login and receive admin token |
| Stats | Platform totals and status summaries |
| Listings | List, create, update, delete, approve, reject |
| Users | List, update, delete, verify seller badge |
| Agencies | CRUD |
| Universities | CRUD |
| Projects | CRUD |
| Blog | CRUD and AI-assisted article formatting |
| Fraud | Fraud queue and review action |
| Notifications | Admin notification listing |
| Bookings | Admin booking list |
| Transactions | Stub/currently lightweight transaction list |

Report implication: admin is a real actor for approval, fraud review, seller verification, and content/entity management.

### 4.10 Leads and WhatsApp Contact

Source files:

| File | Notes |
| --- | --- |
| `backend/app/leads/router.py` | WhatsApp lead capture and admin lead listing |
| `docs/schema/005_leads.sql` | Leads table and RLS |
| `frontend/src/components/property/WhatsAppCTA.tsx` | Property contact CTA |

Lead flow:

1. Authenticated user clicks WhatsApp contact or viewing/contact source.
2. Backend verifies the listing and user.
3. Backend resolves target phone from agency or owner profile.
4. Backend upserts one lead per `(user_id, listing_id)`.
5. Backend returns a `wa.me` URL.
6. Admin can view leads with filters.

This replaces the old report's inquiry/contact-broker idea. The repository still has conversation/message schema remnants, but the roadmap states the messaging page was removed and replaced by WhatsApp lead capture.

### 4.11 Agencies, Projects, Universities, Blog, Notifications, Uploads, Viewings

Source files:

| Feature | Files | Notes |
| --- | --- | --- |
| Agencies | `backend/app/agencies/router.py`, `frontend/src/app/agencies/**`, `frontend/src/components/agencies/**`, `frontend/src/components/agency-details/**` | Public agency listings/projects plus owner-created agency profile and a separate agency subscription stub |
| Projects | `backend/app/projects/router.py`, `frontend/src/app/project/[id]/page.tsx`, `frontend/src/components/project-details/**` | Real estate project detail and residence cards |
| Universities | `backend/app/universities/router.py`, `frontend/src/app/universities/**`, `frontend/src/components/universities/**` | Partner university listing discovery |
| Blog | `backend/app/blog/router.py`, `frontend/src/app/blog/**`, `frontend/src/components/blog/**`, `frontend/src/components/blog-article/**` | Published blog list/detail/related articles |
| Notifications | `backend/app/notifications/router.py`, `frontend/src/components/layout/NotificationBell.tsx` | Notification listing and read state |
| Uploads | `backend/app/uploads/router.py` | Signed upload URLs for avatars, listing images, attachments |
| Viewings | `backend/app/viewings/router.py`, dashboard viewings components | Viewing request creation and owner confirm/cancel |

Note on agencies: `backend/app/agencies/router.py` includes a `subscribe_agency` endpoint with `starter/pro/enterprise` and payment method labels like Paymob/Fawry. This is separate from the newer owner subscription system in `backend/app/subscriptions`. Treat it as a smaller agency-profile feature unless it is intentionally revived.

## 5. Frontend Study

### 5.1 App Shell

Source files:

| File | Purpose |
| --- | --- |
| `frontend/src/app/layout.tsx` | Root metadata, font, providers, conditional chatbot |
| `frontend/src/providers/Providers.tsx` | React Query provider, auth initializer, Sonner toaster |
| `frontend/middleware.ts` | Auth route protection and auth-page redirects |
| `frontend/src/components/layout/Navbar.tsx` | Main navigation |
| `frontend/src/components/layout/Footer.tsx` | Footer |
| `frontend/src/components/layout/ChatbotConditional.tsx` | Decides when to show AI chat |
| `frontend/src/components/layout/FloatingAIButton.tsx` | Chat open button |
| `frontend/src/components/layout/NotificationBell.tsx` | Notifications UI |

The app uses a global QueryClient and initializes auth on the client once the root providers mount. The middleware protects `/dashboard` and still references `/messages`, although the roadmap says `/messages` was removed.

### 5.2 Frontend Data Access

Source files:

| File | Purpose |
| --- | --- |
| `frontend/src/lib/api.ts` | Generic `api.get/post/put/delete`, auth token injection, 401 logout, server fetch helper |
| `frontend/src/lib/queries.ts` | TanStack Query definitions for backend APIs |
| `frontend/src/lib/supabase.ts` | Browser Supabase singleton |
| `frontend/src/lib/supabase-queries.ts` | Direct Supabase queries and local natural-language parsing for public listing pages |
| `frontend/src/lib/queryClient.ts` | Query cache defaults |

Two data-access modes exist:

| Mode | Used for | Notes |
| --- | --- | --- |
| FastAPI backend | Auth-sensitive workflows, dashboard, bookings, subscriptions, AI, admin, applications, notifications | Uses `/api/...` endpoints and Supabase JWT |
| Direct Supabase reads | Public browsing pages such as find homes, property details, agencies, projects, blog, universities | Reads public tables from the client with filters and shape mapping |

This hybrid model matters for the report: the frontend is not only a REST client; it also uses Supabase directly for read-heavy public views.

### 5.3 Page Map

| Route | File | Nature |
| --- | --- | --- |
| `/` | `frontend/src/app/(marketing)/page.tsx` | Server page, homepage composition |
| `/about` | `frontend/src/app/about/page.tsx` | Server page |
| `/find-homes` | `frontend/src/app/find-homes/page.tsx` | Client page with filters, query parsing, grid/list view |
| `/property/[id]` | `frontend/src/app/property/[id]/page.tsx` | Server detail page for all categories |
| `/shared-housing` | `frontend/src/app/shared-housing/page.tsx` | Client shared-housing search page |
| `/shared-housing/[id]` | `frontend/src/app/shared-housing/[id]/page.tsx` | Redirect to `/property/[id]` |
| `/dashboard` | `frontend/src/app/dashboard/page.tsx` | Client user dashboard |
| `/booking/[id]` | `frontend/src/app/booking/[id]/page.tsx` | Client booking detail/actions |
| `/pricing` | `frontend/src/app/pricing/page.tsx` | Client subscription pricing and checkout page |
| `/likes` | `frontend/src/app/likes/page.tsx` | Client favorites page |
| `/login`, `/signup`, `/forgot-password`, `/reset-password` | `frontend/src/app/(auth)/**` | Auth pages |
| `/auth/callback` | `frontend/src/app/auth/callback/page.tsx` | Supabase OAuth callback handler |
| `/admin` | `frontend/src/app/admin/page.tsx` | Redirect/root admin page |
| `/admin/login` | `frontend/src/app/admin/login/page.tsx` | Client admin login |
| `/admin/dashboard` | `frontend/src/app/admin/dashboard/page.tsx` | Client admin console |
| `/agencies`, `/agencies/[slug]` | `frontend/src/app/agencies/**` | Agency directory/detail |
| `/project/[id]` | `frontend/src/app/project/[id]/page.tsx` | Project detail |
| `/blog`, `/blog/[slug]` | `frontend/src/app/blog/**` | Blog list/article |
| `/universities`, `/universities/[slug]` | `frontend/src/app/universities/**` | University directory/detail |

### 5.4 Public Search and Detail UX

Source files:

| Area | Files |
| --- | --- |
| Search page | `frontend/src/app/find-homes/page.tsx` |
| Search filters/cards | `frontend/src/components/find-homes/FilterSidebar.tsx`, `SearchListingCard.tsx`, `SearchListingRow.tsx`, `Pagination.tsx` |
| Property detail | `frontend/src/app/property/[id]/page.tsx` |
| Property components | `frontend/src/components/property/PropertyHero.tsx`, `PropertyInfo.tsx`, `PropertySidebar.tsx`, `WhatsAppCTA.tsx`, `BookNowButton.tsx`, maps, mobile CTA |

Public listing discovery supports:

| Capability | Implementation |
| --- | --- |
| Category filters | Rent, sale, shared housing |
| Price, bedrooms, property type, location | Direct Supabase filters and page state |
| Local text parsing | `parseSearchQuery` extracts category, city/location hints, prices, bedrooms, amenities |
| View modes | Grid and row/list UI |
| Property detail | One route handles all listing categories |
| Shared-housing detail | Same property detail route with housemates and shared-specific fields |
| Contact | WhatsApp CTA through leads flow |
| Booking | Book button hidden for sale listings; rent/shared uses Stripe modal |

### 5.5 Add Listing Wizard

Source file: `frontend/src/components/dashboard/AddListingModal.tsx`

The add listing modal is the most complex user-facing frontend component. It provides:

| Capability | Details |
| --- | --- |
| Three-step flow | Category/basics, details/images/amenities, description/submit |
| Category-specific fields | Rent lease data, sale title/payment/delivery data, shared-housing spots and lifestyle data |
| Image uploads | Requests signed upload URLs then uploads files directly |
| AI amenity validation | Calls `/api/ai/validate-amenity` before accepting custom amenities |
| AI description generation | Calls `/api/ai/description` for English/Arabic/both |
| Housemate drafts | Shared-housing listings can include resident/housemate info |
| Admin reuse | Admin listing creation can inject custom `createListing` and upload behavior |

The modal ultimately posts to `/api/listings`, which creates a pending listing and triggers background AI/fraud/indexing work.

### 5.6 Booking UI

Source files:

| File | Purpose |
| --- | --- |
| `frontend/src/components/booking/BookNowButton.tsx` | Opens booking modal |
| `frontend/src/components/booking/BookingModal.tsx` | Date/duration selection, PaymentIntent creation, Stripe card payment, sync after payment |
| `frontend/src/app/booking/[id]/page.tsx` | Detail page for booking confirm/refund/vacate actions |

Booking modal flow:

1. User selects `start_date` and duration.
2. Frontend calls `createPaymentIntentMutation`, which posts to `/api/bookings/payment-intent`.
3. Backend returns Stripe `client_secret` and a booking preview.
4. Stripe Elements confirms card payment.
5. Frontend calls `/api/bookings/sync-payment` or waits for `/api/bookings/by-intent/{intent_id}`.
6. Success screen links to dashboard/booking.

The frontend displays backend-provided fee data from `/api/bookings/fees`, avoiding hardcoded rent fee behavior.

### 5.7 Pricing and Subscription UI

Source file: `frontend/src/app/pricing/page.tsx`

The pricing page:

| Feature | Implementation |
| --- | --- |
| Current subscription state | `useQuery(subscriptionQuery)` -> `/api/subscriptions/me` |
| Trial start | `startTrialMutation` |
| Upgrade | `checkoutMutation`, redirects to Stripe Checkout |
| Cancellation | `cancelSubscriptionMutation` |
| Usage display | Active listings, listing cap, AI quota and remaining usage |
| Error handling | Shows plan information even if subscription endpoint is unavailable |

### 5.8 AI Chat UI

Source files:

| File | Purpose |
| --- | --- |
| `frontend/src/components/ai/ChatDrawer.tsx` | Streaming fetch to `/api/ai/chat`, prompt state, listing refs |
| `frontend/src/components/ai/ChatMessage.tsx` | Token/listing/citation rendering |
| `frontend/src/components/layout/FloatingAIButton.tsx` | Floating launcher |
| `frontend/src/components/layout/ChatbotConditional.tsx` | Global placement |

The chat uses `fetch` against `${API_BASE_URL}/api/ai/chat` and processes streamed SSE-like data. It can render listing references and citations from the backend RAG layer.

### 5.9 Admin Frontend

Source files:

| File | Purpose |
| --- | --- |
| `frontend/src/app/admin/login/page.tsx` | Admin login using separate admin credentials |
| `frontend/src/app/admin/dashboard/page.tsx` | Large multi-section admin console |
| `frontend/src/components/admin/AdminSidebar.tsx` | Navigation |
| `frontend/src/components/admin/AdminTable.tsx` | Table UI |
| `frontend/src/components/admin/AdminModal.tsx` | Modal shell |
| `frontend/src/components/admin/EntityPicker.tsx` | Entity selection |
| `frontend/src/components/admin/RichTextEditor.tsx` | Blog/admin content editing |

The admin dashboard is a large single client page. It uses backend admin endpoints for live CRUD and moderation tasks. For the report, admin workflows should include:

| Workflow | Meaning |
| --- | --- |
| Listing approval/rejection | Core trust workflow |
| User verification | Grants `is_verified_seller` |
| Fraud review | Reviews AI-scored risky listings |
| CRUD management | Agencies, universities, projects, blog posts |
| Bookings/transactions | Operational overview |

## 6. Database and Migrations Study

### 6.1 Core Schema

Source file: `docs/schema/001_v2_comprehensive_schema.sql`

Core tables:

| Table | Purpose |
| --- | --- |
| `profiles` | Supabase user profile, role, verification badge, contact/lifestyle fields |
| `neighborhoods` | Egyptian neighborhood metadata and coordinates |
| `agencies` | Agency/developer profiles |
| `projects` | Real estate projects |
| `listings` | Unified property/rent/sale/shared-housing listing table |
| `housemates` | Current residents/housemates for shared-housing listings |
| `listing_applications` | Shared-housing applications |
| `favorites` | User saved listings |
| `conversations` | Legacy/available messaging conversation table |
| `messages` | Legacy/available messages table |
| `notifications` | In-app notifications |
| `blog_posts` | Blog CMS |
| `viewings` | Viewing request workflow |

Important enums:

| Enum | Values in core schema |
| --- | --- |
| `user_role` | `user`, `admin` |
| `listing_category` | `for_rent`, `for_sale`, `shared_housing` |
| `listing_status` | `active`, `pending`, `rejected`, `sold`, `rented` |
| `application_status` | `pending`, `approved`, `rejected` |
| `viewing_status` | `pending`, `confirmed`, `cancelled` |

The schema defines RLS policies, indexes, and useful RPC functions such as:

| RPC/function | Purpose |
| --- | --- |
| `match_listings` | Vector/semantic listing match |
| `toggle_favorite` | Toggle user favorite |
| `increment_listing_views` | Atomic view count increment |
| `get_user_conversations` | Legacy messaging helper |
| `get_unread_notification_count` | Notification badge count |

### 6.2 Later Schema/Migration Files

| File | Adds |
| --- | --- |
| `docs/schema/002_message_requests.sql` | Conversation status, initiated-by, blocked users |
| `docs/schema/003_conversation_soft_delete.sql` | Per-user conversation soft delete |
| `docs/schema/004_knowledge_chunks.sql` | RAG knowledge chunks, vector/FTS indexes, `hybrid_search_chunks` RPC |
| `docs/schema/005_leads.sql` | WhatsApp leads table and RLS |
| `docs/schema/006_gender_constraint.sql` | Restricts gender to `male`/`female` |
| `backend/sql/2026-05-15_all_new_features.sql` | Application lifestyle fields, bookings, booking disbursements |
| `backend/sql/2026-05-16_profile_whatsapp_and_avatars.sql` | WhatsApp/profile fields and storage policies |
| `backend/sql/2026-05-29_payment_fees_model.sql` | Payments ledger, booked/reserved statuses, fee model |
| `backend/sql/2026-05-30_owner_subscriptions.sql` | Owner subscription enum/table, listing pause field, subscription payment kind |

### 6.3 Schema Drift Risks to Verify

Before final report diagrams are generated, verify these points against the live Supabase database:

| Risk | Why it matters |
| --- | --- |
| `listing_status` enum | Code writes `pending_payment` and uses paused listing behavior. Core/migration files show `reserved`/`booked`, but `pending_payment`/`paused` must exist live or be migrated |
| Sale payment remnants | Some roadmap/docs mention sale reservation fees, but current `bookings/router.py` rejects sale online payments |
| Messaging remnants | Schema and some docs mention conversations/messages, but roadmap says `/messages` was removed in favor of WhatsApp leads |
| Agency subscription stub | Agency subscribe endpoint is separate from owner Stripe subscriptions and should not be confused with current monetization |
| Admin transactions | Admin transactions endpoint is present but lightweight/stub-like compared with the actual payments ledger |
| Direct Supabase vs backend API | Some public pages bypass FastAPI for reads, so architecture diagrams should show both paths |

## 7. Test Suite Study

Backend test suite summary:

| File | Tests | Coverage focus |
| --- | ---: | --- |
| `backend/tests/test_admin.py` | 6 | Admin stats, auth protection, listing update, stale owner retry, fraud review |
| `backend/tests/test_agencies.py` | 5 | Agency list/detail/projects/listings |
| `backend/tests/test_ai.py` | 36 | AI search/chat, RAG schemas, RAG retrieval, description, recommendations, fraud, compatibility, property intent |
| `backend/tests/test_applications.py` | 3 | Shared-housing application create/auth/category checks |
| `backend/tests/test_auth.py` | 9 | Signup, duplicate email, login, profile auth/update, phone sync |
| `backend/tests/test_blog.py` | 4 | Blog list/detail/related |
| `backend/tests/test_bookings.py` | 5 | Flat rent/shared booking fee, sale rejection, category mismatch, PaymentIntent amount |
| `backend/tests/test_dashboard.py` | 2 | Auth protection and response shape |
| `backend/tests/test_leads.py` | 5 | Lead auth/admin checks, lead creation, source validation |
| `backend/tests/test_listings.py` | 20 | Listing create/list/detail/update/delete/favorite/filter/sort/view increment/upload invalid bucket |
| `backend/tests/test_notifications.py` | 3 | Notification list and read-all |
| `backend/tests/test_ollama_client.py` | 4 | Ollama embedding/generate endpoints and model use |
| `backend/tests/test_projects.py` | 2 | Project detail/not found |
| `backend/tests/test_subscriptions.py` | 9 | Plan caps, trial behavior, AI remaining, listing pause selection, monthly reset, quota gate |
| `backend/tests/test_uploads.py` | 2 | Signed upload URL success/invalid bucket |
| `backend/tests/test_validate_amenity.py` | 8 | Amenity validation auth, length, empty input, fail-open, appropriate/inappropriate, malformed AI response |

Total backend tests discovered: 123.

Frontend verification requirement from `AGENTS.md`: run `npx tsc --noEmit` inside `frontend/` before finishing tasks. The frontend does not currently have a documented Jest/Playwright test suite in the studied source tree; TypeScript compilation is the required frontend verification gate.

## 8. Report and Diagram Guidance

Use these source-grounded mappings when writing chapters 4 and 5:

| Report topic | Use these files |
| --- | --- |
| Architecture diagram | `frontend/src/app/layout.tsx`, `frontend/src/providers/Providers.tsx`, `backend/app/main.py`, `backend/app/database.py`, `backend/app/config.py`, `backend/app/ai/ollama_client.py`, `backend/app/stripe_client.py` |
| ERD/relational schema | `docs/schema/*.sql`, `backend/sql/*.sql` |
| Auth sequence | `frontend/src/stores/authStore.ts`, `frontend/src/lib/supabase.ts`, `backend/app/dependencies.py`, `backend/app/auth/router.py` |
| Listing lifecycle | `backend/app/listings/router.py`, `frontend/src/components/dashboard/AddListingModal.tsx`, `backend/app/admin/router.py` |
| AI/RAG flow | `backend/app/ai/router.py`, `backend/app/ai/rag.py`, `backend/app/ai/embeddings.py`, `backend/app/ai/ollama_client.py`, `frontend/src/components/ai/ChatDrawer.tsx` |
| Fraud flow | `backend/app/ai/fraud.py`, `backend/app/listings/router.py`, `backend/app/admin/router.py` |
| Booking/payment sequence | `frontend/src/components/booking/BookingModal.tsx`, `backend/app/bookings/router.py`, `backend/app/stripe_webhooks/router.py`, `backend/app/stripe_client.py` |
| Subscription lifecycle | `frontend/src/app/pricing/page.tsx`, `backend/app/subscriptions/*.py`, `backend/app/stripe_webhooks/router.py`, `backend/sql/2026-05-30_owner_subscriptions.sql` |
| Dashboard | `frontend/src/app/dashboard/page.tsx`, `frontend/src/components/dashboard/**`, `backend/app/dashboard/router.py` |
| Admin use cases | `frontend/src/app/admin/dashboard/page.tsx`, `backend/app/admin/router.py` |
| WhatsApp leads | `frontend/src/components/property/WhatsAppCTA.tsx`, `backend/app/leads/router.py`, `docs/schema/005_leads.sql` |
| Shared housing | `frontend/src/components/shared-housing/**`, `backend/app/applications/router.py`, `backend/app/listings/router.py` |

Recommended diagram actors:

| Actor | Meaning |
| --- | --- |
| User | Anyone browsing, saving, applying, booking, creating listings, or managing dashboard |
| Admin | Separate admin console user who approves, rejects, verifies, reviews fraud, and manages content |
| AI Assistant | Ollama/RAG-backed assistant and AI service layer |
| Stripe | PaymentIntent and Checkout external payment service |
| Supabase | Auth, Postgres, Storage, pgvector |

Recommended state diagrams:

| State machine | States to include |
| --- | --- |
| Listing lifecycle | Draft/client form, pending, active, rejected, pending_payment, booked, rented/sold, paused, soft-deleted |
| Booking lifecycle | PaymentIntent created, pending_payment listing lock, payment succeeded, pending_confirmation, active, refunded/cancelled, completed/vacated |
| Subscription lifecycle | free, trialing, active basic/pro, past_due/canceled, downgraded/free, excess listings paused, paused listings deleted after grace |
| Shared-housing application | pending, approved, rejected, spots filled |

## 9. Old Report Corrections to Apply

When reusing `docs/Broker System Doc.pdf`, apply these corrections:

| Old wording/design | Replace with |
| --- | --- |
| Broker Website | AXIOM |
| Broker role | Verified seller badge on normal user profile |
| Seeker role | User |
| Broker ID | Owner ID |
| Inquiry | WhatsApp lead, viewing request, favorite, application, or booking depending on context |
| Shared Unit entity | `listings.category = shared_housing` plus housemates/applications |
| PHP/MySQL stack | Next.js, FastAPI, Supabase/PostgreSQL, pgvector, Ollama, Stripe |
| External AI API | Local Ollama with RAG and embeddings |
| Payments future work | Stripe bookings and subscriptions are implemented, with the current limitations described above |
| Messages as primary contact | WhatsApp lead capture is current; messages schema is legacy/available but not the current user-facing route |
| Admin only simple account management | Admin manages approvals, users, verification, agencies, universities, projects, blog, fraud, bookings |

## 10. Concise Current-Code Narrative for the Report

AXIOM V2 is a full-stack AI-powered real estate platform for the Egyptian market. The frontend is a Next.js 16 application with typed React components, a Supabase-backed auth store, TanStack Query server-state management, a dashboard, an admin console, AI chat, public listing search, shared-housing discovery, pricing, and Stripe booking UI. The backend is a FastAPI service that validates Supabase JWTs, manages listings through a unified listing model, supports shared-housing applications, provides AI search/chat/recommendations/compatibility/description generation through local Ollama and pgvector RAG, scores listings for fraud, handles booking fees through Stripe PaymentIntents, syncs subscriptions through Stripe Checkout/webhooks, captures WhatsApp leads, and provides a separate admin API for moderation and content management. Supabase supplies PostgreSQL, Auth, Storage, RLS-backed schema, vector search, and RPC helpers.

This is the technical story the graduation report should tell.
