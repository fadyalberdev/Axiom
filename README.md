# AXIOM V2

AI-powered real estate platform for the Egyptian market.

**Stack:** Next.js 16 · FastAPI · Supabase · Ollama · TypeScript · Python 3.11

---

## Quick Start

### Frontend
```bash
cd frontend
npm install
npm run dev        # http://localhost:3000
```

Create `frontend/.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### Backend
```bash
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000   # http://localhost:8000
```

### AI (Ollama)
```bash
ollama pull nomic-embed-text
ollama create axiom-llm -f path/to/Modelfile
```

---

## Features

- Property listings — for sale, for rent, shared housing
- AI chatbot with RAG and inline listing cards (SSE streaming)
- Natural language property search (filter extraction + pgvector)
- Personalized recommendations and shared-housing compatibility scoring
- Listing description generator (bilingual AR/EN)
- AI amenity content moderation
- Fraud detection scoring
- Dashboard with listing management, saved homes, and profile settings
- Admin approval queue for listings

---

## Pages

| Route | Description |
|-------|-------------|
| `/` | Homepage |
| `/find-homes` | Property search with filters and NLP |
| `/property/[id]` | Property detail (all categories incl. shared housing) |
| `/dashboard` | User dashboard: listings, saved homes, profile |
| `/messages` | Removed: WhatsApp lead capture replaces in-app messaging |
| `/agencies` | Real estate developers directory |
| `/agencies/[slug]` | Agency detail with projects and listings |
| `/project/[id]` | Development project detail |
| `/blog` | Blog listing |
| `/admin/dashboard` | Admin panel |

---

## Docs

- `FULLknowledge.md` — **Complete learning guide** — novice to expert on every layer (start here)
- `docs/API_REFERENCE.md` — Backend endpoint contracts
- `docs/BACKEND.md` — Backend architecture reference
- `docs/AI_FEATURES.md` — AI feature specs
- `docs/SETUP.md` — Detailed setup guide
- `docs/ROADMAP.md` — Current status and next steps
