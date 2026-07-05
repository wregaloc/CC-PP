import uuid
from datetime import UTC, datetime

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies.pagination import PaginationParams
from app.models.enums import UserRole
from app.models.user import User


async def get_by_email(session: AsyncSession, email: str) -> User | None:
    result = await session.execute(select(User).where(User.email == email))
    return result.scalar_one_or_none()


async def get_by_id(session: AsyncSession, user_id: uuid.UUID) -> User | None:
    result = await session.execute(select(User).where(User.id == user_id))
    return result.scalar_one_or_none()


async def update_last_login(session: AsyncSession, user: User) -> None:
    """No hace commit — ver [[fastapi-enterprise-backend]]: la transacción la
    controla el service que orquesta la operación completa (Unit of Work),
    para poder combinar esta escritura con otras (p. ej. el audit log de
    LOGIN_SUCCESS) de forma atómica."""
    user.last_login_at = datetime.now(UTC)


async def update_password(session: AsyncSession, user: User, password_hash: str) -> None:
    user.password_hash = password_hash


async def create(
    session: AsyncSession,
    *,
    email: str,
    password_hash: str,
    full_name: str,
    role: UserRole,
    created_by_id: uuid.UUID,
) -> User:
    user = User(
        email=email,
        password_hash=password_hash,
        full_name=full_name,
        role=role,
        created_by_id=created_by_id,
    )
    session.add(user)
    # flush (no commit): resuelve los defaults del servidor (id, created_at...)
    # para que el caller pueda serializar la respuesta ya con esos valores,
    # sin cerrar la transacción — el commit lo hace el service al final.
    await session.flush()
    return user


async def update_profile(
    session: AsyncSession, user: User, *, email: str, full_name: str, role: UserRole
) -> User:
    user.email = email
    user.full_name = full_name
    user.role = role
    return user


async def set_active(session: AsyncSession, user: User, *, is_active: bool) -> User:
    user.is_active = is_active
    return user


async def list_paginated(
    session: AsyncSession,
    pagination: PaginationParams,
    *,
    role: UserRole | None = None,
    is_active: bool | None = None,
) -> tuple[list[User], int]:
    filters = []
    if role is not None:
        filters.append(User.role == role)
    if is_active is not None:
        filters.append(User.is_active == is_active)

    total = (
        await session.execute(select(func.count()).select_from(User).where(*filters))
    ).scalar_one()

    result = await session.execute(
        select(User)
        .where(*filters)
        .order_by(User.created_at.desc())
        .offset(pagination.offset)
        .limit(pagination.page_size)
    )
    return list(result.scalars().all()), total
