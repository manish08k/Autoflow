"""Credentials management routes."""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from storage.database import get_db
from storage.models import OAuthCredential
from api.middleware.auth import get_current_user
from oauth.flow import get_access_token

router = APIRouter()


class CredentialRename(BaseModel):
    label: str


@router.get("")
async def list_credentials(
    provider: str = None,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    q = select(OAuthCredential).where(OAuthCredential.user_id == user.id)
    if provider:
        q = q.where(OAuthCredential.provider == provider)
    result = await db.execute(q.order_by(OAuthCredential.created_at.desc()))
    creds = result.scalars().all()
    return {"credentials": [_serialize(c) for c in creds]}


@router.get("/{credential_id}")
async def get_credential(
    credential_id: str,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    cred = await _get_owned(credential_id, user.id, db)
    return _serialize(cred)


@router.patch("/{credential_id}")
async def rename_credential(
    credential_id: str,
    body: CredentialRename,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    cred = await _get_owned(credential_id, user.id, db)
    cred.label = body.label
    await db.commit()
    return _serialize(cred)


@router.post("/{credential_id}/test")
async def test_credential(
    credential_id: str,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    cred = await _get_owned(credential_id, user.id, db)
    try:
        token = await get_access_token(credential_id, db)
        return {"valid": True, "provider": cred.provider}
    except Exception as e:
        cred.is_valid = False
        await db.commit()
        return {"valid": False, "error": str(e)}


async def _get_owned(credential_id: str, user_id: str, db: AsyncSession) -> OAuthCredential:
    result = await db.execute(
        select(OAuthCredential).where(
            OAuthCredential.id == credential_id,
            OAuthCredential.user_id == user_id,
        )
    )
    cred = result.scalar_one_or_none()
    if not cred:
        raise HTTPException(status_code=404, detail="Credential not found")
    return cred


def _serialize(c: OAuthCredential) -> dict:
    return {
        "id": c.id,
        "provider": c.provider,
        "label": c.label,
        "scope": c.scope,
        "external_account_id": c.external_account_id,
        "external_account_name": c.external_account_name,
        "is_valid": c.is_valid,
        "created_at": c.created_at.isoformat(),
        "updated_at": c.updated_at.isoformat(),
    }
