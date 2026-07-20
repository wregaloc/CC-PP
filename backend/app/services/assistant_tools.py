"""Herramientas ("tools") que el asistente de IA puede invocar para consultar
datos reales del dashboard.

Cada herramienta es un envoltorio delgado sobre una función que **ya existe y
está testeada** en `dashboard_service` — el asistente nunca escribe SQL ni
accede a la base directamente (ver [[enterprise-security]]: sin SQL dinámico,
allowlist estricta). El modelo solo elige qué herramienta llamar y con qué
parámetros; la ejecución real reusa la misma lógica de agregación que consume
el dashboard, así que el asistente no puede ver más de lo que ya ve cualquier
usuario en pantalla (datos agregados, nunca fila cruda ni PII).

Agregar una herramienta nueva = agregar una entrada a `_HANDLERS` y su
declaración en `TOOL_DECLARATIONS`; nunca exponer una función que permita
escritura."""

from datetime import date
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies.dashboard_filters import DateRangeParams
from app.models.enums import ProgramType
from app.schemas.dashboard import Granularidad, MetricaSecundaria
from app.services import dashboard_service


class ToolArgumentError(ValueError):
    """Un argumento provisto por el modelo es inválido (fecha mal formada, enum
    fuera de rango, etc.). Se le devuelve al modelo como resultado de la
    herramienta para que se corrija, no es un error del servidor."""


def _parse_date(value: Any, campo: str) -> date | None:
    if value is None or value == "":
        return None
    if not isinstance(value, str):
        raise ToolArgumentError(f"{campo} debe ser una fecha 'YYYY-MM-DD'")
    try:
        return date.fromisoformat(value)
    except ValueError as exc:
        raise ToolArgumentError(f"{campo} no es una fecha válida 'YYYY-MM-DD': {value}") from exc


def _parse_tipo(value: Any) -> ProgramType | None:
    if value is None or value == "":
        return None
    try:
        return ProgramType(value)
    except ValueError as exc:
        raise ToolArgumentError("tipo debe ser 'podcast' o 'programa'") from exc


def _date_range(args: dict[str, Any]) -> DateRangeParams:
    inicio = _parse_date(args.get("fecha_inicio"), "fecha_inicio")
    fin = _parse_date(args.get("fecha_fin"), "fecha_fin")
    if inicio and fin and inicio > fin:
        raise ToolArgumentError("fecha_inicio no puede ser posterior a fecha_fin")
    return DateRangeParams(fecha_inicio=inicio, fecha_fin=fin)


# ---------------------------------------------------------------------------
# Handlers: cada uno recibe (session, args) y devuelve un dict serializable a
# JSON (lo que se le manda de vuelta al modelo como resultado de la tool).
# ---------------------------------------------------------------------------


async def _listar_filtros_disponibles(session: AsyncSession, args: dict[str, Any]) -> dict[str, Any]:
    canales = await dashboard_service.get_filter_canales(session)
    categorias = await dashboard_service.get_filter_categorias(session)
    periodo = await dashboard_service.get_filter_periodos(session)
    return {
        "canales": canales,
        "categorias": categorias,
        "periodo_disponible": periodo.model_dump(mode="json"),
        "nota": "Para nombres exactos de programas usá obtener_ranking_programas con el "
        "parámetro 'q' (búsqueda parcial).",
    }


async def _obtener_kpis(session: AsyncSession, args: dict[str, Any]) -> dict[str, Any]:
    filters = _date_range(args)
    result = await dashboard_service.get_kpis(
        session,
        filters,
        programa=args.get("programa") or None,
        canal=args.get("canal") or None,
        categoria=args.get("categoria") or None,
        tipo=_parse_tipo(args.get("tipo")),
    )
    return result.model_dump(mode="json")


async def _obtener_ranking_programas(session: AsyncSession, args: dict[str, Any]) -> dict[str, Any]:
    filters = _date_range(args)
    limit = args.get("limit") or 10
    limit = max(1, min(int(limit), 50))
    q = args.get("q") or None
    items = await dashboard_service.get_ranking_programas(
        session,
        filters,
        canal=args.get("canal") or None,
        tipo=_parse_tipo(args.get("tipo")),
        formato=None,
        limit=limit,
        q=q if q and len(q) >= 2 else None,
        programa_asegurado=None,
        categoria=args.get("categoria") or None,
    )
    return {"programas": [item.model_dump(mode="json") for item in items]}


async def _obtener_evolutivo(session: AsyncSession, args: dict[str, Any]) -> dict[str, Any]:
    filters = _date_range(args)
    try:
        granularidad = Granularidad(args.get("granularidad", "mes"))
        metrica = MetricaSecundaria(args.get("metrica_secundaria", "emisiones"))
    except ValueError as exc:
        raise ToolArgumentError(
            "granularidad debe ser anio|mes|semana|dia y metrica_secundaria "
            "emisiones|busquedas"
        ) from exc
    points = await dashboard_service.get_evolutivo(
        session,
        filters,
        granularidad,
        metrica,
        programa=args.get("programa") or None,
        canal=args.get("canal") or None,
        categoria=args.get("categoria") or None,
        tipo=_parse_tipo(args.get("tipo")),
    )
    return {"serie": [point.model_dump(mode="json") for point in points]}


