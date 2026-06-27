"""Tests for the projects module."""

from unittest.mock import MagicMock


FAKE_PROJECT = {
    "id": "proj-001",
    "agency_id": "agency-001",
    "title": "Sunset Residences",
    "description": "A luxury residential project",
    "image_url": "https://example.com/project.jpg",
    "starting_price": 1500000,
    "units_total": 200,
    "completion_pct": 60,
    "status": "under_construction",
    "key_features": ["Swimming Pool", "Gym", "Garden"],
    "created_at": "2026-01-15T00:00:00Z",
    "agencies": {
        "name": "Test Agency",
        "slug": "test-agency",
        "logo_url": "https://example.com/logo.png",
        "verified": True,
    },
}


def test_get_project_detail(client, mock_supabase):
    _, mock_admin = mock_supabase

    chain = MagicMock()
    chain.select.return_value = chain
    chain.eq.return_value = chain
    chain.single.return_value = chain

    result = MagicMock()
    result.data = FAKE_PROJECT
    chain.execute.return_value = result

    mock_admin.table.return_value = chain

    res = client.get("/api/projects/proj-001")
    assert res.status_code == 200
    data = res.json()
    assert data["title"] == "Sunset Residences"
    assert data["agency_name"] == "Test Agency"
    assert data["agency_verified"] is True
    assert data["completion_pct"] == 60
    assert data["starting_price"] == 1500000.0
    assert "Swimming Pool" in data["key_features"]


def test_get_project_not_found(client, mock_supabase):
    _, mock_admin = mock_supabase

    chain = MagicMock()
    chain.select.return_value = chain
    chain.eq.return_value = chain
    chain.single.return_value = chain
    chain.execute.side_effect = Exception("not found")

    mock_admin.table.return_value = chain

    res = client.get("/api/projects/nonexistent")
    assert res.status_code == 404
