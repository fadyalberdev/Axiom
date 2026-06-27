import json
import asyncio
import re
from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from typing import Optional, Any
from app.ai.ollama_client import ollama
from app.ai.rag import rag_retriever
from app.database import supabase_admin
from app.dependencies import get_current_user, get_optional_user
from app.subscriptions import plans, service


def _extract_json(raw: str) -> str | None:
    """Extract a JSON object from LLM output, tolerating markdown code fences."""
    raw = re.sub(r"```(?:json)?\s*", "", raw)
    start = raw.find("{")
    end = raw.rfind("}") + 1
    if start >= 0 and end > start:
        return raw[start:end]
    return None

router = APIRouter()

AI_UNAVAILABLE = {"ai_unavailable": True}

# City / neighborhood substrings — shared by search-intent scoring and the
# entity-name heuristic so neither treats a place name as an agency.
EGYPT_PLACES = (
    "cairo", "giza", "alexandria", "alex", "new cairo", "new capital", "maadi",
    "zamalek", "heliopolis", "nasr city", "sheikh zayed", "6th october",
    "6th of october", "october city", "north coast", "hurghada", "sharm",
    "dokki", "mohandessin", "rehab", "mostakbal", "egypt",
    # Arabic city names
    "القاهرة", "الجيزة", "الإسكندرية", "المعادي", "الزمالك",
    "مدينة نصر", "الشيخ زايد", "أكتوبر", "الرحاب", "المستقبل",
)


def _entity_name_from_query(query: str) -> str | None:
    """Heuristic backup for the LLM extractor: capture an organization named
    after 'by'/'from' (e.g. 'listings by Nile Tower 200', 'from Ahram Canadian
    University'). Returns None when the captured phrase is actually a city, so
    'listings from Cairo' is never mistaken for an agency name.
    """
    m = re.search(
        r"\b(?:by|from)\s+([A-Za-z؀-ۿ][\w .&'؀-ۿ-]{1,60})",
        query,
        re.IGNORECASE,
    )
    if not m:
        return None
    name = m.group(1).strip()
    # Cut a trailing location/qualifier clause: "Emaar in new cairo" → "Emaar"
    name = re.split(
        r"\s+(?:in|with|for|near|at|located|that|which|under)\s+",
        name,
        maxsplit=1,
        flags=re.IGNORECASE,
    )[0].strip().rstrip(".,!?؟،")
    # Drop a trailing role word: "Nile Tower 200 agency" → "Nile Tower 200"
    name = re.sub(
        r"\s+(agency|agencies|developer|developers|company|compound|project|projects|university)$",
        "",
        name,
        flags=re.IGNORECASE,
    ).strip()
    low = name.lower()
    if not name or any(place == low or place in low for place in EGYPT_PLACES):
        return None
    return name[:100]


# ─── Request Bodies ───────────────────────────────────────────────────────────

class NLSearchRequest(BaseModel):
    query: str
    limit: int = 20


class ChatRequest(BaseModel):
    message: str = Field(..., max_length=2000)
    # Cap history to prevent a single request from sending a 10k-item prompt to Ollama
    conversation_history: list[dict] = Field(default=[], max_length=20)


class CompatibilityRequest(BaseModel):
    listing_id: str
    lifestyle_data: dict[str, Any]


class DescriptionRequest(BaseModel):
    title: str
    property_type: str
    category: str
    city: str
    bedrooms: Optional[int] = None
    bathrooms: Optional[int] = None
    size_sqm: Optional[float] = None
    amenities: list[str] = []
    price: Optional[float] = None
    extra_notes: Optional[str] = None


class RecommendationRequest(BaseModel):
    budget_max: Optional[float] = None
    location: Optional[str] = None
    bedrooms: Optional[int] = None
    # "rent" | "buy" | "shared" from the "What are you looking for?" modal
    property_type: Optional[str] = None
    vibes: list[str] = []
    limit: int = Field(default=6, ge=1, le=24)


class AmenityValidationRequest(BaseModel):
    amenity: str = Field(..., max_length=200)


class FormatArticleRequest(BaseModel):
    text: str = Field(..., max_length=30000)


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _build_listing_brief(row: dict) -> dict:
    """Shared helper — same as listings/router._build_listing_brief."""
    nbhd = row.get("neighborhoods")
    neighborhood_name = nbhd.get("name") if isinstance(nbhd, dict) else None
    return {
        "id": row["id"],
        "title": row["title"],
        "location": row["location"],
        "price": float(row["price"]),
        "currency": row.get("currency", "EGP"),
        "price_period": row.get("price_period"),
        "category": row["category"],
        "property_type": row["property_type"],
        "images": row.get("images") or [],
        "verified": bool(row.get("verified", False)),
        "is_new": bool(row.get("is_new", True)),
        "status": row.get("status", "active"),
        "bedrooms": row.get("bedrooms"),
        "bathrooms": row.get("bathrooms"),
        "size_sqm": float(row["size_sqm"]) if row.get("size_sqm") is not None else None,
        "floor_number": row.get("floor_number"),
        "neighborhood": neighborhood_name,
        "compound_name": row.get("compound_name"),
        "views_count": row.get("views_count", 0),
        "created_at": row.get("created_at", ""),
    }


async def _extract_filters_from_query(query: str) -> dict:
    """
    Use Ollama to parse a natural-language query into structured filters.
    Falls back to an empty dict if Ollama is down.
    """
    system = (
        "You are a real estate search assistant for Egypt. "
        "Extract search filters from the user's query. "
        "Return ONLY a JSON object with these optional keys: "
        "location (string, Egyptian city or neighborhood — 'alex' means Alexandria), "
        "max_price (number in EGP — '5 million' means 5000000, '500k' means 500000), "
        "min_price (number), "
        "bedrooms (number — '3bd' means 3), "
        "bathrooms (number — '2ba' means 2), "
        "size_sqm (number — exact size in sqm; '300m2' or '300sqm' means 300), "
        "min_size_sqm (number), max_size_sqm (number), "
        "amenities (array of strings — map user terms to the closest values from: "
        "Parking, Swimming Pool, Gym, Garden, Security, Elevator, Central AC, "
        "Balcony, Storage Room, Maid's Room), "
        "category (for_rent|for_sale|shared_housing — ONLY set this if the user "
        "explicitly says 'rent', 'buy', 'purchase', 'roommate', or 'shared'. "
        "If they just say 'apartment' or 'villa' without specifying, do NOT include category), "
        "property_type (apartment|villa|studio|duplex|penthouse|commercial|room|chalet|townhouse|twin_house|land|whole_building|office), "
        "agency_name (string — any organization, developer, company, agency, or "
        "institution name the user says listings are 'by' or 'from', even if it is "
        "not obviously a real estate firm, e.g. 'Palm Hills', 'Emaar', 'Ora Developers', "
        "'Ahram Canadian University'. If the user says 'listings by X' or 'listings from X', "
        "extract X here unless X is clearly a city or neighborhood), "
        "project_name (string — the name of a specific real estate compound or development project mentioned by the user, e.g. 'Marassi', 'Uptown Cairo', 'The Gate'). "
        "Omit any key the user did not mention. Output ONLY valid JSON, no explanation."
    )
    filters: dict = {}
    try:
        raw = await ollama.generate(prompt=query, system=system)
        json_str = _extract_json(raw)
        if json_str:
            filters = json.loads(json_str)
    except Exception:
        pass

    # Backup: if the model didn't capture an entity but the query clearly names
    # one ("listings by/from X"), recover it so resolution can run.
    if isinstance(filters, dict) and not filters.get("agency_name") and not filters.get("project_name"):
        entity = _entity_name_from_query(query)
        if entity:
            filters["agency_name"] = entity

    return filters if isinstance(filters, dict) else {}


