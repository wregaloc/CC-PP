from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies.auth import require_authenticated
from app.dependencies.db import get_db
from app.models.user import User
from app.schemas.dashboard import PeriodoDisponibleResponse
from app.services import dashboard_service

router = APIRouter(prefix="/filters", tags=["filters"])

_AUTH_RESPONSES = {401: {"description": "No autenticado"}}


@router.get(
    "/programas",
    response_model=list[str],
    summary="Programas disponibles",
    description="Rol requerido: cualquier usuario autenticado.",
    responses=_AUTH_RESPONSES,
)
async def get_filter_programas(
    user: User = Depends(require_authenticated),
    session: AsyncSession = Depends(get_db),
) -> list[str]:
    return await dashboard_service.get_filter_programas(session)


@router.get(
    "/canales",
    response_model=list[str],
    summary="Canales disponibles",
    description="Rol requerido: cualquier usuario autenticado.",
    responses=_AUTH_RESPONSES,
)
async def get_filter_canales(
    user: User = Depends(require_authenticated),
    session: AsyncSession = Depends(get_db),
) -> list[str]:
    return await dashboard_service.get_filter_canales(session)


@router.get(
    "/categorias",
    response_model=list[str],
    summary="Categorías disponibles",
    description="Rol requerido: cualquier usuario autenticado.",
    responses=_AUTH_RESPONSES,
)
async def get_filter_categorias(
    user: User = Depends(require_authenticated),
    session: AsyncSession = Depends(get_db),
) -> list[str]:
    return await dashboard_service.get_filter_categorias(session)


@router.get(
    "/periodos",
    response_model=PeriodoDisponibleResponse,
    summary="Rango de fechas disponible",
    description="Rol requerido: cualquier usuario autenticado.",
    responses=_AUTH_RESPONSES,
)
async def get_filter_periodos(
    user: User = Depends(require_authenticated),
    session: AsyncSession = Depends(get_db),
) -> PeriodoDisponibleResponse:
    return await dashboard_service.get_filter_periodos(session)
