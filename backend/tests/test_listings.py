"""Tests for listings endpoints."""

from unittest.mock import MagicMock, patch
from tests.conftest import FAKE_USER_ID, FAKE_PROFILE, make_supabase_jwt


LISTING_PAYLOAD = {
    "title": "Modern Apartment",
    "description": "Great place in Maadi",
    "category": "for_rent",
    "property_type": "apartment",
    "price": 8000,
    "location": "Maadi, Cairo",
    "city": "Cairo",
    "bedrooms": 2,
    "bathrooms": 1,
    "size_sqm": 120,
    "images": [],
    "amenities": ["Parking"],
}

FAKE_LISTING_ROW = {
    "id": "11111111-2222-3333-4444-555555555555",
    "owner_id": FAKE_USER_ID,
    "title": "Modern Apartment",
    "description": "Great place in Maadi",
    "location": "Maadi, Cairo",
    "city": "Cairo",
    "price": 8000,
    "currency": "EGP",
    "price_period": "monthly",
    "category": "for_rent",
    "property_type": "apartment",
    "status": "active",
    "verified": False,
    "is_new": True,
    "images": [],
    "bedrooms": 2,
    "bathrooms": 1,
    "size_sqm": 120,
    "floor_number": None,
    "neighborhood_id": None,
    "compound_name": None,
    "views_count": 0,
    "deleted_at": None,
    "created_at": "2026-01-01T00:00:00Z",
    "neighborhoods": {"name": "Maadi"},
}


# ── Test: create listing requires auth ──────────────────────────────────────

def test_create_listing_unauthenticated(client):
    resp = client.post("/api/listings", json=LISTING_PAYLOAD)
    assert resp.status_code in (401, 403)


# ── Test: create listing success ────────────────────────────────────────────

def test_create_listing_success(client, mock_supabase, auth_header):
    mock_client, mock_admin = mock_supabase

    # Mock profile lookup for auth
    profile_result = MagicMock()
    profile_result.data = FAKE_PROFILE
    mock_admin.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value = profile_result

    # Mock listing insert
    insert_result = MagicMock()
    insert_result.data = {"id": "new-listing-id"}
    mock_admin.table.return_value.insert.return_value.select.return_value.single.return_value.execute.return_value = insert_result

    resp = client.post("/api/listings", json=LISTING_PAYLOAD, headers=auth_header)
    assert resp.status_code == 201
    data = resp.json()
    assert "id" in data
    assert data["status"] == "pending"


# ── Test: listing status is pending on creation ─────────────────────────────

def test_listing_starts_pending(client, mock_supabase, auth_header):
    mock_client, mock_admin = mock_supabase

    profile_result = MagicMock()
    profile_result.data = FAKE_PROFILE
    mock_admin.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value = profile_result

    insert_result = MagicMock()
    insert_result.data = {"id": "new-id"}
    mock_admin.table.return_value.insert.return_value.select.return_value.single.return_value.execute.return_value = insert_result

    resp = client.post("/api/listings", json=LISTING_PAYLOAD, headers=auth_header)
    assert resp.json()["status"] == "pending"


# ── Test: list listings (GET /api/listings) ─────────────────────────────────

def test_list_listings(client, mock_supabase):
    mock_client, mock_admin = mock_supabase

    list_result = MagicMock()
    list_result.data = [FAKE_LISTING_ROW]
    list_result.count = 1
    mock_admin.table.return_value.select.return_value.eq.return_value.is_.return_value.order.return_value.range.return_value.execute.return_value = list_result

    resp = client.get("/api/listings")
    assert resp.status_code == 200
    data = resp.json()
    assert "listings" in data
    assert data["total"] == 1


# ── Test: get single listing ────────────────────────────────────────────────

def test_get_listing(client, mock_supabase):
    mock_client, mock_admin = mock_supabase

    # Use side_effect to return different results for different table() calls.
    # The detail fetch wraps in try/except, so we need the first call to succeed.
    detail_result = MagicMock()
    detail_result.data = FAKE_LISTING_ROW

    # Make all chained .execute() calls return the detail result by default.
    # The endpoint catches exceptions for similar listings so failures are safe.
    mock_admin.table.return_value.select.return_value.eq.return_value.is_.return_value.single.return_value.execute.return_value = detail_result
    mock_admin.rpc.return_value.execute.return_value = MagicMock()

    resp = client.get(f"/api/listings/{FAKE_LISTING_ROW['id']}")
    assert resp.status_code == 200
    data = resp.json()
    assert data["title"] == "Modern Apartment"


# ── Test: get listing 404 ──────────────────────────────────────────────────

def test_get_listing_not_found(client, mock_supabase):
    mock_client, mock_admin = mock_supabase

    mock_admin.table.return_value.select.return_value.eq.return_value.is_.return_value.single.return_value.execute.side_effect = Exception("not found")

    resp = client.get("/api/listings/nonexistent-id")
    assert resp.status_code == 404


# ── Test: update listing requires ownership ─────────────────────────────────

