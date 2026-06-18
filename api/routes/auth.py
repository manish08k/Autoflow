"""User auth routes — register, login, token refresh, Google sign-in."""
import base64
import hashlib
import os
import secrets
import uuid
from datetime import datetime, timedelta
from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import RedirectResponse, Response
from pydantic import BaseModel, EmailStr
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from core.config import settings
from credentials.encryption import encrypt_credential
from oauth.providers import PROVIDERS
from storage.database import get_db
from storage.models import User, GoogleLoginState, OAuthCredential
from api.middleware.auth import (
    hash_password, verify_password, create_access_token, get_current_user,
    check_login_rate_limit, reset_login_rate_limit
)

router = APIRouter(prefix="/api/auth", tags=["Auth"])


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


@router.post("/register", status_code=201)
async def register(body: RegisterRequest, db: AsyncSession = Depends(get_db)):
    existing = await db.execute(select(User).where(User.email == body.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")

    user = User(
        id=str(uuid.uuid4()),
        email=body.email,
        hashed_password=hash_password(body.password),
    )
    db.add(user)
    await db.commit()
    token = create_access_token(user.id, user.email)
    return {"access_token": token, "token_type": "bearer", "user_id": user.id}


@router.post("/login")
async def login(body: LoginRequest, request: Request, db: AsyncSession = Depends(get_db)):
    check_login_rate_limit(request)
    result = await db.execute(select(User).where(User.email == body.email, User.is_active == True))
    user = result.scalar_one_or_none()
    if not user or not verify_password(body.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    token = create_access_token(user.id, user.email)
    reset_login_rate_limit(request)
    return {"access_token": token, "token_type": "bearer", "user_id": user.id}


@router.get("/me")
async def me(user: User = Depends(get_current_user)):
    return {
        "id": user.id,
        "email": user.email,
        "is_admin": user.is_admin,
        "created_at": user.created_at.isoformat(),
    }


# ─── Sign in with Google ──────────────────────────────────────────────────
#
# Flow:
#   1. GET /api/auth/google/login    -> redirect to Google's consent screen
#   2. GET /api/auth/google/callback -> exchange code, upsert user, save an
#                                        OAuthCredential, redirect to the
#                                        frontend with ?google_token=...
#
# This sign-in flow now requests the SAME scopes as /oauth/connect/google
# (Gmail, Sheets, Drive, Calendar) so that signing in with Google also
# connects the integration credential in one step — no separate "Connect"
# click needed on the Credentials page.

def _pkce_pair() -> tuple[str, str]:
    verifier = base64.urlsafe_b64encode(os.urandom(32)).rstrip(b"=").decode()
    challenge = base64.urlsafe_b64encode(
        hashlib.sha256(verifier.encode()).digest()
    ).rstrip(b"=").decode()
    return verifier, challenge


@router.get("/google/login")
async def google_login(db: AsyncSession = Depends(get_db)):
    provider = PROVIDERS["google"]
    if not provider.client_id_getter():
        raise HTTPException(
            status_code=501,
            detail="Google sign-in is not configured. Set GOOGLE_CLIENT_ID in environment.",
        )

    state_token = secrets.token_urlsafe(32)
    verifier, challenge = _pkce_pair()
    db.add(GoogleLoginState(
        state=state_token,
        extra={"pkce_verifier": verifier},
        expires_at=datetime.utcnow() + timedelta(minutes=10),
    ))
    await db.commit()

    params = {
        "client_id": provider.client_id_getter(),
        "redirect_uri": f"{settings.APP_BASE_URL}/api/auth/google/callback",
        "response_type": "code",
        "scope": " ".join(provider.default_scopes),
        "state": state_token,
        "code_challenge": challenge,
        "code_challenge_method": "S256",
        # Request a refresh token so the connected credential keeps working
        # after the access token expires.
        "access_type": "offline",
        "prompt": "consent",
    }
    return RedirectResponse(url=f"{provider.authorization_url}?{urlencode(params)}")


@router.get("/google/callback")
async def google_callback(
    code: str | None = Query(default=None),
    state: str | None = Query(default=None),
    error: str | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
):
    def _fail(reason: str) -> RedirectResponse:
        return RedirectResponse(url=f"{settings.frontend_url}/login?error={reason}")

    if error or not code or not state:
        return _fail("google_auth_failed")

    # Validate + consume state (CSRF / replay protection)
    result = await db.execute(
        select(GoogleLoginState).where(
            GoogleLoginState.state == state,
            GoogleLoginState.used == False,
            GoogleLoginState.expires_at > datetime.utcnow(),
        )
    )
    state_row = result.scalar_one_or_none()
    if not state_row:
        return _fail("invalid_state")
    state_row.used = True
    await db.flush()

    provider = PROVIDERS["google"]
    redirect_uri = f"{settings.APP_BASE_URL}/api/auth/google/callback"

    try:
        async with httpx.AsyncClient() as client:
            token_resp = await client.post(
                provider.token_url,
                data={
                    "grant_type": "authorization_code",
                    "code": code,
                    "redirect_uri": redirect_uri,
                    "client_id": provider.client_id_getter(),
                    "client_secret": provider.client_secret_getter(),
                    "code_verifier": state_row.extra.get("pkce_verifier", ""),
                },
                headers={"Accept": "application/json"},
            )
            token_resp.raise_for_status()
            token_data = token_resp.json()
            access_token = token_data["access_token"]

            userinfo_resp = await client.get(
                "https://www.googleapis.com/oauth2/v3/userinfo",
                headers={"Authorization": f"Bearer {access_token}"},
            )
            userinfo_resp.raise_for_status()
            info = userinfo_resp.json()
    except (httpx.HTTPError, KeyError):
        await db.commit()
        return _fail("google_auth_failed")

    email = info.get("email")
    google_id = info.get("sub")
    if not email or not google_id:
        await db.commit()
        return _fail("google_auth_failed")
    if not info.get("email_verified", False):
        await db.commit()
        return _fail("google_email_unverified")

    # Find existing user by Google ID first, then by email (account linking)
    result = await db.execute(select(User).where(User.google_id == google_id))
    user = result.scalar_one_or_none()

    if not user:
        result = await db.execute(select(User).where(User.email == email))
        user = result.scalar_one_or_none()

    if user:
        if not user.is_active:
            await db.commit()
            return _fail("account_disabled")
        if user.google_id != google_id:
            user.google_id = google_id  # link Google identity to existing account
    else:
        user = User(
            id=str(uuid.uuid4()),
            email=email,
            # Random password — this account can only sign in via Google
            # unless the user later sets a password explicitly.
            hashed_password=hash_password(secrets.token_urlsafe(32)),
            google_id=google_id,
        )
        db.add(user)

    await db.commit()
    await db.refresh(user)

    # ── Save/refresh the Google integration credential ──────────────────
    # Same record type used by /oauth/connect/google, so it shows up
    # immediately under Credentials -> Connected, ready for workflows.
    token_data["fetched_at"] = datetime.utcnow().timestamp()
    encrypted = encrypt_credential(token_data, settings.CREDENTIAL_ENCRYPTION_KEY)

    result = await db.execute(
        select(OAuthCredential).where(
            OAuthCredential.user_id == user.id,
            OAuthCredential.provider == "google",
        )
    )
    cred = result.scalar_one_or_none()

    if "refresh_token" not in token_data and cred:
        from credentials.encryption import decrypt_credential
        old_data = decrypt_credential(cred.encrypted_token, settings.CREDENTIAL_ENCRYPTION_KEY)
        if old_data.get("refresh_token"):
            token_data["refresh_token"] = old_data["refresh_token"]
            encrypted = encrypt_credential(token_data, settings.CREDENTIAL_ENCRYPTION_KEY)

    if cred:
        cred.encrypted_token = encrypted
        cred.scope = token_data.get("scope", "")
        cred.is_valid = True
        cred.external_account_id = google_id
        cred.external_account_name = email
        cred.updated_at = datetime.utcnow()
    else:
        db.add(OAuthCredential(
            user_id=user.id,
            provider="google",
            label=provider.display_name,
            scope=token_data.get("scope", ""),
            encrypted_token=encrypted,
            external_account_id=google_id,
            external_account_name=email,
            is_valid=True,
        ))
    await db.commit()

    token = create_access_token(user.id, user.email)
    redirect = RedirectResponse(url=f"{settings.frontend_url}/")
    redirect.set_cookie(
        key="oauth_token",
        value=token,
        httponly=True,
        secure=not settings.DEBUG,
        samesite="lax",
        max_age=300,  # 5 minutes — SPA should exchange it immediately
        path="/",
    )
    return redirect