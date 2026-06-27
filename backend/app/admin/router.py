import logging
import math
import secrets
import time
import uuid
from datetime import date

import jwt
from fastapi import APIRouter, HTTPException, Depends, Query, Request, Body
from app.admin.schemas import (
    AdminLoginRequest, AdminLoginResponse,
    RejectListingRequest, VerifyUserRequest,
)
from app.database import supabase_admin
from app.config import settings

router = APIRouter()
logger = logging.getLogger(__name__)


def _admin_secret() -> str:
    """Admin JWT uses a separate secret so a leaked user jwt_secret cannot forge admin tokens."""
    return settings.admin_jwt_secret or settings.jwt_secret

ADMIN_TOKEN_EXPIRY = 24 * 60 * 60  # 24 hours
ALLOWED_ADMIN_UPLOAD_BUCKETS = {"avatars", "listing-images", "attachments", "agency-images"}


def _age_from_birth_date(value: str | None) -> int | None:
    if not value:
        return None
    try:
        born = date.fromisoformat(value[:10])
    except ValueError:
        return None
    today = date.today()
    return today.year - born.year - ((today.month, today.day) < (born.month, born.day))


def _payload_with_calculated_age(update_data: dict) -> dict:
    if "birth_date" not in update_data:
        return update_data
    return {
        **update_data,
        "age": _age_from_birth_date(update_data.get("birth_date")),
    }


def _missing_schema_columns(error_msg: str) -> set[str]:
    missing = set()
    for column in ("birth_date", "whatsapp_number"):
        if "PGRST204" in error_msg and column in error_msg:
            missing.add(column)
    return missing


def _create_admin_token(username: str) -> str:
    """Create a signed JWT for admin sessions."""
    payload = {
        "sub": username,
        "role": "admin",
        "iat": int(time.time()),
        "exp": int(time.time()) + ADMIN_TOKEN_EXPIRY,
    }
    return jwt.encode(payload, _admin_secret(), algorithm="HS256")


def _verify_admin_token(token: str) -> str:
    """Verify an admin JWT and return the username."""
    try:
        payload = jwt.decode(
            token,
            _admin_secret(),
            algorithms=["HS256"],
            options={"verify_aud": False},
        )
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Admin token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid admin token")
    if payload.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return payload["sub"]


def get_admin(request: Request) -> str:
    """Authenticate admin via Bearer token (frontend) or Basic Auth (API tools)."""
    auth = request.headers.get("Authorization", "")

    # Bearer token (from frontend admin login)
    if auth.startswith("Bearer "):
        return _verify_admin_token(auth[7:])

    # Basic Auth fallback (for curl / API tools)
    if auth.startswith("Basic "):
        import base64
        try:
            decoded = base64.b64decode(auth[6:]).decode("utf-8")
            username, password = decoded.split(":", 1)
        except Exception:
            raise HTTPException(status_code=401, detail="Invalid Basic auth header")
        ok_user = secrets.compare_digest(username, settings.admin_username)
        ok_pass = secrets.compare_digest(password, settings.admin_password)
        if not (ok_user and ok_pass):
            raise HTTPException(status_code=401, detail="Invalid admin credentials")
        return username

    raise HTTPException(status_code=401, detail="Missing Authorization header")


def _paged(data: list, total: int, page: int, per_page: int) -> dict:
    """Build a standardized paginated response for the admin frontend."""
    return {
        "data": data,
        "total": total,
        "page": page,
        "per_page": per_page,
        "total_pages": max(1, math.ceil(total / per_page)),
    }


def _count(table: str) -> int:
    """Quick row count for a table."""
    try:
        r = supabase_admin.table(table).select("id", count="exact").limit(0).execute()
        return r.count or 0
    except Exception:
        return 0


# ─── Auth ─────────────────────────────────────────────────────────────────────

@router.post("/auth/login", response_model=AdminLoginResponse)
async def admin_login(body: AdminLoginRequest):
    """Validate admin credentials and return a signed JWT."""
    ok_user = secrets.compare_digest(body.username, settings.admin_username)
    ok_pass = secrets.compare_digest(body.password, settings.admin_password)
    if not (ok_user and ok_pass):
        raise HTTPException(status_code=401, detail="Invalid admin credentials")
    return AdminLoginResponse(token=_create_admin_token(body.username))


# ─── Stats ────────────────────────────────────────────────────────────────────

