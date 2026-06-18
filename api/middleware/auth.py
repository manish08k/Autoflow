"""JWT authentication middleware."""
import time
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import Cookie, Depends, HTTPException, Request, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from core.config import settings
from storage.database import get_db
from storage.models import User

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 24h

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto", bcrypt__rounds=12)
bearer_scheme = HTTPBearer(auto_error=False)

# ── In-process login rate limiter ────────────────────────────────────────────
# Keyed by IP. Tracks (attempt_count, window_start).
# For multi-replica deployments swap this dict for a Redis-backed counter.
_login_attempts: dict[str, tuple[int, float]] = defaultdict(lambda: (0, 0.0))
_LOGIN_MAX_ATTEMPTS = 10
_LOGIN_WINDOW_SECONDS = 60


def check_login_rate_limit(request: Request) -> None:
    ip = request.client.host if request.client else "unknown"
    count, window_start = _login_attempts[ip]
    now = time.monotonic()
    if now - window_start > _LOGIN_WINDOW_SECONDS:
        _login_attempts[ip] = (1, now)
        return
    count += 1
    _login_attempts[ip] = (count, window_start)
    if count > _LOGIN_MAX_ATTEMPTS:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many login attempts. Please wait a minute.",
        )


def reset_login_rate_limit(request: Request) -> None:
    """Call on successful login to clear the counter."""
    ip = request.client.host if request.client else "unknown"
    _login_attempts.pop(ip, None)


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def create_access_token(user_id: str, email: str) -> str:
    now = datetime.now(timezone.utc)
    expire = now + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {"sub": user_id, "email": email, "exp": expire, "iat": now}
    return jwt.encode(payload, settings.APP_SECRET_KEY, algorithm=ALGORITHM)


async def _user_from_token(token: str, db: AsyncSession) -> User:
    try:
        payload = jwt.decode(token, settings.APP_SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if not user_id:
            raise JWTError()
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    result = await db.execute(select(User).where(User.id == user_id, User.is_active == True))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

    return user


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    if not credentials:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    return await _user_from_token(credentials.credentials, db)


async def get_current_user_flexible(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
    oauth_token: Optional[str] = Cookie(default=None, alias="oauth_token"),
    db: AsyncSession = Depends(get_db),
) -> User:
    """
    Accepts JWT from Authorization header (primary) or a short-lived
    HttpOnly cookie named `oauth_token` (used only during the OAuth
    redirect dance — the cookie is set by /oauth/connect and consumed
    once the SPA reads it via /api/auth/me, then cleared).
    No longer accepts the token as a URL query parameter.
    """
    if credentials:
        return await _user_from_token(credentials.credentials, db)
    if oauth_token:
        return await _user_from_token(oauth_token, db)
    raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