def _lookup_agency_id(name: str) -> str | None:
    try:
        r = supabase_admin.table("agencies").select("id").ilike("name", f"%{name}%").limit(1).execute()
        return r.data[0]["id"] if r.data else None
    except Exception:
        return None


def _lookup_project_id(name: str) -> str | None:
    try:
        r = supabase_admin.table("projects").select("id").ilike("title", f"%{name}%").limit(1).execute()
        return r.data[0]["id"] if r.data else None
    except Exception:
        return None


async def _resolve_agency_project(filters: dict) -> dict:
    """Resolve agency_name/project_name strings to their UUIDs.

    Users often don't know whether a name is an agency, a developer, or a
    compound/project (e.g. 'Nile Tower 200' is a project but a user may call it
    an agency), so an unmatched agency_name is retried against projects — and a
    project_name against agencies. When the user named an entity but NOTHING
    matched in either table, sets filters['_entity_unresolved'] = True. Callers
    must then return zero listings — a generic fallback would surface unrelated
    cards that contradict the model's "no listings by X" reply.
    """
    def _clean(raw: str) -> str:
        return re.sub(r"[,().\[\]\"'`\\]", "", raw)[:100]

    requested = False
    resolved = False

    if filters.get("agency_name"):
        requested = True
        name = _clean(filters.pop("agency_name"))
        aid = _lookup_agency_id(name)
        if aid:
            filters["agency_id"] = aid
            resolved = True
        else:
            pid = _lookup_project_id(name)  # maybe it's actually a project/compound
            if pid:
                filters["project_id"] = pid
                resolved = True

    if filters.get("project_name"):
        requested = True
        name = _clean(filters.pop("project_name"))
        pid = _lookup_project_id(name)
        if pid:
            filters["project_id"] = pid
            resolved = True
        else:
            aid = _lookup_agency_id(name)  # maybe it's actually an agency/developer
            if aid:
                filters["agency_id"] = aid
                resolved = True

    if requested and not resolved:
        filters["_entity_unresolved"] = True
    return filters


def _detect_property_search(message: str) -> int:
    """
    Score a message for property search intent.
    Returns int score; >= 40 means run listing search.
    """
    msg = message.lower()
    score = 0

    if any(city in msg for city in EGYPT_PLACES):
        score += 40

    property_words = [
        "apartment", "flat", "villa", "rent", "sale", "buy", "buying", "purchase",
        "for sale", "for rent", "room", "studio",
        "penthouse", "duplex", "chalet", "townhouse", "office", "land",
        "twin house", "commercial", "whole building",
        # Generic real-estate terms that confirm search intent
        "listing", "listings", "property", "properties", "real estate",
        # Agency / project / compound signals
        "agency", "agenc", "developer", "developers", "project", "compound", "development",
        "شقة", "فيلا", "إيجار", "للبيع", "للإيجار", "بنتهاوس", "دوبلكس", "شراء",
        "عقار", "عقارات", "وكالة", "مشروع", "كمبوند",
    ]
    if any(w in msg for w in property_words):
        score += 30

    intent_phrases = [
        "show me", "find me", "looking for", "i want", "i need",
        "i'm looking", "search for", "any ", "budget",
        "أريد", "أبحث", "ابحث", "دور على", "ابحث عن",
    ]
    if any(p in msg for p in intent_phrases):
        score += 25

    if re.search(r'\b\d[\d,]*\s*(k|m|egp|pound|جنيه)\b|\begp\b', msg):
        score += 25

    # Bedroom/bathroom/size shorthand patterns (e.g. "3bd", "2ba", "300m2", "300sqm")
    if re.search(r'\b\d+\s*bd\b|\bbedroom|\bbeds\b|غرف|أوض', msg) or re.search(r'\bbr\b', msg):
        score += 20
    if re.search(r'\b\d+\s*ba\b|\bbathroom', msg):
        score += 15
    if re.search(r'\b\d+\s*(sqm|m2|m²)\b', msg):
        score += 15

    amenity_words = [
        "pool", "swimming", "gym", "parking", "garden", "security", "elevator",
        "air condition", "balcony", "storage", "maid", "rooftop",
        "حمام سباحة", "جيم", "موقف", "حديقة", "أمن", "مصعد", "بلكونة",
    ]
    # "ac" needs word boundaries — bare substring matches "place", "space", "beach"
    if any(w in msg for w in amenity_words) or re.search(r"\ba/?c\b", msg):
        score += 20

    question_words = ["how ", "what is", "explain", "كيف", "ما هو"]
    if any(w in msg for w in question_words) and score <= 40:
        score -= 30

    return score


def _compute_match_score(candidate: dict, filters: dict) -> int | None:
    """
    0–100 score: fraction of requested spec filters the candidate satisfies.
    Returns None when no spec filters were in the query (score would be meaningless).
    """
    total = 0
    matched = 0

    if filters.get("bedrooms") is not None:
        total += 1
        if candidate.get("bedrooms") == filters["bedrooms"]:
            matched += 1

    if filters.get("bathrooms") is not None:
        total += 1
        if candidate.get("bathrooms") == filters["bathrooms"]:
            matched += 1

    if filters.get("size_sqm") is not None:
        total += 1
        size = candidate.get("size_sqm")
        if size is not None:
            tol = filters["size_sqm"] * 0.20
            if abs(float(size) - filters["size_sqm"]) <= tol:
                matched += 1

    if filters.get("amenities"):
        for a in filters["amenities"]:
            total += 1
            if a in (candidate.get("amenities") or []):
                matched += 1

    if total == 0:
        return None  # no spec filters — badge would be misleading

    return round((matched / total) * 100)


def _build_listing_refs(candidates: list[dict]) -> list[dict]:
    """Build the listing_refs SSE payload from DB rows. Strips embeddings."""
    return [
        {
            "id": row["id"],
            "title": row["title"],
            "location": row["location"],
            "city": row.get("city") or "",
            "price": float(row["price"]),
            "currency": row.get("currency", "EGP"),
            "bedrooms": row.get("bedrooms"),
            "bathrooms": row.get("bathrooms"),
            "size_sqm": float(row["size_sqm"]) if row.get("size_sqm") else None,
            "images": row.get("images") or [],
            "property_type": row.get("property_type") or "",
        }
        for row in candidates
    ]


