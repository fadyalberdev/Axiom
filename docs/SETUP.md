# AXIOM V2 — Setup Guide

## Prerequisites

| Tool    | Version | Install            |
| ------- | ------- | ------------------ |
| Node.js | 20+     | https://nodejs.org |
| npm     | 10+     | comes with Node    |
| Python  | 3.11+   | https://python.org |
| Ollama  | latest  | https://ollama.ai  |

---

## 1. Frontend

```bash
cd frontend
npm install
npm run dev
```

Opens at `http://localhost:3000`.

Create `frontend/.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_API_URL=http://localhost:8000
```

> If `.env.local` is missing, the app still builds — API calls will fail but pages render with mock data.

---

## 2. Backend

Backend lives at `G:\AI\Newstart\backend\` (not in this repository).

```bash
cd G:\AI\Newstart\backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
uvicorn app.main:app --reload --port 8000
```

Swagger UI at `http://localhost:8000/docs`.

Backend `.env` keys:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_ANON_KEY=your-anon-key
JWT_SECRET=your-supabase-jwt-secret
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=axiom-llm
UPSTASH_REDIS_URL=https://...
UPSTASH_REDIS_TOKEN=...
```

---

## 3. Ollama / AI

```bash
ollama pull nomic-embed-text
ollama create axiom-llm -f G:\AI\Newstart\ai-training\AXIOM-gguf_gguf\Modelfile
ollama list
# Should show: axiom-llm:latest and nomic-embed-text:latest
```

Ollama runs on `http://localhost:11434`. The backend calls it automatically.

> AI is optional — all non-AI endpoints work without Ollama.

---

## 4. Supabase

1. Create a project at https://supabase.com
2. Run schema migration from `G:\AI\Newstart\backend\migrations\schema.sql`
3. Enable Row-Level Security on all user-data tables
4. Copy URL and keys into `.env` files
5. Configure Auth password recovery:
   - Auth -> URL Configuration: add `http://localhost:3000/reset-password` and the deployed `/reset-password` URL
   - Auth -> Email Templates: configure the reset-password email template to redirect to `/reset-password`
   - Auth -> SMTP: use Supabase default email only for development; configure custom SMTP for production
   - Auth -> Providers -> Phone: enable phone auth and configure a Supabase-supported SMS provider for phone OTP recovery
   - Do not use the old backend Twilio OTP endpoints for password recovery; recovery OTPs are sent and verified by Supabase Auth
6. Configure social and phone sign-in:
   - Auth -> URL Configuration: add `http://localhost:3000/auth/callback`, the deployed `/auth/callback` URL, and keep the normal Site URL set to the frontend origin
   - Auth -> Providers -> Facebook: enable Facebook and enter the Facebook App ID and App Secret
   - Facebook Developer Dashboard -> Facebook Login -> Settings: add the Supabase callback URL shown in the Supabase Facebook provider panel. For the AXIOM-V2 project this is `https://pgaqqseqwtgsuihbswnv.supabase.co/auth/v1/callback`
   - Facebook app permissions: ensure `public_profile` and `email` are available for testing/live use
   - Auth -> Providers -> Phone: phone login uses the same Supabase SMS provider and verified/linked phone identity as phone recovery

---

## 5. Verify

```bash
# TypeScript check
cd frontend
npx tsc --noEmit        # Expected: no output

# Build check
npm run build           # Expected: all routes compile

# Backend import check
cd G:\AI\Newstart\backend
python -c "from app.main import app; print('OK')"
```

---

## Common Issues

| Problem                   | Fix                                               |
| ------------------------- | ------------------------------------------------- |
| `Module not found: @/...` | Run `npm install` in `frontend/`                  |
| API calls return 401      | Check `.env.local` Supabase keys                  |
| AI endpoints return 503   | Start Ollama: `ollama serve`                      |
| `npx tsc` errors          | Read error output — usually a missing type import |
| Port 3000 in use          | `npm run dev -- -p 3001`                          |
