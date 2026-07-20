"""Orquesta las consultas de dashboard_repository y las mapea a los schemas de
respuesta — ver [[fastapi-enterprise-backend]] (routers solo orquestan, la
lógica de agregación vive en el repository, no aquí ni en el router)."""

from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies.dashboard_filters import DateRangeParams
from app.exceptions.dashboard import HorarioAudienciaFiltroInvalidoError
from app.models.enums import ProgramType
from app.repositories import dashboard_repository
from app.schemas.dashboard import (
    AuspiciadorTopItem,
    AuspicioBusquedaItem,
    AuspicioOut,
    EvolutivoPoint,
    Granularidad,
    HorarioAudienciaPoint,
    KeywordOut,
    KpisResponse,
    MetricaSecundaria,
    PeriodoDisponibleResponse,
    ProgramaRankingItem,
    SentimentKpisResponse,
    SentimientoEvolutivoPoint,
    SentimientoFiltro,
)
from app.services import forecast_service


async def get_kpis(
    session: AsyncSession,
    filters: DateRangeParams,
    programa: str | None,
    canal: str | None,
    categoria: str | None = None,
    tipo: ProgramType | None = None,
) -> KpisResponse:
    data = await dashboard_repository.get_kpis(session, filters, programa, canal, categoria, tipo)
    return KpisResponse(**data)


async def get_sentiment_kpis(
    session: AsyncSession, filters: DateRangeParams, programa: str | None
) -> SentimentKpisResponse:
    data = await dashboard_repository.get_sentiment_kpis(session, filters, programa)
    return SentimentKpisResponse(**data)


async def get_auspicios(
    session: AsyncSession, programa: str | None, mes: int | None
) -> list[AuspicioOut]:
    rows = await dashboard_repository.get_auspicios(session, programa, mes)
    return [AuspicioOut(**row) for row in rows]


async def get_auspicios_por_marca(
    session: AsyncSession, query_texto: str
) -> list[AuspicioBusquedaItem]:
    rows = await dashboard_repository.get_auspicios_por_marca(session, query_texto)
    return [AuspicioBusquedaItem(**row) for row in rows]


async def get_top_auspiciadores(session: AsyncSession, limit: int) -> list[AuspiciadorTopItem]:
    rows = await dashboard_repository.get_top_auspiciadores(session, limit)
    return [AuspiciadorTopItem(**row) for row in rows]


async def get_evolutivo(
    session: AsyncSession,
    filters: DateRangeParams,
    granularidad: Granularidad,
    metrica_secundaria: MetricaSecundaria,
    programa: str | None,
    canal: str | None,
    categoria: str | None = None,
    tipo: ProgramType | None = None,
    incluir_forecast: bool = False,
) -> list[EvolutivoPoint]:
    points = await dashboard_repository.get_evolutivo(
        session, filters, granularidad, metrica_secundaria, programa, canal, categoria, tipo
    )
    result = [EvolutivoPoint(**point) for point in points]
    if incluir_forecast:
        result = forecast_service.con_proyeccion(result, granularidad)
    return result


async def get_ranking_programas(
    session: AsyncSession,
    filters: DateRangeParams,
    canal: str | None,
    tipo: ProgramType | None,
    formato: str | None,
    limit: int,
    q: str | None = None,
    programa_asegurado: str | None = None,
    categoria: str | None = None,
) -> list[ProgramaRankingItem]:
    items = await dashboard_repository.get_ranking_programas(
        session, filters, canal, tipo, formato, limit, q, programa_asegurado, categoria
    )
    return [ProgramaRankingItem(**item) for item in items]


async def get_keywords(
    session: AsyncSession,
    programa: str | None,
    mes: list[int] | None,
    sentimiento: SentimientoFiltro,
    limit: int,
) -> list[KeywordOut]:
    items = await dashboard_repository.get_keywords(session, programa, mes, sentimiento, limit)
    return [KeywordOut(**item) for item in items]


async def get_sentimiento_evolutivo(
    session: AsyncSession, programa: str | None, filters: DateRangeParams
) -> list[SentimientoEvolutivoPoint]:
    points = await dashboard_repository.get_sentimiento_evolutivo(session, programa, filters)
    return [SentimientoEvolutivoPoint(**point) for point in points]


async def get_filter_programas(session: AsyncSession) -> list[str]:
    return await dashboard_repository.get_filter_programas(session)


async def get_filter_canales(session: AsyncSession) -> list[str]:
    return await dashboard_repository.get_filter_canales(session)


async def get_filter_categorias(session: AsyncSession) -> list[str]:
    return await dashboard_repository.get_filter_categorias(session)


async def get_filter_periodos(session: AsyncSession) -> PeriodoDisponibleResponse:
    data = await dashboard_repository.get_filter_periodos(session)
    return PeriodoDisponibleResponse(**data)


async def get_horario_audiencia(
    session: AsyncSession,
    filters: DateRangeParams,
    programa: str | None,
    canal: str | None,
    tipo: ProgramType | None = None,
) -> list[HorarioAudienciaPoint]:
    if (programa is None) == (canal is None):
        raise HorarioAudienciaFiltroInvalidoError()
    rows = await dashboard_repository.get_horario_audiencia(session, filters, programa, canal, tipo)
    return [HorarioAudienciaPoint(**row) for row in rows]
