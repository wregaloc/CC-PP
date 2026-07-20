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
from app.schemas.dashboard import Granularidad, MetricaSecundaria, SentimientoFiltro
from app.services import dashboard_service

# Mismo orden que DIAS_SEMANA en frontend/src/features/dashboard/lib/horarioAudiencia.ts
# — índice 0 = Lunes, coincide con date.weekday() de Python (Monday=0).
_DIAS_SEMANA = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"]


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


async def _obtener_sentimiento(session: AsyncSession, args: dict[str, Any]) -> dict[str, Any]:
    filters = _date_range(args)
    result = await dashboard_service.get_sentiment_kpis(session, filters, args.get("programa") or None)
    return result.model_dump(mode="json")


async def _obtener_keywords(session: AsyncSession, args: dict[str, Any]) -> dict[str, Any]:
    meses_raw = args.get("meses") or None
    meses: list[int] | None = None
    if meses_raw is not None:
        try:
            meses = [int(m) for m in meses_raw]
        except (TypeError, ValueError) as exc:
            raise ToolArgumentError("meses debe ser una lista de números 1-12") from exc
        if any(m < 1 or m > 12 for m in meses):
            raise ToolArgumentError("cada mes debe estar entre 1 y 12")

    sentimiento_raw = args.get("sentimiento") or "todos"
    try:
        sentimiento = SentimientoFiltro(sentimiento_raw)
    except ValueError as exc:
        raise ToolArgumentError("sentimiento debe ser positivo|negativo|neutral|todos") from exc

    limit = max(1, min(int(args.get("limit") or 30), 500))
    items = await dashboard_service.get_keywords(
        session, args.get("programa") or None, meses, sentimiento, limit
    )
    return {"keywords": [item.model_dump(mode="json") for item in items]}


async def _obtener_auspicios_programa(session: AsyncSession, args: dict[str, Any]) -> dict[str, Any]:
    programa = args.get("programa") or None
    if not programa:
        raise ToolArgumentError("programa es obligatorio para esta herramienta")
    mes = args.get("mes")
    mes_int = None
    if mes is not None:
        try:
            mes_int = int(mes)
        except (TypeError, ValueError) as exc:
            raise ToolArgumentError("mes debe ser un número 1-12") from exc
        if mes_int < 1 or mes_int > 12:
            raise ToolArgumentError("mes debe estar entre 1 y 12")
    items = await dashboard_service.get_auspicios(session, programa, mes_int)
    return {"auspicios": [item.model_dump(mode="json") for item in items]}


async def _buscar_programas_por_auspiciador(session: AsyncSession, args: dict[str, Any]) -> dict[str, Any]:
    q = args.get("marca") or ""
    if len(q) < 2:
        raise ToolArgumentError("marca debe tener al menos 2 caracteres")
    items = await dashboard_service.get_auspicios_por_marca(session, q)
    return {"resultados": [item.model_dump(mode="json") for item in items]}


async def _obtener_top_auspiciadores(session: AsyncSession, args: dict[str, Any]) -> dict[str, Any]:
    limit = max(1, min(int(args.get("limit") or 5), 50))
    items = await dashboard_service.get_top_auspiciadores(session, limit)
    return {"top_auspiciadores": [item.model_dump(mode="json") for item in items]}


async def _obtener_horario_audiencia(session: AsyncSession, args: dict[str, Any]) -> dict[str, Any]:
    """Replica exactamente la agregación del panel "Horario de Mayor
    Audiencia" (ver frontend/src/features/dashboard/lib/horarioAudiencia.ts
    ::construirGrillaHeatmap/construirGrillaHeatmapCanal + encontrarBloqueMax)
    para que el asistente nunca dé una respuesta distinta a la que el usuario
    vería si abriera ese panel él mismo.

    Modo programa: suma vistas por (día de semana, hora) y devuelve el
    bloque con más vistas acumuladas. Modo canal: por cada (día, hora) se
    queda con la fila de mayor `vistas_diarias` (no una suma — un video
    puntual, no un acumulado), para poder atribuir qué programa lideró ese
    bloque."""
    filters = _date_range(args)
    programa = args.get("programa") or None
    canal = args.get("canal") or None
    if (programa is None) == (canal is None):
        raise ToolArgumentError(
            "Indicá exactamente uno de 'programa' o 'canal' (no ambos, no ninguno)"
        )
    tipo = _parse_tipo(args.get("tipo"))
    rows = await dashboard_service.get_horario_audiencia(session, filters, programa, canal, tipo)

    if programa:
        totales: dict[tuple[int, int], int] = {}
        for row in rows:
            if row.hora_transmision is None:
                continue
            clave = (row.fecha.weekday(), row.hora_transmision.hour)
            totales[clave] = totales.get(clave, 0) + row.vistas_diarias
        if not totales:
            return {"bloque_max": None, "nota": "No hay filas con hora de transmisión registrada."}
        (dia, hora), vistas = max(totales.items(), key=lambda kv: kv[1])
        return {"bloque_max": {"dia_semana": _DIAS_SEMANA[dia], "hora": hora, "vistas": vistas}}

    mejor: dict[tuple[int, int], tuple[int, str]] = {}
    for row in rows:
        if row.hora_transmision is None:
            continue
        clave = (row.fecha.weekday(), row.hora_transmision.hour)
        if clave not in mejor or row.vistas_diarias > mejor[clave][0]:
            mejor[clave] = (row.vistas_diarias, row.programa)
    if not mejor:
        return {"bloque_max": None, "nota": "No hay filas con hora de transmisión registrada."}
    (dia, hora), (vistas, programa_lider) = max(mejor.items(), key=lambda kv: kv[1][0])
    return {
        "bloque_max": {
            "dia_semana": _DIAS_SEMANA[dia],
            "hora": hora,
            "vistas": vistas,
            "programa_lider": programa_lider,
        }
    }


