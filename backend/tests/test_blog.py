"""Tests for the blog module."""

from unittest.mock import MagicMock


FAKE_POST = {
    "id": "post-001",
    "slug": "test-post",
    "title": "Test Blog Post",
    "lead": "A short lead paragraph",
    "image_url": "https://example.com/img.jpg",
    "content": [{"type": "paragraph", "text": "Hello"}],
    "tags": ["real-estate", "tips"],
    "category": "market",
    "read_time": "5 min",
    "is_published": True,
    "published_at": "2026-03-01T00:00:00Z",
    "created_at": "2026-02-28T00:00:00Z",
    "author_id": "author-001",
    "profiles": {"full_name": "Author Name", "avatar_url": "https://example.com/avatar.jpg", "role": "user"},
}


# ── List blog posts ──────────────────────────────────────────────────────────

def test_list_blog_posts(client, mock_supabase):
    _, mock_admin = mock_supabase

    chain = MagicMock()
    chain.select.return_value = chain
    chain.eq.return_value = chain
    chain.order.return_value = chain
    chain.range.return_value = chain

    result = MagicMock()
    result.data = [FAKE_POST]
    result.count = 1
    chain.execute.return_value = result

    mock_admin.table.return_value = chain

    res = client.get("/api/blog")
    assert res.status_code == 200
    data = res.json()
    assert "posts" in data
    assert data["total"] == 1
    post = data["posts"][0]
    assert post["subtitle"] == "A short lead paragraph"
    assert post["image_url"] == "https://example.com/img.jpg"
    assert post["author_name"] == "Author Name"


# ── Get single blog post ─────────────────────────────────────────────────────

def test_get_blog_post(client, mock_supabase):
    _, mock_admin = mock_supabase

    chain = MagicMock()
    chain.select.return_value = chain
    chain.eq.return_value = chain
    chain.single.return_value = chain

    result = MagicMock()
    result.data = FAKE_POST
    chain.execute.return_value = result

    mock_admin.table.return_value = chain

    res = client.get("/api/blog/test-post")
    assert res.status_code == 200
    data = res.json()
    assert data["title"] == "Test Blog Post"
    assert data["author_name"] == "Author Name"
    assert data["author_role"] == "user"
    assert data["subtitle"] == "A short lead paragraph"
    assert data["image_url"] == "https://example.com/img.jpg"
    assert data["lead"] == "A short lead paragraph"


# ── Blog post 404 ────────────────────────────────────────────────────────────

def test_get_blog_post_not_found(client, mock_supabase):
    _, mock_admin = mock_supabase

    chain = MagicMock()
    chain.select.return_value = chain
    chain.eq.return_value = chain
    chain.single.return_value = chain
    chain.execute.side_effect = Exception("not found")

    mock_admin.table.return_value = chain

    res = client.get("/api/blog/nonexistent")
    assert res.status_code == 404


# ── Related posts ─────────────────────────────────────────────────────────────

def test_related_posts(client, mock_supabase):
    _, mock_admin = mock_supabase

    call_idx = 0

    def table_side_effect(name):
        nonlocal call_idx
        call_idx += 1
        chain = MagicMock()
        chain.select.return_value = chain
        chain.eq.return_value = chain
        chain.neq.return_value = chain
        chain.single.return_value = chain
        chain.order.return_value = chain
        chain.limit.return_value = chain

        result = MagicMock()

        if call_idx == 1:
            # First call: get current post
            result.data = {"id": "post-001", "category": "market"}
        else:
            # Second call: get related posts
            related = dict(FAKE_POST)
            related["id"] = "post-002"
            related["slug"] = "related-post"
            related["title"] = "Related Post"
            result.data = [related]

        chain.execute.return_value = result
        return chain

    mock_admin.table.side_effect = table_side_effect

    res = client.get("/api/blog/test-post/related")
    assert res.status_code == 200
    data = res.json()
    assert isinstance(data, list)
    assert len(data) == 1
    assert data[0]["title"] == "Related Post"