@router.get("/stats")
async def admin_stats(_admin: str = Depends(get_admin)):
    """Platform-wide statistics for the admin dashboard."""
    total_users = _count("profiles")
    total_agencies = _count("agencies")
    total_projects = _count("projects")

    # Listings counts by status
    try:
        all_listings = (
            supabase_admin.table("listings")
            .select("status", count="exact")
            .is_("deleted_at", "null")
            .execute()
        )
        total_listings = all_listings.count or 0
    except Exception:
        total_listings = 0

    active_listings = pending_listings = 0
    try:
        r = supabase_admin.table("listings").select("id", count="exact").eq("status", "active").is_("deleted_at", "null").execute()
        active_listings = r.count or 0
    except Exception:
        pass
    try:
        r = supabase_admin.table("listings").select("id", count="exact").eq("status", "pending").is_("deleted_at", "null").execute()
        pending_listings = r.count or 0
    except Exception:
        pass

    # Shared housing count
    try:
        r = supabase_admin.table("listings").select("id", count="exact").eq("category", "shared_housing").eq("status", "active").is_("deleted_at", "null").execute()
        total_shared_housing = r.count or 0
    except Exception:
        total_shared_housing = 0

    # Fraud-flagged listings
    try:
        r = supabase_admin.table("listings").select("id", count="exact").gt("fraud_score", 0.5).is_("deleted_at", "null").execute()
        flagged_listings = r.count or 0
    except Exception:
        flagged_listings = 0

    # Blog posts
    total_blog_posts = _count("blog_posts")

    # Transactions (stub — no payments table yet)
    total_leads = _count("leads")

    # Verified sellers
    try:
        r = supabase_admin.table("profiles").select("id", count="exact").eq("is_verified_seller", True).execute()
        total_verified_sellers = r.count or 0
    except Exception:
        total_verified_sellers = 0

    return {
        "total_users": total_users,
        "total_listings": total_listings,
        "total_agencies": total_agencies,
        "total_projects": total_projects,
        "total_shared_housing": total_shared_housing,
        "total_blog_posts": total_blog_posts,
        "total_leads": total_leads,
        "flagged_listings": flagged_listings,
        "pending_listings": pending_listings,
        "active_listings": active_listings,
        "total_verified_sellers": total_verified_sellers,
    }


# ─── Listings ─────────────────────────────────────────────────────────────────

@router.get("/listings")
async def admin_list_listings(
    status: str | None = Query(None),
    search: str | None = Query(None),
    category: str | None = Query(None),
    property_type: str | None = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    _admin: str = Depends(get_admin),
):
    """Return listings (paginated, filterable)."""
    offset = (page - 1) * per_page
    query = (
        supabase_admin.table("listings")
        .select("*, profiles!listings_owner_id_fkey(full_name, email, avatar_url), neighborhoods(name)", count="exact")
        .is_("deleted_at", "null")
    )
    if status:
        query = query.eq("status", status)
    if category:
        query = query.eq("category", category)
    if property_type:
        query = query.eq("property_type", property_type)
    if search:
        query = query.ilike("title", f"%{search}%")

    try:
        result = query.order("created_at", desc=False).range(offset, offset + per_page - 1).execute()
    except Exception as e:
        logger.error("admin DB error: %s", e)
        raise HTTPException(status_code=500, detail="Internal server error")

    return _paged(result.data or [], result.count or 0, page, per_page)


@router.post("/listings", status_code=201)
async def admin_create_listing(
    body: dict = Body(...),
    _admin: str = Depends(get_admin),
):
    """Admin-create a listing (bypasses normal flow)."""
    body.pop("id", None)
    body.pop("neighborhoods", None)
    body.pop("profiles", None)
    body.setdefault("status", "active")
    body.setdefault("city", body.get("location", ""))
    body.setdefault("currency", "EGP")
    for optional_uuid in ("agency_id", "project_id", "neighborhood_id", "university_id"):
        if body.get(optional_uuid) == "":
            body.pop(optional_uuid, None)

    try:
        result = supabase_admin.table("listings").insert(body).execute()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create listing")
    listing = result.data[0]

    return listing