_HANDLERS = {
    "listar_filtros_disponibles": _listar_filtros_disponibles,
    "obtener_kpis": _obtener_kpis,
    "obtener_ranking_programas": _obtener_ranking_programas,
    "obtener_evolutivo": _obtener_evolutivo,
    "obtener_sentimiento": _obtener_sentimiento,
    "obtener_keywords": _obtener_keywords,
    "obtener_auspicios_programa": _obtener_auspicios_programa,
    "buscar_programas_por_auspiciador": _buscar_programas_por_auspiciador,
    "obtener_top_auspiciadores": _obtener_top_auspiciadores,
    "obtener_horario_audiencia": _obtener_horario_audiencia,
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
    {
        "name": "obtener_sentimiento",
        "description": "Porcentaje de audiencia con sentimiento positivo/negativo/neutral en el "
        "período/filtro (0-1, ej. 0.335 = 33.5%). Para '¿cómo viene el sentimiento/opinión de la "
        "audiencia?'.",
        "parameters": {
            "type": "object",
            "properties": {
                "programa": {"type": "string", "description": "Nombre exacto del programa (opcional)"},
                **_FECHA_PROPS,
            },
        },
    },
    {
        "name": "obtener_keywords",
        "description": "Hashtags/keywords más frecuentes, ordenados por cantidad de menciones. "
        "Para '¿de qué habla la audiencia de X?' o '¿cuáles son los temas más comentados?'.",
        "parameters": {
            "type": "object",
            "properties": {
                "programa": {"type": "string", "description": "Nombre exacto del programa (opcional)"},
                "meses": {
                    "type": "array",
                    "items": {"type": "integer"},
                    "description": "Uno o más meses (1-12) a incluir (opcional, todos si se omite)",
                },
                "sentimiento": {
                    "type": "string",
                    "enum": ["positivo", "negativo", "neutral", "todos"],
                    "description": "Filtrar por sentimiento del keyword (default todos)",
                },
                "limit": {"type": "integer", "description": "Cantidad a devolver (1-500, default 30)"},
            },
        },
    },
    {
        "name": "obtener_auspicios_programa",
        "description": "Marcas auspiciadoras (sponsors) de un programa específico, opcionalmente "
        "acotado a un mes. Requiere 'programa'.",
        "parameters": {
            "type": "object",
            "properties": {
                "programa": {"type": "string", "description": "Nombre exacto del programa (obligatorio)"},
                "mes": {"type": "integer", "description": "Mes numérico 1-12 (opcional)"},
            },
            "required": ["programa"],
        },
    },
    {
        "name": "buscar_programas_por_auspiciador",
        "description": "Dado el nombre (parcial) de una marca/auspiciador (ej. 'BCP'), devuelve en "
        "qué programas y canales aparece auspiciando. Para '¿en qué programas auspicia X marca?'.",
        "parameters": {
            "type": "object",
            "properties": {
                "marca": {"type": "string", "description": "Texto a buscar en el nombre del auspiciador (mín. 2 letras)"},
            },
            "required": ["marca"],
        },
    },
    {
        "name": "obtener_top_auspiciadores",
        "description": "Ranking global de auspiciadores por cantidad de programas distintos en los "
        "que aparecen (sobre todo el histórico, sin filtrar por fecha). Para '¿quiénes son los "
        "principales auspiciadores?'.",
        "parameters": {
            "type": "object",
            "properties": {
                "limit": {"type": "integer", "description": "Cantidad a devolver (1-50, default 5)"},
            },
        },
    },
    {
        "name": "obtener_horario_audiencia",
        "description": "Encuentra el bloque de día de semana + hora con más audiencia — el mismo "
        "cálculo que muestra el panel 'Horario de Mayor Audiencia' del dashboard. Para '¿cuál es el "
        "mejor horario para publicar/transmitir?'. Requiere EXACTAMENTE uno de 'programa' o 'canal' "
        "(no ambos, no ninguno); con 'canal' el resultado indica además qué programa lideró ese "
        "bloque, ya que mezcla las filas de todos los programas del canal.",
        "parameters": {
            "type": "object",
            "properties": {
                "programa": {"type": "string", "description": "Nombre exacto del programa (usar esto O canal)"},
                "canal": {"type": "string", "description": "Nombre exacto del canal (usar esto O programa)"},
                **_TIPO_PROP,
                **_FECHA_PROPS,
            },
        },
    },
]
