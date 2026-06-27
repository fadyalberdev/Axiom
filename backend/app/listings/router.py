import logging
from datetime import datetime, timezone
from fastapi import APIRouter, BackgroundTasks, HTTPException, Depends, Query
from app.listings.schemas import (
    CreateListingRequest,
    UpdateListingRequest,
    ListingBriefResponse,
    ListingDetailResponse,
    ListingsPageResponse,
)
from app.database import supabase_admin
from app.dependencies import get_current_user, get_optional_user
from app.ai.embeddings import embed_listing, embed_listing_chunk, delete_listing_chunk
from app.ai.fraud import score_listing
from app.subscriptions import plans, service

router = APIRouter()
logger = logging.getLogger(__name__)


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _owner_agency_id(owner_id: str) -> str | None:
    """Return the agency this user owns, if any. Users own at most one agency
    (enforced at agency creation), so a listing's agency is implied by its owner.
    """
    try:
        r = (
            supabase_admin.table("agencies")
            .select("id")
            .eq("owner_id", owner_id)
            .limit(1)
            .execute()
        )
        return r.data[0]["id"] if r.data else None
    except Exception:
        return None


def _project_belongs_to_agency(project_id: str, agency_id: str | None) -> bool:
    """True only when the project exists AND belongs to the given agency.
    Prevents a user from attaching a listing to another agency's project.
    """
    if not agency_id:
        return False
    try:
        r = (
            supabase_admin.table("projects")
            .select("id")
            .eq("id", project_id)
            .eq("agency_id", agency_id)
            .limit(1)
            .execute()
        )
        return bool(r.data)
    except Exception:
        return False



def _build_listing_brief(row: dict) -> dict:
    """
    Convert a raw DB row (with optional neighborhoods join) into ListingBrief shape.
    """
    neighborhood_name: str | None = None
    nbhd = row.get("neighborhoods")
    if isinstance(nbhd, dict):
        neighborhood_name = nbhd.get("name")
    elif isinstance(nbhd, str):
        neighborhood_name = nbhd

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
        "room_type": row.get("room_type"),
        "lifestyle_preferences": row.get("lifestyle_preferences"),
        "total_spots": row.get("total_spots"),
        "filled_spots": row.get("filled_spots"),
        "utilities_included": row.get("utilities_included"),
        "available_date": row.get("available_date"),
        "views_count": row.get("views_count", 0),
        "created_at": row.get("created_at", ""),
    }


def _apply_sort(query, sort_by: str):
    """Apply sort order to a Supabase query builder."""
    if sort_by == "price_asc":
        return query.order("price", desc=False)
    elif sort_by == "price_desc":
        return query.order("price", desc=True)
    elif sort_by == "most_viewed":
        return query.order("views_count", desc=True)
    else:  # newest (default)
        return query.order("created_at", desc=True)


# ─── GET /api/listings ───────────────────────────────────────────────────────