async def _search_listings_for_chat(
    message: str,
    filters: dict,
    current_user: dict | None,
) -> tuple[list[dict], str]:
    """
    Returns (listing_refs, source). source is "search" or "personalized".
    Total budget: 3 seconds. Returns ([], "search") on any failure or timeout.
    """
    import math

    async def _do_search() -> tuple[list[dict], str]:
        nonlocal filters
        # Resolve agency_name / project_name → IDs before either search path runs
        filters = await _resolve_agency_project(filters)
        # User named an agency/project that doesn't exist → no listings can match.
        # Return empty so no misleading generic cards are shown.
        if filters.pop("_entity_unresolved", False):
            return [], "search"
        has_entity_filter = bool(filters.get("agency_id") or filters.get("project_id"))

        # ── Personalized path (logged-in users with favorites, no entity filter) ──
        # Skip when the user asked for a specific agency/project — entity filter
        # must be applied exactly, which the vector RPC cannot guarantee.
        if current_user and not has_entity_filter:
            try:
                fav_result = (
                    supabase_admin.table("favorites")
                    .select("listing_id")
                    .eq("user_id", current_user["id"])
                    .order("created_at", desc=True)
                    .limit(5)
                    .execute()
                )
                fav_ids = [r["listing_id"] for r in (fav_result.data or [])]
                for fav_id in fav_ids:
                    ref = (
                        supabase_admin.table("listings")
                        .select("embedding")
                        .eq("id", fav_id)
                        .single()
                        .execute()
                    )
                    if ref.data and ref.data.get("embedding"):
                        rpc_result = supabase_admin.rpc("match_listings", {
                            "query_embedding": ref.data["embedding"],
                            "match_threshold": 0.5,
                            "match_count": 10,
                            "filter_category": filters.get("category"),
                            # IMPORTANT: RPC param is filter_city; extractor key is location (not city)
                            "filter_city": filters.get("location"),
                        }).execute()
                        candidates = rpc_result.data or []
                        # Post-filter on all hard constraints RPC cannot apply
                        if filters.get("max_price"):
                            candidates = [c for c in candidates if c.get("price", float("inf")) <= filters["max_price"]]
                        if filters.get("min_price"):
                            candidates = [c for c in candidates if c.get("price", 0) >= filters["min_price"]]
                        if filters.get("bedrooms") is not None:
                            candidates = [c for c in candidates if c.get("bedrooms") == filters["bedrooms"]]
                        if filters.get("bathrooms") is not None:
                            candidates = [c for c in candidates if c.get("bathrooms") == filters["bathrooms"]]
                        if filters.get("property_type"):
                            candidates = [c for c in candidates if c.get("property_type") == filters["property_type"]]
                        if filters.get("amenities"):
                            candidates = [
                                c for c in candidates
                                if all(a in (c.get("amenities") or []) for a in filters["amenities"])
                            ]
                        for c in candidates:
                            c.pop("embedding", None)
                        if candidates:
                            refs = _build_listing_refs(candidates[:3])
                            for ref, c in zip(refs, candidates[:3]):
                                score = _compute_match_score(c, filters)
                                if score is not None:
                                    ref["match_score"] = score
                            return refs, "personalized"
            except Exception:
                pass  # fall through to structured search

        # ── Structured search path ─────────────────────────────────────────────
        db_query = (
            supabase_admin.table("listings")
            .select(
                "id, title, location, city, price, currency, "
                "bedrooms, bathrooms, size_sqm, images, views_count, embedding, property_type, amenities"
            )
            .eq("status", "active")
            .is_("deleted_at", "null")
        )
        if filters.get("category"):
            db_query = db_query.eq("category", filters["category"])
        if filters.get("property_type"):
            db_query = db_query.eq("property_type", filters["property_type"])
        if filters.get("min_price") is not None:
            db_query = db_query.gte("price", filters["min_price"])
        if filters.get("max_price") is not None:
            db_query = db_query.lte("price", filters["max_price"])
        if filters.get("bedrooms") is not None:
            db_query = db_query.eq("bedrooms", filters["bedrooms"])
        if filters.get("bathrooms") is not None:
            db_query = db_query.eq("bathrooms", filters["bathrooms"])
        if filters.get("location"):
            # Strip PostgREST special chars to prevent prompt-injection → filter-injection
            loc = re.sub(r"[,().\[\]\"'`\\]", "", filters["location"])[:100]
            db_query = db_query.or_(f"city.ilike.%{loc}%,location.ilike.%{loc}%")
        if filters.get("agency_id"):
            db_query = db_query.eq("agency_id", filters["agency_id"])
        if filters.get("project_id"):
            db_query = db_query.eq("project_id", filters["project_id"])
        if filters.get("amenities"):
            db_query = db_query.contains("amenities", filters["amenities"])
        if filters.get("min_size_sqm") is not None:
            db_query = db_query.gte("size_sqm", filters["min_size_sqm"])
        if filters.get("max_size_sqm") is not None:
            db_query = db_query.lte("size_sqm", filters["max_size_sqm"])
        # Exact size → ±20 % range so "300 sqm" matches 240–360
        if filters.get("size_sqm") is not None and filters.get("min_size_sqm") is None:
            tol = filters["size_sqm"] * 0.20
            db_query = db_query.gte("size_sqm", filters["size_sqm"] - tol)
            db_query = db_query.lte("size_sqm", filters["size_sqm"] + tol)

        result = db_query.order("views_count", desc=True).limit(10).execute()
        candidates = result.data or []

        # Semantic re-rank (only if Ollama healthy and candidates non-empty)
        if candidates and await ollama.health():
            try:
                msg_embedding = await ollama.embed(message)

                def cosine_sim(a: list[float], b: list[float]) -> float:
                    dot = sum(x * y for x, y in zip(a, b))
                    mag = math.sqrt(sum(x * x for x in a)) * math.sqrt(sum(x * x for x in b))
                    return dot / mag if mag else 0.0

                scored = [
                    (cosine_sim(msg_embedding, c["embedding"]), c)
                    for c in candidates
                    if c.get("embedding")
                ]
                if len(scored) >= 3:
                    scored.sort(key=lambda x: x[0], reverse=True)
                    candidates = [c for _, c in scored[:3]]
                else:
                    candidates = candidates[:3]
            except Exception:
                candidates = candidates[:3]
        else:
            candidates = candidates[:3]

        # Strip embedding vectors before building refs
        for c in candidates:
            c.pop("embedding", None)

        refs = _build_listing_refs(candidates)
        for ref, c in zip(refs, candidates):
            score = _compute_match_score(c, filters)
            if score is not None:
                ref["match_score"] = score
        return refs, "search"

    try:
        return await asyncio.wait_for(_do_search(), timeout=3.0)
    except Exception:
        return [], "search"


