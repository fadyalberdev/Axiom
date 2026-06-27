"""
Embedding generation for listings.

Builds a text representation from listing fields, generates a 768-dim vector
via Ollama, and stores it in the listings.embedding column (pgvector).
Silently skips if Ollama is down — can be backfilled later.

Also provides embed_listing_chunk() and delete_listing_chunk() for the
knowledge_chunks RAG table — used by the batch script and router hooks.
"""

import logging

from app.ai.ollama_client import ollama
from app.database import supabase_admin

logger = logging.getLogger(__name__)


async def embed_listing(listing_id: str) -> bool:
    """
    Generate and store an embedding for a listing.
    Returns True on success, False if skipped or failed.
    """
    if not await ollama.health():
        return False

    # Fetch listing data
    try:
        result = (
            supabase_admin.table("listings")
            .select("title, description, location, city, property_type, category, bedrooms, bathrooms, size_sqm, amenities")
            .eq("id", listing_id)
            .single()
            .execute()
        )
    except Exception:
        return False

    if not result.data:
        return False

    listing = result.data
    text = _build_embed_text(listing)
    if not text:
        return False

    try:
        vector = await ollama.embed(text)
    except Exception:
        return False

    if not vector:
        return False

    # Store the embedding
    try:
        supabase_admin.table("listings").update(
            {"embedding": vector}
        ).eq("id", listing_id).execute()
        return True
    except Exception:
        return False


async def embed_listing_chunk(listing_id: str) -> bool:
    """
    Generate a chunk embedding for a listing and upsert into knowledge_chunks.

    This powers RAG retrieval. Returns True on success, False if skipped or
    failed (e.g. listing soft-deleted, Ollama down, DB error).
    """
    # Fetch the listing with all fields needed for a rich chunk
    try:
        result = (
            supabase_admin.table("listings")
            .select(
                "title, description, location, city, neighborhood_id, "
                "property_type, category, price, bedrooms, bathrooms, "
                "size_sqm, amenities, compound_name, status, deleted_at"
            )
            .eq("id", listing_id)
            .single()
            .execute()
        )
    except Exception:
        return False

    if not result.data:
        return False

    listing = result.data

    # Skip soft-deleted listings
    if listing.get("deleted_at") is not None:
        return False

    chunk_text = _build_chunk_text(listing)
    if not chunk_text:
        return False

    try:
        vector = await ollama.embed(chunk_text)
    except Exception:
        return False

    if not vector:
        return False

    try:
        supabase_admin.table("knowledge_chunks").upsert(
            {
                "source_type": "listing",
                "source_id": listing_id,
                "chunk_text": chunk_text,
                "embedding": vector,
                "metadata": {
                    "city": listing.get("city", ""),
                    "category": listing.get("category", ""),
                    "price": float(listing.get("price", 0) or 0),
                    "bedrooms": listing.get("bedrooms"),
                    "property_type": listing.get("property_type", ""),
                },
                "updated_at": "now()",
            },
            on_conflict="source_type,source_id",
        ).execute()
        return True
    except Exception as exc:
        logger.warning("embed_listing_chunk failed for %s: %s", listing_id, exc)
        return False


async def delete_listing_chunk(listing_id: str) -> bool:
    """
    Remove a listing's knowledge_chunks row when the listing is soft-deleted.
    Returns True on success, False on any exception.
    """
    try:
        supabase_admin.table("knowledge_chunks") \
            .delete() \
            .eq("source_type", "listing") \
            .eq("source_id", listing_id) \
            .execute()
        return True
    except Exception as exc:
        logger.warning("delete_listing_chunk failed for %s: %s", listing_id, exc)
        return False


def _build_chunk_text(listing: dict) -> str:
    """
    Build a human-readable chunk string for a listing.

    Format: "{title}. {property_type} in {city}{, location}. {beds} bed,
    {baths} bath{, size sqm}. Price: {price} EGP. {description[:300]}.
    Amenities: {amenities}. Compound: {compound_name}."
    """
    parts: list[str] = []

    title = listing.get("title", "").strip()
    if title:
        parts.append(title)

    # Type + location
    type_loc_parts: list[str] = []
    if listing.get("property_type"):
        type_loc_parts.append(listing["property_type"])
    if listing.get("city"):
        city_part = f"in {listing['city']}"
        location = listing.get("location", "").strip()
        if location and location.lower() != listing["city"].lower():
            city_part += f", {location}"
        type_loc_parts.append(city_part)
    if type_loc_parts:
        parts.append(" ".join(type_loc_parts))

    # Beds / baths / size
    bed_bath_parts: list[str] = []
    if listing.get("bedrooms") is not None:
        bed_bath_parts.append(f"{listing['bedrooms']} bed")
    if listing.get("bathrooms") is not None:
        bed_bath_parts.append(f"{listing['bathrooms']} bath")
    if listing.get("size_sqm") is not None:
        bed_bath_parts.append(f"{listing['size_sqm']} sqm")
    if bed_bath_parts:
        parts.append(", ".join(bed_bath_parts))

    # Price
    price = listing.get("price")
    if price is not None:
        parts.append(f"Price: {float(price):.0f} EGP")

    # Description (first 300 chars)
    desc = (listing.get("description") or "").strip()
    if desc:
        parts.append(desc[:300])

    # Amenities
    amenities = listing.get("amenities")
    if amenities:
        parts.append(f"Amenities: {', '.join(amenities)}")

    # Compound
    compound = (listing.get("compound_name") or "").strip()
    if compound:
        parts.append(f"Compound: {compound}")

    return ". ".join(parts)


def _build_embed_text(listing: dict) -> str:
    """Build a text string from listing fields for embedding."""
    parts = []

    if listing.get("title"):
        parts.append(listing["title"])
    if listing.get("description"):
        parts.append(listing["description"])
    if listing.get("location"):
        parts.append(f"Location: {listing['location']}")
    if listing.get("city"):
        parts.append(f"City: {listing['city']}")
    if listing.get("property_type"):
        parts.append(f"Type: {listing['property_type']}")
    if listing.get("category"):
        parts.append(f"Category: {listing['category']}")
    if listing.get("bedrooms") is not None:
        parts.append(f"{listing['bedrooms']} bedrooms")
    if listing.get("bathrooms") is not None:
        parts.append(f"{listing['bathrooms']} bathrooms")
    if listing.get("size_sqm") is not None:
        parts.append(f"{listing['size_sqm']} sqm")
    if listing.get("amenities"):
        parts.append(f"Amenities: {', '.join(listing['amenities'])}")

    return ". ".join(parts)
