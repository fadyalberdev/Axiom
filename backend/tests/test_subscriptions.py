# backend/tests/test_subscriptions.py
"""Unit tests for owner-subscription pure logic."""
from datetime import datetime, timedelta, timezone

from app.subscriptions import plans


def _iso(dt):
    return dt.isoformat()


def test_free_plan_caps():
    assert plans.listing_cap(None) == 1
    assert plans.ai_quota(None) == 0


def test_paid_plan_caps():
    assert plans.listing_cap({"plan": "basic", "status": "active"}) == 5
    assert plans.listing_cap({"plan": "pro", "status": "active"}) == 20
    assert plans.ai_quota({"plan": "pro", "status": "active"}) == 50


def test_canceled_subscription_falls_to_free():
    assert plans.effective_plan({"plan": "pro", "status": "canceled"}) == "free"
    assert plans.listing_cap({"plan": "pro", "status": "past_due"}) == 1


def test_active_trial_grants_trial_caps():
    future = _iso(datetime.now(timezone.utc) + timedelta(days=3))
    sub = {"plan": "trial", "status": "trialing", "trial_ends_at": future}
    assert plans.effective_plan(sub) == "trial"
    assert plans.listing_cap(sub) == 3
    assert plans.ai_quota(sub) == 50


def test_expired_trial_falls_to_free():
    past = _iso(datetime.now(timezone.utc) - timedelta(days=1))
    sub = {"plan": "trial", "status": "trialing", "trial_ends_at": past}
    assert plans.effective_plan(sub) == "free"
    assert plans.listing_cap(sub) == 1


def test_ai_remaining_never_negative():
    sub = {"plan": "basic", "status": "active", "ai_descriptions_used": 99}
    assert plans.ai_remaining(sub) == 0
    sub2 = {"plan": "basic", "status": "active", "ai_descriptions_used": 3}
    assert plans.ai_remaining(sub2) == 7


def test_select_listings_to_pause_keeps_newest():
    ids = ["a", "b", "c", "d"]  # a oldest, d newest
    assert plans.select_listings_to_pause(ids, cap=1) == ["a", "b", "c"]
    assert plans.select_listings_to_pause(ids, cap=4) == []
    assert plans.select_listings_to_pause(ids, cap=10) == []


from app.subscriptions import service


def test_should_reset_ai_window_after_a_month():
    from datetime import datetime, timedelta, timezone
    old = (datetime.now(timezone.utc) - timedelta(days=32)).isoformat()
    recent = (datetime.now(timezone.utc) - timedelta(days=3)).isoformat()
    assert service._window_expired(old) is True
    assert service._window_expired(recent) is False
    assert service._window_expired(None) is True


def test_quota_gate_blocks_at_cap():
    from app.listings.router import _enforce_listing_quota
    from fastapi import HTTPException
    import pytest

    sub_free = {"plan": "free", "status": "active"}
    with pytest.raises(HTTPException) as exc:
        _enforce_listing_quota(active_count=1, sub=sub_free)
    assert exc.value.status_code == 402
    _enforce_listing_quota(active_count=0, sub=sub_free)
    _enforce_listing_quota(active_count=10, sub={"plan": "pro", "status": "active"})


def test_webhook_reads_metadata_from_stripe_object():
    """Regression: stripe-python >=8 StripeObject is NOT a dict subclass, so the
    webhook must read metadata via attribute access, not isinstance(dict) + .get().
    Previously this returned None -> paid users never got upgraded."""
    from stripe import StripeObject
    from app.stripe_webhooks.router import _field, _current_period_end

    sub = StripeObject.construct_from({
        "id": "sub_1",
        "status": "active",
        "customer": "cus_1",
        "metadata": {"user_id": "u-123", "plan": "pro"},
        "items": {"data": [{"current_period_end": 1781712517}]},
    }, "key")

    md = _field(sub, "metadata")
    assert not isinstance(md, dict)  # the exact trap the old code fell into
    assert _field(md, "user_id") == "u-123"
    assert _field(md, "plan") == "pro"
    # Basil API moved current_period_end onto items; helper must find it.
    assert _current_period_end(sub) == 1781712517
