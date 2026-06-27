# AXIOM V2 Deep Overview

Date created: 2026-06-16

This overview explains AXIOM V2 as it exists in the current repository. It connects the graduation-report story, the early `Broker System Doc.pdf`, and the real codebase. For source-level evidence, use `docs/CODEBASE_STUDY.md`. This file is the readable system narrative.

## 1. What AXIOM Is

AXIOM is an AI-powered real estate platform built for the Egyptian market. It helps users discover homes, rental units, sale listings, and shared-housing opportunities while giving owners a controlled way to publish and manage listings. It also gives administrators tools to approve content, verify sellers, review fraud risk, and manage public platform data.

The current project is no longer the early "Broker Website" described in the first report draft. The early report is still useful because it captures the original motivation: the difficulty of finding trusted housing in Egypt, the need for shared housing, the importance of verification, and the value of AI-assisted discovery. However, the technical implementation has changed heavily.

Current AXIOM V2 is:

| Area | Current reality |
| --- | --- |
| Product | AI-powered real estate platform for Egypt |
| Frontend | Next.js 16, TypeScript, App Router, Tailwind, shadcn-style UI, Framer Motion |
| Backend | FastAPI service in Python |
| Database | Supabase PostgreSQL with pgvector and RLS-aware schema |
| Authentication | Supabase Auth with JWT validation in FastAPI |
| AI | Local Ollama model, RAG retrieval, embeddings, recommendations, fraud checks |
| Payments | Stripe booking fees and owner subscriptions |
| Contact | WhatsApp lead capture, viewing requests, applications, bookings |
| Admin | Separate admin console for moderation, approvals, users, content, fraud, and platform entities |

## 2. What Changed Since the Early Broker Report

The early report described a broker/seeker system with PHP, MySQL, and separate property/shared-unit entities. AXIOM V2 replaced that model with a cleaner and more scalable architecture.

| Early report | Current AXIOM V2 |
| --- | --- |
| "Broker Website" | AXIOM |
| Broker, seeker, admin roles | `user` and `admin` only |
| Broker owns property through `broker_id` | Any user can own listings through `owner_id` |
| Separate `Property` and `Shared_Unit` | One `listings` model with category |
| PHP and MySQL | Next.js, FastAPI, Supabase PostgreSQL |
| AI described as optional/future | AI is implemented through Ollama, RAG, embeddings, recommendations, and fraud scoring |
| Inquiry/contact-broker concept | WhatsApp leads, viewing requests, shared-housing applications, bookings |
| Payments out of scope | Stripe booking fees and owner subscription checkout are implemented |

The biggest conceptual shift is that AXIOM is not a broker marketplace with two user classes. It is a unified real estate platform where a normal user can browse, save, apply, book, and also publish listings. Seller trust is represented by `is_verified_seller`, not by a separate broker role.

## 3. Core Product Problem

AXIOM is solving several connected problems in the Egyptian housing market:

1. Housing search is fragmented across social media, informal brokers, property portals, and word of mouth.
2. Trust is difficult because listings can be duplicated, fake, outdated, or missing details.
3. Students, expats, and relocating users often need shared housing but cannot easily judge compatibility.
4. Users need faster search than manual filters alone can provide.
5. Owners need a simple listing workflow, moderation feedback, and monetization plans.
6. Admins need approval and fraud-review controls to protect platform quality.

The project answers these problems through verified profiles, admin approval, AI-assisted search, shared-housing compatibility, fraud-risk scoring, structured listing data, WhatsApp lead capture, bookings, and subscription limits.

## 4. Main Users and Actors

| Actor | Role in system |
| --- | --- |
| Guest user | Can browse public pages and view listings |
| Authenticated user | Can save listings, contact owners, request viewings, apply to shared housing, book rental/shared listings, manage dashboard, and publish listings |
| Verified seller | A normal user with an admin-granted trust badge |
| Admin | Uses a separate admin console to approve/reject listings, verify users, review fraud, and manage agencies, universities, projects, blog posts, bookings, and platform data |
| AI assistant | Helps with search, recommendations, chat, description generation, compatibility, amenity validation, and fraud-risk support |
| Stripe | Handles card payments for booking fees and checkout for subscriptions |
| Supabase | Provides auth, PostgreSQL, storage, pgvector, and public/private data access |
| Ollama | Provides local LLM and embedding inference |

