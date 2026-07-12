from typing import Annotated

from fastapi import APIRouter, Depends, Query
from pydantic import Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies.auth import require_authenticated
from app.dependencies.dashboard_filters import DateRangeParams, date_range_params
from app.dependencies.db import get_db
from app.models.enums import ProgramType
from app.models.user import User
from app.schemas.dashboard import (
    AuspicioBusquedaItem,
    AuspicioOut,
    CanalLiveStatsResponse,
    CanalProgramaItem,
    CanalRankingItem,
    EvolutivoPoint,
    Granularidad,
    KeywordOut,
    KpisResponse,
    MetricaSecundaria,
    ProgramaRankingItem,
    SentimentKpisResponse,
    SentimientoEvolutivoPoint,
    SentimientoFiltro,
)
from app.services import dashboard_service

router = APIRouter(prefix="/dashboard", tags=["dashboard"])

_AUTH_RESPONSES = {401: {"description": "No autenticado"}}


@router.get(
    "/kpis",
    response_model=KpisResponse,
    summary="KPIs globales",
    description="Vistas totales, engagement, likes, comentarios, emisiones, pico máx en vivo y "
    "promedio en vivo en el rango filtrado. Rol requerido: cualquier usuario autenticado.",
    responses=_AUTH_RESPONSES,
)
async def get_kpis(
    programa: str | None = Query(default=None, description="Nombre exacto del programa"),
    canal: str | None = Query(default=None, description="Nombre exacto del canal"),
    filters: DateRangeParams = Depends(date_range_params),
    user: User = Depends(require_authenticated),
    session: AsyncSession = Depends(get_db),
) -> KpisResponse:
    return await dashboard_service.get_kpis(session, filters, programa, canal)


@router.get(
    "/sentiment-kpis",
    response_model=SentimentKpisResponse,
    summary="KPIs de sentimiento",
    description="Promedio de score positivo/negativo/neutral en el rango filtrado. "
    "Rol requerido: cualquier usuario autenticado.",
    responses=_AUTH_RESPONSES,
)
async def get_sentiment_kpis(
    programa: str | None = Query(default=None, description="Nombre exacto del programa"),
    filters: DateRangeParams = Depends(date_range_params),
    user: User = Depends(require_authenticated),
    session: AsyncSession = Depends(get_db),
) -> SentimentKpisResponse:
    return await dashboard_service.get_sentiment_kpis(session, filters, programa)


@router.get(
    "/auspicios",
    response_model=list[AuspicioOut],
    summary="Marcas auspiciadoras",
    description="Lista de auspiciadores (sin duplicados) filtrada por programa/mes. "
    "Rol requerido: cualquier usuario autenticado.",
    responses=_AUTH_RESPONSES,
)
async def get_auspicios(
    programa: str | None = Query(default=None, description="Nombre exacto del programa"),
    mes: int | None = Query(default=None, ge=1, le=12, description="Mes numérico (1-12)"),
    user: User = Depends(require_authenticated),
    session: AsyncSession = Depends(get_db),
) -> list[AuspicioOut]:
    return await dashboard_service.get_auspicios(session, programa, mes)


@router.get(
    "/auspicios/buscar",
    response_model=list[AuspicioBusquedaItem],
    summary="Búsqueda de programas por marca auspiciadora",
    description="Búsqueda inversa a /auspicios: dado un texto de marca (ej. 'BCP'), devuelve "
    "los programas/canales donde aparece como auspiciador — coincidencia parcial, "
    "case-insensitive, sin exigir elegir un programa primero. Rol requerido: cualquier "
    "usuario autenticado.",
    responses=_AUTH_RESPONSES,
)
async def buscar_auspicios(
    q: str = Query(min_length=2, description="Texto a buscar en el nombre del auspiciador"),
    user: User = Depends(require_authenticated),
    session: AsyncSession = Depends(get_db),
) -> list[AuspicioBusquedaItem]:
    return await dashboard_service.get_auspicios_por_marca(session, q)


@router.get(
    "/evolutivo",
    response_model=list[EvolutivoPoint],
    summary="Gráfico evolutivo de vistas",
    description="Serie temporal de vistas_totales + una métrica secundaria (emisiones o "
    "búsquedas), agrupada según la granularidad elegida. Rol requerido: cualquier usuario "
    "autenticado.",
    responses=_AUTH_RESPONSES,
)
async def get_evolutivo(
    granularidad: Granularidad = Query(description="anio | mes | semana | dia"),
    metrica_secundaria: MetricaSecundaria = Query(description="emisiones | busquedas"),
    programa: str | None = Query(default=None, description="Nombre exacto del programa"),
    canal: str | None = Query(default=None, description="Nombre exacto del canal"),
    filters: DateRangeParams = Depends(date_range_params),
    user: User = Depends(require_authenticated),
    session: AsyncSession = Depends(get_db),
) -> list[EvolutivoPoint]:
    return await dashboard_service.get_evolutivo(
        session, filters, granularidad, metrica_secundaria, programa, canal
    )


