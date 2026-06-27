import logging

from fastapi import APIRouter, HTTPException, Depends, Query
from app.agencies.schemas import CreateAgencyRequest, UpdateAgencyRequest, SubscribeRequest
from app.database import supabase_admin
from app.dependencies import get_current_user

router = APIRouter()
logger = logging.getLogger(__name__)

# Subscription plan pricing (EGP/month) and listing quotas
PLAN_CONFIG = {
    "starter": {"price": 500, "quota": 10},
    "pro": {"price": 1200, "quota": 50},
    "enterprise": {"price": 2500, "quota": 9999},
}


def _count_projects(agency_id: str) -> int:
    """Count projects for an agency."""
    try:
        r = (
            supabase_admin.table("projects")
            .select("id", count="exact")
            .eq("agency_id", agency_id)
            .execute()
        )
        return r.count or 0
    except Exception:
        return 0


def _build_agency_brief(row: dict, projects_count: int = 0) -> dict:
    return {
        "id": row["id"],
        "slug": row["slug"],
        "name": row["name"],
        "subtitle": (row.get("description") or "")[:100] or None,
        "logo_url": row.get("logo_url"),
        "verified": bool(row.get("verified", False)),
        "active_projects": projects_count,
        "listings_count": row.get("listings_count", 0),
    }


@router.get("")
async def list_agencies(
    page: int = Query(1, ge=1),
    per_page: int = Query(12, ge=1, le=100),
    city: str | None = Query(None),
):
    """Return paginated list of agencies."""
    offset = (page - 1) * per_page
    query = supabase_admin.table("agencies").select("*", count="exact")

    if city:
        city_safe = city.replace("%", "").replace("_", "")[:100]
        query = query.ilike("city", f"%{city_safe}%")

    query = query.order("created_at", desc=True).range(offset, offset + per_page - 1)

    try:
        result = query.execute()
    except Exception as e:
        logger.error("agencies DB error: %s", e)
        raise HTTPException(status_code=500, detail="Internal server error")

    agencies = result.data or []

    enriched = []
    for agency in agencies:
        agency_id = agency["id"]
        try:
            count_result = (
                supabase_admin.table("listings")
                .select("id", count="exact")
                .eq("agency_id", agency_id)
                .eq("status", "active")
                .is_("deleted_at", "null")
                .execute()
            )
            listings_count = count_result.count or 0
        except Exception:
            listings_count = 0

        projects_count = _count_projects(agency_id)

        agency_data = dict(agency)
        agency_data["listings_count"] = listings_count
        enriched.append(_build_agency_brief(agency_data, projects_count))

    return {
        "agencies": enriched,
        "total": result.count or 0,
        "page": page,
        "per_page": per_page,
    }


# ── Sub-endpoints (MUST come before /{slug} to avoid route conflicts) ────────

@router.get("/{slug}/projects")
async def get_agency_projects(slug: str):
    """Return projects for an agency."""
    try:
        agency_result = (
            supabase_admin.table("agencies")
            .select("id")
            .eq("slug", slug)
            .single()
            .execute()
        )
    except Exception:
        raise HTTPException(status_code=404, detail="Agency not found")

    if not agency_result.data:
        raise HTTPException(status_code=404, detail="Agency not found")

    agency_id = agency_result.data["id"]

    try:
        result = (
            supabase_admin.table("projects")
            .select("*")
            .eq("agency_id", agency_id)
            .order("created_at", desc=True)
            .execute()
        )
    except Exception as e:
        logger.error("agencies DB error: %s", e)
        raise HTTPException(status_code=500, detail="Internal server error")

    projects = [
        {
            "id": p["id"],
            "agency_id": p["agency_id"],
            "title": p["title"],
            "subtitle": (p.get("description") or "")[:100] or None,
            "image_url": p.get("image_url"),
            "completion_pct": p.get("completion_pct", 0),
            "starting_price": float(p["starting_price"]) if p.get("starting_price") is not None else None,
            "status": p.get("status", "planned"),
        }
        for p in (result.data or [])
    ]

    return {"projects": projects}


@router.get("/{slug}/listings")
async def get_agency_listings(
    slug: str,
    page: int = Query(1, ge=1),
    per_page: int = Query(10, ge=1, le=50),
):
    """Return paginated listings for an agency."""
    try:
        agency_result = (
            supabase_admin.table("agencies")
            .select("id")
            .eq("slug", slug)
            .single()
            .execute()
        )
    except Exception:
        raise HTTPException(status_code=404, detail="Agency not found")

    if not agency_result.data:
        raise HTTPException(status_code=404, detail="Agency not found")

    agency_id = agency_result.data["id"]
    offset = (page - 1) * per_page

    from app.listings.router import _build_listing_brief

    try:
        result = (
            supabase_admin.table("listings")
            .select("*, neighborhoods(name)", count="exact")
            .eq("agency_id", agency_id)
            .eq("status", "active")
            .is_("deleted_at", "null")
            .order("created_at", desc=True)
            .range(offset, offset + per_page - 1)
            .execute()
        )
    except Exception as e:
        logger.error("agencies DB error: %s", e)
        raise HTTPException(status_code=500, detail="Internal server error")

    return {
        "listings": [_build_listing_brief(l) for l in (result.data or [])],
        "total": result.count or 0,
        "page": page,
        "per_page": per_page,
    }


# ── Current user's agency ──────────────────────────────────────────────────────

