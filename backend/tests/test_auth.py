"""Tests for auth endpoints: signup, login, profile get/update."""

from unittest.mock import MagicMock
from tests.conftest import FAKE_PROFILE, FAKE_USER_ID


# ─── Signup ───────────────────────────────────────────────────────────────────


def test_signup_success(client, mock_supabase):
    """POST /api/auth/signup with valid data returns 201."""
    _mock_client, mock_admin = mock_supabase

    # Mock admin.create_user to return a user object
    fake_user = MagicMock()
    fake_user.id = FAKE_USER_ID
    fake_auth_resp = MagicMock()
    fake_auth_resp.user = fake_user
    mock_admin.auth.admin.create_user.return_value = fake_auth_resp

    # Mock profile update (best-effort)
    mock_admin.table.return_value.update.return_value.eq.return_value.execute.return_value = MagicMock()

    resp = client.post("/api/auth/signup", json={
        "email": "new@example.com",
        "password": "securepass123",
        "full_name": "New User",
        "phone": "+201234567890",
        "country_code": "+20",
        "gender": "male",
    })
    assert resp.status_code == 201
    data = resp.json()
    assert data["user_id"] == FAKE_USER_ID
    assert "Account created" in data["message"]
    create_payload = mock_admin.auth.admin.create_user.call_args.args[0]
    assert create_payload["phone"] == "+201234567890"


def test_signup_duplicate_email(client, mock_supabase):
    """POST /api/auth/signup with existing email returns 400."""
    _mock_client, mock_admin = mock_supabase

    mock_admin.auth.admin.create_user.side_effect = Exception(
        "A user with this email address has already been registered"
    )

    resp = client.post("/api/auth/signup", json={
        "email": "existing@example.com",
        "password": "securepass123",
        "full_name": "Dupe User",
    })
    assert resp.status_code == 400
    assert "already registered" in resp.json()["detail"]


def test_signup_missing_fields(client, mock_supabase):
    """POST /api/auth/signup without required fields returns 422."""
    resp = client.post("/api/auth/signup", json={"email": "test@example.com"})
    assert resp.status_code == 422


# ─── Login ────────────────────────────────────────────────────────────────────


def test_login_success(client, mock_supabase):
    """POST /api/auth/login with valid credentials returns 200."""
    mock_client, _mock_admin = mock_supabase

    fake_user = MagicMock()
    fake_auth_resp = MagicMock()
    fake_auth_resp.user = fake_user
    mock_client.auth.sign_in_with_password.return_value = fake_auth_resp

    resp = client.post("/api/auth/login", json={
        "email": "test@example.com",
        "password": "correctpassword",
    })
    assert resp.status_code == 200
    assert resp.json()["message"] == "ok"


def test_login_wrong_password(client, mock_supabase):
    """POST /api/auth/login with wrong password returns 401."""
    mock_client, _mock_admin = mock_supabase

    mock_client.auth.sign_in_with_password.side_effect = Exception(
        "Invalid login credentials"
    )

    resp = client.post("/api/auth/login", json={
        "email": "test@example.com",
        "password": "wrongpassword",
    })
    assert resp.status_code == 401
    assert "Invalid email or password" in resp.json()["detail"]


# ─── Profile ─────────────────────────────────────────────────────────────────


def test_get_profile_authenticated(client, mock_supabase, auth_header):
    """GET /api/auth/me with valid JWT returns profile."""
    _mock_client, mock_admin = mock_supabase

    # Mock profile lookup
    mock_result = MagicMock()
    mock_result.data = FAKE_PROFILE
    mock_admin.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value = mock_result

    resp = client.get("/api/auth/me", headers=auth_header)
    assert resp.status_code == 200
    data = resp.json()
    assert data["id"] == FAKE_USER_ID
    assert data["email"] == "test@example.com"
    assert data["role"] == "user"


def test_get_profile_unauthenticated(client, mock_supabase):
    """GET /api/auth/me without token returns 401 or 403."""
    resp = client.get("/api/auth/me")
    assert resp.status_code in (401, 403)


def test_update_profile(client, mock_supabase, auth_header):
    """PUT /api/auth/me with valid data updates and returns profile."""
    _mock_client, mock_admin = mock_supabase

    # Mock get_current_user profile lookup
    mock_profile_result = MagicMock()
    mock_profile_result.data = FAKE_PROFILE
    mock_admin.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value = mock_profile_result

    # Mock profile update (no .select().single() — supabase-py update doesn't support it)
    updated_profile = {**FAKE_PROFILE, "full_name": "Updated Name", "bio": "New bio"}
    mock_update_result = MagicMock()
    mock_update_result.data = [updated_profile]
    mock_admin.table.return_value.update.return_value.eq.return_value.execute.return_value = mock_update_result

    resp = client.put("/api/auth/me", headers=auth_header, json={
        "full_name": "Updated Name",
        "bio": "New bio",
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["full_name"] == "Updated Name"
    assert data["bio"] == "New bio"


def test_update_profile_syncs_e164_phone_to_supabase_auth(client, mock_supabase, auth_header):
    """PUT /api/auth/me syncs E.164 profile phone to the Supabase Auth user."""
    _mock_client, mock_admin = mock_supabase

    mock_profile_result = MagicMock()
    mock_profile_result.data = FAKE_PROFILE
    mock_admin.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value = mock_profile_result

    updated_profile = {**FAKE_PROFILE, "phone": "+201001234567"}
    mock_update_result = MagicMock()
    mock_update_result.data = [updated_profile]
    mock_admin.table.return_value.update.return_value.eq.return_value.execute.return_value = mock_update_result

    resp = client.put("/api/auth/me", headers=auth_header, json={
        "phone": "+201001234567",
    })

    assert resp.status_code == 200
    assert resp.json()["phone"] == "+201001234567"
    mock_admin.auth.admin.update_user_by_id.assert_called_with(
        FAKE_USER_ID,
        {"phone": "+201001234567"},
    )