# ─── POST /api/ai/search ─────────────────────────────────────────────────────

@router.post("/search")
async def nl_search(body: NLSearchRequest):
    """
    Natural language property search.
    Primary path: semantic retrieval from knowledge_chunks (3+ results).
    Fallback path: LLM filter extraction -> structured DB query.
    Returns {ai_unavailable: true} if Ollama is down.
    """
    if not await ollama.health():
        return AI_UNAVAILABLE

    # Primary path: semantic retrieval from knowledge_chunks
    chunks = await rag_retriever.retrieve(body.query, source_type="listing", k=body.limit)

    if len(chunks) >= 3:
        # Enough semantic results — fetch full listing details for the top chunk source_ids
        listing_ids = list(dict.fromkeys(c.source_id for c in chunks))  # deduplicate, preserve order
        try:
            details_result = (
                supabase_admin.table("listings")
                .select("*, neighborhoods(name)")
                .in_("id", listing_ids[:body.limit])
                .eq("status", "active")
                .is_("deleted_at", "null")
                .execute()
            )
            listings = [_build_listing_brief(r) for r in (details_result.data or [])]
        except Exception as e:
            raise HTTPException(status_code=500, detail="Internal server error")

        return {
            "query": body.query,
            "parsed_filters": {},
            "results": listings,
            "total": len(listings),
            "retrieval_method": "semantic",
        }

    # Fallback path: LLM filter extraction -> structured DB query
    filters = await _extract_filters_from_query(body.query)
    filters = await _resolve_agency_project(filters)

    # User named an agency/project with no matching row → no results possible.
    if filters.pop("_entity_unresolved", False):
        return {
            "query": body.query,
            "parsed_filters": {},
            "results": [],
            "total": 0,
            "retrieval_method": "structured",
        }

    db_query = (
        supabase_admin.table("listings")
        .select("*, neighborhoods(name)")
        .eq("status", "active")
        .is_("deleted_at", "null")
    )

    if filters.get("category"):
        db_query = db_query.eq("category", filters["category"])
    if filters.get("property_type"):
        db_query = db_query.eq("property_type", filters["property_type"])
    if filters.get("min_price") is not None:
        db_query = db_query.gte("price", filters["min_price"])
    if filters.get("max_price") is not None:
        db_query = db_query.lte("price", filters["max_price"])
    if filters.get("bedrooms") is not None:
        db_query = db_query.eq("bedrooms", filters["bedrooms"])
    if filters.get("bathrooms") is not None:
        db_query = db_query.gte("bathrooms", filters["bathrooms"])
    if filters.get("location"):
        location = re.sub(r"[,().\[\]\"'`\\]", "", filters["location"])[:100]
        db_query = db_query.or_(f"city.ilike.%{location}%,location.ilike.%{location}%")
    if filters.get("agency_id"):
        db_query = db_query.eq("agency_id", filters["agency_id"])
    if filters.get("project_id"):
        db_query = db_query.eq("project_id", filters["project_id"])

    try:
        result = db_query.order("views_count", desc=True).limit(body.limit).execute()
        listings = [_build_listing_brief(r) for r in (result.data or [])]
    except Exception as e:
        raise HTTPException(status_code=500, detail="Internal server error")

    return {
        "query": body.query,
        "parsed_filters": filters,
        "results": listings,
        "total": len(listings),
        "retrieval_method": "keyword",
    }


# ─── POST /api/ai/chat ────────────────────────────────────────────────────────

