"""Reglas de negocio de administración de usuarios (TDD §8.9, §5.3).

Solo lo invoca un Admin (verificado por Depends(require_admin) en el router,
ver [[enterprise-security]] — autorización siempre en backend).
"""

import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password
from app.dependencies.pagination import PaginationParams
from app.exceptions.admin_users import (
    CannotChangeOwnRoleError,
    EmailAlreadyExistsError,
    UserNotFoundError,
)
from app.models.enums import UserRole
from app.models.user import User
from app.repositories import audit_log_repository, user_repository


async def create_user(
    session: AsyncSession,
    actor: User,
    *,
    email: str,
    full_name: str,
    role: UserRole,
    password: str,
    cargo: str | None = None,
    client_id: uuid.UUID | None = None,
) -> User:
    if await user_repository.get_by_email(session, email) is not None:
        raise EmailAlreadyExistsError

    user = await user_repository.create(
        session,
        email=email,
        password_hash=hash_password(password),
        full_name=full_name,
        role=role,
        created_by_id=actor.id,
        cargo=cargo,
        client_id=client_id,
    )
    await audit_log_repository.record(
        session,
        action="USER_CREATE",
        user_id=actor.id,
        extra={"new_user_id": str(user.id), "role": role.value},
    )
    await session.commit()
    return user


async def get_user(session: AsyncSession, user_id: uuid.UUID) -> User:
    user = await user_repository.get_by_id(session, user_id)
    if user is None:
        raise UserNotFoundError
    return user


async def list_users(
    session: AsyncSession,
    pagination: PaginationParams,
    *,
    role: list[UserRole] | None,
    is_active: bool | None,
    client_id: uuid.UUID | None = None,
) -> tuple[list[User], int]:
    return await user_repository.list_paginated(
        session, pagination, role=role, is_active=is_active, client_id=client_id
    )


async def update_user(
    session: AsyncSession,
    actor: User,
    user_id: uuid.UUID,
    *,
    email: str,
    full_name: str,
    role: UserRole,
    cargo: str | None = None,
    client_id: uuid.UUID | None = None,
) -> User:
    user = await get_user(session, user_id)

    if user.id == actor.id and role != user.role:
        raise CannotChangeOwnRoleError

    if email != user.email and await user_repository.get_by_email(session, email) is not None:
        raise EmailAlreadyExistsError

    fields_changed = [
        field
        for field, old, new in (
            ("email", user.email, email),
            ("full_name", user.full_name, full_name),
            ("role", user.role, role),
            ("cargo", user.cargo, cargo),
            ("client_id", user.client_id, client_id),
        )
        if old != new
    ]

    updated = await user_repository.update_profile(
        session,
        user,
        email=email,
        full_name=full_name,
        role=role,
        cargo=cargo,
        client_id=client_id,
    )
    if fields_changed:
        await audit_log_repository.record(
            session,
            action="USER_UPDATE",
            user_id=actor.id,
            extra={"user_id": str(user.id), "fields_changed": fields_changed},
        )
    await session.commit()
    return updated


async def toggle_active(session: AsyncSession, actor: User, user_id: uuid.UUID) -> User:
    user = await get_user(session, user_id)
    new_state = not user.is_active

    updated = await user_repository.set_active(session, user, is_active=new_state)
    await audit_log_repository.record(
        session,
        action="USER_ACTIVATE" if new_state else "USER_DEACTIVATE",
        user_id=actor.id,
        extra={"user_id": str(user.id)},
    )
    await session.commit()
    return updated


async def set_password(
    session: AsyncSession, actor: User, user_id: uuid.UUID, *, new_password: str
) -> User:
    """Fase 10 §Módulo 4: el Admin fija la contraseña directamente, sin
    conocer la actual (a diferencia de auth_service.change_password)."""
    user = await get_user(session, user_id)

    await user_repository.update_password(session, user, hash_password(new_password))
    await audit_log_repository.record(
        session, action="USER_PASSWORD_RESET", user_id=actor.id, extra={"user_id": str(user.id)}
    )
    await session.commit()
    return user