@router.get("", response_model=ListingsPageResponse)
async def list_listings(
    category: str | None = Query(None),
    city: str | None = Query(None),
    neighborhood_id: str | None = Query(None),
    neighborhood: str | None = Query(None),
    min_price: float | None = Query(None),
    max_price: float | None = Query(None),
    min_size_sqm: float | None = Query(None),
    max_size_sqm: float | None = Query(None),
    min_bedrooms: int | None = Query(None),
    max_bedrooms: int | None = Query(None),
    min_bathrooms: int | None = Query(None),
    property_type: str | None = Query(None),
    lease_type: str | None = Query(None),
    title_deed_status: str | None = Query(None),
    room_type: str | None = Query(None),
    gender_preference: str | None = Query(None),
    utilities_included: bool | None = Query(None),
    has_spots: bool | None = Query(None),
    available_before: str | None = Query(None),
    compound_name: str | None = Query(None),
    floor_min: int | None = Query(None),
    floor_max: int | None = Query(None),
    agency_id: str | None = Query(None),
    project_id: str | None = Query(None),
    sort_by: str = Query("newest"),
    page: int = Query(1, ge=1),
    per_page: int = Query(12, ge=1, le=100),
):
    """
    Paginated listing search. Only returns status='active' and not soft-deleted.
    """
    offset = (page - 1) * per_page

    # Build the query — joins neighborhoods for the name field
    query = (
        supabase_admin.table("listings")
        .select("*, neighborhoods(name)", count="exact")
        .eq("status", "active")
        .is_("deleted_at", "null")
    )

    # Apply filters
    if category:
        query = query.eq("category", category)
    if city:
        # Strip LIKE metacharacters to prevent regex-like catastrophic backtrack on full-table scan
        city_safe = city.replace("%", "").replace("_", "")[:100]
        query = query.ilike("city", f"%{city_safe}%")
    if neighborhood_id:
        query = query.eq("neighborhood_id", neighborhood_id)
    if neighborhood:
        # Filter by neighborhood slug — join to neighborhoods table
        try:
            nbhd_result = (
                supabase_admin.table("neighborhoods")
                .select("id")
                .eq("slug", neighborhood)
                .single()
                .execute()
            )
            if nbhd_result.data:
                query = query.eq("neighborhood_id", nbhd_result.data["id"])
        except Exception:
            pass
    if min_price is not None:
        query = query.gte("price", min_price)
    if max_price is not None:
        query = query.lte("price", max_price)
    if min_size_sqm is not None:
        query = query.gte("size_sqm", min_size_sqm)
    if max_size_sqm is not None:
        query = query.lte("size_sqm", max_size_sqm)
    if min_bedrooms is not None:
        query = query.gte("bedrooms", min_bedrooms)
    if max_bedrooms is not None:
        query = query.lte("bedrooms", max_bedrooms)
    if min_bathrooms is not None:
        query = query.gte("bathrooms", min_bathrooms)
    if property_type:
        query = query.eq("property_type", property_type)
    if lease_type:
        query = query.eq("lease_type", lease_type)
    if title_deed_status:
        query = query.eq("title_deed_status", title_deed_status)
    if room_type:
        query = query.eq("room_type", room_type)
    if category == "shared_housing":
        if gender_preference:
            query = query.contains("lifestyle_preferences", {"gender_preference": gender_preference})
        if utilities_included is not None:
            query = query.eq("utilities_included", utilities_included)
        if available_before:
            query = query.lte("available_date", available_before)
    if compound_name:
        compound_name_safe = compound_name.replace("%", "").replace("_", "")[:100]
        query = query.ilike("compound_name", f"%{compound_name_safe}%")
    if floor_min is not None:
        query = query.gte("floor_number", floor_min)
    if floor_max is not None:
        query = query.lte("floor_number", floor_max)
    if agency_id:
        query = query.eq("agency_id", agency_id)
    if project_id:
        query = query.eq("project_id", project_id)

    # Sort and paginate
    query = _apply_sort(query, sort_by)
    query = query.range(offset, offset + per_page - 1)

    try:
        result = query.execute()
    except Exception as e:
        logger.error("listings DB error: %s", e)
        raise HTTPException(status_code=500, detail="Internal server error")

    rows = result.data or []
    if category == "shared_housing" and has_spots:
        rows = [
            row for row in rows
            if row.get("total_spots") is None
            or (row.get("filled_spots") or 0) < row.get("total_spots")
        ]

    listings = [_build_listing_brief(row) for row in rows]
    total = len(rows) if category == "shared_housing" and has_spots else (result.count or 0)

    return {"listings": listings, "total": total, "page": page, "per_page": per_page}


# ─── GET /api/listings/favorites ─────────────────────────────────────────────

@router.get("/favorites", response_model=list[ListingBriefResponse])
async def get_favorites(current_user: dict = Depends(get_current_user)):
    """Return all listings favorited by the current user."""
    user_id = current_user["id"]
    try:
        result = (
            supabase_admin.table("favorites")
            .select("listing_id, listings(*, neighborhoods(name))")
            .eq("user_id", user_id)
            .execute()
        )
    except Exception as e:
        logger.error("listings DB error: %s", e)
        raise HTTPException(status_code=500, detail="Internal server error")

    listings = []
    for row in result.data or []:
        listing_data = row.get("listings")
        if listing_data and listing_data.get("deleted_at") is None:
            listings.append(_build_listing_brief(listing_data))

    return listings


