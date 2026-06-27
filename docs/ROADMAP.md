# AXIOM V2 — Roadmap & Current Status

Last updated: 2026-06-17

---

## Current State

| Layer                          | Status        | Notes                                                                                                                                                        |
| ------------------------------ | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Frontend (Next.js)             | ✅ Built      | All pages, zero TypeScript errors, builds clean                                                                                                              |
| Backend (FastAPI)              | ✅ Built      | All routers implemented, server starts successfully                                                                                                          |
| Database schema                | ✅ Designed   | Active Supabase schema; retired booking, viewing, messaging, shared-housing applications, housemates, and notification tables removed                          |
| AI models                      | ✅ Registered | `axiom-llm:latest` + `nomic-embed-text` in Ollama                                                                                                            |
| Authentication                 | ✅ Wired      | Supabase auth + JWT middleware protection                                                                                                                    |
| AI Chatbot                     | ✅ Wired      | SSE streaming RAG chat, property intent detection, inline listing cards                                                                                      |
| AI Search                      | ✅ Wired      | Natural language filter extraction + hybrid vector/structured search                                                                                         |
| Dashboard AddListingModal      | ✅ Enhanced   | Three-step listing wizard with category-tailored details, owner-managed shared-housing private/shared features, and AI amenity validation                    |
| Agency pages                   | ✅ Enhanced   | Premium dark mode, developer cards, stats bar                                                                                                                |
| Agency detail                  | ✅ Enhanced   | Sidebar, project filter tabs, correct project/listing routing                                                                                                |
| Project detail                 | ✅ Enhanced   | Sortable residence cards, working "Contact Sales Team" form (emails the agency via Resend, falls back to support inbox)                                       |
| Public pages Supabase wiring   | ✅ Done       | find-homes, property, agencies, project, blog, dashboard — all direct Supabase queries, no mock data                                                         |
| Admin CRUD overhaul            | Done          | Live DB-backed admin views; unified Add/Edit/View/action UI; Listings Add uses dashboard wizard; Listings Edit is category-aware; shared housing is a Listings category filter |
| WhatsApp lead capture          | ✅ Done       | Messaging system removed; WhatsApp CTAs + leads table + admin view live                                                                                      |
| Responsive design (400–1200px) | ✅ Done       | FilterSidebar Sheet drawer, admin Sheet hamburger, all page grids fixed                                                                                      |
| All-new features implementation | ✅ Done       | Shared housing search, owner-managed occupied spot counts, owner subscriptions, WhatsApp lead capture, `payments` ledger retained for platform accounting, liked properties wired to `favorites` DB table, dashboard tabs fully live |
| Partner Universities           | ✅ Done       | DB table, backend CRUD, admin dashboard section, list page, detail page with hero/sidebar/listings, working "Contact University" form (emails the university via Resend, falls back to support inbox) |
| Deployment                     | ⚠️ Infra ready | Dockerfile + railway.toml + GitHub Actions CI committed; Railway/Vercel deploy itself not done                                                              |
| Backend tests                  | ✅ Green      | Latest local pytest pass after retiring booking, viewing, applications, housemates, and notifications                                                       |

---

## Frontend Pages

