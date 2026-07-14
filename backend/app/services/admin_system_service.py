"""Fase 10 §Módulo 1 (Dashboard del Sistema) — resumen de salud y actividad
de la plataforma para el panel de administración."""

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import UserRole
from app.repositories import admin_system_repository
from app.schemas.admin_system import SystemSummary
from app.schemas.upload import UploadLogSummary


async def get_summary(session: AsyncSession) -> SystemSummary:
    database_ok = await admin_system_repository.check_database_status(session)

    total_usuarios = await admin_system_repository.count_users_by_roles(
        session, [UserRole.CLIENTE]
    )
    total_equipo = await admin_system_repository.count_users_by_roles(
        session, [UserRole.ADMIN, UserRole.INTERNO]
    )
    total_clientes = await admin_system_repository.count_active_clients(session)
    last_upload = await admin_system_repository.get_last_upload(session)
    last_update_at = await admin_system_repository.get_last_successful_update_at(session)

    database_status = "ok" if database_ok else "down"
    overall_status = "ok" if database_ok else "degraded"

    return SystemSummary(
        api_status="ok",
        database_status=database_status,
        overall_status=overall_status,
        total_clientes=total_clientes,
        total_usuarios=total_usuarios,
        total_equipo=total_equipo,
        last_upload=UploadLogSummary.from_model(last_upload) if last_upload else None,
        last_update_at=last_update_at,
    )
