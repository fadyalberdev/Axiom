"""Tests for POST /api/ai/validate-amenity."""
from unittest.mock import AsyncMock


def _get_ollama(client):
    import app.ai.router as ai_router
    return ai_router.ollama


def test_validate_amenity_no_auth(client, mock_supabase):
    """Endpoint requires authentication — 401 without auth header."""
    resp = client.post("/api/ai/validate-amenity", json={"amenity": "Parking"})
    assert resp.status_code == 401


def test_validate_amenity_too_long(client, mock_supabase, auth_header):
    """Pydantic rejects amenity strings longer than 200 characters."""
    resp = client.post(
        "/api/ai/validate-amenity",
        json={"amenity": "x" * 201},
        headers=auth_header,
    )
    assert resp.status_code == 422


def test_validate_amenity_empty_string(client, mock_supabase, auth_header):
    resp = client.post(
        "/api/ai/validate-amenity", json={"amenity": ""}, headers=auth_header
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["ok"] is False
    assert data["reason"] != ""


def test_validate_amenity_whitespace_only(client, mock_supabase, auth_header):
    resp = client.post(
        "/api/ai/validate-amenity", json={"amenity": "   "}, headers=auth_header
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["ok"] is False
    assert data["reason"] != ""


def test_validate_amenity_ollama_down_fail_open(client, mock_supabase, auth_header):
    """If Ollama is down the endpoint returns ok=True (fail-open)."""
    ollama = _get_ollama(client)
    ollama.health = AsyncMock(return_value=False)

    resp = client.post(
        "/api/ai/validate-amenity",
        json={"amenity": "Rooftop Terrace"},
        headers=auth_header,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["ok"] is True


def test_validate_amenity_appropriate(client, mock_supabase, auth_header):
    ollama = _get_ollama(client)
    ollama.health = AsyncMock(return_value=True)
    ollama.generate = AsyncMock(
        return_value='{"appropriate": true, "reason": ""}'
    )

    resp = client.post(
        "/api/ai/validate-amenity",
        json={"amenity": "Solar Panels"},
        headers=auth_header,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["ok"] is True
    assert "reason" in data
    assert data["reason"] == ""


def test_validate_amenity_inappropriate(client, mock_supabase, auth_header):
    ollama = _get_ollama(client)
    ollama.health = AsyncMock(return_value=True)
    ollama.generate = AsyncMock(
        return_value='{"appropriate": false, "reason": "Contains offensive content"}'
    )

    resp = client.post(
        "/api/ai/validate-amenity",
        json={"amenity": "offensive text here"},
        headers=auth_header,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["ok"] is False
    assert data["reason"] == "Contains offensive content"


def test_validate_amenity_malformed_ollama_response_fails_open(
    client, mock_supabase, auth_header
):
    """If Ollama returns non-JSON, endpoint fails open (ok=True)."""
    ollama = _get_ollama(client)
    ollama.health = AsyncMock(return_value=True)
    ollama.generate = AsyncMock(return_value="not json at all")

    resp = client.post(
        "/api/ai/validate-amenity",
        json={"amenity": "Balcony"},
        headers=auth_header,
    )
    assert resp.status_code == 200
    assert resp.json()["ok"] is True