# ─── GET /api/listings/{id} ──────────────────────────────────────────────────

@router.get("/{listing_id}", response_model=ListingDetailResponse)
async def get_listing(
    listing_id: str,
    current_user: dict | None = Depends(get_optional_user),
):
    """
    Return full listing detail plus similar listings.
    Also increments view count.
    """
    try:
        result = (
            supabase_admin.table("listings")
            .select("*, neighborhoods(name)")
            .eq("id", listing_id)
            .is_("deleted_at", "null")
            .single()
            .execute()
        )
    except Exception:
        raise HTTPException(status_code=404, detail="Listing not found")

    if not result.data:
        raise HTTPException(status_code=404, detail="Listing not found")

    listing = result.data

    # Only public users see active listings; owners can always see their own
    if listing.get("status") != "active":
        if not current_user or current_user["id"] != listing.get("owner_id"):
            if not current_user or current_user.get("role") != "admin":
                raise HTTPException(status_code=404, detail="Listing not found")

    # Increment views async-style (best-effort)
    try:
        supabase_admin.rpc("increment_listing_views", {"p_listing_id": listing_id}).execute()
    except Exception:
        pass

    # ── Resolve WhatsApp contact info ─────────────────────────────────────────
    contact_phone: str | None = None
    contact_name: str | None = None
    agency_id = listing.get("agency_id")

    if agency_id:
        try:
            ag = (
                supabase_admin.table("agencies")
                .select("name, phone")
                .eq("id", agency_id)
                .single()
                .execute()
            )
            if ag.data and isinstance(ag.data.get("phone"), str):
                contact_phone = ag.data["phone"].lstrip("+")
                contact_name = ag.data.get("name") if isinstance(ag.data.get("name"), str) else None
        except Exception:
            pass
    else:
        owner_id = listing.get("owner_id")
        if owner_id:
            try:
                ow = (
                    supabase_admin.table("profiles")
                    .select("full_name, phone")
                    .eq("id", owner_id)
                    .single()
                    .execute()
                )
                if ow.data and isinstance(ow.data.get("phone"), str):
                    contact_phone = ow.data["phone"].lstrip("+")
                    contact_name = ow.data.get("full_name") if isinstance(ow.data.get("full_name"), str) else None
            except Exception:
                pass

    # Fetch similar listings (same category + city, limit 6, exclude self)
    similar: list[dict] = []
    try:
        sim_result = (
            supabase_admin.table("listings")
            .select("*, neighborhoods(name)")
            .eq("category", listing["category"])
            .ilike("city", listing.get("city", ""))
            .eq("status", "active")
            .is_("deleted_at", "null")
            .neq("id", listing_id)
            .limit(6)
            .execute()
        )
        similar = [_build_listing_brief(r) for r in (sim_result.data or [])]
    except Exception:
        pass

    # Build the neighborhood name
    nbhd = listing.get("neighborhoods")
    neighborhood_name = nbhd.get("name") if isinstance(nbhd, dict) else None

    return {
        "id": listing["id"],
        "owner_id": listing["owner_id"],
        "agency_id": listing.get("agency_id"),
        "title": listing["title"],
        "location": listing["location"],
        "full_address": listing.get("full_address"),
        "price": float(listing["price"]),
        "currency": listing.get("currency", "EGP"),
        "price_period": listing.get("price_period"),
        "category": listing["category"],
        "property_type": listing["property_type"],
        "status": listing["status"],
        "verified": bool(listing.get("verified", False)),
        "is_new": bool(listing.get("is_new", True)),
        "images": listing.get("images") or [],
        "description": listing.get("description"),
        "bedrooms": listing.get("bedrooms"),
        "bathrooms": listing.get("bathrooms"),
        "size_sqm": float(listing["size_sqm"]) if listing.get("size_sqm") is not None else None,
        "floor_number": listing.get("floor_number"),
        "total_floors": listing.get("total_floors"),
        "neighborhood": neighborhood_name,
        "neighborhood_id": listing.get("neighborhood_id"),
        "compound_name": listing.get("compound_name"),
        "amenities": listing.get("amenities") or [],
        "latitude": float(listing["latitude"]) if listing.get("latitude") is not None else None,
        "longitude": float(listing["longitude"]) if listing.get("longitude") is not None else None,
        "views_count": listing.get("views_count", 0),
        "similar_listings": similar,
        # Rental
        "lease_type": listing.get("lease_type"),
        "min_stay_months": listing.get("min_stay_months"),
        "available_date": listing.get("available_date"),
        # Sale
        "payment_plan": listing.get("payment_plan"),
        "delivery_date": listing.get("delivery_date"),
        "title_deed_status": listing.get("title_deed_status"),
        # Shared housing
        "room_type": listing.get("room_type"),
        "lifestyle_preferences": listing.get("lifestyle_preferences"),
        "total_spots": listing.get("total_spots"),
        "filled_spots": listing.get("filled_spots"),
        "availability": listing.get("availability"),
        "furnishing": listing.get("furnishing"),
        "utilities_included": listing.get("utilities_included"),
        "bathroom_type": listing.get("bathroom_type"),
        "private_amenities": listing.get("private_amenities") or [],
        "shared_amenities": listing.get("shared_amenities") or [],
        "created_at": listing.get("created_at", ""),
        "contact_phone": contact_phone,
        "contact_name": contact_name,
    }


