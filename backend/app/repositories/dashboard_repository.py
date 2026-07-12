"""Consultas agregadas de solo lectura para el dashboard — ver docs/API.md.

Cada función corresponde a un endpoint de docs/PODPULSE_TDD_v1.0.docx §8.3-8.7.
Las fórmulas replican las medidas DAX originales documentadas en
docs/PODPULSE_Documentacion_Migracion.docx §4 (ver referencia en cada función).
Todo se resuelve en una sola consulta agregada en Postgres (GROUP BY / window
functions) — nunca cargando filas a Python para sumar/promediar ahí.
"""

from typing import Any

from sqlalchemy import Select, func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies.dashboard_filters import DateRangeParams
from app.models.dim_auspicios import Auspicio
from app.models.dim_programa import Programa
from app.models.enums import ProgramType, SentimentType
from app.models.fact_audiencia import FactAudiencia
from app.models.fact_keywords import FactKeywords
from app.models.fact_sentimiento import FactSentimiento
from app.schemas.dashboard import Granularidad, MetricaSecundaria, SentimientoFiltro


def _apply_date_range(stmt: Select, date_column: Any, filters: DateRangeParams) -> Select:
    if filters.fecha_inicio is not None:
        stmt = stmt.where(date_column >= filters.fecha_inicio)
    if filters.fecha_fin is not None:
        stmt = stmt.where(date_column <= filters.fecha_fin)
    return stmt


def _apply_month_range_overlap(stmt: Select, month_start: Any, filters: DateRangeParams) -> Select:
    """Para tablas con grano mensual (fact_sentimiento, un solo resumen por
    mes, sin detalle diario): incluye el mes si se *solapa* con
    [fecha_inicio, fecha_fin], no solo si el día 1 del mes cae exactamente
    dentro del rango. Con `_apply_date_range` normal, un rango parcial dentro
    de un mes (p. ej. 10-20 de abril, posible desde que el date picker deja
    elegir cualquier día) excluía abril entero porque el día 1 quedaba antes
    de "Desde" — acá se compara contra el último día del mes en vez de
    exigir que el primer día esté dentro del rango."""
    month_end = month_start.op("+")(text("interval '1 month - 1 day'"))
    if filters.fecha_inicio is not None:
        stmt = stmt.where(month_end >= filters.fecha_inicio)
    if filters.fecha_fin is not None:
        stmt = stmt.where(month_start <= filters.fecha_fin)
    return stmt


def _as_float(value: Any) -> float | None:
    return float(value) if value is not None else None


async def get_kpis(
    session: AsyncSession, filters: DateRangeParams, programa: str | None, canal: str | None
) -> dict[str, Any]:
    """TDD §8.3 /dashboard/kpis. Medidas DAX: Vistas Totales=SUM(Vistas_Diarias),
    Engagement Rate=AVERAGE(Engagement), Emisiones=SUM(Es_Emision), Pico Max en
    Vivo=MAX(Pico Max), Promedio en Vivo=AVG(Promedio en Vivo), todas respetando
    Programa + Canal + fechas."""
    stmt = select(
        func.coalesce(func.sum(FactAudiencia.vistas_diarias), 0).label("vistas_totales"),
        func.avg(FactAudiencia.engagement).label("engagement_rate"),
        func.coalesce(func.sum(FactAudiencia.likes), 0).label("likes"),
        func.coalesce(func.sum(FactAudiencia.comentarios), 0).label("comentarios"),
        func.coalesce(func.sum(FactAudiencia.es_emision), 0).label("emisiones"),
        func.max(FactAudiencia.pico_max_vivo).label("pico_max_vivo"),
        func.avg(FactAudiencia.promedio_vivo).label("promedio_vivo"),
    )
    if programa is not None or canal is not None:
        stmt = stmt.join(Programa, FactAudiencia.programa_id == Programa.id)
        if programa is not None:
            stmt = stmt.where(Programa.nombre == programa)
        if canal is not None:
            stmt = stmt.where(Programa.canal == canal)
    stmt = _apply_date_range(stmt, FactAudiencia.fecha, filters)

    row = (await session.execute(stmt)).one()
    return {
        "vistas_totales": row.vistas_totales,
        "engagement_rate": _as_float(row.engagement_rate),
        "likes": row.likes,
        "comentarios": row.comentarios,
        "emisiones": row.emisiones,
        "pico_max_vivo": row.pico_max_vivo,
        "promedio_vivo": _as_float(row.promedio_vivo),
    }