## 5. System Architecture in One View

AXIOM V2 has a split architecture:

1. The Next.js frontend renders public pages, dashboards, admin pages, forms, and AI chat.
2. The frontend authenticates users with Supabase Auth.
3. The frontend calls FastAPI for protected workflows and business logic.
4. FastAPI validates Supabase JWTs, loads profiles, and performs server-side database work through Supabase.
5. Public browsing pages also perform direct Supabase reads where appropriate.
6. AI workflows call local Ollama and search `knowledge_chunks` through pgvector and text search.
7. Stripe handles payment and subscription events, then webhooks update Supabase records.

Important source files:

| Area | Source |
| --- | --- |
| App bootstrap | `backend/app/main.py` |
| Config | `backend/app/config.py` |
| Auth dependencies | `backend/app/dependencies.py` |
| Frontend API wrapper | `frontend/src/lib/api.ts` |
| Frontend query layer | `frontend/src/lib/queries.ts` |
| Direct Supabase queries | `frontend/src/lib/supabase-queries.ts` |
| Auth store | `frontend/src/stores/authStore.ts` |
| Supabase schema | `docs/schema/*.sql`, `backend/sql/*.sql` |

## 6. Frontend Overview

The frontend is a Next.js 16 App Router application. It is organized around public discovery pages, authenticated user pages, admin pages, reusable components, and shared data layers.

Main route groups:

| Route | Purpose |
| --- | --- |
| `/` | Homepage with property discovery and platform positioning |
| `/find-homes` | Main listing search page |
| `/property/[id]` | Detail page for rent, sale, and shared-housing listings |
| `/shared-housing` | Shared-housing search experience |
| `/dashboard` | User dashboard for listings, saved homes, bookings, applications, viewings, and profile |
| `/booking/[id]` | Booking detail and booking actions |
| `/pricing` | Subscription plans and usage limits |
| `/likes` | Saved listings |
| `/login`, `/signup`, `/forgot-password`, `/reset-password` | Auth flows |
| `/admin/login` | Admin login |
| `/admin/dashboard` | Admin control center |
| `/agencies`, `/agencies/[slug]` | Agencies/developers |
| `/project/[id]` | Real estate project detail |
| `/blog`, `/blog/[slug]` | Blog and article pages |
| `/universities`, `/universities/[slug]` | Partner university pages |

The frontend uses two data-access patterns:

| Pattern | Used for |
| --- | --- |
| FastAPI through `frontend/src/lib/api.ts` and `frontend/src/lib/queries.ts` | Auth-sensitive flows, dashboard, bookings, subscriptions, notifications, AI, admin, applications |
| Direct Supabase through `frontend/src/lib/supabase-queries.ts` | Public listing, agency, project, blog, and university reads |

This hybrid model is important. AXIOM is not simply a client that calls REST for everything; it also uses Supabase directly for read-heavy public pages.

## 7. Backend Overview

The backend is a FastAPI application. It exposes routers under `/api/...`, validates JWTs, and uses Supabase as the persistence layer.

Router overview:

