"""Unit tests for OllamaClient — verifies embed endpoint and model config.

These tests inspect the source code and instance attributes to verify
the client is correctly configured, without requiring a live Ollama server.
"""

import inspect
import pytest

from app.ai.ollama_client import OllamaClient
from app.config import settings


# ─── Test 1: embed() calls /api/embed (not /api/embeddings) ──────────────────


def test_embed_uses_correct_endpoint():
    """embed() source must reference /api/embed, not /api/embeddings."""
    source = inspect.getsource(OllamaClient.embed)
    assert "/api/embed" in source, "embed() must call /api/embed"
    assert "/api/embeddings" not in source, "embed() must NOT call old /api/embeddings endpoint"


# ─── Test 2: embed() sends "input" key and reads "embeddings[0]" ─────────────


def test_embed_request_body_and_response_parsing():
    """embed() must use 'input' key in request body and parse embeddings[0]."""
    source = inspect.getsource(OllamaClient.embed)
    # Must use "input" key in request body (Ollama v0.5+ API)
    assert '"input"' in source, "embed() must send request body with 'input' key"
    assert '"prompt"' not in source, "embed() must NOT use old 'prompt' key"
    # Must read from "embeddings" (plural, list of lists) and take index [0]
    assert '"embeddings"' in source, "embed() must read 'embeddings' key from response"
    assert 'embeddings' in source and '[0]' in source, (
        "embed() must return embeddings[0] (not flat 'embedding' key)"
    )
    assert '"embedding"' not in source, "embed() must NOT use old singular 'embedding' key"


# ─── Test 3: generate() uses self.model from settings ────────────────────────


def test_generate_uses_settings_model():
    """OllamaClient.model is set from settings.ollama_model at init time."""
    client = OllamaClient()
    assert client.model == settings.ollama_model, (
        f"Expected client.model={settings.ollama_model!r}, "
        f"got {client.model!r}"
    )
    # Verify generate() uses self.model in its payload
    source = inspect.getsource(OllamaClient.generate)
    assert "self.model" in source, "generate() must use self.model in its payload"


# ─── Test 4: generate_stream() uses self.model from settings ─────────────────


def test_generate_stream_uses_settings_model():
    """generate_stream() must use self.model (resolved from settings.ollama_model)."""
    client = OllamaClient()
    assert client.model == settings.ollama_model, (
        f"Expected client.model={settings.ollama_model!r}, "
        f"got {client.model!r}"
    )
    # Verify generate_stream() uses self.model in its payload
    source = inspect.getsource(OllamaClient.generate_stream)
    assert "self.model" in source, "generate_stream() must use self.model in its payload"