@router.post("/chat")
async def chat(
    body: ChatRequest,
    current_user: dict | None = Depends(get_optional_user),
):
    """
    RAG-augmented streaming SSE chatbot powered by Ollama.
    Retrieves relevant context BEFORE streaming, then emits a citations event
    before [DONE] so the frontend can render source links.
    Returns {ai_unavailable: true} if Ollama is down.
    """
    if not await ollama.health():
        return AI_UNAVAILABLE

    # Step 1: Retrieve context + listing cards in parallel so RAG never blocks cards
    is_property_query = _detect_property_search(body.message) >= 40
    search_filters: dict = {}

    async def _run_listing_search() -> tuple[list[dict], str]:
        nonlocal search_filters
        if not is_property_query:
            return [], "search"
        try:
            search_filters = await _extract_filters_from_query(body.message)
            return await _search_listings_for_chat(body.message, search_filters, current_user)
        except Exception:
            return [], "search"

    chunks, (listing_refs, listing_source) = await asyncio.gather(
        rag_retriever.retrieve(body.message, k=5),
        _run_listing_search(),
    )

    # Non-listing chunks (neighborhoods, blog) come from RAG as-is.
    # Listing chunks are dropped — they may be stale snapshots.
    # Fresh listing context is built directly from the live DB results above.
    non_listing_chunks = [c for c in chunks if c.source_type != "listing"]
    citations = rag_retriever.format_citations(non_listing_chunks)

    rag_context = rag_retriever.build_context(non_listing_chunks)

    # Detect proximity mismatch: requested city not in any returned listing
    proximity_notice: str | None = None
    if listing_refs and search_filters.get("location"):
        requested_loc = search_filters["location"].lower()
        has_local_match = any(
            requested_loc in (r.get("city") or "").lower() or
            requested_loc in (r.get("location") or "").lower()
            for r in listing_refs
        )
        if not has_local_match:
            cap = search_filters["location"].title()
            proximity_notice = (
                f"No exact matches in {cap} — showing the closest available results from nearby areas."
            )

    if listing_refs:
        listing_lines = []
        for i, r in enumerate(listing_refs, 1):
            beds  = f"beds={r['bedrooms']} "   if r.get("bedrooms")  is not None else ""
            baths = f"baths={r['bathrooms']} " if r.get("bathrooms") is not None else ""
            size  = f"size={r['size_sqm']}sqm " if r.get("size_sqm") is not None else ""
            price = f"price={r['price']:,.0f}{r.get('currency','EGP')}"
            ptype = r.get("property_type") or "property"
            city  = r.get("city") or r.get("location") or ""
            listing_lines.append(
                f"LISTING[{i}]: type={ptype} {beds}{baths}{size}{price} city={city}"
            )
        count_line = f"RESULT_COUNT={len(listing_refs)}\n"
        fresh_listing_context = "LIVE_DB_RESULTS:\n" + count_line + "\n".join(listing_lines)
        context_str = fresh_listing_context + ("\n\n" + rag_context if rag_context else "")
    elif is_property_query:
        context_str = (
            "LIVE_DB_RESULTS:\n"
            "RESULT_COUNT=0\n"
            "(No listings found matching this search query)\n"
            + ("\n\n" + rag_context if rag_context else "")
        )
    else:
        context_str = rag_context

    # Step 2: Build grounded system prompt
    if context_str:
        system = (
            "You are AXIOM AI, the assistant inside AXIOM — Egypt's real estate platform.\n"
            "The user is already on the site. Help them find a home using ONLY the verified\n"
            "live data below. A separate UI layer renders matched listings as tappable\n"
            "cards under your reply, and each card links to its full details page — you\n"
            "never need to describe a listing exhaustively or output IDs, URLs, or images.\n\n"
            "HARD RULES — NON-NEGOTIABLE:\n\n"
            "1. GROUNDING. Every factual claim about a listing, neighborhood, price,\n"
            "   size, amenity, or availability MUST come from the VERIFIED DATABASE\n"
            "   RECORDS below. If a detail is not in the records, you do not know it.\n"
            "   Do not infer, estimate, average, or fill gaps from general knowledge.\n\n"
            "2. NO HALLUCINATION. Never invent listings, prices, addresses, compound\n"
            "   names, landlord names, phone numbers, square meters, bedroom counts,\n"
            "   or amenities. If the records don't contain it, say so plainly in one\n"
            "   sentence.\n\n"
            "3. NO QUESTIONS BACK. Do not ask the user for clarification, budget,\n"
            "   city, bedroom count, or preferences. Answer using whatever is already\n"
            "   in their message plus the records. If the query is vague, give the\n"
            "   best short answer possible from what is available and stop.\n\n"
            "4. NO RAW IDs OR LINKS. Never output UUIDs, database IDs, embedding\n"
            "   values, internal field names, or URLs. The card UI handles all of that.\n\n"
            "5. NO OFF-PLATFORM REFERRALS. Never mention or link to Aqarmap, Bayut,\n"
            "   Property Finder, OLX, Dubizzle, or any external site. Keep the user\n"
            "   on AXIOM.\n\n"
            "6. LANGUAGE. Reply in the same language as the user's last message\n"
            "   (Arabic or English). If mixed, match the dominant language.\n\n"
            "FRESHNESS RULES:\n\n"
            "7. The LIVE_DB_RESULTS below are a live snapshot from Supabase at the\n"
            "   moment this message was sent. They are the ONLY source of truth —\n"
            "   they override previous assistant replies, anything the user quotes\n"
            "   back at you, and any general market assumptions.\n\n"
            "8. If this turn's records differ from earlier replies (price, size,\n"
            "   bedroom count), USE THIS TURN'S VALUES silently.\n\n"
            "9. Only reference listings present in THIS turn's LIVE_DB_RESULTS.\n"
            "   If a listing from conversation history is not here, say it no\n"
            "   longer matches. Do not restate its old details.\n\n"
            "10. Never say a listing is 'available' — its presence in the data\n"
            "    already means it is.\n\n"
            "11. CONVERSATION HISTORY may contain '[Listings shown: ...]' lines.\n"
            "    Those are PAST searches — COMPLETELY OUTDATED. NEVER cite them.\n"
            "    If this turn's RESULT_COUNT=0, there are NO listings. Period.\n\n"
            "WHEN LISTINGS MATCH (RESULT_COUNT > 0 in LIVE_DB_RESULTS below):\n"
            "┌─────────────────────────────────────────────────────────────┐\n"
            "│  YOUR ENTIRE RESPONSE = ONE SENTENCE.  NOTHING ELSE.       │\n"
            "│  Format: 'Here are [N] [type]s in [city]:'                 │\n"
            "│  Then STOP. No newline, no dash, no title, no price.       │\n"
            "│  Cards appear automatically — DO NOT list any details.     │\n"
            "└─────────────────────────────────────────────────────────────┘\n"
            "Use the EXACT number from RESULT_COUNT and the exact type= value\n"
            "from LIVE_DB_RESULTS. Never round, never add prose.\n\n"
            "WHEN NO LISTINGS MATCH (RESULT_COUNT=0 in LIVE_DB_RESULTS below):\n"
            "- One plain sentence: 'There are no [type] listings at the moment.'\n"
            "- NEVER invent listings. NEVER cite conversation history.\n\n"
            "STYLE:\n"
            "- 1–2 sentences for almost every reply. Maximum 3.\n"
            "- No markdown headers, no bold, no numbered lists, no emojis.\n"
            "- No filler openers ('Great question!', 'Of course!', 'Sure thing!',\n"
            "  'بكل تأكيد', 'بالطبع').\n"
            "- Plain, direct, conversational Arabic or English.\n\n"
            f"{context_str}"
        )
    else:
        system = (
            "You are AXIOM AI, the assistant inside AXIOM — Egypt's real estate platform.\n"
            "No verified listing data was retrieved from Supabase for this query.\n\n"
            "HARD RULES:\n"
            "- Do NOT claim any specific listing, price, address, or availability\n"
            "  exists. You have no live data for this query.\n"
            "- Do NOT ask the user clarifying questions. Answer briefly from general\n"
            "  Egyptian real estate knowledge (lease norms, neighborhood character,\n"
            "  buying/renting process, typical price ranges as ranges only) and stop.\n"
            "- Do NOT mention Aqarmap, Bayut, Property Finder, or any external\n"
            "  platform.\n"
            "- No UUIDs, no URLs, no markdown, no filler openers.\n"
            "- Reply in the user's language (Arabic or English).\n"
            "- Maximum 2–3 sentences."
        )

    # Step 3: Build chat messages array (proper role-separated format for /api/chat)
    chat_messages: list[dict] = [{"role": "system", "content": system}]
    for msg in body.conversation_history[-4:]:
        role = msg.get("role", "user")
        content = msg.get("content", "")
        if role in ("user", "assistant") and content:
            chat_messages.append({"role": role, "content": content})
    chat_messages.append({"role": "user", "content": body.message})

    # Step 4: Stream response with per-token timeout; emit listing_refs + proximity_notice + citations before [DONE]
    _TOKEN_TIMEOUT = 30.0  # seconds to wait for the next token before aborting

    async def generate_sse():
        token_gen = ollama.chat_stream(chat_messages)
        try:
            while True:
                try:
                    token = await asyncio.wait_for(token_gen.__anext__(), timeout=_TOKEN_TIMEOUT)
                    yield f"data: {json.dumps({'token': token})}\n\n"
                except asyncio.TimeoutError:
                    yield f"data: {json.dumps({'error': 'Generation timed out — please try again.'})}\n\n"
                    return
                except StopAsyncIteration:
                    break
                except Exception as e:
                    yield f"data: {json.dumps({'error': str(e)})}\n\n"
                    return
        finally:
            await token_gen.aclose()

        if listing_refs:
            enriched_filters = {**search_filters, "_user_query": body.message}
            yield f"data: {json.dumps({'listing_refs': listing_refs, 'source': listing_source, 'search_filters': enriched_filters})}\n\n"
        if proximity_notice:
            yield f"data: {json.dumps({'proximity_notice': proximity_notice})}\n\n"
        if citations:
            yield f"data: {json.dumps({'citations': [c.model_dump() for c in citations]})}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(
        generate_sse(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


# ─── GET /api/ai/recommendations ─────────────────────────────────────────────

async def _explain_recommendations(
    fav_listings: list[dict],
    candidate_listings: list[dict],
) -> dict[str, str]:
    """
    Single-batch LLM call that returns a dict of listing_id -> 1-sentence explanation.
    Fail-open: returns {} if Ollama call fails.
    """
    if not fav_listings or not candidate_listings:
        return {}

    fav_summary = "; ".join(
        f"{l.get('title', '')} in {l.get('location', '')} ({l.get('category', '')})"
        for l in fav_listings[:3]
    )
    candidates_text = "\n".join(
        f"ID:{l['id']} | {l.get('title', '')} | {l.get('location', '')} | {l.get('category', '')} | {l.get('price', '')} EGP"
        for l in candidate_listings
    )

    system = (
        "You are a real estate recommendation assistant. "
        "Given a user's favorites and a list of candidate listings, "
        "write a single sentence explaining why each candidate matches the user's preferences. "
        "Return ONLY a JSON object mapping listing ID to explanation string. "
        "Example: {\"uuid-1\": \"Similar to your Maadi favorites — same area and price range.\"}"
    )
    prompt = (
        f"User's favorites: {fav_summary}\n\n"
        f"Candidate listings:\n{candidates_text}\n\n"
        "Return a JSON object with an explanation for each candidate ID."
    )

    try:
        raw = await ollama.generate(prompt=prompt, system=system)
        json_str = _extract_json(raw)
        if json_str:
            result = json.loads(json_str)
            return {k: str(v) for k, v in result.items() if isinstance(k, str)}
    except Exception:
        pass

    return {}


@router.get("/recommendations")
async def get_recommendations(
    current_user: dict = Depends(get_current_user),
    explain: bool = False,
    category: str | None = None,
):
    """
    Return property recommendations based on the user's favorited listings.
    Uses pgvector cosine similarity if embeddings exist, otherwise falls back to
    category/location matching.
    Returns {ai_unavailable: true} if Ollama is down and no embeddings available.
    """
    user_id = current_user["id"]

    # Fetch user's favorite listing IDs
    try:
        fav_result = (
            supabase_admin.table("favorites")
            .select("listing_id")
            .eq("user_id", user_id)
            .limit(10)
            .execute()
        )
        fav_ids = [r["listing_id"] for r in (fav_result.data or [])]
    except Exception:
        fav_ids = []

    if not fav_ids:
        # No favorites — return newest active listings
        try:
            query = (
                supabase_admin.table("listings")
                .select("*, neighborhoods(name)")
                .eq("status", "active")
                .is_("deleted_at", "null")
            )
            if category:
                query = query.eq("category", category)
            result = query.order("created_at", desc=True).limit(8).execute()
            return [_build_listing_brief(r) for r in (result.data or [])]
        except Exception:
            return []

    # Fetch one of the favorited listings to use as reference for category/city
    # Extended select includes id, title, location for _explain_recommendations() fav_summary
    try:
        ref_result = (
            supabase_admin.table("listings")
            .select("id, title, location, category, city, embedding")
            .eq("id", fav_ids[0])
            .single()
            .execute()
        )
        ref = ref_result.data or {}
    except Exception:
        ref = {}

    # Try vector similarity first (if embedding exists)
    if ref.get("embedding") and await ollama.health():
        try:
            sim_result = supabase_admin.rpc(
                "match_listings",
                {
                    "query_embedding": ref["embedding"],
                    "match_threshold": 0.5,
                    "match_count": 12,
                    "filter_category": category or ref.get("category"),
                    "filter_city": ref.get("city"),
                },
            ).execute()
            # Get full listing details for matched IDs
            if sim_result.data:
                matched_ids = [r["id"] for r in sim_result.data if r["id"] not in fav_ids]
                if matched_ids:
                    details_result = (
                        supabase_admin.table("listings")
                        .select("*, neighborhoods(name)")
                        .in_("id", matched_ids[:8])
                        .execute()
                    )
                    candidates = [_build_listing_brief(r) for r in (details_result.data or [])]
                    if explain and fav_ids:
                        fav_details = [ref] if ref else []
                        explanations = await _explain_recommendations(fav_details, candidates)
                        for listing in candidates:
                            listing["explanation"] = explanations.get(listing["id"], "")
                    return candidates
        except Exception:
            pass

    # Fallback: same category + city, excluding already favorited
    try:
        fb_result = (
            supabase_admin.table("listings")
            .select("*, neighborhoods(name)")
            .eq("status", "active")
            .is_("deleted_at", "null")
            .not_.in_("id", fav_ids)
        )
        target_category = category or ref.get("category")
        if target_category:
            fb_result = fb_result.eq("category", target_category)
        if ref.get("city"):
            fb_result = fb_result.ilike("city", f"%{ref['city']}%")

        final = fb_result.order("views_count", desc=True).limit(8).execute()
        candidates = [_build_listing_brief(r) for r in (final.data or [])]
        if explain and fav_ids:
            fav_details = [ref] if ref else []
            explanations = await _explain_recommendations(fav_details, candidates)
            for listing in candidates:
                listing["explanation"] = explanations.get(listing["id"], "")
        return candidates
    except Exception:
        return []


_PROPERTY_TYPE_TO_CATEGORY = {
    "rent": "for_rent",
    "buy": "for_sale",
    "shared": "shared_housing",
}


@router.post("/recommendations")
async def post_recommendations(
    body: RecommendationRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    Return listings filtered by the preferences submitted from the home
    "What are you looking for?" modal (budget, location, bedrooms, type, vibes).
    Hard-filters on budget/location/bedrooms/category, then ranks the remaining
    candidates by how many requested vibes match the listing amenities.
    """
    try:
        query = (
            supabase_admin.table("listings")
            .select("*, neighborhoods(name)")
            .eq("status", "active")
            .is_("deleted_at", "null")
        )

        category = _PROPERTY_TYPE_TO_CATEGORY.get((body.property_type or "").lower())
        if category:
            query = query.eq("category", category)
        if body.budget_max is not None:
            query = query.lte("price", body.budget_max)
        if body.bedrooms is not None:
            query = query.gte("bedrooms", body.bedrooms)
        if body.location:
            loc = body.location.replace(",", " ").strip()
            query = query.or_(f"location.ilike.%{loc}%,city.ilike.%{loc}%")

        result = query.order("views_count", desc=True).limit(50).execute()
        rows = result.data or []
    except Exception:
        rows = []

    wanted_vibes = [v.lower() for v in (body.vibes or [])]

    def vibe_score(row: dict) -> int:
        if not wanted_vibes:
            return 0
        haystack = " ".join(str(a).lower() for a in (row.get("amenities") or []))
        return sum(1 for v in wanted_vibes if v in haystack)

    ranked = sorted(
        rows,
        key=lambda r: (vibe_score(r), r.get("views_count", 0)),
        reverse=True,
    )

    recommendations = []
    for row in ranked[: body.limit]:
        brief = _build_listing_brief(row)
        matched = vibe_score(row)
        if matched:
            brief["reasoning"] = f"Matches {matched} of your selected vibes"
        recommendations.append(brief)

    return {"recommendations": recommendations, "total": len(recommendations)}


# ─── POST /api/ai/compatibility ──────────────────────────────────────────────

@router.post("/compatibility")
async def compute_compatibility(
    body: CompatibilityRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    Compute a lifestyle compatibility score (0-100) between the current user
    and a shared housing listing, using listing preferences and stored user profile.
    Returns {ai_unavailable: true} if Ollama is down.
    """
    if not await ollama.health():
        return AI_UNAVAILABLE

    # Step 1: Fetch listing
    try:
        listing_result = (
            supabase_admin.table("listings")
            .select("category, lifestyle_preferences, title")
            .eq("id", body.listing_id)
            .single()
            .execute()
        )
    except Exception:
        raise HTTPException(status_code=404, detail="Listing not found")

    if not listing_result.data:
        raise HTTPException(status_code=404, detail="Listing not found")

    listing = listing_result.data
    if listing.get("category") != "shared_housing":
        raise HTTPException(status_code=400, detail="Not a shared housing listing")

    listing_prefs = listing.get("lifestyle_preferences") or {}

    # Step 4: Fetch current user's stored profile
    stored_user_prefs: dict = {}
    try:
        profile_result = (
            supabase_admin.table("profiles")
            .select("lifestyle_preferences, age, occupation, gender")
            .eq("id", current_user["id"])
            .single()
            .execute()
        )
        if profile_result.data:
            p = profile_result.data
            stored_user_prefs = {
                "age": p.get("age"),
                "occupation": p.get("occupation"),
                "gender": p.get("gender"),
                **(p.get("lifestyle_preferences") or {}),
            }
    except Exception:
        pass  # fail-open

    # Step 5: Merge — body.lifestyle_data overrides stored prefs
    merged_user_prefs = {**stored_user_prefs, **body.lifestyle_data}

    # Step 7: LLM call with enriched prompt
    system = (
        "You are a shared housing compatibility expert. "
        "Score compatibility between a person's lifestyle preferences and a shared housing listing. "
        "Consider: gender preference, smoking, pets, guests policy, noise level, "
        "cleanliness, sleep schedule, occupation. "
        "Return ONLY a JSON object: "
        "{\"score\": <0-100>, \"reasons\": [\"...\", \"...\"]}"
    )
    prompt = (
        f"Listing preferences: {json.dumps(listing_prefs)}\n"
        f"Applicant preferences: {json.dumps(merged_user_prefs)}\n"
        "Compute compatibility score."
    )

    # Step 8: Parse response
    try:
        raw = await ollama.generate(prompt=prompt, system=system)
        json_str = _extract_json(raw)
        if json_str:
            parsed = json.loads(json_str)
            score = max(0, min(100, int(parsed.get("score", 50))))
            reasons = parsed.get("reasons", [])
        else:
            score = 50
            reasons = []
    except Exception:
        score = 50
        reasons = []

    return {
        "listing_id": body.listing_id,
        "compatibility_score": score,
        "reasons": reasons,
    }


# ─── POST /api/ai/description ────────────────────────────────────────────────

def _clean_description(raw: str) -> str:
    """
    Normalize the model's reply into plain English description text.

    The model is asked for plain text, but occasionally wraps it in JSON or
    quotes. Recover the English text from those cases and strip stray labels.
    """
    if not raw:
        return ""
    text = raw.strip()

    # Recover from an accidental JSON object (e.g. {"english": "...", ...}).
    json_str = _extract_json(text)
    if json_str:
        try:
            parsed = json.loads(json_str)
            if isinstance(parsed, dict):
                text = (
                    parsed.get("english")
                    or parsed.get("description")
                    or next((v for v in parsed.values() if isinstance(v, str)), "")
                )
        except Exception:
            pass

    text = text.strip()
    # Strip a leading "English:" / "Description:" label if present.
    for label in ("english:", "description:"):
        if text.lower().startswith(label):
            text = text[len(label):].strip()
    # Strip wrapping quotes.
    if len(text) >= 2 and text[0] in "\"'" and text[-1] == text[0]:
        text = text[1:-1].strip()
    return text


def _enforce_ai_quota(sub: dict | None) -> None:
    if plans.ai_remaining(sub) <= 0:
        raise HTTPException(
            status_code=402,
            detail="AI description limit reached for your plan. Upgrade for more.",
        )


@router.post("/description")
async def generate_description(
    body: DescriptionRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    Generate an English listing description using Ollama.
    Retrieves neighborhood context from knowledge_chunks before generating.
    Returns {ai_unavailable: true} if Ollama is down.
    """
    sub = service.get_or_create(current_user["id"])
    _enforce_ai_quota(sub)
    if not await ollama.health():
        return AI_UNAVAILABLE

    # Step 1: Retrieve neighborhood context (fail-open — proceed even if this fails)
    neighborhood_context = ""
    try:
        nbhd_chunks = await rag_retriever.retrieve(
            f"{body.city} neighborhood real estate",
            source_type="neighborhood",
            k=2,
        )
        if nbhd_chunks:
            # Build context string capped at 600 chars to avoid bloating the prompt
            raw_context = " ".join(c.chunk_text for c in nbhd_chunks)
            neighborhood_context = raw_context[:600]
    except Exception:
        pass  # fail-open: proceed without neighborhood context

    amenities_str = ", ".join(body.amenities) if body.amenities else "none listed"
    price_str = f"EGP {body.price:,.0f}" if body.price else "price not specified"

    # Step 2: Build system prompt with optional context clause
    context_clause = (
        f"\n\nNEIGHBORHOOD CONTEXT:\n{neighborhood_context}"
        if neighborhood_context
        else ""
    )
    system = (
        "You are a professional real estate copywriter specializing in Egyptian property listings. "
        "Write a compelling, accurate description in English only. "
        "Be specific to Egyptian market context and culture. "
        "Respond with the description text only — no preamble, labels, quotes, or JSON."
        f"{context_clause}"
    )

    prompt = (
        f"Property details:\n"
        f"- Title: {body.title}\n"
        f"- Type: {body.property_type}\n"
        f"- Category: {body.category}\n"
        f"- City: {body.city}\n"
        f"- Bedrooms: {body.bedrooms or 'N/A'}\n"
        f"- Bathrooms: {body.bathrooms or 'N/A'}\n"
        f"- Size: {body.size_sqm or 'N/A'} sqm\n"
        f"- Price: {price_str}\n"
        f"- Amenities: {amenities_str}\n"
        f"- Extra notes: {body.extra_notes or 'none'}\n\n"
        "Write a 3-4 sentence property description in English."
    )

    raw = ""
    try:
        raw = await ollama.generate(prompt=prompt, system=system)
    except Exception:
        return AI_UNAVAILABLE

    description = _clean_description(raw)
    if not description:
        return AI_UNAVAILABLE

    service.increment_ai_used(current_user["id"])
    return {"description": description}


# ─── POST /api/ai/validate-amenity ───────────────────────────────────────────

@router.post("/validate-amenity")
async def validate_amenity(
    body: AmenityValidationRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    Check whether a custom amenity string is appropriate for a property listing.
    Fail-open: returns ok=True if Ollama is unavailable.
    """
    value = body.amenity.strip()
    if not value:
        return {"ok": False, "reason": "Amenity name cannot be empty"}

    if not await ollama.health():
        return {"ok": True, "reason": ""}

    system = (
        "You are a content moderation system for a real estate platform in Egypt. "
        "Determine whether the given amenity name is appropriate for a property listing. "
        "Flag anything that is: offensive, sexual, discriminatory, harmful, or entirely unrelated to real estate. "
        "Legitimate examples: 'Rooftop Terrace', 'Private Entrance', 'Solar Panels', 'Maid's Room'. "
        "Return ONLY valid JSON with no extra text: "
        '{\"appropriate\": true, \"reason\": \"\"} '
        'or {\"appropriate\": false, \"reason\": \"short reason\"}'
    )
    prompt = f'Is this amenity appropriate for a real estate listing? Amenity: "{value}"'

    try:
        raw = await ollama.generate(prompt=prompt, system=system)
        json_str = _extract_json(raw)
        if json_str:
            parsed = json.loads(json_str)
            ok = bool(parsed.get("appropriate", True))
            reason = str(parsed.get("reason", ""))
            return {"ok": ok, "reason": reason}
    except Exception:
        pass

    # Fail-open on any parse error
    return {"ok": True, "reason": ""}


# ─── POST /api/ai/format-article ─────────────────────────────────────────────

def _split_article(text: str) -> list[dict]:
    """
    Split article text into segments.
    AI will only classify types — original text is always used for content.
    """
    segments: list[dict] = []

    for para in re.split(r'\n{2,}', text.strip()):
        para = para.strip()
        if not para:
            continue

        lines = [l.strip() for l in para.split('\n') if l.strip()]

        # Inline bullet list (2+ lines starting with - * or number.)
        bullet_lines = [l for l in lines if re.match(r'^[-*]\s', l) or re.match(r'^\d+\.\s', l)]
        if len(bullet_lines) >= 2:
            items = [re.sub(r'^[-*\d\.]+\s*', '', l) for l in lines if l.strip()]
            segments.append({"text": para, "items": items, "pre_type": "list"})
            continue

        # Heading+body in one block: short first line without ending punctuation
        if (
            len(lines) >= 2
            and len(lines[0]) <= 80
            and lines[0][-1] not in '.?!,;:'
        ):
            segments.append({"text": lines[0], "pre_type": None})
            segments.append({"text": ' '.join(lines[1:]), "pre_type": None})
            continue

        segments.append({"text": para, "pre_type": None})

    return segments


def _rule_classify(text: str) -> str | None:
    """
    Classify a text segment by rule. Returns type string or None if ambiguous.
    None means: ask the AI.
    """
    t = text.strip()
    if not t:
        return "paragraph"
    last_char = t[-1]
    length = len(t)

    # Clearly a paragraph: ends with sentence punctuation OR very long
    if last_char in '.?!' or length > 80:
        return "paragraph"

    # Clearly a heading: short, no sentence-ending punctuation
    if length <= 60:
        return "heading"

    # 61–80 chars, no ending punctuation — ambiguous, delegate to AI
    return None


@router.post("/format-article")
async def format_article(body: FormatArticleRequest):
    """
    Structure article text into typed content blocks.
    Rules handle clear cases; AI resolves the 61–80 char ambiguous segments.
    Original text is NEVER modified — AI only outputs type labels.
    Falls back to {ai_unavailable: true} if Ollama is down.
    """
    segments = _split_article(body.text)
    if not segments:
        return AI_UNAVAILABLE

    # Apply rules first
    for s in segments:
        if s.get("pre_type") is None:
            rule = _rule_classify(s["text"])
            if rule:
                s["pre_type"] = rule

    # Only truly ambiguous segments go to AI
    ambiguous = [(i, s) for i, s in enumerate(segments) if s.get("pre_type") is None]

    if ambiguous:
        if not await ollama.health():
            # Fallback: treat ambiguous as heading (they're short and have no punctuation)
            for i, s in ambiguous:
                s["pre_type"] = "heading"
        else:
            numbered = "\n".join(f"[{idx}] {s['text']}" for idx, s in ambiguous)
            n = len(ambiguous)
            system = (
                f"Classify each numbered text snippet. Return ONLY a JSON array of exactly {n} strings.\n"
                "Types: \"heading\" (section title) or \"paragraph\" (body text).\n"
                f"Return exactly {n} strings. Example: [\"heading\",\"paragraph\"]"
            )
            try:
                raw = await ollama.generate(prompt=numbered, system=system)
                raw = re.sub(r"```(?:json)?\s*", "", raw).strip().rstrip("`").strip()
                start = raw.find("[")
                end = raw.rfind("]") + 1
                if start >= 0 and end > start:
                    types = json.loads(raw[start:end])
                    types = [
                        json.loads(t) if isinstance(t, str) and t.startswith('"') else t
                        for t in types
                    ]
                    if isinstance(types, list) and len(types) == len(ambiguous):
                        for (orig_i, _), t in zip(ambiguous, types):
                            segments[orig_i]["pre_type"] = str(t) if t else "heading"
            except Exception:
                pass

    # Final fallback
    for s in segments:
        if not s.get("pre_type"):
            s["pre_type"] = "heading"

    # Build blocks — group consecutive list_items into one list block
    blocks: list[dict] = []
    i = 0
    while i < len(segments):
        seg = segments[i]
        t = seg["pre_type"]

        if t == "list":
            blocks.append({"type": "list", "items": seg["items"]})
        elif t == "list_item":
            items = [seg["text"]]
            while i + 1 < len(segments) and segments[i + 1].get("pre_type") == "list_item":
                i += 1
                items.append(segments[i]["text"])
            blocks.append({"type": "list", "items": items})
        elif t == "heading":
            blocks.append({"type": "heading", "text": seg["text"]})
        elif t == "blockquote":
            blocks.append({"type": "blockquote", "text": seg["text"], "attribution": "AXIOM Editorial"})
        else:
            blocks.append({"type": "paragraph", "text": seg["text"]})
        i += 1

    if blocks:
        return {"blocks": blocks}

    return AI_UNAVAILABLE