| Router | Main responsibility |
| --- | --- |
| `/api/auth` | Signup, login compatibility, profile read/update, phone OTP compatibility |
| `/api/listings` | Listing search, details, create/update/delete, favorites, applications |
| `/api/dashboard` | Unified user dashboard data |
| `/api/ai` | Search, chat, recommendations, compatibility, descriptions, validation, formatting |
| `/api/bookings` | Booking fee, PaymentIntent, booking sync, confirm/refund/vacate |
| `/api/subscriptions` | Current plan, trial, Stripe checkout, cancellation |
| `/api/stripe/webhook` | PaymentIntent and subscription webhook sync |
| `/api/applications` | Shared-housing applications |
| `/api/leads` | WhatsApp lead capture |
| `/api/admin` | Admin auth, stats, listing moderation, user verification, CRUD sections |
| `/api/agencies` | Agency public pages and owner agency profile actions |
| `/api/projects` | Project details |
| `/api/universities` | University pages and associated listings |
| `/api/blog` | Published blog content |
| `/api/notifications` | Notification list and read state |
| `/api/uploads` | Signed upload URLs |
| `/api/viewings` | Viewing request creation and status updates |

The backend includes rate limiting for AI and auth routes, security headers, CORS configuration, and background workers for booking leases and subscription lapse cleanup.

## 8. Database Overview

The database is a Supabase PostgreSQL schema with structured tables, enums, RLS policies, helper RPCs, and pgvector support.

Core tables:

| Table | Purpose |
| --- | --- |
| `profiles` | User profile, role, trust badge, contact data, lifestyle fields |
| `listings` | Unified rent, sale, and shared-housing listing table |
| `housemates` | Shared-housing resident data |
| `listing_applications` | Shared-housing applications |
| `favorites` | Saved listings |
| `viewings` | Viewing requests |
| `notifications` | In-app notification records |
| `agencies` | Agency/developer profiles |
| `projects` | Real estate projects |
| `universities` | Partner university discovery data |
| `blog_posts` | Blog CMS data |
| `knowledge_chunks` | RAG chunks for semantic and text search |
| `leads` | WhatsApp/contact lead capture |
| `bookings` | Rental/shared-housing booking records |
| `payments` | Payment ledger |
| `subscriptions` | Owner plan and usage data |

Important modeling decisions:

1. `profiles.role` is `user` or `admin`.
2. Listing ownership uses `owner_id`.
3. Listing category is `for_rent`, `for_sale`, or `shared_housing`.
4. Shared housing is a listing category, not a separate property type.
5. AI retrieval uses both vector search and text search through `knowledge_chunks`.
6. Payments and subscriptions are modeled as platform-level records, not broker commission records.

## 9. Listing Lifecycle

Listing creation begins in the dashboard add-listing modal. The user fills a category-specific wizard, uploads images, optionally uses AI to generate a description, and submits the listing.

Lifecycle:

1. User creates listing.
2. Backend inserts listing as `pending`.
3. Background tasks create embeddings and knowledge chunks.
4. Fraud scoring runs in the background.
5. Low-risk listings may be auto-approved by current logic.
6. Admin can approve to `active` or reject to `rejected`.
7. Active rent/shared listings can be booked.
8. Booking can temporarily lock the listing as `pending_payment`.
9. Payment success creates a booking and marks the listing as booked.
10. Refund/vacate/completion can return the listing to active.
11. Subscription enforcement can pause excess listings.

Report diagrams should show both moderation and booking-related status transitions. They should also note that some status values used by code must be verified against the live Supabase enum before final schema diagrams are frozen.

## 10. Shared Housing Overview

Shared housing is one of AXIOM's strongest differentiators. It is handled as a listing category with extra data rather than a separate entity.

Shared-housing features:

| Feature | Meaning |
| --- | --- |
| Room and spot data | Room type, total spots, filled spots, availability |
| Lifestyle preferences | Compatibility inputs such as smoking, pets, quiet hours, study/work patterns |
| Amenities | Private and shared amenities |
| Housemates | Existing resident information |
| Applications | Users can apply to join a shared listing |
| Compatibility scoring | AI-assisted evaluation of applicant/listing/housemate fit |

This replaces the early report's separate `Shared_Unit` concept. In diagrams, shared housing should be shown as `listings.category = shared_housing` with related `housemates` and `listing_applications`.

## 11. AI Overview

AXIOM's AI layer is implemented, not just planned. It uses local Ollama inference and pgvector-backed retrieval.

Public AI endpoints:

