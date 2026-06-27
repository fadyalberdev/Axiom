# Prompt — Regenerate the graduation report for AXIOM (Word + diagrams)

> Paste everything below the line into Claude (app or Code) running in the `E:\GradProject\AXIOM-V2` repo.
> It produces a `.docx` graduation report for the **current AXIOM** project, following the faculty template
> and the old "Broker System Doc" structure, and it emits all diagrams as PlantUML / Mermaid source
> derived from the **real codebase** (not the stale broker/seeker design).

---

## ROLE

You are writing my Bachelor graduation dissertation for **AXIOM — an AI-powered real estate platform for the Egyptian market**. There is an old early-stage version of this report at `docs/Broker System Doc.pdf` (62 pages, title "Broker Website"). It is **outdated**: it describes an abandoned PHP/MySQL design with a broker/seeker role split. You will reuse its *structure, chapter flow, motivation, and competitor analysis*, but rewrite all technical content to match what the project **actually is today**. The faculty template is `docs/Graduation project template.pdf` (cover page, committee report, IP declaration, anti-plagiarism declaration, TOC layout) — match that template's front matter and formatting. Before writing technical chapters, read `docs/AXIOM_DEEP_OVERVIEW.md` for the project narrative and `docs/CODEBASE_STUDY.md` for the source-grounded frontend, backend, database, tests, and drift-risk evidence.

Additional reference: study `docs/Graduation_Project_xray 1 report.pdf` and `docs/XRAY_REPORT_STRUCTURE_STUDY.md` for report depth and Chapter 6 testing structure. Use its pattern of unit-testing explanation, testing evidence, integration testing, and manual test-case tables, but rewrite everything for AXIOM and do not copy X-ray project content.

## HARD RULES (what changed since the old report — do NOT carry the old design forward)

| Old report (WRONG now) | AXIOM today (USE THIS) |
|---|---|
| Roles: broker / seeker split, `Seeker`+`Broker` ISA `User` | Single role `"user" \| "admin"`. No seeker/broker. `is_verified_seller` boolean is cosmetic, admin-granted |
| Owner reference `broker_id` | `owner_id` everywhere. **Never** write `broker_id`, `brokerId`, `"broker"`, or `"seeker"` |
| Separate `Property` and `Shared_Unit` entities | One listings table, `category: "for_rent" \| "for_sale" \| "shared_housing"` |
| PHP + MySQL + plain HTML/CSS/JS | **Frontend:** Next.js 16 (App Router), TypeScript strict, Tailwind + shadcn/ui, Framer Motion, TanStack Query v5, Zustand, React Hook Form + Zod, Leaflet. **Backend:** FastAPI (Python). **DB:** Supabase (PostgreSQL + pgvector). **Auth:** Supabase JWT |
| External AI API, "AI optional / future" | **Local Ollama** (`axiom-llm` model, port 11434) + RAG retriever (hybrid search, pgvector embeddings, citations) + internal fraud-detection engine (price anomaly, owner reputation, LLM consistency). The current code exposes 7 public AI routes plus internal embedding/fraud services with fail-open/fail-soft behavior. Chatbot, NLP search, recommendations, compatibility, description generation, amenity validation, and article formatting are live |
| Online payments "out of scope / future" | **Stripe is live.** Rent/shared-housing bookings charge a flat booking deposit/fee from the backend (default EGP 2000), retained by the single platform Stripe account. The current code has no Stripe Connect and no owner payout (`owner_amount = 0`). Owner subscriptions (basic/pro) use Stripe Checkout, tiered listing caps, AI quotas, and Stripe webhooks. Sale listings are lead-generation/WhatsApp only; do not describe sale online reservation payments |
| "Contact broker / Send inquiry" | WhatsApp lead capture + viewing requests + shared-housing applications + bookings/dashboard tabs. The old conversation/message schema exists in migrations, but the current user-facing messaging page was removed/replaced by WhatsApp leads |
| Title "Broker Website" | Title **AXIOM** |
| Inquiry entity, MySQL relational mapping | Current Supabase schema: profiles, listings, bookings, favorites, notifications, leads, subscriptions, payments ledger, projects, agencies, universities, blog posts, shared-housing lifestyle preferences, housemates, and roommate applications. Conversations/messages are legacy/available schema, not the current primary contact flow. **Verify exact tables/columns from the code and migrations before drawing — do not guess.** |