# ─── POST /api/listings ──────────────────────────────────────────────────────

def _enforce_listing_quota(active_count: int, sub: dict | None) -> None:
    cap = plans.listing_cap(sub)
    if active_count >= cap:
        raise HTTPException(
            status_code=402,
            detail=f"Listing limit reached for your plan ({cap}). Upgrade to add more listings.",
        )


@router.post("", status_code=201)
async def create_listing(
    body: CreateListingRequest,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user),
):
    """Create a new listing. Status is set to 'pending' awaiting admin approval."""
    sub = service.get_or_create(current_user["id"])
    active_count = service.count_active_listings(current_user["id"])
    _enforce_listing_quota(active_count, sub)
    listing_data = body.model_dump(exclude_none=True)
    listing_data["owner_id"] = current_user["id"]
    listing_data["status"] = "pending"
    listing_data["is_new"] = True
    listing_data["verified"] = False
    listing_data["views_count"] = 0

    # Associate with the owner's agency, derived server-side so it can't be
    # spoofed. This is what populates agency_id for every new listing.
    agency_id = _owner_agency_id(current_user["id"])
    if agency_id:
        listing_data["agency_id"] = agency_id
    else:
        listing_data.pop("agency_id", None)
    # Keep project_id only when it belongs to the owner's own agency.
    project_id = listing_data.get("project_id")
    if project_id and not _project_belongs_to_agency(project_id, agency_id):
        listing_data.pop("project_id", None)

    try:
        result = (
            supabase_admin.table("listings")
            .insert(listing_data)
            .execute()
        )
    except Exception as e:
        logger.error("create_listing failed: %s", e)
        raise HTTPException(status_code=500, detail="Failed to create listing")

    listing_id = result.data[0]["id"]

    # Run fraud scoring + embedding generation in the background
    background_tasks.add_task(_score_and_approve, listing_id, listing_data)
    background_tasks.add_task(embed_listing, listing_id)
    background_tasks.add_task(embed_listing_chunk, listing_id)

    return {"id": listing_id, "status": "pending"}


async def _score_and_approve(listing_id: str, listing_data: dict):
    """Run fraud scoring; auto-approve if score < 0.4."""
    try:
        fraud_score = await score_listing(listing_data)
        if fraud_score < 0.4:
            supabase_admin.table("listings").update(
                {"status": "active", "fraud_score": fraud_score}
            ).eq("id", listing_id).execute()
        else:
            # Store the score but keep pending for manual review
            supabase_admin.table("listings").update(
                {"fraud_score": fraud_score}
            ).eq("id", listing_id).execute()
    except Exception:
        pass  # Best-effort — listing stays pending


# ─── PUT /api/listings/{id} ──────────────────────────────────────────────────

