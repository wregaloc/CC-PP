from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies.auth import require_admin
from app.dependencies.db import get_db
from app.models.user import User
from app.schemas.admin_system import SystemSummary
from app.services import admin_system_service

router = APIRouter(prefix="/admin/system", tags=["admin-system"])


@router.get(
    "/summary",
    response_model=SystemSummary,
    summary="Resumen del sistema",
    description="Estado de la API/Supabase, conteos de usuarios/clientes/equipo, última carga y "
    "última actualización de datos. Rol requerido: admin.",
    responses={401: {"description": "No autenticado"}, 403: {"description": "Solo Admin"}},
)
async def get_system_summary(
    admin: User = Depends(require_admin),
    session: AsyncSession = Depends(get_db),
) -> SystemSummary:
    return await admin_system_service.get_summary(session)
