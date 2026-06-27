"""Shared test fixtures — mocks Supabase so tests don't hit the real DB."""

import time
from contextlib import ExitStack
import pytest
import jwt
from unittest.mock import AsyncMock, MagicMock, patch
from fastapi.testclient import TestClient

from app.config import settings


# ── Fake profile data ────────────────────────────────────────────────────────

FAKE_USER_ID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"

FAKE_PROFILE = {
    "id": FAKE_USER_ID,
    "email": "test@example.com",
    "full_name": "Test User",
    "avatar_url": None,
    "phone": "+201234567890",
    "whatsapp_number": "+201234567890",
    "bio": None,
    "role": "user",
    "is_verified_seller": False,
    "gender": "male",
    "country_code": "+20",
    "badges": [],
    "birth_date": None,
    "age": None,
    "occupation": None,
    "lifestyle_preferences": None,
    "created_at": "2026-01-01T00:00:00Z",
    "updated_at": "2026-01-01T00:00:00Z",
}


def make_supabase_jwt(user_id: str = FAKE_USER_ID, expired: bool = False) -> str:
    """Create a valid Supabase-style JWT for testing."""
    now = int(time.time())
    payload = {
        "sub": user_id,
        "aud": "authenticated",
        "role": "authenticated",
        "iat": now - 60,
        "exp": (now - 120) if expired else (now + 3600),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm="HS256")


@pytest.fixture(autouse=True)
def _reset_rate_limit():
    """RateLimitMiddleware counts per-IP; every TestClient request shares one
    fake IP, so the whole suite would trip the 10 req/min AI limit."""
    from app.main import _rate_windows
    _rate_windows.clear()
    yield


@pytest.fixture
def mock_supabase():
    """Patch both supabase_client and supabase_admin with MagicMocks."""
    mock_client = MagicMock()
    mock_admin = MagicMock()

    mock_ollama = MagicMock()
    mock_ollama.health = AsyncMock(return_value=False)
    mock_ollama.embed = AsyncMock(return_value=[])
    mock_ollama.generate = AsyncMock(return_value="")
    mock_ollama.generate_stream = AsyncMock(return_value=iter([]))

    patches = [
        patch("app.database.supabase_client", mock_client),
        patch("app.database.supabase_admin", mock_admin),
        patch("app.auth.router.supabase_client", mock_client),
        patch("app.auth.router.supabase_admin", mock_admin),
        patch("app.dependencies.supabase_admin", mock_admin),
        patch("app.listings.router.supabase_admin", mock_admin),
        patch("app.uploads.router.supabase_admin", mock_admin),
        patch("app.ai.router.supabase_admin", mock_admin),
        patch("app.ai.router.ollama", mock_ollama),
        patch("app.ai.rag.supabase_admin", mock_admin),
        patch("app.ai.rag.ollama", mock_ollama),
        patch("app.ai.embeddings.supabase_admin", mock_admin),
        patch("app.ai.embeddings.ollama", mock_ollama),
        patch("app.dashboard.router.supabase_admin", mock_admin),
        patch("app.agencies.router.supabase_admin", mock_admin),
        patch("app.blog.router.supabase_admin", mock_admin),
        patch("app.admin.router.supabase_admin", mock_admin),
        patch("app.projects.router.supabase_admin", mock_admin),
        patch("app.leads.router.supabase_admin", mock_admin),
        patch("app.subscriptions.service.supabase_admin", mock_admin),
        patch("app.subscriptions.router.supabase_admin", mock_admin),
        patch("app.subscriptions.lapse.supabase_admin", mock_admin),
        patch("app.stripe_webhooks.router.supabase_admin", mock_admin),
        # Quota gates in listings + AI routers call service.*; stub them out so
        # existing endpoint tests aren't blocked by the subscription check.
        patch("app.listings.router.service", MagicMock(
            get_or_create=MagicMock(return_value={"plan": "pro", "status": "active", "ai_descriptions_used": 0}),
            count_active_listings=MagicMock(return_value=0),
        )),
        patch("app.ai.router.service", MagicMock(
            get_or_create=MagicMock(return_value={"plan": "pro", "status": "active", "ai_descriptions_used": 0}),
            increment_ai_used=MagicMock(),
        )),
    ]
    with ExitStack() as stack:
        for item in patches:
            stack.enter_context(item)
        yield mock_client, mock_admin




@pytest.fixture
def client(mock_supabase):
    """TestClient with mocked Supabase — import app after patching."""
    # Import inside fixture so patches are active
    from app.main import app
    return TestClient(app)


@pytest.fixture
def auth_header():
    """Authorization header with a valid JWT."""
    token = make_supabase_jwt()
    return {"Authorization": f"Bearer {token}"}
