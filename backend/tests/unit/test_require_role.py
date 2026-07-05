import pytest

from app.dependencies.auth import require_admin, require_role
from app.exceptions.auth import InsufficientRoleError
from app.models.enums import UserRole
from app.models.user import User


def _user(role: UserRole) -> User:
    return User(role=role, is_active=True, email="x@example.com", password_hash="h", full_name="X")


async def test_require_role_allows_user_with_matching_role() -> None:
    check = require_role(UserRole.ADMIN, UserRole.INTERNO)

    result = await check(user=_user(UserRole.INTERNO))

    assert result.role == UserRole.INTERNO


async def test_require_role_rejects_user_without_matching_role() -> None:
    check = require_role(UserRole.ADMIN)

    with pytest.raises(InsufficientRoleError):
        await check(user=_user(UserRole.CLIENTE))


async def test_require_admin_rejects_non_admin() -> None:
    with pytest.raises(InsufficientRoleError):
        await require_admin(user=_user(UserRole.INTERNO))


async def test_require_admin_allows_admin() -> None:
    result = await require_admin(user=_user(UserRole.ADMIN))

    assert result.role == UserRole.ADMIN
