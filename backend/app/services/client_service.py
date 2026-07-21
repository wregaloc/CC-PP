"""Fase 10 §Módulo 3 (Gestión de Clientes). Solo lo invoca un Admin (verificado
por Depends(require_admin) en el router, ver [[enterprise-security]])."""

import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies.pagination import PaginationParams
from app.exceptions.clients import ClientNotFoundError
from app.models.client import Client
from app.models.user import User
from app.repositories import audit_log_repository, client_repository
from app.schemas.client import ClientOut


async def get_client(session: AsyncSession, client_id: uuid.UUID) -> ClientOut:
    client = await client_repository.get_by_id(session, client_id)
    if client is None:
        raise ClientNotFoundError
    user_count = await client_repository.count_users(session, client_id)
    return ClientOut.from_model(client, user_count=user_count)


async def list_clients(
    session: AsyncSession,
    pagination: PaginationParams,
    *,
    is_active: bool | None,
    search: str | None,
) -> tuple[list[ClientOut], int]:
    rows, total = await client_repository.list_paginated(
        session, pagination, is_active=is_active, search=search
    )
    return [ClientOut.from_model(client, user_count=count) for client, count in rows], total


async def create_client(session: AsyncSession, actor: User, *, name: str) -> ClientOut:
    client = await client_repository.create(session, name=name)
    await audit_log_repository.record(
        session, action="CLIENT_CREATE", user_id=actor.id, extra={"client_id": str(client.id)}
    )
    await session.commit()
    return ClientOut.from_model(client, user_count=0)


async def update_client(
    session: AsyncSession, actor: User, client_id: uuid.UUID, *, name: str
) -> ClientOut:
    client = await _get_client_model(session, client_id)
    updated = await client_repository.update_name(session, client, name=name)
    await audit_log_repository.record(
        session, action="CLIENT_UPDATE", user_id=actor.id, extra={"client_id": str(client_id)}
    )
    await session.commit()
    # `updated_at` tiene onupdate=func.now() (valor calculado por Postgres, no
    # por Python) — tras el UPDATE queda "expirado" en el objeto ORM y hay que
    # recargarlo con un await explícito antes de leerlo, o SQLAlchemy intenta
    # un refresh síncrono fuera de contexto async (MissingGreenlet).
    await session.refresh(updated)
    user_count = await client_repository.count_users(session, client_id)
    return ClientOut.from_model(updated, user_count=user_count)


async def toggle_active(session: AsyncSession, actor: User, client_id: uuid.UUID) -> ClientOut:
    client = await _get_client_model(session, client_id)
    new_state = not client.is_active
    updated = await client_repository.set_active(session, client, is_active=new_state)
    await audit_log_repository.record(
        session,
        action="CLIENT_ACTIVATE" if new_state else "CLIENT_DEACTIVATE",
        user_id=actor.id,
        extra={"client_id": str(client_id)},
    )
    await session.commit()
    await session.refresh(updated)  # ver comentario en update_client sobre onupdate
    user_count = await client_repository.count_users(session, client_id)
    return ClientOut.from_model(updated, user_count=user_count)


async def _get_client_model(session: AsyncSession, client_id: uuid.UUID) -> Client:
    client = await client_repository.get_by_id(session, client_id)
    if client is None:
        raise ClientNotFoundError
    return client