| Route                  | Built | API Wired | Notes                                                                |
| ---------------------- | ----- | --------- | -------------------------------------------------------------------- |
| `/`                    | ✅    | ✅        | Top Listings + Recommendations + Guides live; testimonials static by design |
| `/find-homes`          | ✅    | ✅        | Direct Supabase query via `supabase-queries`                         |
| `/property/[id]`       | ✅    | ✅        | Direct Supabase — handles regular + shared_housing                   |
| `/shared-housing`      | ✅    | ✅        | Dedicated shared-housing search with filters and recommendations     |
| `/shared-housing/[id]` | ✅    | —         | Redirects to `/property/[id]`                                        |
| `/dashboard`           | ✅    | ✅        | Backend `/api/dashboard/me`, avatar upload, WhatsApp/member-since profile sync, listings/saved/profile surface |
| `/booking/[id]`        | —     | —         | Removed — online booking flow retired |
| `/messages`            | —     | —         | Removed — replaced by WhatsApp lead capture                          |
| `/login`               | ✅    | ✅        | Supabase email, Facebook OAuth, and phone OTP auth wired             |
| `/signup`              | ✅    | ✅        | Single role, Supabase wired                                          |
| `/forgot-password`     | ✅    | ✅        | Supabase email reset + phone OTP recovery wired                      |
| `/agencies`            | ✅    | ✅        | Direct Supabase query, no mock fallback                              |
| `/agencies/[slug]`     | ✅    | ✅        | Direct Supabase query, no mock fallback                              |
| `/project/[id]`        | ✅    | ✅        | Direct Supabase query                                                |
| `/blog`                | ✅    | ✅        | Direct Supabase query                                                |
| `/blog/[slug]`         | ✅    | ✅        | Direct Supabase query                                                |
| `/about`               | ✅    | —         | Static                                                               |
| `/universities`        | ✅    | ✅        | Hero + search + responsive grid wired to Supabase                    |
| `/universities/[slug]` | ✅    | ✅        | Hero + sidebar + campus listings grid, server-rendered               |
| `/admin/dashboard`     | Yes   | Yes       | Live data, unified admin modals/actions/details, dashboard-grade Add Listing wizard, category-aware Listing editor, category-filtered shared housing, detailed entity forms, universities CRUD |

---

## AI Features

| Feature                 | Endpoint                        | Status                                         |
| ----------------------- | ------------------------------- | ---------------------------------------------- |
| RAG Chatbot             | `POST /api/ai/chat`             | ✅ Live — SSE streaming + inline listing cards |
| Natural Language Search | `POST /api/ai/search`           | ✅ Live — filter extraction + pgvector         |
| Recommendations         | `GET /api/ai/recommendations`   | ✅ Built                                       |
| Shared-Housing Compatibility | `POST /api/ai/compatibility` | ✅ Built — compares user/profile preferences with listing preferences |
| Description Generator   | `POST /api/ai/description`      | ✅ Built — bilingual AR/EN                     |
| Amenity Validation      | `POST /api/ai/validate-amenity` | ✅ Built — wired in AddListingModal            |
| Fraud Detection         | Internal                        | ✅ Built                                       |

---

## Next Steps

1. **Apply remaining SQL migrations** — run `backend/sql/2026-05-15_all_new_features.sql` in Supabase (payments model + subscriptions migrations already applied to live DB)
2. **Configure Stripe subscription prices** — create recurring EGP prices for Basic (199) + Pro (499) in Stripe dashboard, set `STRIPE_PRICE_BASIC` / `STRIPE_PRICE_PRO` in `backend/.env`
3. **Rotate Stripe keys** — old keys exist in git history pre-`.env` removal; rotate in Stripe dashboard
4. **Subscription QA** — `stripe listen --forward-to localhost:8000/api/stripe/webhook`, test: free listing cap (402 on 2nd listing), trial activation, Basic/Pro checkout + webhook sync, lapse sweep pausing + grace delete, AI description quota gate
5. **Recreate `backend/.env`** — file is missing locally; copy from `.env.example` and fill rotated keys (backend cannot start without it)
6. **Deployment** — deploy to Vercel (frontend) + Railway (backend); CI workflow, Dockerfile, and railway.toml are already in the repo
7. **Security/performance advisors** — Supabase still reports pre-existing RLS/function/storage/index advisory items; review before production

Done since 2026-05-31: shared housing search live, homepage fully live, `/pricing` in navbar, booking/viewing/messaging/application/notification surfaces retired, housemates replaced by owner-managed occupied spot counts, Supabase cleanup migrations added, demo booking layer removed, dead code purged, deployment infra committed.

---

## Locked Architecture Decisions

| Decision                                       | Reason                                               |
| ---------------------------------------------- | ---------------------------------------------------- |
| Single `user` role (no broker)                 | All types, components, and API shapes depend on this |
| `owner_id` not `broker_id`                     | Consistent across DB, backend, and frontend          |
| Unified `/property/[id]` for all listing types | Shared housing redirects here                        |
| `/api/dashboard/me` single endpoint            | Dashboard mapper functions built around this shape   |
| `listing_status`: pending before active        | UI shows pending/rejected states                     |
| Local Ollama for AI                            | `axiom-llm:latest` — no external AI API calls        |
