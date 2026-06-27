# AXIOM V2 — AI Features

AXIOM's AI layer runs entirely **on-premise** via a local [Ollama](https://ollama.com) server.
No data leaves the machine. No external AI API is called.

---

## Models

| Model              | Endpoint used                | Purpose                                                                                                |
| ------------------ | ---------------------------- | ------------------------------------------------------------------------------------------------------ |
| `axiom-llm`        | `/api/generate`, `/api/chat` | Text generation — chat, filter extraction, descriptions, fraud scoring, compatibility, recommendations |
| `nomic-embed-text` | `/api/embed`                 | Embeddings — 768-dim vectors for semantic search, RAG retrieval, and listing recommendations           |

---

## Design Principles

**Fail-open everywhere.** Every AI feature degrades gracefully when Ollama is down:

- Chat / search → `{ "ai_unavailable": true }`
- Fraud scoring → returns `0.0` (listing auto-approved)
- Embeddings → skipped silently (can be backfilled)
- Amenity validation → returns `{ "ok": true }` (allow by default)
- Compatibility → returns score `50` with empty reasons

**No hallucination by design.** The chat system prompt contains 11 hard rules that
prevent the LLM from inventing listings, prices, addresses, or availability.
All factual claims must come from live DB records injected at request time.

**Live context, not stale cache.** Listing data for every chat turn is fetched from
Supabase at request time and injected directly into the system prompt.
RAG listing chunks are explicitly **dropped** and replaced with fresh DB results.

---

## Feature Index

