"""Tests for /api/dashboard/me endpoint."""

from unittest.mock import MagicMock
from tests.conftest import FAKE_USER_ID, FAKE_PROFILE


def test_dashboard_requires_auth(client):
    """GET /api/dashboard/me without token returns 401."""
    resp = client.get("/api/dashboard/me")
    assert resp.status_code == 401


def test_dashboard_returns_structure(client, mock_supabase, auth_header):
    """GET /api/dashboard/me returns all sections with correct shapes."""
    _, mock_admin = mock_supabase

    # Auth: profile lookup via single() chain
    profile_result = MagicMock()
    profile_result.data = FAKE_PROFILE
    mock_admin.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value = profile_result

    # User listings
    listings_result = MagicMock()
    listings_result.data = [
        {
            "id": "list-001",
            "title": "Test Apartment",
            "location": "Cairo",
            "price": 5000.0,
            "images": [],
            "status": "active",
            "views_count": 42,
            "created_at": "2026-03-01T00:00:00Z",
        }
    ]
    mock_admin.table.return_value.select.return_value.eq.return_value.is_.return_value.order.return_value.execute.return_value = listings_result

    # Favorites count
    fav_count_result = MagicMock()
    fav_count_result.count = 3
    mock_admin.table.return_value.select.return_value.eq.return_value.execute.return_value = fav_count_result

    # Liked properties (favorites join)
    fav_join_result = MagicMock()
    fav_join_result.data = [
        {
            "created_at": "2026-03-02T00:00:00Z",
            "listings": {
                "id": "liked-001",
                "title": "Shared Room",
                "location": "New Cairo",
                "price": 6500.0,
                "images": [],
                "bedrooms": 3,
                "bathrooms": 2,
                "property_type": "apartment",
                "category": "shared_housing",
                "price_period": "monthly",
            },
        }
    ]
    mock_admin.table.return_value.select.return_value.eq.return_value.order.return_value.limit.return_value.execute.return_value = fav_join_result

    resp = client.get("/api/dashboard/me", headers=auth_header)
    assert resp.status_code == 200
    data = resp.json()

    # Verify all sections are present
    assert "profile" in data
    assert "analytics" in data
    assert "listings" in data
    assert "liked_properties" in data
    assert "listings_count" in data
    assert "liked_count" in data
    assert data["liked_properties"][0]["category"] == "shared_housing"
    assert data["liked_properties"][0]["price_period"] == "monthly"

    # Verify analytics shape: 4 items, each with label and value
    assert isinstance(data["analytics"], list)
    assert len(data["analytics"]) == 4
    for item in data["analytics"]:
        assert "label" in item
        assert "value" in item
