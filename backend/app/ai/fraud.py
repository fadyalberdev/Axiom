"""
Fraud detection scoring pipeline for new listings.

Returns a score from 0.0 (safe) to 1.0 (likely fraudulent).
Fail-open: if Ollama is down, returns 0.0 so listings are auto-approved.
"""

import json
from app.ai.ollama_client import ollama
from app.ai.rag import rag_retriever
from app.database import supabase_admin


async def score_listing(listing: dict) -> float:
    """
    Compute a fraud score (0.0-1.0) for a listing.

    Weights:
      - Price anomaly: 0.3
      - Owner reputation: 0.2
      - LLM consistency: 0.5

    Hard rules (return 1.0 immediately, no LLM needed):
      - price <= 10 EGP
      - size_sqm <= 5
      - no description

    If Ollama is down the LLM component returns 0.0 (fail-open).
    """
    # Hard rule: suspiciously low price
    price = listing.get("price")
    if price is not None and float(price) <= 10:
        return 1.0

    # Hard rule: impossibly small area
    size = listing.get("size_sqm")
    if size is not None and float(size) <= 5:
        return 1.0

    # Hard rule: missing description is high-risk, skip LLM
    if not listing.get("description"):
        price_score = await _price_anomaly(listing)
        reputation_score = await _owner_reputation(listing.get("owner_id", ""))
        # Missing description counts as 0.6 LLM-equivalent risk
        total = (price_score * 0.3) + (reputation_score * 0.2) + (0.6 * 0.5)
        return round(min(1.0, max(0.0, total)), 3)

    price_score = await _price_anomaly(listing)
    reputation_score = await _owner_reputation(listing.get("owner_id", ""))
    llm_score = await _llm_consistency(listing)

    total = (price_score * 0.3) + (reputation_score * 0.2) + (llm_score * 0.5)
    return round(min(1.0, max(0.0, total)), 3)


async def _price_anomaly(listing: dict) -> float:
    """
    Compare listing price to the average for the same category + city.
    Returns 0.0 if within 3x of average, scales up to 1.0.
    """
    category = listing.get("category")
    city = listing.get("city")
    price = listing.get("price")

    if not all([category, city, price]):
        return 0.0

    try:
        result = (
            supabase_admin.table("listings")
            .select("price")
            .eq("category", category)
            .ilike("city", f"%{city.replace('%', '').replace('_', '')[:100]}%")
            .eq("status", "active")
            .is_("deleted_at", "null")
            .limit(100)
            .execute()
        )
        prices = [float(r["price"]) for r in (result.data or []) if r.get("price")]
    except Exception:
        return 0.0

    if not prices:
        return 0.0

    avg_price = sum(prices) / len(prices)
    if avg_price == 0:
        return 0.0

    ratio = float(price) / avg_price

    if 0.3 <= ratio <= 3.0:
        return 0.0
    if ratio < 0.1 or ratio > 10.0:
        return 1.0
    return 0.5


async def _owner_reputation(owner_id: str) -> float:
    """
    Check how many of the owner's previous listings were rejected.
    More rejected listings = higher fraud score.
    """
    if not owner_id:
        return 0.0

    try:
        result = (
            supabase_admin.table("listings")
            .select("status", count="exact")
            .eq("owner_id", owner_id)
            .eq("status", "rejected")
            .execute()
        )
        rejected_count = result.count or 0
    except Exception:
        return 0.0

    if rejected_count == 0:
        return 0.0
    if rejected_count <= 2:
        return 0.3
    if rejected_count <= 5:
        return 0.6
    return 1.0


async def _llm_consistency(listing: dict) -> float:
    """
    Ask Ollama whether the description is consistent with attributes.
    Retrieves real market price context from knowledge_chunks before scoring.
    Returns 0.0 if Ollama is down (fail-open).
    """
    if not await ollama.health():
        return 0.0

    description = listing.get("description") or ""
    if not description:
        return 0.0

    # Step 1: Retrieve market price context (fail-open)
    market_context = ""
    try:
        city = listing.get("city", "")
        category = listing.get("category", "")
        if city and category:
            price_chunks = await rag_retriever.retrieve(
                f"{city} {category} price range market",
                source_type="listing",
                k=3,
            )
            if price_chunks:
                raw = " ".join(c.chunk_text for c in price_chunks)
                market_context = raw[:400]
    except Exception:
        pass  # fail-open: proceed without market context

    # Step 2: Build system prompt with optional market clause
    market_clause = (
        f"\n\nMARKET CONTEXT (real listings for reference):\n{market_context}"
        if market_context
        else ""
    )
    system = (
        "You are a fraud detection system for a real estate platform. "
        "Evaluate whether the listing description is consistent with its attributes. "
        "Look for: unrealistic claims, mismatch between description and attributes, "
        "suspicious urgency, requests for off-platform payment. "
        "Return ONLY a JSON object: {\"fraud_score\": <0.0-1.0>, \"reason\": \"...\"}"
        f"{market_clause}"
    )

    attrs = {
        "title": listing.get("title"),
        "price": listing.get("price"),
        "category": listing.get("category"),
        "property_type": listing.get("property_type"),
        "city": listing.get("city"),
        "bedrooms": listing.get("bedrooms"),
        "bathrooms": listing.get("bathrooms"),
        "size_sqm": listing.get("size_sqm"),
    }

    prompt = (
        f"Listing attributes: {json.dumps(attrs)}\n"
        f"Listing description: {description}\n\n"
        "Is the description consistent with these attributes? Score fraud risk."
    )

    try:
        raw = await ollama.generate(prompt=prompt, system=system)
        start = raw.find("{")
        end = raw.rfind("}") + 1
        if start >= 0 and end > start:
            parsed = json.loads(raw[start:end])
            return max(0.0, min(1.0, float(parsed.get("fraud_score", 0.0))))
    except Exception:
        pass

    return 0.0
