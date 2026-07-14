from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.client import Client
from app.models.enums import UploadStatus, UserRole
from app.models.upload_log import UploadLog
from app.models.user import User


async def check_database_status(session: AsyncSession) -> bool:
    """SELECT 1 — Fase 10 §Módulo 1 "Estado de Supabase". Cualquier excepción
    de la capa de DB se interpreta como caído (fail closed en la lectura de
    estado, no en el sentido de autorización — ver [[enterprise-security]])."""
    try:
        await session.execute(select(1))
        return True
    except SQLAlchemyError:
        return False


async def count_users_by_roles(session: AsyncSession, roles: list[UserRole]) -> int:
    result = await session.execute(
        select(func.count()).select_from(User).where(User.role.in_(roles))
    )
    return result.scalar_one()


async def count_active_clients(session: AsyncSession) -> int:
    result = await session.execute(
        select(func.count()).select_from(Client).where(Client.is_active.is_(True))
    )
    return result.scalar_one()


async def get_last_upload(session: AsyncSession) -> UploadLog | None:
    """Intento de carga más reciente, sin importar el resultado."""
    result = await session.execute(
        select(UploadLog)
        .options(selectinload(UploadLog.uploaded_by))
        .order_by(UploadLog.started_at.desc())
        .limit(1)
    )
    return result.scalar_one_or_none()


async def get_last_successful_update_at(session: AsyncSession) -> datetime | None:
    """`completed_at` de la carga exitosa más reciente — cuándo se
    refrescaron por última vez los datos que ve el dashboard principal."""
    result = await session.execute(
        select(func.max(UploadLog.completed_at)).where(UploadLog.status == UploadStatus.SUCCESS)
    )
    return result.scalar_one_or_none()