| #   | Feature                                                     | Endpoint                                 | Auth     | Streaming |
| --- | ----------------------------------------------------------- | ---------------------------------------- | -------- | --------- |
| 1   | [RAG Chat](#1-rag-augmented-chat)                           | `POST /api/ai/chat`                      | Optional | Yes (SSE) |
| 2   | [NL Property Search](#2-natural-language-property-search)   | `POST /api/ai/search`                    | None     | No        |
| 3   | [Recommendations](#3-property-recommendations)              | `GET /api/ai/recommendations`            | Required | No        |
| 4   | [Roommate Compatibility](#4-roommate-compatibility-scoring) | `POST /api/ai/compatibility`             | Required | No        |
| 5   | [Description Generation](#5-listing-description-generation) | `POST /api/ai/description`               | Required | No        |
| 6   | [Amenity Validation](#6-amenity-validation)                 | `POST /api/ai/validate-amenity`          | Required | No        |
| 7   | [Fraud Detection](#7-fraud-detection-background-task)       | _(background on POST /api/listings)_     | —        | No        |
| 8   | [Listing Embeddings](#8-listing-embeddings-background-task) | _(background on POST/PUT /api/listings)_ | —        | No        |
| 9   | [RAG Infrastructure](#9-rag-infrastructure)                 | _(internal)_                             | —        | No        |

---

## 1. RAG-Augmented Chat

**File:** `backend/app/ai/router.py` — `POST /api/ai/chat`

The main AI assistant. Answers questions about neighborhoods and the Egyptian property market,
and surfaces real listing cards grounded in live database records — never hallucinated.

### Request / Response

```python
class ChatRequest(BaseModel):
    message: str        # max 2000 chars
    conversation_history: list[dict] = []   # [{ "role": "user"|"assistant", "content": str }]
```

Response: **Server-Sent Events** stream (`text/event-stream`). Event payloads are JSON:

| SSE event key      | When emitted                                      | Content                                                                                  |
| ------------------ | ------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `token`            | Each generated text chunk                         | `{ "token": "..." }`                                                                     |
| `listing_refs`     | After stream ends, if listings found              | `{ "listing_refs": [...], "source": "search"\|"personalized", "search_filters": {...} }` |
| `proximity_notice` | When returned listings don't match requested city | `{ "proximity_notice": "No exact matches in {city}…" }`                                  |
| `citations`        | After stream ends, for non-listing RAG chunks     | `{ "citations": [{ "source_type", "source_id", "title", "url" }] }`                      |
| `[DONE]`           | Stream complete                                   | literal string                                                                           |
| `error`            | Token timeout (30s) or generation error           | `{ "error": "..." }`                                                                     |

SSE headers: `Cache-Control: no-cache`, `X-Accel-Buffering: no`

### Full Pipeline

```
Incoming message
       │
       ▼
┌──────────────────────────────────────────────────────────────┐
│  Step 1 — Property-search intent detection                   │
│  _detect_property_search(message) → int score 0–100+        │
│  Score ≥ 40 → trigger listing lookup alongside RAG           │
└──────────────────────────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────────────────────┐
│  Step 2 — Parallel retrieval (asyncio.gather, 3-sec budget)  │
│                                                              │
│  Branch A — RAG retriever (always runs)                      │
│    • ollama.embed(message) → 768-dim vector                  │
│    • hybrid_search_chunks RPC (BM25 + cosine)                │
│    • Returns up to 5 knowledge chunks                        │
│    • Listing chunks DROPPED; only neighborhood/blog kept     │
│                                                              │
│  Branch B — Listing search (runs if score ≥ 40)              │
│    • _extract_filters_from_query(message) via axiom-llm      │
│    • _search_listings_for_chat(message, filters, user)       │
│      ├─ Logged-in + has favorites:                           │
│      │    fetch top-5 favorite IDs → find one with embedding │
│      │    → match_listings RPC (threshold 0.5, limit 10)     │
│      │    → post-filter by price / bedrooms / property_type  │
│      │    → cosine re-rank if Ollama healthy                  │
│      │    → top 3 returned as "personalized"                 │
│      └─ Fallback (no favorites or RPC returns nothing):      │
│           structured DB query with all extracted filters     │
│           → order by views_count → top 10                    │
│           → cosine re-rank against message embedding         │
│           → top 3 returned as "search"                       │
└──────────────────────────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────────────────────┐
│  Step 3 — Context assembly                                   │
│  • Format fresh listing data as "LIVE LISTINGS FROM DATABASE"│
│  • Prepend to RAG neighborhood/blog context                  │
│  • Detect proximity mismatch (requested city ≠ results city) │
└──────────────────────────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────────────────────┐
│  Step 4 — System prompt construction                         │
│  11 hard rules injected including:                           │
│    • Only cite facts from VERIFIED DATABASE RECORDS below    │
│    • Never invent listings, prices, addresses, IDs, URLs     │
│    • Never ask the user clarifying questions                  │
│    • Language-match Arabic ↔ English                         │
│    • 1–2 sentence replies; no markdown, no emojis            │
│    • When listings match: exactly ONE sentence + STOP        │
│    • When no match: one plain "no listings at the moment"    │
│  Conversation history appended (last 4 turns only)           │
└──────────────────────────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────────────────────┐
│  Step 5 — ollama.chat_stream(messages)                       │
│  Yields tokens via /api/chat (role-separated format)         │
│  Per-token timeout: 30 seconds                               │
│  After StopAsyncIteration: emit listing_refs, citations,     │
│  proximity_notice (if any), then [DONE]                      │
└──────────────────────────────────────────────────────────────┘
```

### Property Search Detection — `_detect_property_search(message) → int`

Scores a message based on four signal groups. Score ≥ 40 triggers listing search.

| Signal group                                  | Points | Examples                                                                            |
| --------------------------------------------- | ------ | ----------------------------------------------------------------------------------- |
| Egyptian city / neighborhood                  | +40    | cairo, maadi, zamalek, شيخ زايد, الرحاب, north coast, new capital (20 cities total) |
| Property-type word                            | +30    | apartment, villa, studio, rent, sale, شقة, فيلا, للإيجار                            |
| Intent phrase                                 | +25    | "show me", "find me", "looking for", "أريد", "أبحث عن"                              |
| Price pattern                                 | +25    | `\b\d[\d,]*\s*(k\|m\|egp\|pound\|جنيه)\b`                                           |
| Bedroom shorthand                             | +20    | `3bd`, `bedroom`, `غرف`, `أوض`                                                      |
| Size shorthand                                | +15    | `300sqm`, `150m2`, `300m²`                                                          |
| Bathroom shorthand                            | +15    | `2ba`, `bathroom`                                                                   |
| Amenity word                                  | +20    | pool, gym, parking, حمام سباحة, مصعد                                                |
| Question phrase (penalty, only if score ≤ 40) | −30    | "how ", "what is", "explain", "كيف", "ما هو"                                        |

### Match Score — `_compute_match_score(candidate, filters) → int | None`

Attaches a `match_score` (0–100) to each returned listing card.
Returns `None` (badge hidden) when no spec filters were in the query.

Scored fields: `bedrooms` (exact), `bathrooms` (exact), `size_sqm` (±20% tolerance),
`amenities` (each requested amenity checked individually).

---

## 2. Natural-Language Property Search

**File:** `backend/app/ai/router.py` — `POST /api/ai/search`

Translates free-text queries into property results via two ranked paths.

### Request

```python
class NLSearchRequest(BaseModel):
    query: str
    limit: int = 20
```

### Response

```json
{
  "query": "quiet 2-bedroom near Maadi under 8000 EGP",
  "parsed_filters": {
    "location": "Maadi",
    "max_price": 8000,
    "bedrooms": 2,
    "category": "for_rent"
  },
  "results": [ ...ListingBrief ],
  "total": 8,
  "retrieval_method": "semantic" | "keyword"
}
```

### Decision Tree

```
POST /api/ai/search { query, limit }
        │
        ▼
  ollama.health() check — returns ai_unavailable if down
        │
        ▼
  Primary: RAG semantic retrieval
  rag_retriever.retrieve(query, source_type="listing", k=limit)
  → hybrid_search_chunks RPC (embed + BM25 fusion)
        │
        ▼
  ≥ 3 chunks returned?
  ┌─── YES ──────────────────────────────────────────────────┐
  │ Deduplicate chunk source_ids (preserve rank order)        │
  │ Fetch full listing rows from DB for those IDs             │
  │ Return with retrieval_method = "semantic"                 │
  └───────────────────────────────────────────────────────────┘
        │
       NO (< 3 results)
        ▼
  Fallback: LLM filter extraction
  _extract_filters_from_query(query)
  axiom-llm extracts → location, max/min_price, bedrooms,
  bathrooms, size_sqm, min/max_size_sqm, amenities[],
  category, property_type
        │
        ▼
  Structured DB query with all non-null filters
  .or_("city.ilike.%{loc}%, location.ilike.%{loc}%")
  .order("views_count", desc=True).limit(limit)
  Return with retrieval_method = "keyword"
```

### Filter Extraction System Prompt (key excerpt)

The LLM is told to map shorthand:

- `"alex"` → Alexandria
- `"3bd"` → bedrooms: 3
- `"2ba"` → bathrooms: 2
- `"300m2"` or `"300sqm"` → size_sqm: 300
- Amenities mapped to canonical values from: Parking, Swimming Pool, Gym, Garden,
  Security, Elevator, Central AC, Balcony, Storage Room, Maid's Room

---

## 3. Property Recommendations

**File:** `backend/app/ai/router.py` — `GET /api/ai/recommendations?explain=false`

Suggests properties the logged-in user is likely to want based on their saved favorites,
using pgvector cosine similarity rather than collaborative filtering.

### Response

Array of `ListingBrief` objects. When `explain=true`, each item gains:

```json
{
  "explanation": "Similar to your Maadi favorites — same area and price range."
}
```

### Decision Tree

```
GET /api/ai/recommendations
        │
        ▼
  Fetch user's favorites (top 10 by created_at)
        │
        ▼
  No favorites?
  └─ Return newest 8 active listings (created_at DESC)

        │
  Has favorites
        ▼
  Fetch first favorite listing (id, title, location, category, city, embedding)
        │
        ▼
  Listing has embedding AND ollama.health()?
  ┌─── YES ─────────────────────────────────────────────────────┐
  │ match_listings RPC:                                          │
  │   query_embedding = favorite's embedding                    │
  │   match_threshold = 0.5                                     │
  │   match_count = 12                                          │
  │   filter_category = favorite's category                     │
  │   filter_city = favorite's city                             │
  │ Exclude already-favorited IDs                               │
  │ Fetch full details for matched IDs (top 8)                  │
  └─────────────────────────────────────────────────────────────┘
        │
       NO / RPC returned nothing
        ▼
  Keyword fallback:
  same category + city, exclude favorites
  order by views_count DESC, limit 8

        │
        ▼ (both paths)
  explain=true?
  └─ _explain_recommendations(fav_details, candidates)
     Single LLM batch call → JSON { "uuid": "reason" }
     Attaches one-sentence explanation to each candidate
```

### Explanation Prompt Format

```
User's favorites: {title} in {location} ({category}); ...

Candidate listings:
ID:{uuid} | {title} | {location} | {category} | {price} EGP
...

Return a JSON object with an explanation for each candidate ID.
```

---

## 4. Roommate Compatibility Scoring

**File:** `backend/app/ai/router.py` — `POST /api/ai/compatibility`

Scores how well the current user would fit in a shared housing listing (0–100).
Only works on listings with `category = "shared_housing"`.

### Request

```python
class CompatibilityRequest(BaseModel):
    listing_id: str
    lifestyle_data: dict   # overrides stored profile prefs
```

### Response

```json
{
  "listing_id": "uuid",
  "compatibility_score": 78,
  "reasons": [
    "Non-smoking preference matches listing rules.",
    "Similar sleep schedule to current housemates."
  ],
  "housemate_notes": [
    "Ahmed (25, engineer) — similar occupation and lifestyle."
  ]
}
```

### Data Collection Pipeline

```
1. Fetch listing — verify category == shared_housing
   → listing.lifestyle_preferences (JSONB)

2. Fetch housemates (up to 10)
   → name, age, occupation, tags, user_id

3. For each housemate with user_id:
   → fetch profiles.lifestyle_preferences (JSONB)

4. Fetch current user's full profile:
   → age, occupation, gender, lifestyle_preferences

5. Merge: body.lifestyle_data OVERRIDES stored preferences
   merged_user_prefs = { ...stored_prefs, ...body.lifestyle_data }

6. Build context block:
   "- Ahmed | age 25 | engineer | tags: quiet, non-smoker | lifestyle: {...}"

7. Single ollama.generate() call:
   system: score compatibility considering gender_preference,
           smoking_allowed, pets_allowed, guests_policy, noise_level,
           cleanliness, sleep_schedule, occupation_type
   → JSON: { "score": 0–100, "reasons": [...], "housemate_notes": [...] }

8. Clamp score: max(0, min(100, parsed_score))
   Fallback on parse failure: score=50, reasons=[], housemate_notes=[]
```

### Lifestyle Fields

`gender_preference` · `smoking_allowed` · `pets_allowed` · `guests_policy` ·
`noise_level` · `cleanliness` · `sleep_schedule` · `occupation_type`

---

## 5. Listing Description Generation

**File:** `backend/app/ai/router.py` — `POST /api/ai/description`

Generates a bilingual (English + Arabic) property description from structured metadata.
Uses RAG to ground the description in real neighborhood context.

### Request

```python
class DescriptionRequest(BaseModel):
    title: str
    property_type: str
    category: str
    city: str
    bedrooms: Optional[int]
    bathrooms: Optional[int]
    size_sqm: Optional[float]
    amenities: list[str] = []
    price: Optional[float]
    extra_notes: Optional[str]
```

### Response

```json
{
  "english": "Discover this elegant 3-bedroom apartment...",
  "arabic": "اكتشف هذه الشقة الأنيقة المكونة من 3 غرف..."
}
```

### Pipeline

```
1. RAG retrieval (fail-open):
   rag_retriever.retrieve(f"{city} neighborhood real estate",
                          source_type="neighborhood", k=2)
   → join chunk_text → cap at 600 chars
   → injected as NEIGHBORHOOD CONTEXT clause in system prompt

2. Build prompt:
   title, property_type, category, city, bedrooms, bathrooms,
   size_sqm, price (formatted as "EGP 1,200,000"), amenities, extra_notes
   "Write a 3–4 sentence property description in both English and Arabic."

3. System prompt:
   "Professional Egyptian real estate copywriter.
    Write compelling, accurate descriptions in both English and Arabic.
    Be specific to Egyptian market context and culture.
    Return ONLY JSON: {"english": "...", "arabic": "..."}"

4. Parse _extract_json(raw) → load JSON
   Fallback: raw text as English only, arabic=""
```

---

## 6. Amenity Validation

**File:** `backend/app/ai/router.py` — `POST /api/ai/validate-amenity`

Content-moderation gate on the amenities field. Runs before the listing is saved
to prevent offensive, sexual, discriminatory, or off-topic content.

### Request / Response

```python
class AmenityValidationRequest(BaseModel):
    amenity: str   # max 200 chars
```

```json
{ "ok": true,  "reason": "" }
{ "ok": false, "reason": "Contains discriminatory language." }
```

### Behaviour

- Empty string → `{ "ok": false, "reason": "Amenity name cannot be empty" }` (no LLM call)
- Ollama down → `{ "ok": true, "reason": "" }` (**fail-open** — allow by default)
- LLM parse error → `{ "ok": true, "reason": "" }` (fail-open)

System prompt flags: offensive · sexual · discriminatory · harmful · entirely unrelated to real estate.

Legitimate examples given to the LLM: `"Rooftop Terrace"`, `"Private Entrance"`,
`"Solar Panels"`, `"Maid's Room"`.

---

## 7. Fraud Detection (Background Task)

**File:** `backend/app/ai/fraud.py`  
**Triggered by:** `POST /api/listings` as a FastAPI background task

Automatically scores new listings and either approves them or holds them for admin review.

### Score Formula

```
total = (price_anomaly × 0.30)
      + (owner_reputation × 0.20)
      + (llm_consistency × 0.50)
```

Result is clamped to `[0.0, 1.0]` and stored in `listings.fraud_score`.

| threshold | action                                           |
| --------- | ------------------------------------------------ |
| `< 0.4`   | Auto-approve → status `active`, owner notified   |
| `≥ 0.4`   | Stay `pending` → flagged for admin manual review |

### Component 1 — Price Anomaly (`weight: 0.3`)

```python
async def _price_anomaly(listing) → float:
    # Fetch active listings in same category + city (up to 100)
    # Compute average price
    ratio = listing_price / avg_price

    if 0.3 <= ratio <= 3.0:  return 0.0   # normal range
    if ratio < 0.1 or ratio > 10.0: return 1.0  # extreme outlier
    return 0.5                              # moderately suspicious
```

### Component 2 — Owner Reputation (`weight: 0.2`)

```python
async def _owner_reputation(owner_id) → float:
    # Count owner's rejected listings
    0 rejected  → 0.0
    ≤ 2 rejected → 0.3
    ≤ 5 rejected → 0.6
    > 5 rejected → 1.0
```

### Component 3 — LLM Consistency (`weight: 0.5`)

```python
async def _llm_consistency(listing) → float:
    # Step 1: RAG — fetch 3 listing chunks for price context
    #   query: "{city} {category} price range market"
    #   inject up to 400 chars as MARKET CONTEXT

    # Step 2: Prompt includes listing attributes + description
    # LLM checks: unrealistic claims, mismatch, suspicious urgency,
    #             requests for off-platform payment
    # Returns: { "fraud_score": 0.0–1.0, "reason": "..." }

    # Fail-open: returns 0.0 if Ollama is down
```

---

## 8. Listing Embeddings (Background Task)

**File:** `backend/app/ai/embeddings.py`  
**Triggered by:** `POST /api/listings` and `PUT /api/listings/{id}`

Generates 768-dimensional vectors so semantic search and recommendations work.
Silently skips if Ollama is down — can be backfilled later.

### Two Targets

#### Target A — Recommendation vector (`listings.embedding`)

```python
async def embed_listing(listing_id: str) → bool:
    text = _build_embed_text(listing)
    # Fields: title · description · "Location: {}" · "City: {}"
    #         "Type: {}" · "Category: {}" · "{n} bedrooms" · "{n} bathrooms"
    #         "{n} sqm" · "Amenities: {}"
    vector = await ollama.embed(text)   # 768-dim via nomic-embed-text
    supabase_admin.table("listings").update({"embedding": vector})
```

Used by: `match_listings` RPC (recommendations, personalized chat search).

#### Target B — RAG knowledge chunk (`knowledge_chunks` table)

```python
async def embed_listing_chunk(listing_id: str) → bool:
    chunk_text = _build_chunk_text(listing)
    # Format: "Title. property_type in city, location. N bed, N bath, N sqm.
    #          Price: N EGP. description[:300]. Amenities: a, b, c. Compound: X."
    vector = await ollama.embed(chunk_text)
    supabase_admin.table("knowledge_chunks").upsert(
        { source_type: "listing", source_id: listing_id,
          chunk_text, embedding: vector,
          metadata: { city, category, price, bedrooms, property_type } },
        on_conflict="source_type,source_id"
    )
```

Used by: `hybrid_search_chunks` RPC (NL search, RAG chat).

#### Deletion on soft-delete

```python
async def delete_listing_chunk(listing_id: str) → bool:
    supabase_admin.table("knowledge_chunks")
        .delete()
        .eq("source_type", "listing")
        .eq("source_id", listing_id)
```

---

## 9. RAG Infrastructure

**File:** `backend/app/ai/rag.py` — `RAGRetriever` class (module singleton `rag_retriever`)

### `retrieve(query, source_type=None, k=5) → list[Chunk]`

```python
embedding = await ollama.embed(query)   # nomic-embed-text
result = supabase_admin.rpc("hybrid_search_chunks", {
    "query_text": query,
    "query_embedding": embedding,
    "match_count": k,
    "filter_source": source_type,   # "listing" | "neighborhood" | "blog" | None
})
# Returns list[Chunk(id, source_type, source_id, chunk_text, metadata, score)]
# Never raises — returns [] on any failure
```

### `build_context(chunks, max_chars=3000) → str`

Formats chunks as a numbered reference block for LLM injection:

```
[1][neighborhood:uuid-1] Maadi is a leafy Cairo suburb known for...
[2][blog:uuid-2] Average rents in Sheikh Zayed rose 12% in Q1 2026...
```

Truncates at `max_chars` to prevent context overflow.

### `format_citations(chunks) → list[Citation]`

Converts chunks to frontend-renderable links (deduplicates by `source_id`):

| source_type    | URL pattern                   |
| -------------- | ----------------------------- |
| `listing`      | `/property/{source_id}`       |
| `neighborhood` | `/find-homes?location={name}` |
| `blog`         | `/blog/{source_id}`           |

### `knowledge_chunks` Table

| Column        | Type        | Notes                                                    |
| ------------- | ----------- | -------------------------------------------------------- |
| `id`          | UUID        | PK                                                       |
| `source_type` | text        | `listing` \| `neighborhood` \| `blog`                    |
| `source_id`   | UUID        | FK to originating row                                    |
| `chunk_text`  | text        | Human-readable text the LLM reads                        |
| `embedding`   | vector(768) | HNSW index (cosine)                                      |
| `metadata`    | JSONB       | `city`, `category`, `price`, `bedrooms`, `property_type` |
| `updated_at`  | timestamptz | Set to `now()` on each upsert                            |

Indexes: **HNSW cosine** on `embedding` · **GIN English FTS** on `chunk_text`

### `hybrid_search_chunks` RPC — Scoring Formula

Combines full-text and vector signals via **Reciprocal Rank Fusion (k=50)**:

```sql
score = 1.0 / (50 + rank_ft)  * ft_weight    -- BM25 (websearch_to_tsquery)
      + 1.0 / (50 + rank_sem) * sem_weight   -- cosine vector similarity
```

Result ordered by combined score descending, filtered by `source_type` and `metadata` fields.

---

## Ollama Client

**File:** `backend/app/ai/ollama_client.py` — `OllamaClient` (singleton `ollama`)

| Method                            | HTTP endpoint                       | Timeout | Returns         | Notes                                                       |
| --------------------------------- | ----------------------------------- | ------- | --------------- | ----------------------------------------------------------- |
| `health()`                        | `GET /api/tags`                     | 2 s     | `bool`          | Called before every AI operation                            |
| `generate(prompt, system)`        | `POST /api/generate` (stream=false) | 60 s    | `str`           | Single-shot generation                                      |
| `embed(text)`                     | `POST /api/embed`                   | 15 s    | `list[float]`   | 768-dim via `nomic-embed-text`; returns `embeddings[0]`     |
| `generate_stream(prompt, system)` | `POST /api/generate` (stream=true)  | 120 s   | async generator | Yields `response` tokens                                    |
| `chat_stream(messages)`           | `POST /api/chat` (stream=true)      | 120 s   | async generator | Yields `message.content` tokens; uses role-separated format |

All methods return empty / falsy values on exceptions — **nothing propagates to callers**.

Chat streaming uses a separate **30-second per-token timeout** (`asyncio.wait_for`) in
the chat endpoint to abort stalled generation without hanging the SSE connection.