async def get_sentiment_kpis(
    session: AsyncSession, filters: DateRangeParams, programa: str | None
) -> dict[str, Any]:
    """TDD §8.3 /dashboard/sentiment-kpis. Medidas DAX (tabla SPLIT SENSE):
    Sentimiento Positivo/Negativo/Neutral = AVERAGE(score).

    fact_sentimiento solo tiene grano (año, mes) — un mes se incluye si se
    solapa con [fecha_inicio, fecha_fin] (ver _apply_month_range_overlap),
    no solo si el día 1 del mes cae exactamente dentro del rango.
    """
    month_start = func.make_date(FactSentimiento.anio, FactSentimiento.mes_num, 1)
    stmt = select(
        func.avg(FactSentimiento.score_positivo).label("pct_positivo"),
        func.avg(FactSentimiento.score_negativo).label("pct_negativo"),
        func.avg(FactSentimiento.score_neutral).label("pct_neutral"),
    )
    if programa is not None:
        stmt = stmt.join(Programa, FactSentimiento.programa_id == Programa.id).where(
            Programa.nombre == programa
        )
    stmt = _apply_month_range_overlap(stmt, month_start, filters)

    row = (await session.execute(stmt)).one()
    return {
        "pct_positivo": _as_float(row.pct_positivo),
        "pct_negativo": _as_float(row.pct_negativo),
        "pct_neutral": _as_float(row.pct_neutral),
    }


async def get_auspicios(
    session: AsyncSession, programa: str | None, mes: int | None
) -> list[dict[str, Any]]:
    """TDD §8.3 /dashboard/auspicios — lista de (auspiciador, mes), sin duplicados. Incluye
    mes_num/mes_nombre para que el frontend pueda agrupar por mes cuando no se filtra un mes
    específico (ver aprobación: agrupar auspiciadores por mes en el panel de Auspicios)."""
    stmt = select(Auspicio.auspiciador, Auspicio.mes_num, Auspicio.mes_nombre).distinct()
    if programa is not None:
        stmt = stmt.join(Programa, Auspicio.programa_id == Programa.id).where(
            Programa.nombre == programa
        )
    if mes is not None:
        stmt = stmt.where(Auspicio.mes_num == mes)
    stmt = stmt.order_by(Auspicio.mes_num, Auspicio.auspiciador)

    result = await session.execute(stmt)
    return [
        {"auspiciador": row.auspiciador, "mes_num": row.mes_num, "mes_nombre": row.mes_nombre}
        for row in result
    ]


async def get_auspicios_por_marca(
    session: AsyncSession, query_texto: str
) -> list[dict[str, Any]]:
    """Búsqueda inversa a get_auspicios: dado un texto de marca (p. ej. "BCP"),
    devuelve los programas/canales donde aparece como auspiciador — coincidencia
    parcial, case-insensitive (ILIKE), sin exigir elegir un programa primero."""
    stmt = (
        select(
            Programa.nombre.label("programa"),
            Programa.canal.label("canal"),
            Auspicio.auspiciador,
            Auspicio.mes_num,
            Auspicio.mes_nombre,
        )
        .join(Programa, Auspicio.programa_id == Programa.id)
        .where(Auspicio.auspiciador.ilike(f"%{query_texto}%"))
        .distinct()
        .order_by(Programa.nombre, Auspicio.mes_num)
    )

    result = await session.execute(stmt)
    return [
        {
            "programa": row.programa,
            "canal": row.canal,
            "auspiciador": row.auspiciador,
            "mes_num": row.mes_num,
            "mes_nombre": row.mes_nombre,
        }
        for row in result
    ]