Listing lifecycle is unchanged in spirit: **submit → pending → admin approves → active (or rejected)**.

## STABLE SPINE (keep from the old report, just refresh wording)

Egyptian market focus; motivation from Egypt's 2025 Rental Law + distrust of traditional brokers + students/expats relocating; shared-housing with resident/roommate compatibility profiles; AI-assisted personalized recommendations; verification/trust + fraud prevention; admin approval lifecycle; prices in EGP; bilingual Arabic/English intent. Competitor analysis (Dubizzle, Aqarmap, Property Finder, Bayut, Sakneen, Weetas, Student.com, HousingAnywhere, Uniplaces, AmberStudent) and the "summary & gaps" section stay — keep them, light edits only.

## HOW TO GROUND IN THE REAL CODE (do this BEFORE writing chapters 4–5)

This repo has a knowledge graph. Use it first, fall back to Grep/Read only if needed:
- `code-review-graph` MCP tools and/or `/graphify query "..."` to map architecture, routers, components, communities.
- Read `docs/AXIOM_DEEP_OVERVIEW.md` first for the current system story, then `docs/CODEBASE_STUDY.md` as the map of current modules, routes, pages, tests, and drift risks.
- Confirm: backend routers (FastAPI), the 7 public AI routes + Ollama client + RAG retriever + internal fraud/embedding pipeline, the bookings/subscriptions/Stripe flow, the Supabase tables and columns (read the SQL migrations), the frontend pages/components, auth store, and the API contract in `docs/API_REFERENCE.md` / `docs/BACKEND.md`.
- Every entity, class, table, endpoint, and state you put in a diagram MUST exist in the code. Cite the file you took it from in a comment inside the diagram source.

## DIAGRAMS — EMIT SOURCE CODE, GROUNDED IN REAL FILES

