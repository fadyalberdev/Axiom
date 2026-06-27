"""Tests for leads endpoints."""

from unittest.mock import MagicMock
from tests.conftest import FAKE_USER_ID, FAKE_PROFILE, make_supabase_jwt


FAKE_LISTING_ID = "11111111-2222-3333-4444-555555555555"
FAKE_AGENCY_ID = "aaaaaaaa-bbbb-cccc-dddd-111111111111"

FAKE_LISTING = {
    "id": FAKE_LISTING_ID,
    "title": "Modern Apartment",
    "price": 8000,
    "agency_id": FAKE_AGENCY_ID,
    "owner_id": FAKE_USER_ID,
    "status": "active",
    "deleted_at": None,
}

FAKE_AGENCY = {
    "name": "Cairo Realty",
    "phone": "+201001234567",
}

CREATE_LEAD_PAYLOAD = {
    "listing_id": FAKE_LISTING_ID,
    "source": "whatsapp_click",
}


# ── Test: POST /api/leads — no auth returns 403 ──────────────────────────────

def test_create_lead_unauthenticated(client):
    resp = client.post("/api/leads", json=CREATE_LEAD_PAYLOAD)
    assert resp.status_code in (401, 403)


# ── Test: GET /api/admin/leads — non-admin returns 403 ───────────────────────

def test_get_admin_leads_non_admin(client, mock_supabase, auth_header):
    mock_client, mock_admin = mock_supabase

    # Mock profile lookup — user role (not admin)
    profile_result = MagicMock()
    profile_result.data = FAKE_PROFILE  # role = "user"
    mock_admin.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value = profile_result

    resp = client.get("/api/admin/leads", headers=auth_header)
    assert resp.status_code in (401, 403)


# ── Test: GET /api/admin/leads — no auth returns 403 ─────────────────────────

def test_get_admin_leads_unauthenticated(client):
    resp = client.get("/api/admin/leads")
    assert resp.status_code in (401, 403)


# ── Test: POST /api/leads — success returns whatsapp_url ─────────────────────

def test_create_lead_success(client, mock_supabase, auth_header):
    mock_client, mock_admin = mock_supabase

    # The mock needs to handle multiple chained .table() calls in sequence.
    # Supabase calls:
    # 1. profiles table (get_current_user in dependencies)
    # 2. listings table (.eq().is_().single().execute())
    # 3. agencies table (.eq().single().execute())
    # 4. leads table (.insert().execute())

    # Profile result
    profile_result = MagicMock()
    profile_result.data = FAKE_PROFILE

    # Listing result
    listing_result = MagicMock()
    listing_result.data = FAKE_LISTING

    # Agency result
    agency_result = MagicMock()
    agency_result.data = FAKE_AGENCY

    # Lead insert result
    insert_result = MagicMock()
    insert_result.data = [{"id": "lead-id-1"}]

    # Use side_effect to return different mocks per table() call
    call_count = [0]

    def table_side_effect(table_name):
        mock_table = MagicMock()

        if table_name == "profiles":
            mock_table.select.return_value.eq.return_value.single.return_value.execute.return_value = profile_result
        elif table_name == "listings":
            mock_table.select.return_value.eq.return_value.is_.return_value.single.return_value.execute.return_value = listing_result
        elif table_name == "agencies":
            mock_table.select.return_value.eq.return_value.single.return_value.execute.return_value = agency_result
        elif table_name == "leads":
            mock_table.insert.return_value.execute.return_value = insert_result

        return mock_table

    mock_admin.table.side_effect = table_side_effect

    resp = client.post("/api/leads", json=CREATE_LEAD_PAYLOAD, headers=auth_header)
    assert resp.status_code == 200
    data = resp.json()
    assert "whatsapp_url" in data
    assert data["whatsapp_url"].startswith("https://wa.me/")
    assert "already_existed" in data


# ── Test: POST /api/leads — invalid source returns 422 ───────────────────────

def test_create_lead_invalid_source(client, mock_supabase, auth_header):
    mock_client, mock_admin = mock_supabase

    profile_result = MagicMock()
    profile_result.data = FAKE_PROFILE

    def table_side_effect(table_name):
        mock_table = MagicMock()
        if table_name == "profiles":
            mock_table.select.return_value.eq.return_value.single.return_value.execute.return_value = profile_result
        return mock_table

    mock_admin.table.side_effect = table_side_effect

    resp = client.post(
        "/api/leads",
        json={"listing_id": FAKE_LISTING_ID, "source": "invalid_source"},
        headers=auth_header,
    )
    assert resp.status_code == 422