async def get_evolutivo(
    session: AsyncSession,
    filters: DateRangeParams,
    granularidad: Granularidad,
    metrica_secundaria: MetricaSecundaria,
    programa: str | None,
    canal: str | None,
) -> list[dict[str, Any]]:
    """TDD §8.4 /dashboard/evolutivo. Reemplaza la medida "KPI Vistas Promedio
    Dinámico" (que usaba CONTAINSSTRING sobre el parámetro GRANULARIDAD — TDD
    la marcó como patrón frágil a reemplazar) por un switch explícito sobre el
    enum Granularidad, agrupando siempre por columnas ya materializadas en el
    ETL (anio/mes_num/semana_num) — sin recalcular fecha en SQL."""
    vistas_col = func.coalesce(func.sum(FactAudiencia.vistas_diarias), 0)
    secondary_col = (
        func.coalesce(func.sum(FactAudiencia.es_emision), 0)
        if metrica_secundaria == MetricaSecundaria.EMISIONES
        else func.coalesce(func.sum(FactAudiencia.busquedas_diarias), 0)
    )

    if granularidad == Granularidad.DIA:
        group_cols = [FactAudiencia.fecha]
    elif granularidad == Granularidad.SEMANA:
        group_cols = [FactAudiencia.anio, FactAudiencia.semana_num]
    elif granularidad == Granularidad.MES:
        group_cols = [FactAudiencia.anio, FactAudiencia.mes_num]
    else:
        group_cols = [FactAudiencia.anio]

    stmt = select(
        *group_cols, vistas_col.label("vistas_totales"), secondary_col.label("metrica_secundaria")
    )

    if programa is not None or canal is not None:
        stmt = stmt.join(Programa, FactAudiencia.programa_id == Programa.id)
        if programa is not None:
            stmt = stmt.where(Programa.nombre == programa)
        if canal is not None:
            stmt = stmt.where(Programa.canal == canal)
    stmt = _apply_date_range(stmt, FactAudiencia.fecha, filters)
    stmt = stmt.group_by(*group_cols).order_by(*group_cols)

    rows = (await session.execute(stmt)).all()

    points: list[dict[str, Any]] = []
    for row in rows:
        values = row._mapping
        anio = values.get(FactAudiencia.anio.key)
        if granularidad == Granularidad.DIA:
            periodo = values[FactAudiencia.fecha.key].isoformat()
        elif granularidad == Granularidad.SEMANA:
            periodo = f"{anio}-W{values[FactAudiencia.semana_num.key]:02d}"
        elif granularidad == Granularidad.MES:
            periodo = f"{anio}-{values[FactAudiencia.mes_num.key]:02d}"
        else:
            periodo = str(anio)
        points.append(
            {
                "periodo": periodo,
                "vistas_totales": values["vistas_totales"],
                "metrica_secundaria": values["metrica_secundaria"],
            }
        )
    return points


async def get_ranking_programas(
    session: AsyncSession,
    filters: DateRangeParams,
    canal: str | None,
    tipo: ProgramType | None,
    formato: str | None,
    limit: int,
) -> list[dict[str, Any]]:
    """TDD §8.5 /dashboard/ranking/programas. Medida DAX "Ranking Programas":
    RANKX ... Dense sobre Vistas Totales DESC → DENSE_RANK() (empates comparten
    puesto, sin huecos en la numeración siguiente).

    `tipo` se incluye en la respuesta (además de como filtro) para que el
    frontend pueda colorear cada barra según su tipo simultáneamente, en vez
    de exigir un filtro excluyente — ver Doc-Migración §5.1 (el ranking
    original distingue tipo por color de barra, no por pestaña). `formato`
    filtra por DATA[Formato] (Grabado/Vivo/Finalizado), columna ya existente
    en fact_audiencia — ver decisión registrada en Adenda 3 de la auditoría.
    """
    vistas_col = func.coalesce(func.sum(FactAudiencia.vistas_diarias), 0)
    ranking_col = func.dense_rank().over(order_by=vistas_col.desc())

    stmt = (
        select(
            Programa.nombre.label("programa"),
            Programa.canal.label("canal"),
            Programa.tipo.label("tipo"),
            vistas_col.label("vistas_totales"),
            ranking_col.label("ranking"),
        )
        .join(Programa, FactAudiencia.programa_id == Programa.id)
        .group_by(Programa.nombre, Programa.canal, Programa.tipo)
    )
    if canal is not None:
        stmt = stmt.where(Programa.canal == canal)
    if tipo is not None:
        stmt = stmt.where(Programa.tipo == tipo)
    if formato is not None:
        stmt = stmt.where(FactAudiencia.formato == formato)
    stmt = _apply_date_range(stmt, FactAudiencia.fecha, filters)
    stmt = stmt.order_by(vistas_col.desc()).limit(limit)

    result = await session.execute(stmt)
    return [dict(row._mapping) for row in result.all()]


