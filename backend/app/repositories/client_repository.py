import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies.pagination import PaginationParams
from app.models.client import Client
from app.models.user import User


async def get_by_id(session: AsyncSession, client_id: uuid.UUID) -> Client | None:
    result = await session.execute(select(Client).where(Client.id == client_id))
    return result.scalar_one_or_none()


async def create(session: AsyncSession, *, name: str) -> Client:
    client = Client(name=name)
    session.add(client)
    # flush (no commit): resuelve los defaults del servidor (id, created_at...)
    # para que el caller pueda serializar la respuesta ya con esos valores —
    # el commit lo hace el service al final (Unit of Work).
    await session.flush()
    return client


async def update_name(session: AsyncSession, client: Client, *, name: str) -> Client:
    client.name = name
    return client


async def set_active(session: AsyncSession, client: Client, *, is_active: bool) -> Client:
    client.is_active = is_active
    return client


async def count_users(session: AsyncSession, client_id: uuid.UUID) -> int:
    result = await session.execute(
        select(func.count()).select_from(User).where(User.client_id == client_id)
    )
    return result.scalar_one()


async def list_paginated(
    session: AsyncSession,
    pagination: PaginationParams,
    *,
    is_active: bool | None = None,
    search: str | None = None,
) -> tuple[list[tuple[Client, int]], int]:
    """Devuelve (cliente, cantidad_de_usuarios) por fila en una sola query
    (LEFT JOIN + GROUP BY) en vez de un count() por cliente — evita N+1
    (ver [[data-engineering-postgresql]])."""
    filters = []
    if is_active is not None:
        filters.append(Client.is_active == is_active)
    if search:
        filters.append(Client.name.ilike(f"%{search}%"))

    total = (
        await session.execute(select(func.count()).select_from(Client).where(*filters))
    ).scalar_one()

    result = await session.execute(
        select(Client, func.count(User.id))
        .outerjoin(User, User.client_id == Client.id)
        .where(*filters)
        .group_by(Client.id)
        .order_by(Client.name.asc())
        .offset(pagination.offset)
        .limit(pagination.page_size)
    )
    return [(client, count) for client, count in result.all()], total