@router.post("/uploads/signed-url")
async def admin_get_signed_upload_url(
    body: dict = Body(...),
    _admin: str = Depends(get_admin),
):
    """Generate a signed Supabase Storage upload URL for admin-managed media."""
    bucket = body.get("bucket")
    filename = body.get("filename") or "upload"
    if bucket not in ALLOWED_ADMIN_UPLOAD_BUCKETS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid bucket. Allowed: {', '.join(sorted(ALLOWED_ADMIN_UPLOAD_BUCKETS))}",
        )

    ext = filename.rsplit(".", 1)[-1] if "." in filename else ""
    unique_name = f"{uuid.uuid4().hex}.{ext}" if ext else uuid.uuid4().hex
    storage_path = f"admin/{unique_name}"

    try:
        response = supabase_admin.storage.from_(bucket).create_signed_upload_url(storage_path)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate signed URL")

    if isinstance(response, dict):
        signed_url = response.get("signedURL") or response.get("signed_url") or ""
        path = response.get("path") or storage_path
    else:
        signed_url = getattr(response, "signed_url", "") or getattr(response, "signedURL", "")
        path = getattr(response, "path", storage_path)

    return {
        "upload_url": signed_url,
        "path": path,
        "public_url": f"{supabase_admin.storage.from_(bucket).get_public_url(path)}",
        "bucket": bucket,
    }


