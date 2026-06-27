"""
batch_embed.py — One-shot script to embed all existing content into knowledge_chunks.

Run from the project root:
    python backend/scripts/batch_embed.py

Handles three source types in sequence:
  1. listings  — all active, non-deleted listings not yet in knowledge_chunks
  2. neighborhoods — all rows in the neighborhoods table
  3. blog posts — all published blog posts

Uses asyncio.Semaphore(10) to cap concurrency at 10 simultaneous Ollama calls.
Prints progress and a summary at the end.
"""

import asyncio
import logging
import os
import sys

# Allow imports from backend/app
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.ai.embeddings import embed_listing_chunk  # noqa: E402  (after sys.path setup)
from app.ai.ollama_client import ollama  # noqa: E402
from app.database import supabase_admin  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
logger = logging.getLogger(__name__)

CONCURRENCY = 10


def _blog_content_to_text(content: object) -> str:
    """Flatten the blog editor's JSON block content into searchable text."""
    if isinstance(content, str):
        return content.strip()
    if not isinstance(content, list):
        return ""

    parts: list[str] = []
    for block in content:
        if not isinstance(block, dict):
            continue

        text = block.get("text")
        if isinstance(text, str) and text.strip():
            parts.append(text.strip())

        items = block.get("items")
        if isinstance(items, list):
            parts.extend(str(item).strip() for item in items if str(item).strip())

    return " ".join(parts).strip()


# ─── Listings ─────────────────────────────────────────────────────────────────


async def embed_all_listings() -> tuple[int, int]:
    """
    Embed all active listings not already in knowledge_chunks.

    Returns (done, failures).
    """
    # Fetch all active listing IDs
    try:
        listings_result = (
            supabase_admin.table("listings")
            .select("id")
            .eq("status", "active")
            .is_("deleted_at", "null")
            .execute()
        )
    except Exception as exc:
        logger.error("Failed to fetch active listings: %s", exc)
        return 0, 0

    all_ids = {row["id"] for row in (listings_result.data or [])}

    # Fetch listing IDs already in knowledge_chunks
    try:
        chunks_result = (
            supabase_admin.table("knowledge_chunks")
            .select("source_id")
            .eq("source_type", "listing")
            .execute()
        )
    except Exception as exc:
        logger.warning("Could not fetch existing listing chunks (will embed all): %s", exc)
        already_embedded: set[str] = set()
    else:
        already_embedded = {row["source_id"] for row in (chunks_result.data or [])}

    pending_ids = list(all_ids - already_embedded)
    total = len(pending_ids)

    if total == 0:
        logger.info("Listings: all %d already embedded, nothing to do.", len(all_ids))
        return 0, 0

    logger.info("Listings: %d to embed (%d already done).", total, len(already_embedded))

    semaphore = asyncio.Semaphore(CONCURRENCY)
    done = 0
    failures = 0

    async def _embed_one(listing_id: str) -> bool:
        async with semaphore:
            return await embed_listing_chunk(listing_id)

    tasks = [_embed_one(lid) for lid in pending_ids]
    for idx, coro in enumerate(asyncio.as_completed(tasks), start=1):
        success = await coro
        if success:
            done += 1
        else:
            failures += 1
        if idx % 10 == 0 or idx == total:
            logger.info("Listings: %d/%d", idx, total)

    return done, failures


# ─── Neighborhoods ────────────────────────────────────────────────────────────


async def embed_all_neighborhoods() -> tuple[int, int]:
    """
    Embed all neighborhoods into knowledge_chunks.

    Returns (done, failures).
    """
    try:
        result = (
            supabase_admin.table("neighborhoods")
            .select("id, name, name_ar, city, slug")
            .execute()
        )
    except Exception as exc:
        logger.error("Failed to fetch neighborhoods: %s", exc)
        return 0, 0

    rows = result.data or []
    total = len(rows)
    if total == 0:
        logger.info("Neighborhoods: table is empty, nothing to embed.")
        return 0, 0

    logger.info("Neighborhoods: %d to embed.", total)

    semaphore = asyncio.Semaphore(CONCURRENCY)
    done = 0
    failures = 0

    async def _embed_one(row: dict) -> bool:
        nbhd_id = str(row["id"])
        name = row.get("name", "")
        name_ar = row.get("name_ar") or ""
        city = row.get("city", "")

        name_ar_part = f" ({name_ar})" if name_ar else ""
        chunk_text = f"{name}{name_ar_part}. Neighborhood in {city}."

        async with semaphore:
            try:
                vector = await ollama.embed(chunk_text)
            except Exception as exc:
                logger.warning("Ollama embed failed for neighborhood %s: %s", nbhd_id, exc)
                return False

            if not vector:
                return False

            try:
                supabase_admin.table("knowledge_chunks").upsert(
                    {
                        "source_type": "neighborhood",
                        "source_id": nbhd_id,
                        "chunk_text": chunk_text,
                        "embedding": vector,
                        "metadata": {"city": city},
                        "updated_at": "now()",
                    },
                    on_conflict="source_type,source_id",
                ).execute()
                return True
            except Exception as exc:
                logger.warning("DB upsert failed for neighborhood %s: %s", nbhd_id, exc)
                return False

    tasks = [_embed_one(row) for row in rows]
    for idx, coro in enumerate(asyncio.as_completed(tasks), start=1):
        success = await coro
        if success:
            done += 1
        else:
            failures += 1
        if idx % 10 == 0 or idx == total:
            logger.info("Neighborhoods: %d/%d", idx, total)

    return done, failures