@router.get("/mine")
async def get_my_agency(current_user: dict = Depends(get_current_user)):
    """Return the agency the current user owns (if any) plus its projects.

    Used by the add-listing modal so an agency owner can attach a new listing
    to one of their agency's projects. Agencies and projects themselves are
    admin-created — this endpoint only reads them. Declared before /{slug} so
    'mine' is never matched as a slug.
    """
    try:
        agency_res = (
            supabase_admin.table("agencies")
            .select("id, name, slug")
            .eq("owner_id", current_user["id"])
            .limit(1)
            .execute()
        )
    except Exception:
        return {"agency": None, "projects": []}

    if not agency_res.data:
        return {"agency": None, "projects": []}

    agency = agency_res.data[0]
    try:
        proj_res = (
            supabase_admin.table("projects")
            .select("id, title")
            .eq("agency_id", agency["id"])
            .order("title")
            .execute()
        )
        projects = proj_res.data or []
    except Exception:
        projects = []

    return {"agency": agency, "projects": projects}


# ── Detail ────────────────────────────────────────────────────────────────────

@router.get("/{slug}")
async def get_agency(slug: str):
    """Return agency detail with their active listings."""
    try:
        result = (
            supabase_admin.table("agencies")
            .select("*")
            .eq("slug", slug)
            .single()
            .execute()
        )
    except Exception:
        raise HTTPException(status_code=404, detail="Agency not found")

    if not result.data:
        raise HTTPException(status_code=404, detail="Agency not found")

    agency = result.data

    # Fetch active listings for this agency
    try:
        listings_result = (
            supabase_admin.table("listings")
            .select("*, neighborhoods(name)")
            .eq("agency_id", agency["id"])
            .eq("status", "active")
            .is_("deleted_at", "null")
            .order("created_at", desc=True)
            .limit(20)
            .execute()
        )
        agency_listings = listings_result.data or []
    except Exception:
        agency_listings = []

    from app.listings.router import _build_listing_brief
    listings_count = len(agency_listings)
    listings_brief = [_build_listing_brief(l) for l in agency_listings]

    projects_count = _count_projects(agency["id"])

    return {
        "id": agency["id"],
        "slug": agency["slug"],
        "name": agency["name"],
        "subtitle": (agency.get("description") or "")[:100] or None,
        "logo_url": agency.get("logo_url"),
        "verified": bool(agency.get("verified", False)),
        "active_projects": projects_count,
        "listings_count": listings_count,
        "description": agency.get("description"),
        "banner_url": agency.get("banner_url"),
        "trust_score": 85,
        "followers_count": 0,
        "created_at": agency.get("created_at"),
        "listings": listings_brief,
    }


@router.post("", status_code=201)
async def create_agency(
    body: CreateAgencyRequest,
    current_user: dict = Depends(get_current_user),
):
    """Create a new agency. One per user — enforced here."""
    user_id = current_user["id"]

    try:
        existing = (
            supabase_admin.table("agencies")
            .select("id")
            .eq("owner_id", user_id)
            .limit(1)
            .execute()
        )
        if existing.data:
            raise HTTPException(status_code=409, detail="You already have an agency")
    except HTTPException:
        raise
    except Exception:
        pass

    agency_data = body.model_dump(exclude_none=True)
    agency_data["owner_id"] = user_id
    agency_data.setdefault("subscription_plan", "none")
    agency_data.setdefault("listing_quota", 0)

    try:
        result = (
            supabase_admin.table("agencies")
            .insert(agency_data)
            .select("*")
            .single()
            .execute()
        )
    except Exception as e:
        error_str = str(e)
        if "duplicate" in error_str.lower() or "unique" in error_str.lower():
            raise HTTPException(status_code=409, detail="Agency slug already taken")
        logger.error("create_agency failed: %s", e)
        raise HTTPException(status_code=500, detail="Failed to create agency")

    return result.data


@router.put("/{agency_id}")
async def update_agency(
    agency_id: str,
    body: UpdateAgencyRequest,
    current_user: dict = Depends(get_current_user),
):
    """Update agency info. Owner only."""
    user_id = current_user["id"]

    try:
        check = (
            supabase_admin.table("agencies")
            .select("owner_id")
            .eq("id", agency_id)
            .single()
            .execute()
        )
    except Exception:
        raise HTTPException(status_code=404, detail="Agency not found")

    if not check.data:
        raise HTTPException(status_code=404, detail="Agency not found")
    if check.data["owner_id"] != user_id:
        raise HTTPException(status_code=403, detail="Not the agency owner")

    update_data = body.model_dump(exclude_none=True)
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    try:
        result = (
            supabase_admin.table("agencies")
            .update(update_data)
            .eq("id", agency_id)
            .execute()
        )
    except Exception as e:
        logger.error("update_agency failed: %s", e)
        raise HTTPException(status_code=500, detail="Failed to update agency")

    return result.data[0] if result.data else {}


@router.post("/{agency_id}/subscribe")
async def subscribe_agency(
    agency_id: str,
    body: SubscribeRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    Subscribe or renew an agency subscription plan.
    In a full implementation this would initiate a payment flow.
    For now it returns stub payment data.
    """
    user_id = current_user["id"]

    if body.plan not in PLAN_CONFIG:
        raise HTTPException(status_code=400, detail=f"Invalid plan: {body.plan}")

    try:
        check = (
            supabase_admin.table("agencies")
            .select("owner_id")
            .eq("id", agency_id)
            .single()
            .execute()
        )
    except Exception:
        raise HTTPException(status_code=404, detail="Agency not found")

    if not check.data:
        raise HTTPException(status_code=404, detail="Agency not found")
    if check.data["owner_id"] != user_id:
        raise HTTPException(status_code=403, detail="Not the agency owner")

    plan_info = PLAN_CONFIG[body.plan]

    return {
        "message": "Subscription initiated",
        "plan": body.plan,
        "amount": plan_info["price"],
        "currency": "EGP",
        "payment_method": body.payment_method,
        "status": "pending_payment",
    }