@router.get(
    "/ranking/programas",
    response_model=list[ProgramaRankingItem],
    summary="Ranking de programas por vistas",
    description="Rol requerido: cualquier usuario autenticado.",
    responses=_AUTH_RESPONSES,
)
async def get_ranking_programas(
    canal: str | None = Query(default=None, description="Nombre exacto del canal"),
    tipo: ProgramType | None = Query(default=None, description="podcast | programa"),
    formato: str | None = Query(default=None, description="Grabado | Vivo | Finalizado"),
    limit: int = Query(default=20, ge=1, le=100),
    filters: DateRangeParams = Depends(date_range_params),
    user: User = Depends(require_authenticated),
    session: AsyncSession = Depends(get_db),
) -> list[ProgramaRankingItem]:
    return await dashboard_service.get_ranking_programas(
        session, filters, canal, tipo, formato, limit
    )


@router.get(
    "/ranking/canales",
    response_model=list[CanalRankingItem],
    summary="Ranking de canales por vistas",
    description="Rol requerido: cualquier usuario autenticado.",
    responses=_AUTH_RESPONSES,
)
async def get_ranking_canales(
    limit: int = Query(default=20, ge=1, le=100),
    filters: DateRangeParams = Depends(date_range_params),
    user: User = Depends(require_authenticated),
    session: AsyncSession = Depends(get_db),
) -> list[CanalRankingItem]:
    return await dashboard_service.get_ranking_canales(session, filters, limit)


@router.get(
    "/canal/{canal_id}/programas",
    response_model=list[CanalProgramaItem],
    summary="Programas de un canal",
    description="`canal_id` es el nombre del canal (no existe una tabla de canales separada "
    "en el esquema — ver docs/API.md, sección de supuestos). Rol requerido: cualquier usuario "
    "autenticado.",
    responses=_AUTH_RESPONSES,
)
async def get_canal_programas(
    canal_id: str,
    categoria: str | None = Query(default=None),
    filters: DateRangeParams = Depends(date_range_params),
    user: User = Depends(require_authenticated),
    session: AsyncSession = Depends(get_db),
) -> list[CanalProgramaItem]:
    return await dashboard_service.get_canal_programas(session, canal_id, filters, categoria)


@router.get(
    "/canal/{canal_id}/live-stats",
    response_model=CanalLiveStatsResponse,
    summary="Estadísticas de audiencia en vivo de un canal",
    description="`canal_id` es el nombre del canal (ver nota en /canal/{canal_id}/programas). "
    "Rol requerido: cualquier usuario autenticado.",
    responses=_AUTH_RESPONSES,
)
async def get_canal_live_stats(
    canal_id: str,
    filters: DateRangeParams = Depends(date_range_params),
    user: User = Depends(require_authenticated),
    session: AsyncSession = Depends(get_db),
) -> CanalLiveStatsResponse:
    return await dashboard_service.get_canal_live_stats(session, canal_id, filters)


@router.get(
    "/keywords",
    response_model=list[KeywordOut],
    summary="Hashtags/keywords más frecuentes",
    description="Ordenado por occurrences DESC (equivalente al tamaño de palabra en la nube "
    "original). Rol requerido: cualquier usuario autenticado.",
    responses=_AUTH_RESPONSES,
)
async def get_keywords(
    programa: str | None = Query(default=None, description="Nombre exacto del programa"),
    mes: list[Annotated[int, Field(ge=1, le=12)]] | None = Query(
        default=None, description="Uno o más meses (?mes=4&mes=5)"
    ),
    sentimiento: SentimientoFiltro = Query(default=SentimientoFiltro.TODOS),
    limit: int = Query(default=100, ge=1, le=500),
    user: User = Depends(require_authenticated),
    session: AsyncSession = Depends(get_db),
) -> list[KeywordOut]:
    return await dashboard_service.get_keywords(session, programa, mes, sentimiento, limit)


@router.get(
    "/sentimiento/evolutivo",
    response_model=list[SentimientoEvolutivoPoint],
    summary="Evolución mensual de sentimiento",
    description="Rol requerido: cualquier usuario autenticado.",
    responses=_AUTH_RESPONSES,
)
async def get_sentimiento_evolutivo(
    programa: str | None = Query(default=None, description="Nombre exacto del programa"),
    filters: DateRangeParams = Depends(date_range_params),
    user: User = Depends(require_authenticated),
    session: AsyncSession = Depends(get_db),
) -> list[SentimientoEvolutivoPoint]:
    return await dashboard_service.get_sentimiento_evolutivo(session, programa, filters)