@router.put("/{listing_id}")
async def update_listing(
    listing_id: str,
    body: UpdateListingRequest,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user),
):
    """Update a listing. Only the owner can update."""
    # Verify ownership
    try:
        check = (
            supabase_admin.table("listings")
            .select("owner_id")
            .eq("id", listing_id)
            .is_("deleted_at", "null")
            .single()
            .execute()
        )
    except Exception:
        raise HTTPException(status_code=404, detail="Listing not found")

    if not check.data:
        raise HTTPException(status_code=404, detail="Listing not found")
    if check.data["owner_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Not the listing owner")

    update_data = body.model_dump(exclude_none=True)
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    # A listing may only be tied to a project owned by the owner's own agency.
    if "project_id" in update_data:
        agency_id = _owner_agency_id(check.data["owner_id"])
        if not _project_belongs_to_agency(update_data["project_id"], agency_id):
            update_data.pop("project_id", None)

    try:
        result = (
            supabase_admin.table("listings")
            .update(update_data)
            .eq("id", listing_id)
            .execute()
        )
    except Exception as e:
        logger.error("update_listing failed: %s", e)
        raise HTTPException(status_code=500, detail="Failed to update listing")

    # Re-embed the listing chunk so RAG reflects the latest content
    background_tasks.add_task(embed_listing_chunk, listing_id)

    return result.data[0] if result.data else {}


# ─── DELETE /api/listings/{id} ───────────────────────────────────────────────

@router.delete("/{listing_id}", status_code=204)
async def delete_listing(
    listing_id: str,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user),
):
    """Soft-delete a listing (owner only). Sets deleted_at = now()."""
    try:
        check = (
            supabase_admin.table("listings")
            .select("owner_id")
            .eq("id", listing_id)
            .is_("deleted_at", "null")
            .single()
            .execute()
        )
    except Exception:
        raise HTTPException(status_code=404, detail="Listing not found")

    if not check.data:
        raise HTTPException(status_code=404, detail="Listing not found")
    if check.data["owner_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Not the listing owner")

    now = datetime.now(timezone.utc).isoformat()
    try:
        supabase_admin.table("listings").update({"deleted_at": now}).eq("id", listing_id).execute()
    except Exception as e:
        logger.error("delete_listing failed: %s", e)
        raise HTTPException(status_code=500, detail="Failed to delete listing")

    # Remove from knowledge_chunks so it no longer surfaces in RAG results
    background_tasks.add_task(delete_listing_chunk, listing_id)


# ─── POST /api/listings/{id}/favorite ────────────────────────────────────────

@router.post("/{listing_id}/view", status_code=204)
async def record_listing_view(
    listing_id: str,
    current_user: dict | None = Depends(get_optional_user),
):
    """Record a view for a listing (best-effort, public).

    The property page loads listings directly from Supabase, so it can't rely
    on GET /api/listings/{id} to bump the counter. The frontend ViewTracker
    pings this endpoint instead. Increments listings.views_count via the
    increment_listing_views RPC; failures are swallowed so a tracking error
    never breaks the page.

    Owners viewing their own listing are not counted. Per-session de-duplication
    (one view per listing per browser session) is handled by the client.
    """
    try:
        owner = (
            supabase_admin.table("listings")
            .select("owner_id")
            .eq("id", listing_id)
            .single()
            .execute()
        )
    except Exception as e:
        logger.warning("record_listing_view lookup failed for %s: %s", listing_id, e)
        return None

    if not owner.data:
        return None

    # Don't count the owner viewing their own listing.
    if current_user and current_user.get("id") == owner.data.get("owner_id"):
        return None

    try:
        supabase_admin.rpc(
            "increment_listing_views", {"p_listing_id": listing_id}
        ).execute()
    except Exception as e:
        logger.warning("record_listing_view failed for %s: %s", listing_id, e)
    return None


@router.post("/{listing_id}/favorite")
async def toggle_favorite(
    listing_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Toggle favorite on a listing. Returns {favorited: bool}."""
    user_id = current_user["id"]
    try:
        result = supabase_admin.rpc(
            "toggle_favorite",
            {"p_user_id": user_id, "p_listing_id": listing_id},
        ).execute()
        favorited = bool(result.data)
    except Exception as e:
        logger.error("toggle_favorite failed: %s", e)
        raise HTTPException(status_code=500, detail="Failed to toggle favorite")

    return {"favorited": favorited, "listing_id": listing_id}