# ─── Blog Posts ───────────────────────────────────────────────────────────────


async def embed_all_blog() -> tuple[int, int]:
    """
    Embed all published blog posts into knowledge_chunks.

    Returns (done, failures).
    """
    try:
        # Try the current blog schema first; fall back for older schemas.
        try:
            result = (
                supabase_admin.table("blog_posts")
                .select("id, title, lead, content")
                .eq("is_published", True)
                .execute()
            )
        except Exception:
            result = (
                supabase_admin.table("blog_posts")
                .select("id, title, excerpt, content")
                .execute()
            )
    except Exception as exc:
        logger.error("Failed to fetch blog posts: %s", exc)
        return 0, 0

    rows = result.data or []
    total = len(rows)
    if total == 0:
        logger.info("Blog posts: none found, nothing to embed.")
        return 0, 0

    logger.info("Blog posts: %d to embed.", total)

    semaphore = asyncio.Semaphore(CONCURRENCY)
    done = 0
    failures = 0

    async def _embed_one(row: dict) -> bool:
        post_id = str(row["id"])
        title = row.get("title", "")
        excerpt = (row.get("excerpt") or row.get("lead") or "").strip()
        content = _blog_content_to_text(row.get("content"))

        chunk_text = f"{title}. {excerpt}. {content[:500]}".strip()
        # Collapse extra dots/spaces from missing fields
        while ".." in chunk_text:
            chunk_text = chunk_text.replace("..", ".")
        chunk_text = chunk_text.strip(". ").strip()

        if not chunk_text:
            return False

        async with semaphore:
            try:
                vector = await ollama.embed(chunk_text)
            except Exception as exc:
                logger.warning("Ollama embed failed for blog post %s: %s", post_id, exc)
                return False

            if not vector:
                return False

            try:
                supabase_admin.table("knowledge_chunks").upsert(
                    {
                        "source_type": "blog",
                        "source_id": post_id,
                        "chunk_text": chunk_text,
                        "embedding": vector,
                        "metadata": {"title": title},
                        "updated_at": "now()",
                    },
                    on_conflict="source_type,source_id",
                ).execute()
                return True
            except Exception as exc:
                logger.warning("DB upsert failed for blog post %s: %s", post_id, exc)
                return False

    tasks = [_embed_one(row) for row in rows]
    for idx, coro in enumerate(asyncio.as_completed(tasks), start=1):
        success = await coro
        if success:
            done += 1
        else:
            failures += 1
        if idx % 10 == 0 or idx == total:
            logger.info("Blog posts: %d/%d", idx, total)

    return done, failures


# ─── Main ─────────────────────────────────────────────────────────────────────


async def main() -> None:
    logger.info("=== AXIOM batch_embed.py starting ===")

    # Sanity check: Ollama reachable?
    if not await ollama.health():
        logger.error(
            "Ollama is not reachable at %s — aborting. Start Ollama and retry.",
            ollama.base_url,
        )
        sys.exit(1)

    logger.info("Ollama reachable. Embed model: %s", ollama.embed_model)
    logger.info("")

    listing_done, listing_fail = await embed_all_listings()
    logger.info("")

    nbhd_done, nbhd_fail = await embed_all_neighborhoods()
    logger.info("")

    blog_done, blog_fail = await embed_all_blog()
    logger.info("")

    logger.info("=== Summary ===")
    logger.info("  Listings:      %d embedded,  %d failed", listing_done, listing_fail)
    logger.info("  Neighborhoods: %d embedded,  %d failed", nbhd_done, nbhd_fail)
    logger.info("  Blog posts:    %d embedded,  %d failed", blog_done, blog_fail)
    logger.info("=== Done ===")


if __name__ == "__main__":
    asyncio.run(main())
