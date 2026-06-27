from fastapi import APIRouter, HTTPException, Query
from app.database import supabase_admin

router = APIRouter()


def _build_post_brief(p: dict) -> dict:
    """Build a BlogPostBrief matching the frontend type."""
    author = p.get("profiles") or {}
    return {
        "id": p["id"],
        "slug": p["slug"],
        "title": p["title"],
        "subtitle": p.get("lead"),
        "image_url": p.get("image_url"),
        "published_at": p.get("published_at"),
        "category": p.get("category"),
        "read_time": p.get("read_time"),
        "author_name": author.get("full_name"),
        "author_avatar": author.get("avatar_url"),
    }


@router.get("")
async def list_blog_posts(
    page: int = Query(1, ge=1),
    per_page: int = Query(12, ge=1, le=50),
):
    """Return paginated published blog posts, newest first."""
    offset = (page - 1) * per_page

    try:
        result = (
            supabase_admin.table("blog_posts")
            .select(
                "id, slug, title, lead, image_url, published_at, tags, category, read_time, author_id, profiles(full_name, avatar_url)",
                count="exact",
            )
            .eq("is_published", True)
            .order("published_at", desc=True)
            .range(offset, offset + per_page - 1)
            .execute()
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {e}")

    posts = [_build_post_brief(p) for p in (result.data or [])]

    return {
        "posts": posts,
        "total": result.count or 0,
        "page": page,
        "per_page": per_page,
    }


# ── Related posts (MUST come before /{slug} to avoid route conflict) ─────────

@router.get("/{slug}/related")
async def get_related_posts(slug: str):
    """Return up to 3 related blog posts (same category, excluding current)."""
    try:
        current = (
            supabase_admin.table("blog_posts")
            .select("id, category")
            .eq("slug", slug)
            .single()
            .execute()
        )
    except Exception:
        raise HTTPException(status_code=404, detail="Blog post not found")

    if not current.data:
        raise HTTPException(status_code=404, detail="Blog post not found")

    category = current.data.get("category")
    post_id = current.data["id"]

    query = (
        supabase_admin.table("blog_posts")
        .select(
            "id, slug, title, lead, image_url, published_at, category, read_time, author_id, profiles(full_name, avatar_url)"
        )
        .eq("is_published", True)
        .neq("id", post_id)
    )
    if category:
        query = query.eq("category", category)

    try:
        result = query.order("published_at", desc=True).limit(3).execute()
    except Exception:
        return []

    return [_build_post_brief(p) for p in (result.data or [])]


# ── Detail ────────────────────────────────────────────────────────────────────

@router.get("/{slug}")
async def get_blog_post(slug: str):
    """Return a single published blog post by slug."""
    try:
        result = (
            supabase_admin.table("blog_posts")
            .select("*, profiles(full_name, avatar_url, role)")
            .eq("slug", slug)
            .eq("is_published", True)
            .single()
            .execute()
        )
    except Exception:
        raise HTTPException(status_code=404, detail="Blog post not found")

    if not result.data:
        raise HTTPException(status_code=404, detail="Blog post not found")

    p = result.data
    author = p.get("profiles") or {}

    return {
        "id": p["id"],
        "slug": p["slug"],
        "title": p["title"],
        "subtitle": p.get("lead"),
        "image_url": p.get("image_url"),
        "lead": p.get("lead"),
        "content": p.get("content") or [],
        "tags": p.get("tags") or [],
        "category": p.get("category"),
        "read_time": p.get("read_time"),
        "published_at": p.get("published_at"),
        "created_at": p.get("created_at", ""),
        "author_name": author.get("full_name"),
        "author_avatar": author.get("avatar_url"),
        "author_role": author.get("role"),
    }