| Endpoint | Purpose |
| --- | --- |
| `POST /api/ai/search` | Natural-language property search |
| `POST /api/ai/chat` | Streaming chatbot with listing references and citations |
| `GET /api/ai/recommendations` | Personalized or fallback listing recommendations |
| `POST /api/ai/compatibility` | Shared-housing compatibility scoring |
| `POST /api/ai/description` | Listing description generation |
| `POST /api/ai/validate-amenity` | Custom amenity validation |
| `POST /api/ai/format-article` | Blog/article formatting support |

Internal AI services:

| Service | Purpose |
| --- | --- |
| Ollama client | Calls local LLM and embedding endpoints |
| RAG retriever | Builds context using hybrid vector/text search |
| Embeddings service | Embeds listings and stores knowledge chunks |
| Fraud scoring | Combines price anomaly, owner reputation, and LLM consistency |

AI is used in four product-facing ways:

1. Better search and discovery.
2. Chatbot assistance.
3. Listing owner productivity through description generation.
4. Trust and safety through validation and fraud risk scoring.

## 12. Booking and Payment Overview

AXIOM supports online booking payments for rent and shared-housing listings. Sale listings are not paid online in the current code; they are contact/lead-generation flows.

Current booking payment model:

| Item | Current implementation |
| --- | --- |
| Online booking scope | Rent and shared-housing listings |
| Sale payment | Not supported online; WhatsApp/contact lead only |
| Fee | Flat booking deposit/fee from backend settings, default EGP 2000 |
| Stripe account | Single platform Stripe account |
| Owner payout | No current Stripe Connect payout; `owner_amount = 0` |
| Booking creation | Stripe PaymentIntent success creates or syncs booking |
| User confirmation | Booking becomes active after renter confirmation |
| Refund | Unconfirmed bookings can be refunded/cancelled |
| Vacate | Active bookings can be completed and the listing returned to active |

This is a key correction from some older documents and memories that mention Connect, transfers, owner payouts, sale reservations, or 5 percent cuts. The current source code should be trusted.

## 13. Subscription Overview

Owners are limited by plan. Subscriptions control how many active/pending/booked listings a user can have and how many AI descriptions they can generate.

Plans:

| Plan | Price | Listing cap | AI descriptions |
| --- | ---: | ---: | ---: |
| Free | EGP 0 | 1 | 0 |
| Trial | EGP 0 for 7 days | 3 | 50 |
| Basic | EGP 199/month | 5 | 10/month |
| Pro | EGP 499/month | 20 | 50/month |
| Agency | Custom/contact | 1000 | effectively unlimited |

Subscription flow:

1. User opens pricing page.
2. Frontend loads `/api/subscriptions/me`.
3. User can start a trial or choose Basic/Pro.
4. Backend creates a Stripe Checkout session.
5. Stripe webhook syncs subscription status into Supabase.
6. Listing caps and AI description quotas are enforced by backend services.
7. If a user downgrades below their listing count, excess listings can be paused.
8. Paused listings can be removed after a grace period.

## 14. WhatsApp Leads and Contact Overview

The current platform uses WhatsApp lead capture as the primary contact path. This better matches the Egyptian market and replaces the old inquiry/contact-broker concept.

Lead flow:

1. Authenticated user clicks a WhatsApp contact CTA.
2. Frontend sends a lead request to FastAPI.
3. Backend validates the user, listing, source, and contact target.
4. Backend records or reuses a lead row.
5. Backend returns a `wa.me` URL.
6. User continues the conversation in WhatsApp.
7. Admin can review lead records.

This is important for the report because it shows that AXIOM combines formal platform records with a locally familiar communication channel.

## 15. Admin Overview

The admin system is a full operational console, not a small backend-only panel.

Admin responsibilities:

