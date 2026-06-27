"""Tests for the agencies module."""

from unittest.mock import MagicMock
from tests.conftest import FAKE_USER_ID, make_supabase_jwt


FAKE_AGENCY = {
    "id": "agency-001",
    "owner_id": FAKE_USER_ID,
    "name": "Test Agency",
    "slug": "test-agency",
    "description": "A great agency for testing purposes that has many listings",
    "logo_url": "https://example.com/logo.png",
    "banner_url": "https://example.com/banner.png",
    "city": "Cairo",
    "verified": True,
    "phone": "+201000000000",
    "email": "agency@test.com",
    "website": "https://agency.test",
    "subscription_plan": "pro",
    "listing_quota": 50,
    "created_at": "2026-01-01T00:00:00Z",
}


def _mock_table(mock_admin, table_name, data=None, count=0, single=False):
    """Helper: set up chained table query mock."""
    chain = MagicMock()
    chain.select.return_value = chain
    chain.eq.return_value = chain
    chain.ilike.return_value = chain
    chain.is_.return_value = chain
    chain.neq.return_value = chain
    chain.order.return_value = chain
    chain.range.return_value = chain
    chain.limit.return_value = chain
    chain.single.return_value = chain

    result = MagicMock()
    result.data = data if data is not None else []
    result.count = count
    chain.execute.return_value = result
    if single and data:
        result.data = data[0] if isinstance(data, list) else data

    mock_admin.table.return_value = chain
    return chain


# ── List agencies ─────────────────────────────────────────────────────────────

def test_list_agencies(client, mock_supabase):
    _, mock_admin = mock_supabase

    call_count = 0
    original_table = mock_admin.table

    def table_side_effect(name):
        nonlocal call_count
        call_count += 1
        chain = MagicMock()
        chain.select.return_value = chain
        chain.eq.return_value = chain
        chain.ilike.return_value = chain
        chain.is_.return_value = chain
        chain.order.return_value = chain
        chain.range.return_value = chain
        chain.limit.return_value = chain
        chain.single.return_value = chain

        result = MagicMock()

        if name == "agencies":
            result.data = [FAKE_AGENCY]
            result.count = 1
        elif name == "listings":
            result.data = []
            result.count = 3
        elif name == "projects":
            result.data = []
            result.count = 2
        else:
            result.data = []
            result.count = 0

        chain.execute.return_value = result
        return chain

    mock_admin.table.side_effect = table_side_effect

    res = client.get("/api/agencies")
    assert res.status_code == 200
    data = res.json()
    assert "agencies" in data
    assert data["total"] == 1


# ── Get agency detail ─────────────────────────────────────────────────────────

def test_get_agency_detail(client, mock_supabase):
    _, mock_admin = mock_supabase

    def table_side_effect(name):
        chain = MagicMock()
        chain.select.return_value = chain
        chain.eq.return_value = chain
        chain.is_.return_value = chain
        chain.order.return_value = chain
        chain.range.return_value = chain
        chain.limit.return_value = chain
        chain.single.return_value = chain

        result = MagicMock()

        if name == "agencies":
            result.data = FAKE_AGENCY
        elif name == "listings":
            result.data = []
            result.count = 0
        elif name == "projects":
            result.data = []
            result.count = 0
        else:
            result.data = []
            result.count = 0

        chain.execute.return_value = result
        return chain

    mock_admin.table.side_effect = table_side_effect

    res = client.get("/api/agencies/test-agency")
    assert res.status_code == 200
    data = res.json()
    assert data["name"] == "Test Agency"
    assert data["verified"] is True
    assert "banner_url" in data
    assert "trust_score" in data


# ── Agency 404 ────────────────────────────────────────────────────────────────

def test_get_agency_not_found(client, mock_supabase):
    _, mock_admin = mock_supabase
    chain = MagicMock()
    chain.select.return_value = chain
    chain.eq.return_value = chain
    chain.single.return_value = chain
    chain.execute.side_effect = Exception("not found")
    mock_admin.table.return_value = chain

    res = client.get("/api/agencies/nonexistent")
    assert res.status_code == 404


# ── Agency projects sub-endpoint ──────────────────────────────────────────────

def test_get_agency_projects(client, mock_supabase):
    _, mock_admin = mock_supabase

    fake_project = {
        "id": "proj-001",
        "agency_id": "agency-001",
        "title": "Test Project",
        "description": "Nice project",
        "image_url": "https://example.com/img.jpg",
        "completion_pct": 75,
        "starting_price": 500000,
        "status": "under_construction",
        "created_at": "2026-01-01T00:00:00Z",
    }

    call_idx = 0

    def table_side_effect(name):
        nonlocal call_idx
        call_idx += 1
        chain = MagicMock()
        chain.select.return_value = chain
        chain.eq.return_value = chain
        chain.single.return_value = chain
        chain.order.return_value = chain
        chain.limit.return_value = chain

        result = MagicMock()

        if name == "agencies":
            result.data = {"id": "agency-001"}
        elif name == "projects":
            result.data = [fake_project]
        else:
            result.data = []

        chain.execute.return_value = result
        return chain

    mock_admin.table.side_effect = table_side_effect

    res = client.get("/api/agencies/test-agency/projects")
    assert res.status_code == 200
    data = res.json()
    assert "projects" in data
    assert len(data["projects"]) == 1
    assert data["projects"][0]["title"] == "Test Project"


# ── Agency listings sub-endpoint ──────────────────────────────────────────────

def test_get_agency_listings(client, mock_supabase):
    _, mock_admin = mock_supabase

    def table_side_effect(name):
        chain = MagicMock()
        chain.select.return_value = chain
        chain.eq.return_value = chain
        chain.is_.return_value = chain
        chain.single.return_value = chain
        chain.order.return_value = chain
        chain.range.return_value = chain

        result = MagicMock()

        if name == "agencies":
            result.data = {"id": "agency-001"}
        elif name == "listings":
            result.data = []
            result.count = 0
        else:
            result.data = []

        chain.execute.return_value = result
        return chain

    mock_admin.table.side_effect = table_side_effect

    res = client.get("/api/agencies/test-agency/listings")
    assert res.status_code == 200
    data = res.json()
    assert "listings" in data
    assert data["total"] == 0