def test_update_listing_not_owner(client, mock_supabase, auth_header):
    mock_client, mock_admin = mock_supabase

    # Auth: profile lookup
    profile_result = MagicMock()
    profile_result.data = FAKE_PROFILE
    mock_admin.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value = profile_result

    # Ownership check — different owner
    owner_result = MagicMock()
    owner_result.data = {"owner_id": "someone-else-id"}
    mock_admin.table.return_value.select.return_value.eq.return_value.is_.return_value.single.return_value.execute.return_value = owner_result

    resp = client.put(
        f"/api/listings/{FAKE_LISTING_ROW['id']}",
        json={"title": "Updated"},
        headers=auth_header,
    )
    assert resp.status_code == 403


# ── Test: delete listing requires auth ──────────────────────────────────────

def test_delete_listing_unauthenticated(client):
    resp = client.delete(f"/api/listings/{FAKE_LISTING_ROW['id']}")
    assert resp.status_code in (401, 403)


# ── Test: toggle favorite requires auth ─────────────────────────────────────

def test_favorite_unauthenticated(client):
    resp = client.post(f"/api/listings/{FAKE_LISTING_ROW['id']}/favorite")
    assert resp.status_code in (401, 403)


# ── Test: toggle favorite success ───────────────────────────────────────────

def test_favorite_toggle(client, mock_supabase, auth_header):
    mock_client, mock_admin = mock_supabase

    profile_result = MagicMock()
    profile_result.data = FAKE_PROFILE
    mock_admin.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value = profile_result

    rpc_result = MagicMock()
    rpc_result.data = True
    mock_admin.rpc.return_value.execute.return_value = rpc_result

    resp = client.post(
        f"/api/listings/{FAKE_LISTING_ROW['id']}/favorite",
        headers=auth_header,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "favorited" in data


# ── Test: list listings filter by category ───────────────────────────────────

def test_list_listings_filter_category(client, mock_supabase):
    mock_client, mock_admin = mock_supabase

    list_result = MagicMock()
    list_result.data = [FAKE_LISTING_ROW]
    list_result.count = 1
    mock_admin.table.return_value.select.return_value.eq.return_value.is_.return_value.eq.return_value.order.return_value.range.return_value.execute.return_value = list_result

    resp = client.get("/api/listings?category=for_rent")
    assert resp.status_code == 200
    data = resp.json()
    assert "listings" in data


# ── Test: list listings filter by price range ────────────────────────────────

def test_list_listings_filter_price(client, mock_supabase):
    mock_client, mock_admin = mock_supabase

    list_result = MagicMock()
    list_result.data = [FAKE_LISTING_ROW]
    list_result.count = 1
    # Chained mock for select().eq().is_().gte().lte().order().range().execute()
    mock_admin.table.return_value.select.return_value.eq.return_value.is_.return_value.gte.return_value.lte.return_value.order.return_value.range.return_value.execute.return_value = list_result

    resp = client.get("/api/listings?min_price=5000&max_price=10000")
    assert resp.status_code == 200
    data = resp.json()
    assert "listings" in data


# ── Test: update listing success ─────────────────────────────────────────────

def test_update_listing_success(client, mock_supabase, auth_header):
    mock_client, mock_admin = mock_supabase

    profile_result = MagicMock()
    profile_result.data = FAKE_PROFILE
    mock_admin.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value = profile_result

    owner_result = MagicMock()
    owner_result.data = {"owner_id": FAKE_USER_ID}
    mock_admin.table.return_value.select.return_value.eq.return_value.is_.return_value.single.return_value.execute.return_value = owner_result

    updated_row = {**FAKE_LISTING_ROW, "title": "Updated Title"}
    update_result = MagicMock()
    update_result.data = [updated_row]
    mock_admin.table.return_value.update.return_value.eq.return_value.execute.return_value = update_result

    resp = client.put(
        f"/api/listings/{FAKE_LISTING_ROW['id']}",
        json={"title": "Updated Title"},
        headers=auth_header,
    )
    assert resp.status_code == 200


# ── Test: delete listing not owner ───────────────────────────────────────────

def test_delete_listing_not_owner(client, mock_supabase, auth_header):
    mock_client, mock_admin = mock_supabase

    profile_result = MagicMock()
    profile_result.data = FAKE_PROFILE
    mock_admin.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value = profile_result

    owner_result = MagicMock()
    owner_result.data = {"owner_id": "someone-else-id"}
    mock_admin.table.return_value.select.return_value.eq.return_value.is_.return_value.single.return_value.execute.return_value = owner_result

    resp = client.delete(
        f"/api/listings/{FAKE_LISTING_ROW['id']}",
        headers=auth_header,
    )
    assert resp.status_code == 403


# ── Test: delete listing success ─────────────────────────────────────────────

def test_delete_listing_success(client, mock_supabase, auth_header):
    mock_client, mock_admin = mock_supabase

    profile_result = MagicMock()
    profile_result.data = FAKE_PROFILE
    mock_admin.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value = profile_result

    owner_result = MagicMock()
    owner_result.data = {"owner_id": FAKE_USER_ID}
    mock_admin.table.return_value.select.return_value.eq.return_value.is_.return_value.single.return_value.execute.return_value = owner_result

    delete_result = MagicMock()
    mock_admin.table.return_value.update.return_value.eq.return_value.execute.return_value = delete_result

    resp = client.delete(
        f"/api/listings/{FAKE_LISTING_ROW['id']}",
        headers=auth_header,
    )
    assert resp.status_code == 204


# ── Test: get favorites ───────────────────────────────────────────────────────

def test_get_favorites(client, mock_supabase, auth_header):
    mock_client, mock_admin = mock_supabase

    profile_result = MagicMock()
    profile_result.data = FAKE_PROFILE
    mock_admin.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value = profile_result

    fav_row = {"listing_id": FAKE_LISTING_ROW["id"], "listings": FAKE_LISTING_ROW}
    fav_result = MagicMock()
    fav_result.data = [fav_row]
    mock_admin.table.return_value.select.return_value.eq.return_value.execute.return_value = fav_result

    resp = client.get("/api/listings/favorites", headers=auth_header)
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)


