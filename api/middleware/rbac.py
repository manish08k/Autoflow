"""RBAC — role-based permission checks as FastAPI dependencies."""
from fastapi import Depends, HTTPException, status

from api.middleware.auth import get_current_user
from storage.models import User

ROLE_RANK = {"owner": 4, "admin": 3, "editor": 2, "viewer": 1}

PERMISSIONS: dict[str, list[str]] = {
    "workflow:read":       ["viewer", "editor", "admin", "owner"],
    "workflow:create":     ["editor", "admin", "owner"],
    "workflow:update":     ["editor", "admin", "owner"],
    "workflow:delete":     ["admin", "owner"],
    "workflow:execute":    ["editor", "admin", "owner"],
    "member:read":         ["viewer", "editor", "admin", "owner"],
    "member:invite":       ["admin", "owner"],
    "member:remove":       ["admin", "owner"],
    "member:role":         ["owner"],
    "audit:read":          ["admin", "owner"],
    "org:settings":        ["owner"],
    "marketplace:publish": ["editor", "admin", "owner"],
    "dlq:replay":          ["admin", "owner"],
}


def require_permission(permission: str):
    async def _checker(user: User = Depends(get_current_user)) -> User:
        if not user.org_id or not user.role:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not part of an organization")
        allowed = PERMISSIONS.get(permission, [])
        if user.role.value not in allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Requires one of roles {allowed} for '{permission}', you have '{user.role.value}'",
            )
        return user
    return _checker


def require_role(min_role: str):
    async def _checker(user: User = Depends(get_current_user)) -> User:
        if not user.role:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not part of an organization")
        if ROLE_RANK.get(user.role.value, 0) < ROLE_RANK.get(min_role, 0):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=f"Requires {min_role} role or above")
        return user
    return _checker
