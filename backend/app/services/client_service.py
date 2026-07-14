"""Fase 10 §Módulo 3 (Gestión de Clientes). Solo lo invoca un Admin (verificado
por Depends(require_admin) en el router, ver [[enterprise-security]])."""

import uuid
from pathlib import Path

from fastapi import UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings
from app.dependencies.pagination import PaginationParams
from app.exceptions.clients import ClientNotFoundError, InvalidLogoImageError
from app.exceptions.uploads import FileTooLargeError
from app.models.client import Client
from app.models.user import User
from app.repositories import audit_log_repository, client_repository
from app.schemas.client import ClientOut

_MAX_LOGO_SIZE_BYTES = 2 * 1024 * 1024  # 2 MB — un logo no necesita más
_CHUNK_SIZE_BYTES = 256 * 1024

# Firmas binarias reales de cada formato soportado — se valida el contenido,
# no la extensión declarada por el cliente (ver [[enterprise-security]]).
# PNG y JPEG se identifican por los primeros bytes; WEBP es un contenedor
# RIFF, así que además hay que confirmar el fourcc "WEBP" en el byte 8.
_PNG_MAGIC = b"\x89PNG\r\n\x1a\n"
_JPEG_MAGIC = b"\xff\xd8\xff"
_RIFF_MAGIC = b"RIFF"
_WEBP_FOURCC = b"WEBP"


def _detect_extension(header: bytes) -> str | None:
    if header.startswith(_PNG_MAGIC):
        return ".png"
    if header.startswith(_JPEG_MAGIC):
        return ".jpg"
    if header.startswith(_RIFF_MAGIC) and header[8:12] == _WEBP_FOURCC:
        return ".webp"
    return None


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


async def set_logo(
    session: AsyncSession,
    settings: Settings,
    actor: User,
    client_id: uuid.UUID,
    upload_file: UploadFile,
) -> ClientOut:
    client = await _get_client_model(session, client_id)

    storage_dir = Path(settings.client_logo_storage_dir)
    storage_dir.mkdir(parents=True, exist_ok=True)

    header = await upload_file.read(12)
    extension = _detect_extension(header)
    if extension is None:
        await upload_file.close()
        raise InvalidLogoImageError

    destination = storage_dir / f"{client_id}{extension}"
    size = len(header)
    try:
        with destination.open("wb") as buffer:
            buffer.write(header)
            while chunk := await upload_file.read(_CHUNK_SIZE_BYTES):
                size += len(chunk)
                if size > _MAX_LOGO_SIZE_BYTES:
                    raise FileTooLargeError(size_bytes=size, max_bytes=_MAX_LOGO_SIZE_BYTES)
                buffer.write(chunk)
    except FileTooLargeError:
        destination.unlink(missing_ok=True)
        raise
    finally:
        await upload_file.close()

    # Si el cliente ya tenía un logo con otra extensión, no dejar el archivo
    # viejo huérfano en disco (p. ej. reemplazar un .png por un .jpg).
    if client.logo_path and client.logo_path != str(destination):
        Path(client.logo_path).unlink(missing_ok=True)

    updated = await client_repository.set_logo_path(session, client, logo_path=str(destination))
    await audit_log_repository.record(
        session, action="CLIENT_LOGO_UPDATE", user_id=actor.id, extra={"client_id": str(client_id)}
    )
    await session.commit()
    await session.refresh(updated)  # ver comentario en update_client sobre onupdate
    user_count = await client_repository.count_users(session, client_id)
    return ClientOut.from_model(updated, user_count=user_count)


async def get_logo_path(session: AsyncSession, client_id: uuid.UUID) -> str:
    client = await _get_client_model(session, client_id)
    if client.logo_path is None:
        raise ClientNotFoundError
    return client.logo_path


async def _get_client_model(session: AsyncSession, client_id: uuid.UUID) -> Client:
    client = await client_repository.get_by_id(session, client_id)
    if client is None:
        raise ClientNotFoundError
    return client
