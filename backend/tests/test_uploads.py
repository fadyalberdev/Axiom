"""Tests for uploads endpoints."""

from unittest.mock import MagicMock
from tests.conftest import FAKE_PROFILE


# ── Test: signed URL success ────────────────────────────────────────────────

def test_signed_url_success(client, mock_supabase, auth_header):
    mock_client, mock_admin = mock_supabase

    # Auth profile
    profile_result = MagicMock()
    profile_result.data = FAKE_PROFILE
    mock_admin.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value = profile_result

    # Mock storage signed URL
    mock_admin.storage.from_.return_value.create_signed_upload_url.return_value = {
        "signedURL": "https://storage.example.com/upload?token=abc",
        "path": f"{FAKE_PROFILE['id']}/photo.jpg",
    }
    mock_admin.storage.from_.return_value.get_public_url.return_value = (
        "https://storage.example.com/listing-images/photo.jpg"
    )

    resp = client.post(
        "/api/uploads/signed-url",
        json={"bucket": "listing-images", "filename": "photo.jpg"},
        headers=auth_header,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "upload_url" in data
    assert "public_url" in data
    assert data["bucket"] == "listing-images"


# ── Test: invalid bucket ────────────────────────────────────────────────────

def test_signed_url_invalid_bucket(client, mock_supabase, auth_header):
    mock_client, mock_admin = mock_supabase

    profile_result = MagicMock()
    profile_result.data = FAKE_PROFILE
    mock_admin.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value = profile_result

    resp = client.post(
        "/api/uploads/signed-url",
        json={"bucket": "not-a-real-bucket", "filename": "photo.jpg"},
        headers=auth_header,
    )
    assert resp.status_code == 400
    assert "Invalid bucket" in resp.json()["detail"]