Use the two installed skills to author and render diagrams:
- **PlantUML skill** (https://github.com/SpillwaveSolutions/plantuml.git) — for ERD, class, use-case, sequence, state, component/architecture.
- **Mermaid skill** (https://github.com/WH-2099/mermaid-skill.git) — for the Gantt chart and any diagram easier to keep inline in the doc.

Produce, for **each** diagram below: (a) the diagram **source file** under `docs/diagrams/` with a clear name, (b) a rendered PNG/SVG to embed in the Word doc, and (c) a one-paragraph caption. Each diagram must reflect AXIOM's real design, NOT the broker/seeker model.

1. **Gantt chart** (§3.1.2) — Mermaid `gantt`. Phases: research/planning, UI-UX, DB + Supabase schema, frontend (Next.js), backend (FastAPI), AI integration (Ollama + RAG + fraud), payments (Stripe + bookings + subscriptions), testing, deployment.
2. **ER Diagram** (§4.4.1) — PlantUML or Mermaid `erDiagram`. Entities from the actual Supabase schema (users/profiles, listings [with `category`, `owner_id`, status], bookings, payments/ledger, subscriptions, favorites, conversations, messages, shared-housing prefs, roommate applications, admin). No `broker_id`, no separate `Shared_Unit` entity.
3. **Relational schema / mapping** (§4.4.2) — PlantUML, tables with PK/FK exactly as in the migrations.
4. **Class diagram** (§4.5) — PlantUML `class`. Derive from real code: backend Pydantic models / service classes (Ollama client, RAG retriever, fraud engine, bookings service, Stripe service, auth) and key frontend types/stores. Show real methods.
5. **Use-case diagram** (§4.6.1) — PlantUML `usecase`. Actors: **User**, **Admin**, **AI Assistant**, **Stripe/Payment** (external). Use cases must match real endpoints/flows (browse/search listings, NLP search, AI recommendations, chatbot, create listing → pending → admin approve/reject, book listing + pay deposit, subscribe to a plan, WhatsApp contact/lead capture, viewing requests, shared-housing applications, manage favorites, admin verify seller, fraud review).
6. **Use-case scenarios** (§4.6.2) — tables (same format as the old doc: Use Case Number / Name / Actors / Overview / Related / Event stimulus user+system action / Exceptions / Comments). One per real use case above. Re-number `UC-A01…` etc.
7. **Activity diagram — User** (§4.7) — PlantUML/Mermaid. Real flow: open app → (browse as guest / sign up via Supabase) → search or AI-recommend → view listing (incl. shared-housing residents) → book + Stripe payment or WhatsApp contact/viewing request/shared-housing application → manage dashboard.
8. **Activity diagram — Admin** (§4.7) — approve/reject listings, verify sellers, review fraud flags, manage accounts.
9. **Sequence diagram — User** (§4.8) — lifelines: User → Next.js frontend → FastAPI → Supabase → Ollama/RAG → Stripe. Cover auth (Supabase JWT), search, AI recommendation, booking + payment + webhook.
10. **Sequence diagram — Admin** (§4.8) — admin auth → dashboard → listing approval → webhook/status updates.
11. **State diagram** (§4.9) — PlantUML/Mermaid. Listing lifecycle (Draft → Pending → Active/Rejected), booking lifecycle, and subscription lifecycle (trial → active → past_due/canceled per the Stripe webhook).
12. **Software architecture / component diagram** (§5.1, NEW) — PlantUML component diagram: Next.js client, FastAPI services, Supabase (Postgres + pgvector + Auth), Ollama LLM, Stripe, deployment (Docker/Railway).

## DOCUMENT TO PRODUCE

Output a single **Word document** `docs/AXIOM_Report.docx` (generate via `python-docx`; if a tool is unavailable, produce well-structured `docs/AXIOM_Report.md` with embedded diagram images and tell me the exact command to convert to `.docx`). Follow the template front matter and this chapter structure (same as the old TOC, refreshed):

- Cover (title **AXIOM**, ACU Faculty of CS & IT, the 7 names + IDs from `docs/Broker System Doc.pdf` page 1, Supervisor **Dr. Bahaa Mohamed**, Egypt 2025), Committee Report, IP Declaration, Anti-Plagiarism Declaration, Acknowledgement, Abstract, TOC, List of Figures, List of Tables, List of Abbreviations.
- **Ch.1 Introduction:** Overview, Motivation, Objective, Aim, Scope (functional/technical/user), General Constraints, Organization.
- **Ch.2 Background & Previous Work:** background, digital transformation, cultural/market factors, competitor reviews, summary & gaps.
- **Ch.3 Planning & Analysis:** feasibility + estimated cost, Gantt, analysis & limitations of existing systems, need for new system, user/system/domain/functional/non-functional requirements (rewrite FR/NR tables for AXIOM's real features incl. AI, payments, fraud), advantages, user characteristics (User, Admin).
- **Ch.4 Design:** design & implementation constraints, assumptions & dependencies, risks & risk management, all diagrams above.
- **Ch.5 Implementation:** software architecture (real stack), key modules (auth, listings, AI/RAG, fraud, bookings/Stripe, subscriptions, dashboard), user interface (reference real pages), results & discussion.
- **Ch.6 Testing:** follow the deeper reference-report pattern from `Graduation_Project_xray 1 report.pdf`: unit-testing explanation, real backend pytest coverage, module-level test evidence, integration testing flows, manual system test-case tables with expected/actual/status columns, frontend `npx tsc --noEmit` verification, limitations, then Conclusion, Future Work, References (include the 2025 Rental Law and the competitor URLs from the old doc).

## STYLE

Academic, third person, formal. Keep claims truthful to the code — if a feature is partial, say so. Use EGP for money. Number all figures/tables and list them. Do not invent metrics; if you need test results, derive them from the actual test suite or clearly label them as illustrative.

## DELIVERABLES CHECKLIST

1. `docs/AXIOM_Report.docx` (or `.md` + conversion command).
2. `docs/diagrams/*.puml` and `*.mmd` source for all 12 diagrams + rendered images.
3. A short note listing every place the old report's design was corrected to match the current code.