@router.put("/listings/{listing_id}")
async def admin_update_listing(
    listing_id: str,
    body: dict = Body(...),
    _admin: str = Depends(get_admin),
):
    """Admin-update any listing field."""
    body.pop("id", None)
    body.pop("neighborhoods", None)
    body.pop("profiles", None)
    requested_owner_id = body.get("owner_id") if "owner_id" in body else None
    try:
        result = (
            supabase_admin.table("listings")
            .update(body)
            .eq("id", listing_id)
            .execute()
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update listing")
    if not result.data:
        raise HTTPException(status_code=404, detail="Listing not found")
    listing = result.data[0]
    if "owner_id" in body and listing.get("owner_id") != requested_owner_id:
        try:
            owner_result = (
                supabase_admin.table("listings")
                .update({"owner_id": requested_owner_id})
                .eq("id", listing_id)
                .execute()
            )
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to assign listing owner")
        if not owner_result.data or owner_result.data[0].get("owner_id") != requested_owner_id:
            raise HTTPException(status_code=500, detail="Listing owner assignment did not persist")
        listing = owner_result.data[0]
    return listing


@router.delete("/listings/{listing_id}")
async def admin_delete_listing(
    listing_id: str,
    _admin: str = Depends(get_admin),
):
    """Soft-delete a listing."""
    from datetime import datetime, timezone
    try:
        supabase_admin.table("listings").update(
            {"deleted_at": datetime.now(timezone.utc).isoformat()}
        ).eq("id", listing_id).execute()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete listing")

    return {"message": "Listing deleted"}


@router.put("/listings/{listing_id}/approve")
async def admin_approve_listing(
    listing_id: str,
    _admin: str = Depends(get_admin),
):
    """Approve a listing: set status='active'."""
    try:
        listing_result = (
            supabase_admin.table("listings")
            .select("id, owner_id, title, status")
            .eq("id", listing_id)
            .single()
            .execute()
        )
    except Exception:
        raise HTTPException(status_code=404, detail="Listing not found")

    if not listing_result.data:
        raise HTTPException(status_code=404, detail="Listing not found")

    listing = listing_result.data

    if listing["status"] == "active":
        raise HTTPException(status_code=400, detail="Listing is already active")

    try:
        result = (
            supabase_admin.table("listings")
            .update({"status": "active"})
            .eq("id", listing_id)
            .execute()
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to approve listing")

    return {"message": "Listing approved", "listing": result.data[0] if result.data else {}}


@router.put("/listings/{listing_id}/reject")
async def admin_reject_listing(
    listing_id: str,
    body: RejectListingRequest,
    _admin: str = Depends(get_admin),
):
    """Reject a listing with a reason."""
    try:
        listing_result = (
            supabase_admin.table("listings")
            .select("id, owner_id, title, status")
            .eq("id", listing_id)
            .single()
            .execute()
        )
    except Exception:
        raise HTTPException(status_code=404, detail="Listing not found")

    if not listing_result.data:
        raise HTTPException(status_code=404, detail="Listing not found")

    listing = listing_result.data

    try:
        result = (
            supabase_admin.table("listings")
            .update({"status": "rejected"})
            .eq("id", listing_id)
            .execute()
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to reject listing")

    return {"message": "Listing rejected", "reason": body.reason, "listing": result.data[0] if result.data else {}}


# ─── Users ────────────────────────────────────────────────────────────────────

@router.get("/users")
async def admin_list_users(
    search: str | None = Query(None),
    role: str | None = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    _admin: str = Depends(get_admin),
):
    """Return all user profiles (paginated)."""
    offset = (page - 1) * per_page
    query = supabase_admin.table("profiles").select("*", count="exact")
    if search:
        query = query.ilike("full_name", f"%{search}%")
    if role:
        query = query.eq("role", role)

    try:
        result = query.order("created_at", desc=True).range(offset, offset + per_page - 1).execute()
    except Exception as e:
        logger.error("admin DB error: %s", e)
        raise HTTPException(status_code=500, detail="Internal server error")

    return _paged(result.data or [], result.count or 0, page, per_page)


@router.put("/users/{user_id}/verify")
async def admin_verify_user(
    user_id: str,
    body: VerifyUserRequest,
    _admin: str = Depends(get_admin),
):
    """Grant or revoke the is_verified_seller badge for a user."""
    try:
        result = (
            supabase_admin.table("profiles")
            .update({"is_verified_seller": body.is_verified_seller})
            .eq("id", user_id)
            .execute()
        )
    except Exception as e:
        logger.error("admin DB error: %s", e)
        raise HTTPException(status_code=500, detail="Internal server error")

    if not result.data:
        raise HTTPException(status_code=404, detail="User not found")

    action = "granted" if body.is_verified_seller else "revoked"
    return {
        "message": f"Verified seller badge {action}",
        "user": result.data[0],
    }


@router.put("/users/{user_id}")
async def admin_update_user(
    user_id: str,
    body: dict = Body(...),
    _admin: str = Depends(get_admin),
):
    """Update any user profile field."""
    body.pop("id", None)
    allowed = {
        "full_name",
        "phone",
        "whatsapp_number",
        "role",
        "bio",
        "is_verified_seller",
        "avatar_url",
        "country_code",
        "gender",
        "birth_date",
        "age",
        "occupation",
        "lifestyle_preferences",
    }
    update_data = _payload_with_calculated_age({k: v for k, v in body.items() if k in allowed})
    if not update_data:
        raise HTTPException(status_code=400, detail="No valid fields to update")

    try:
        result = (
            supabase_admin.table("profiles")
            .update(update_data)
            .eq("id", user_id)
            .execute()
        )
    except Exception as e:
        error_msg = str(e)
        missing_columns = _missing_schema_columns(error_msg)
        if missing_columns:
            fallback_data = {
                key: value for key, value in update_data.items() if key not in missing_columns
            }
            try:
                result = (
                    supabase_admin.table("profiles")
                    .update(fallback_data)
                    .eq("id", user_id)
                    .execute()
                )
            except Exception as retry_error:
                raise HTTPException(status_code=500, detail=f"Database error: {retry_error}")
        else:
            logger.error("admin DB error: %s", e)
        raise HTTPException(status_code=500, detail="Internal server error")
    if not result.data:
        raise HTTPException(status_code=404, detail="User not found")
    return result.data[0]


@router.delete("/users/{user_id}")
async def admin_delete_user(
    user_id: str,
    _admin: str = Depends(get_admin),
):
    """Delete a user profile, related records, and the Supabase auth user (invalidates their JWT)."""
    def _safe_delete(table: str, **filters):
        """Delete rows ignoring errors from missing tables or missing columns."""
        try:
            q = supabase_admin.table(table).delete()
            for col, val in filters.items():
                q = q.eq(col, val)
            q.execute()
        except Exception as exc:
            logger.warning("admin delete skip (%s): %s", table, exc)

    # Delete child records first — each wrapped so a missing table won't abort the rest
    _safe_delete("subscriptions", user_id=user_id)
    _safe_delete("favorites", user_id=user_id)
    _safe_delete("notifications", user_id=user_id)
    _safe_delete("leads", user_id=user_id)
    _safe_delete("bookings", renter_id=user_id)
    _safe_delete("bookings", owner_id=user_id)
    _safe_delete("payments", user_id=user_id)

    # Delete the profile row
    try:
        supabase_admin.table("profiles").delete().eq("id", user_id).execute()
    except Exception as e:
        logger.error("admin delete profiles error: %s", e)
        raise HTTPException(status_code=500, detail=f"Failed to delete user: {str(e)}")

    # Delete the Supabase auth user — immediately invalidates their JWT
    try:
        supabase_admin.auth.admin.delete_user(user_id)
    except Exception as e:
        logger.warning("admin delete auth user (non-fatal): %s", e)

    return {"message": "User deleted"}


# ─── Agencies ─────────────────────────────────────────────────────────────────

@router.get("/agencies")
async def admin_list_agencies(
    search: str | None = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    _admin: str = Depends(get_admin),
):
    """List all agencies (admin)."""
    offset = (page - 1) * per_page
    query = supabase_admin.table("agencies").select("*", count="exact")
    if search:
        query = query.ilike("name", f"%{search}%")

    try:
        result = query.order("created_at", desc=True).range(offset, offset + per_page - 1).execute()
    except Exception as e:
        logger.error("admin DB error: %s", e)
        raise HTTPException(status_code=500, detail="Internal server error")

    return _paged(result.data or [], result.count or 0, page, per_page)


@router.post("/agencies", status_code=201)
async def admin_create_agency(
    body: dict = Body(...),
    _admin: str = Depends(get_admin),
):
    """Admin-create an agency."""
    if not body.get("slug") and body.get("name"):
        import re
        body["slug"] = re.sub(r"[^a-z0-9]+", "-", body["name"].lower()).strip("-")
    _AGENCY_FIELDS = {"owner_id", "name", "slug", "description", "logo_url", "banner_url", "website", "phone", "email", "city", "verified", "founded_year"}
    body = {k: v for k, v in body.items() if k in _AGENCY_FIELDS}
    try:
        result = supabase_admin.table("agencies").insert(body).execute()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create agency")
    return result.data[0]


@router.put("/agencies/{agency_id}")
async def admin_update_agency(
    agency_id: str,
    body: dict = Body(...),
    _admin: str = Depends(get_admin),
):
    """Admin-update an agency."""
    body.pop("id", None)
    _AGENCY_FIELDS = {"owner_id", "name", "slug", "description", "logo_url", "banner_url", "website", "phone", "email", "city", "verified", "founded_year"}
    body = {k: v for k, v in body.items() if k in _AGENCY_FIELDS}
    if not body:
        raise HTTPException(status_code=400, detail="No valid fields to update")
    try:
        result = (
            supabase_admin.table("agencies")
            .update(body)
            .eq("id", agency_id)
            .execute()
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update agency")
    if not result.data:
        raise HTTPException(status_code=404, detail="Agency not found")
    return result.data[0]


@router.delete("/agencies/{agency_id}")
async def admin_delete_agency(
    agency_id: str,
    _admin: str = Depends(get_admin),
):
    """Delete an agency."""
    try:
        supabase_admin.table("agencies").delete().eq("id", agency_id).execute()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete agency")
    return {"message": "Agency deleted"}


# ─── Universities ──────────────────────────────────────────────────────────────

@router.get("/universities")
async def admin_list_universities(
    search: str | None = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    _admin: str = Depends(get_admin),
):
    """List all universities (admin)."""
    offset = (page - 1) * per_page
    query = supabase_admin.table("universities").select("*", count="exact")
    if search:
        query = query.ilike("name", f"%{search}%")
    try:
        result = query.order("created_at", desc=True).range(offset, offset + per_page - 1).execute()
    except Exception as e:
        logger.error("admin DB error: %s", e)
        raise HTTPException(status_code=500, detail="Internal server error")
    return _paged(result.data or [], result.count or 0, page, per_page)


@router.post("/universities", status_code=201)
async def admin_create_university(
    body: dict = Body(...),
    _admin: str = Depends(get_admin),
):
    """Admin-create a university."""
    import re
    if not body.get("slug") and body.get("name"):
        body["slug"] = re.sub(r"[^a-z0-9]+", "-", body["name"].lower()).strip("-")
    _UNIVERSITY_FIELDS = {
        "owner_id", "name", "slug", "description", "logo_url", "banner_url",
        "website", "phone", "email", "city", "verified", "founded_year",
        "type", "student_count", "accreditation",
    }
    body = {k: v for k, v in body.items() if k in _UNIVERSITY_FIELDS}
    try:
        result = supabase_admin.table("universities").insert(body).execute()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create university")
    return result.data[0]


@router.put("/universities/{university_id}")
async def admin_update_university(
    university_id: str,
    body: dict = Body(...),
    _admin: str = Depends(get_admin),
):
    """Admin-update a university."""
    body.pop("id", None)
    _UNIVERSITY_FIELDS = {
        "name", "slug", "description", "logo_url", "banner_url",
        "website", "phone", "email", "city", "verified", "founded_year",
        "type", "student_count", "accreditation",
    }
    body = {k: v for k, v in body.items() if k in _UNIVERSITY_FIELDS}
    if not body:
        raise HTTPException(status_code=400, detail="No valid fields to update")
    try:
        result = (
            supabase_admin.table("universities")
            .update(body)
            .eq("id", university_id)
            .execute()
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update university")
    if not result.data:
        raise HTTPException(status_code=404, detail="University not found")
    return result.data[0]


@router.delete("/universities/{university_id}")
async def admin_delete_university(
    university_id: str,
    _admin: str = Depends(get_admin),
):
    """Delete a university."""
    try:
        supabase_admin.table("universities").delete().eq("id", university_id).execute()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete university")
    return {"message": "University deleted"}


# ─── Projects ─────────────────────────────────────────────────────────────────

@router.get("/projects")
async def admin_list_projects(
    search: str | None = Query(None),
    agency_id: str | None = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    _admin: str = Depends(get_admin),
):
    """List all projects (admin)."""
    offset = (page - 1) * per_page
    query = supabase_admin.table("projects").select("*", count="exact")
    if search:
        query = query.ilike("title", f"%{search}%")
    if agency_id:
        query = query.eq("agency_id", agency_id)

    try:
        result = query.order("created_at", desc=True).range(offset, offset + per_page - 1).execute()
    except Exception as e:
        logger.error("admin DB error: %s", e)
        raise HTTPException(status_code=500, detail="Internal server error")

    return _paged(result.data or [], result.count or 0, page, per_page)


@router.post("/projects", status_code=201)
async def admin_create_project(
    body: dict = Body(...),
    _admin: str = Depends(get_admin),
):
    """Admin-create a project."""
    if not body.get("slug") and body.get("title"):
        import re
        body["slug"] = re.sub(r"[^a-z0-9]+", "-", body["title"].lower()).strip("-")
    _PROJECT_FIELDS = {"agency_id", "title", "slug", "description", "image_url", "starting_price", "units_total", "completion_pct", "status", "key_features", "gallery_images", "brochure_url"}
    body = {k: v for k, v in body.items() if k in _PROJECT_FIELDS}
    try:
        result = supabase_admin.table("projects").insert(body).execute()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create project")
    return result.data[0]


@router.put("/projects/{project_id}")
async def admin_update_project(
    project_id: str,
    body: dict = Body(...),
    _admin: str = Depends(get_admin),
):
    """Admin-update a project."""
    body.pop("id", None)
    _PROJECT_FIELDS = {"agency_id", "title", "slug", "description", "image_url", "starting_price", "units_total", "completion_pct", "status", "key_features", "gallery_images", "brochure_url"}
    body = {k: v for k, v in body.items() if k in _PROJECT_FIELDS}
    if not body:
        raise HTTPException(status_code=400, detail="No valid fields to update")
    try:
        result = (
            supabase_admin.table("projects")
            .update(body)
            .eq("id", project_id)
            .execute()
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update project")
    if not result.data:
        raise HTTPException(status_code=404, detail="Project not found")
    return result.data[0]


@router.delete("/projects/{project_id}")
async def admin_delete_project(
    project_id: str,
    _admin: str = Depends(get_admin),
):
    """Delete a project."""
    try:
        supabase_admin.table("projects").delete().eq("id", project_id).execute()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete project")
    return {"message": "Project deleted"}


# ─── Blog ─────────────────────────────────────────────────────────────────────

@router.get("/blog")
async def admin_list_blog(
    search: str | None = Query(None),
    is_published: str | None = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    _admin: str = Depends(get_admin),
):
    """List all blog posts (admin, includes unpublished)."""
    offset = (page - 1) * per_page
    query = supabase_admin.table("blog_posts").select("*", count="exact")
    if search:
        query = query.ilike("title", f"%{search}%")
    if is_published == "true":
        query = query.eq("is_published", True)
    elif is_published == "false":
        query = query.eq("is_published", False)

    try:
        result = query.order("created_at", desc=True).range(offset, offset + per_page - 1).execute()
    except Exception as e:
        logger.error("admin DB error: %s", e)
        raise HTTPException(status_code=500, detail="Internal server error")

    return _paged(result.data or [], result.count or 0, page, per_page)


@router.post("/blog", status_code=201)
async def admin_create_blog_post(
    body: dict = Body(...),
    _admin: str = Depends(get_admin),
):
    """Admin-create a blog post."""
    if not body.get("slug") and body.get("title"):
        import re
        body["slug"] = re.sub(r"[^a-z0-9]+", "-", body["title"].lower()).strip("-")
    # content must be valid jsonb — HTML string is fine, empty string is not
    if not body.get("content"):
        body["content"] = []
    body.setdefault("tags", [])
    body.setdefault("is_published", False)
    # Strip empty-string UUID so NOT NULL FK constraint fails with a clear error
    if body.get("author_id") == "":
        body.pop("author_id", None)
    _BLOG_FIELDS = {"author_id", "title", "slug", "lead", "category", "image_url", "content", "tags", "read_time", "is_published", "published_at"}
    body = {k: v for k, v in body.items() if k in _BLOG_FIELDS}
    try:
        result = supabase_admin.table("blog_posts").insert(body).execute()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create blog post")
    return result.data[0]


@router.put("/blog/{post_id}")
async def admin_update_blog_post(
    post_id: str,
    body: dict = Body(...),
    _admin: str = Depends(get_admin),
):
    """Admin-update a blog post."""
    body.pop("id", None)
    if not body.get("content"):
        body["content"] = []
    _BLOG_FIELDS = {"author_id", "title", "slug", "lead", "category", "image_url", "content", "tags", "read_time", "is_published", "published_at"}
    body = {k: v for k, v in body.items() if k in _BLOG_FIELDS}
    try:
        result = (
            supabase_admin.table("blog_posts")
            .update(body)
            .eq("id", post_id)
            .execute()
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update blog post")
    if not result.data:
        raise HTTPException(status_code=404, detail="Blog post not found")
    return result.data[0]


@router.delete("/blog/{post_id}")
async def admin_delete_blog_post(
    post_id: str,
    _admin: str = Depends(get_admin),
):
    """Delete a blog post."""
    try:
        supabase_admin.table("blog_posts").delete().eq("id", post_id).execute()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete blog post")
    return {"message": "Blog post deleted"}


# ─── Fraud ────────────────────────────────────────────────────────────────────

@router.get("/fraud")
async def admin_list_fraud(
    page: int = Query(1, ge=1),
    per_page: int = Query(15, ge=1, le=100),
    _admin: str = Depends(get_admin),
):
    """List fraud-flagged listings (fraud_score > 0.5)."""
    offset = (page - 1) * per_page
    try:
        result = (
            supabase_admin.table("listings")
            .select("*", count="exact")
            .gt("fraud_score", 0.5)
            .is_("deleted_at", "null")
            .order("fraud_score", desc=True)
            .range(offset, offset + per_page - 1)
            .execute()
        )
    except Exception as e:
        logger.error("admin DB error: %s", e)
        raise HTTPException(status_code=500, detail="Internal server error")

    return _paged(result.data or [], result.count or 0, page, per_page)


@router.put("/fraud/{listing_id}")
async def admin_review_fraud(
    listing_id: str,
    body: dict = Body(...),
    _admin: str = Depends(get_admin),
):
    """Approve or reject a fraud-flagged listing."""
    action = body.get("action")
    if action not in ("approve", "reject"):
        raise HTTPException(status_code=400, detail="action must be 'approve' or 'reject'")

    new_status = "active" if action == "approve" else "rejected"
    try:
        result = (
            supabase_admin.table("listings")
            .update({"status": new_status, "fraud_score": 0})
            .eq("id", listing_id)
            .execute()
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to review listing")
    if not result.data:
        raise HTTPException(status_code=404, detail="Listing not found")
    return {"message": f"Listing {action}d", "listing": result.data[0]}


# ─── Transactions (stub — no payments table yet) ─────────────────────────────

@router.get("/transactions")
async def admin_list_transactions(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    _admin: str = Depends(get_admin),
):
    """Stub: no payments table yet. Returns empty list."""
    return _paged([], 0, page, per_page)
