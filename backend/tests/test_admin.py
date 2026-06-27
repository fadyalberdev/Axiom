"""Tests for the admin module."""

import time
import jwt
from unittest.mock import MagicMock
from app.config import settings


def _admin_header() -> dict:
    """Create a valid admin JWT header."""
    payload = {
        "sub": "admin",
        "role": "admin",
        "iat": int(time.time()),
        "exp": int(time.time()) + 3600,
    }
    token = jwt.encode(payload, settings.admin_jwt_secret or settings.jwt_secret, algorithm="HS256")
    return {"Authorization": f"Bearer {token}"}


# ── Stats ─────────────────────────────────────────────────────────────────────

def test_admin_stats(client, mock_supabase):
    _, mock_admin = mock_supabase

    def table_side_effect(name):
        chain = MagicMock()
        chain.select.return_value = chain
        chain.eq.return_value = chain
        chain.gt.return_value = chain
        chain.is_.return_value = chain
        chain.limit.return_value = chain

        result = MagicMock()
        result.data = []
        result.count = 5
        chain.execute.return_value = result
        return chain

    mock_admin.table.side_effect = table_side_effect

    res = client.get("/api/admin/stats", headers=_admin_header())
    assert res.status_code == 200
    data = res.json()
    assert "total_users" in data
    assert "total_listings" in data
    assert "flagged_listings" in data
    assert "total_verified_sellers" in data


def test_admin_stats_no_auth(client, mock_supabase):
    res = client.get("/api/admin/stats")
    assert res.status_code == 401


# ── Listings CRUD ─────────────────────────────────────────────────────────────

def test_admin_list_listings(client, mock_supabase):
    _, mock_admin = mock_supabase

    chain = MagicMock()
    chain.select.return_value = chain
    chain.eq.return_value = chain
    chain.is_.return_value = chain
    chain.ilike.return_value = chain
    chain.order.return_value = chain
    chain.range.return_value = chain

    result = MagicMock()
    result.data = [{"id": "l1", "title": "Test", "status": "active"}]
    result.count = 1
    chain.execute.return_value = result

    mock_admin.table.return_value = chain

    res = client.get("/api/admin/listings", headers=_admin_header())
    assert res.status_code == 200
    data = res.json()
    # Should use standardized format
    assert "data" in data
    assert "total_pages" in data


def test_admin_update_listing_allows_owner_assignment(client, mock_supabase):
    _, mock_admin = mock_supabase

    chain = MagicMock()
    chain.update.return_value = chain
    chain.eq.return_value = chain

    result = MagicMock()
    result.data = [{"id": "l1", "owner_id": "owner-123", "title": "Assigned"}]
    chain.execute.return_value = result

    mock_admin.table.return_value = chain

    res = client.put(
        "/api/admin/listings/l1",
        json={"owner_id": "owner-123", "title": "Assigned"},
        headers=_admin_header(),
    )

    assert res.status_code == 200
    sent_payload = chain.update.call_args.args[0]
    assert sent_payload["owner_id"] == "owner-123"


# ── Fraud ─────────────────────────────────────────────────────────────────────

def test_admin_update_listing_retries_stale_owner_assignment(client, mock_supabase):
    _, mock_admin = mock_supabase

    chain = MagicMock()
    chain.update.return_value = chain
    chain.eq.return_value = chain

    stale_result = MagicMock()
    stale_result.data = [{"id": "l1", "owner_id": "old-owner", "title": "Assigned"}]
    owner_result = MagicMock()
    owner_result.data = [{"id": "l1", "owner_id": "owner-123", "title": "Assigned"}]
    chain.execute.side_effect = [stale_result, owner_result]

    mock_admin.table.return_value = chain

    res = client.put(
        "/api/admin/listings/l1",
        json={"owner_id": "owner-123", "title": "Assigned"},
        headers=_admin_header(),
    )

    assert res.status_code == 200
    assert res.json()["owner_id"] == "owner-123"
    assert chain.update.call_args_list[-1].args[0] == {"owner_id": "owner-123"}


def test_admin_fraud_review(client, mock_supabase):
    _, mock_admin = mock_supabase

    chain = MagicMock()
    chain.select.return_value = chain
    chain.eq.return_value = chain
    chain.update.return_value = chain
    chain.single.return_value = chain

    result = MagicMock()
    result.data = [{"id": "l1", "title": "Flagged", "status": "active"}]
    chain.execute.return_value = result

    mock_admin.table.return_value = chain

    res = client.put(
        "/api/admin/fraud/l1",
        json={"action": "approve"},
        headers=_admin_header(),
    )
    assert res.status_code == 200
    assert res.json()["message"] == "Listing approved"
