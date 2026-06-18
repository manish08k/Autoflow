"""Tests for auth middleware — rate limiter and token creation."""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from fastapi import HTTPException

import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))


# ── Rate limiter ──────────────────────────────────────────────────────────────

def _make_request(ip="1.2.3.4"):
    req = MagicMock()
    req.client.host = ip
    return req


def test_rate_limit_allows_under_threshold():
    from api.middleware.auth import check_login_rate_limit, _login_attempts
    _login_attempts.clear()
    req = _make_request("10.0.0.1")
    for _ in range(10):  # exactly at limit
        check_login_rate_limit(req)


def test_rate_limit_blocks_over_threshold():
    from api.middleware.auth import check_login_rate_limit, _login_attempts
    _login_attempts.clear()
    req = _make_request("10.0.0.2")
    for _ in range(10):
        check_login_rate_limit(req)
    with pytest.raises(HTTPException) as exc_info:
        check_login_rate_limit(req)
    assert exc_info.value.status_code == 429


def test_rate_limit_reset_clears_counter():
    from api.middleware.auth import check_login_rate_limit, reset_login_rate_limit, _login_attempts
    _login_attempts.clear()
    req = _make_request("10.0.0.3")
    for _ in range(10):
        check_login_rate_limit(req)
    reset_login_rate_limit(req)
    # Should not raise after reset
    check_login_rate_limit(req)


def test_rate_limit_per_ip():
    from api.middleware.auth import check_login_rate_limit, _login_attempts
    _login_attempts.clear()
    for _ in range(10):
        check_login_rate_limit(_make_request("10.0.1.1"))
    # Different IP should not be blocked
    check_login_rate_limit(_make_request("10.0.1.2"))


# ── Token creation / password hashing ────────────────────────────────────────

def test_hash_and_verify_password():
    from api.middleware.auth import hash_password, verify_password
    pw = "correct-horse-battery-staple"
    hashed = hash_password(pw)
    assert verify_password(pw, hashed)
    assert not verify_password("wrong", hashed)


def test_create_access_token_is_string():
    from api.middleware.auth import create_access_token
    with patch("api.middleware.auth.settings") as mock_settings:
        mock_settings.APP_SECRET_KEY = "test-secret-key-32-characters-ok"
        token = create_access_token("user-123", "user@example.com")
    assert isinstance(token, str)
    assert len(token) > 0