_HANDLERS = {
    "listar_filtros_disponibles": _listar_filtros_disponibles,
    "obtener_kpis": _obtener_kpis,
    "obtener_ranking_programas": _obtener_ranking_programas,
    "obtener_evolutivo": _obtener_evolutivo,
}


async def execute_tool(session: AsyncSession, name: str, args: dict[str, Any]) -> dict[str, Any]:
    """Ejecuta la herramienta `name` con `args` y devuelve su resultado (dict
    JSON) o un dict `{"error": ...}` que el modelo puede leer y corregir.

    Un `error` acá nunca es una excepción del servidor: es feedback para el
    modelo (tool inexistente, argumento inválido). Cualquier otra excepción
    inesperada se propaga para que la maneje el service/handler global."""
    handler = _HANDLERS.get(name)
    if handler is None:
        return {"error": f"Herramienta desconocida: {name}"}
    try:
        return await handler(session, args or {})
    except ToolArgumentError as exc:
        return {"error": str(exc)}


# ---------------------------------------------------------------------------
# Declaraciones para Gemini (subset de OpenAPI que espera functionDeclarations).
# ---------------------------------------------------------------------------

_FECHA_PROPS = {
    "fecha_inicio": {"type": "string", "description": "Fecha inicio inclusiva 'YYYY-MM-DD' (opcional)"},
    "fecha_fin": {"type": "string", "description": "Fecha fin inclusiva 'YYYY-MM-DD' (opcional)"},
}
_TIPO_PROP = {
    "tipo": {"type": "string", "enum": ["podcast", "programa"], "description": "Filtrar por tipo (opcional)"}
}

TOOL_DECLARATIONS: list[dict[str, Any]] = [
    {
        "name": "listar_filtros_disponibles",
        "description": "Lista los canales, categorías y el rango de fechas disponibles en los "
        "datos. Útil para conocer valores válidos antes de filtrar.",
        "parameters": {"type": "object", "properties": {}},
    },
    {
        "name": "obtener_kpis",
        "description": "KPIs agregados del período/filtro: vistas totales, engagement rate, likes, "
        "comentarios, emisiones, pico máximo en vivo, promedio en vivo y cantidad de programas "
        "distintos. Todos los parámetros son opcionales; sin filtros devuelve el total global.",
        "parameters": {
            "type": "object",
            "properties": {
                "programa": {"type": "string", "description": "Nombre exacto del programa (opcional)"},
                "canal": {"type": "string", "description": "Nombre exacto del canal (opcional)"},
                "categoria": {"type": "string", "description": "Nombre exacto de la categoría (opcional)"},
                **_TIPO_PROP,
                **_FECHA_PROPS,
            },
        },
    },
    {
        "name": "obtener_ranking_programas",
        "description": "Ranking de programas por vistas totales (mayor a menor). Usá 'q' para "
        "buscar un programa por nombre parcial y así descubrir su nombre exacto.",
        "parameters": {
            "type": "object",
            "properties": {
                "canal": {"type": "string", "description": "Filtrar por canal exacto (opcional)"},
                "categoria": {"type": "string", "description": "Filtrar por categoría exacta (opcional)"},
                **_TIPO_PROP,
                "q": {"type": "string", "description": "Búsqueda parcial por nombre de programa (mín. 2 letras, opcional)"},
                "limit": {"type": "integer", "description": "Cantidad de programas a devolver (1-50, default 10)"},
                **_FECHA_PROPS,
            },
        },
    },
    {
        "name": "obtener_evolutivo",
        "description": "Serie temporal de vistas totales más una métrica secundaria (emisiones o "
        "búsquedas), agrupada por la granularidad indicada. Sirve para responder tendencias "
        "('¿cómo evolucionaron las vistas?').",
        "parameters": {
            "type": "object",
            "properties": {
                "granularidad": {
                    "type": "string",
                    "enum": ["anio", "mes", "semana", "dia"],
                    "description": "Nivel de agrupación temporal",
                },
                "metrica_secundaria": {
                    "type": "string",
                    "enum": ["emisiones", "busquedas"],
                    "description": "Segunda serie a devolver junto a las vistas",
                },
                "programa": {"type": "string", "description": "Nombre exacto del programa (opcional)"},
                "canal": {"type": "string", "description": "Nombre exacto del canal (opcional)"},
                "categoria": {"type": "string", "description": "Nombre exacto de la categoría (opcional)"},
                **_TIPO_PROP,
                **_FECHA_PROPS,
            },
            "required": ["granularidad", "metrica_secundaria"],
        },
    },
]
