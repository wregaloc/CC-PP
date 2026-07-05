from collections.abc import Callable, Coroutine
from typing import Any

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings, get_settings
from app.core.security import InvalidTokenError, TokenType, decode_typed_token
from app.dependencies.db import get_db
from app.exceptions.auth import AccountInactiveError, InsufficientRoleError
from app.models.enums import UserRole
from app.models.user import User
from app.repositories import user_repository

# auto_error=False: por defecto HTTPBearer responde 403 "Not authenticated" si no
# hay header — se maneja aquí para que la falta de token también sea 401 TOKEN_INVALID,
# consistente con el resto de fallos de autenticación (ver TDD §8.10).
_bearer_scheme = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer_scheme),
    session: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> User:
    """Valida el access token y re-consulta el usuario en BD en cada request.

    TDD §9.2: el claim `is_active` del JWT es el estado al momento de emisión;
    aquí se re-valida contra BD para que un usuario desactivado después de emitir
    el token reciba 401 de inmediato (fail closed), sin esperar a que expire.
    """
    if credentials is None:
        raise InvalidTokenError

    decoded = decode_typed_token(
        credentials.credentials, settings.jwt_secret_key, settings.jwt_algorithm, TokenType.ACCESS
    )

    user = await user_repository.get_by_id(session, decoded.user_id)
    if user is None or not user.is_active:
        raise AccountInactiveError

    return user


def require_role(
    *allowed_roles: UserRole,
) -> Callable[[User], Coroutine[Any, Any, User]]:
    """Factory de dependencia: exige que el usuario autenticado tenga uno de los
    roles indicados. Ver [[enterprise-security]] — autorización siempre en backend."""

    async def _check_role(user: User = Depends(get_current_user)) -> User:
        if user.role not in allowed_roles:
            raise InsufficientRoleError
        return user

    return _check_role


require_admin = require_role(UserRole.ADMIN)
require_authenticated = get_current_user