# ── Test: get listing increments views ───────────────────────────────────────

def test_get_listing_increments_views(client, mock_supabase):
    mock_client, mock_admin = mock_supabase

    detail_result = MagicMock()
    detail_result.data = FAKE_LISTING_ROW
    mock_admin.table.return_value.select.return_value.eq.return_value.is_.return_value.single.return_value.execute.return_value = detail_result
    mock_admin.rpc.return_value.execute.return_value = MagicMock()

    resp = client.get(f"/api/listings/{FAKE_LISTING_ROW['id']}")
    assert resp.status_code == 200
    # Verify rpc was called (view increment)
    mock_admin.rpc.assert_called()


# ── Test: POST /view records a view (anonymous) ──────────────────────────────

def test_record_listing_view_increments(client, mock_supabase):
    mock_client, mock_admin = mock_supabase
    lookup = MagicMock()
    lookup.data = {"owner_id": FAKE_USER_ID}
    mock_admin.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value = lookup
    mock_admin.rpc.return_value.execute.return_value = MagicMock()

    # Anonymous viewer (no auth) → counted.
    resp = client.post(f"/api/listings/{FAKE_LISTING_ROW['id']}/view")
    assert resp.status_code == 204
    mock_admin.rpc.assert_called_with(
        "increment_listing_views", {"p_listing_id": FAKE_LISTING_ROW["id"]}
    )


# ── Test: POST /view skips the owner's own view ──────────────────────────────

def test_record_listing_view_skips_owner(client, mock_supabase, auth_header):
    mock_client, mock_admin = mock_supabase
    # Same chain backs both the profile lookup (get_optional_user) and the
    # listing owner lookup; a row that is its own owner satisfies both.
    shared = MagicMock()
    shared.data = {"id": FAKE_USER_ID, "owner_id": FAKE_USER_ID, "role": "user"}
    mock_admin.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value = shared
    mock_admin.rpc.return_value.execute.return_value = MagicMock()

    # auth_header authenticates as FAKE_USER_ID, the listing owner → not counted.
    resp = client.post(
        f"/api/listings/{FAKE_LISTING_ROW['id']}/view", headers=auth_header
    )
    assert resp.status_code == 204
    increment_calls = [
        c for c in mock_admin.rpc.call_args_list
        if c.args and c.args[0] == "increment_listing_views"
    ]
    assert increment_calls == []


# ── Test: list listings sort by price ────────────────────────────────────────

def test_list_listings_sort_by_price(client, mock_supabase):
    mock_client, mock_admin = mock_supabase

    list_result = MagicMock()
    list_result.data = [FAKE_LISTING_ROW]
    list_result.count = 1
    # Chain for sorted query: select().eq().is_().order().range().execute()
    mock_admin.table.return_value.select.return_value.eq.return_value.is_.return_value.order.return_value.range.return_value.execute.return_value = list_result

    resp = client.get("/api/listings?sort_by=price_asc")
    assert resp.status_code == 200
    data = resp.json()
    assert "listings" in data


# ── Test: list listings sort by most viewed ──────────────────────────────────

def test_list_listings_sort_by_most_viewed(client, mock_supabase):
    mock_client, mock_admin = mock_supabase

    list_result = MagicMock()
    list_result.data = [FAKE_LISTING_ROW]
    list_result.count = 1
    mock_admin.table.return_value.select.return_value.eq.return_value.is_.return_value.order.return_value.range.return_value.execute.return_value = list_result

    resp = client.get("/api/listings?sort_by=most_viewed")
    assert resp.status_code == 200
    data = resp.json()
    assert "listings" in data


# ── Test: signed upload URL with invalid bucket ──────────────────────────────

def test_signed_upload_url_invalid_bucket(client, mock_supabase, auth_header):
    mock_client, mock_admin = mock_supabase

    profile_result = MagicMock()
    profile_result.data = FAKE_PROFILE
    mock_admin.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value = profile_result

    resp = client.post(
        "/api/uploads/signed-url",
        json={"bucket": "private-secrets", "filename": "photo.jpg"},
        headers=auth_header,
    )
    assert resp.status_code == 400