async def get_keywords(
    session: AsyncSession,
    programa: str | None,
    mes: list[int] | None,
    sentimiento: SentimientoFiltro,
    limit: int,
) -> list[dict[str, Any]]:
    """TDD §8.6 /dashboard/keywords, ordenado por occurrences DESC (tamaño de
    palabra en la nube original — Doc-Migración §5.1: "ponderadas por
    KEYWORDS[OCCURRENCES]"). Sin filtro de año: el contrato del TDD solo define
    `mes`, no `anio`, para este endpoint.

    `mes` acepta una lista (p. ej. [4, 5] para abril+mayo, del rango del date
    picker) en vez de un único mes — el filtro `IN` se aplica antes de
    agrupar, así que el top por occurrences es el del período combinado, no
    el de un solo mes del rango.

    Agrupa por (hashtag, sentimiento) sumando occurrences: fact_keywords tiene
    grano (hashtag, mes, search_id), así que sin esto el mismo hashtag salía
    repetido una vez por mes (p. ej. sin filtro de mes) — además de inflar el
    conteo visual, las filas duplicadas rompían la key de React en la nube de
    palabras del frontend."""
    occurrences_sum = func.sum(FactKeywords.occurrences).label("occurrences")
    stmt = select(FactKeywords.hashtag, FactKeywords.sentimiento, occurrences_sum)
    if programa is not None:
        stmt = stmt.join(Programa, FactKeywords.programa_id == Programa.id).where(
            Programa.nombre == programa
        )
    if mes:
        stmt = stmt.where(FactKeywords.mes_num.in_(mes))
    if sentimiento != SentimientoFiltro.TODOS:
        stmt = stmt.where(FactKeywords.sentimiento == SentimentType(sentimiento.value))
    stmt = (
        stmt.group_by(FactKeywords.hashtag, FactKeywords.sentimiento)
        .order_by(occurrences_sum.desc())
        .limit(limit)
    )

    result = await session.execute(stmt)
    return [
        {"hashtag": row.hashtag, "occurrences": row.occurrences, "sentimiento": row.sentimiento}
        for row in result.all()
    ]


async def get_sentimiento_evolutivo(
    session: AsyncSession, programa: str | None, filters: DateRangeParams
) -> list[dict[str, Any]]:
    """TDD §8.6 /dashboard/sentimiento/evolutivo — mismas medidas que
    get_sentiment_kpis, agrupadas por mes en vez de un único promedio.
    Mismo criterio de solapamiento que get_sentiment_kpis (ver
    _apply_month_range_overlap): un mes se incluye si se solapa con el
    rango, no solo si su día 1 cae exactamente dentro."""
    month_start = func.make_date(FactSentimiento.anio, FactSentimiento.mes_num, 1)
    stmt = (
        select(
            FactSentimiento.anio.label("anio"),
            FactSentimiento.mes_num.label("mes_num"),
            func.avg(FactSentimiento.score_positivo).label("pct_positivo"),
            func.avg(FactSentimiento.score_negativo).label("pct_negativo"),
            func.avg(FactSentimiento.score_neutral).label("pct_neutral"),
        )
        .group_by(FactSentimiento.anio, FactSentimiento.mes_num)
        .order_by(FactSentimiento.anio, FactSentimiento.mes_num)
    )
    if programa is not None:
        stmt = stmt.join(Programa, FactSentimiento.programa_id == Programa.id).where(
            Programa.nombre == programa
        )
    stmt = _apply_month_range_overlap(stmt, month_start, filters)

    result = await session.execute(stmt)
    return [
        {
            "mes": f"{row.anio}-{row.mes_num:02d}",
            "pct_positivo": _as_float(row.pct_positivo),
            "pct_negativo": _as_float(row.pct_negativo),
            "pct_neutral": _as_float(row.pct_neutral),
        }
        for row in result.all()
    ]


async def get_filter_programas(session: AsyncSession) -> list[str]:
    result = await session.execute(select(Programa.nombre).order_by(Programa.nombre))
    return list(result.scalars().all())


async def get_filter_canales(session: AsyncSession) -> list[str]:
    result = await session.execute(select(Programa.canal).distinct().order_by(Programa.canal))
    return list(result.scalars().all())


async def get_filter_periodos(session: AsyncSession) -> dict[str, Any]:
    stmt = select(func.min(FactAudiencia.fecha), func.max(FactAudiencia.fecha))
    result = await session.execute(stmt)
    fecha_min, fecha_max = result.one()
    return {"fecha_min": fecha_min, "fecha_max": fecha_max}