| Area | Capabilities |
| --- | --- |
| Listings | View, create, edit, approve, reject, delete |
| Users | View, update, delete, verify sellers |
| Fraud | Review risky listings |
| Agencies | CRUD |
| Universities | CRUD |
| Projects | CRUD |
| Blog | CRUD and article formatting |
| Bookings | Operational booking visibility |
| Notifications | Admin notification views |
| Transactions | Lightweight/stub-like transaction view |

Admin auth is separate from Supabase user auth. It uses admin credentials and an admin JWT. This separation should be reflected in sequence and component diagrams.

## 16. Testing and Quality Overview

The backend has a real pytest suite with 123 discovered tests. It covers:

| Area | Coverage |
| --- | --- |
| Auth | Signup, login, profile, phone sync |
| Listings | Create, list, detail, update, delete, favorites, filters, sorting |
| AI | Search, chat, RAG, recommendations, compatibility, fraud, validation |
| Bookings | Flat fee behavior, sale rejection, category mismatch, PaymentIntent amount |
| Subscriptions | Caps, trial behavior, quota gate, listing pause selection |
| Admin | Stats, listing update, fraud review |
| Leads | Auth, admin checks, lead creation |
| Public content | Agencies, projects, blog, notifications, uploads, dashboard |

Frontend verification currently relies on TypeScript compilation through:

```bash
cd frontend
npx tsc --noEmit
```

This should be mentioned in the report as static type verification, not as a full frontend automated test suite.

## 17. Known Drift and Caution Points

Before producing final report diagrams or final database tables, verify these points:

| Point | Why it matters |
| --- | --- |
| Listing status enum | Code uses values such as `pending_payment` and pause-related behavior; make sure migrations/live DB include all used values |
| Messaging | Old message/conversation schema exists, but the user-facing `/messages` route was removed in favor of WhatsApp leads |
| Payments | Current code uses flat platform-retained booking fee, no owner payout, no sale online reservation |
| Agency subscription endpoint | Separate from owner subscriptions and should not be confused with Basic/Pro owner plans |
| Documentation age | `docs/API_REFERENCE.md`, `docs/BACKEND.md`, roadmap, and old memories contain some older claims |
| Public data path | Some public pages read directly from Supabase rather than through FastAPI |

These caution points are not failures; they are places where the report must be precise.

## 18. Best Graduation Report Framing

A strong report should present AXIOM as:

1. A real estate discovery platform for the Egyptian market.
2. A trust-focused system with admin approval and verified seller badges.
3. A shared-housing-aware product that supports resident profiles and compatibility.
4. An AI-assisted platform using local LLM inference, RAG, embeddings, and fraud signals.
5. A full-stack system with Next.js, FastAPI, Supabase, Ollama, and Stripe.
6. A modernized successor to the early Broker Website idea, not the same broker/seeker PHP system.

Suggested chapter emphasis:

| Chapter | Emphasis |
| --- | --- |
| Chapter 1 | Problem, motivation, Egyptian market, objectives, scope |
| Chapter 2 | Existing platforms and gaps |
| Chapter 3 | Requirements, feasibility, planning, risks |
| Chapter 4 | Actual current design: architecture, ERD, class, use cases, activity, sequence, state |
| Chapter 5 | Implementation modules: frontend, backend, auth, listings, AI, bookings, subscriptions, admin |
| Chapter 6 | Testing, verification, limitations, conclusion, future work |

## 19. One-Paragraph Summary

AXIOM V2 is a full-stack AI-powered real estate platform for Egypt. It uses a Next.js frontend, FastAPI backend, Supabase database/auth/storage, local Ollama AI services, pgvector RAG search, Stripe payments, and a separate admin console. The system centers on a unified `listings` model that supports rent, sale, and shared housing through categories, with ownership represented by `owner_id` and trust represented by an admin-granted verified seller badge. Users can browse, search, chat with AI, save listings, contact owners through WhatsApp leads, request viewings, apply to shared housing, book rent/shared listings, and manage their own listings. Admins approve listings, verify users, review fraud, and manage platform content. This current implementation should replace the old broker/seeker PHP/MySQL report design in all technical chapters and diagrams.
