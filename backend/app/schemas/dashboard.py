import enum
from datetime import date, time

from pydantic import BaseModel, Field

from app.models.enums import ProgramType, SentimentType


class Granularidad(enum.StrEnum):
    ANIO = "anio"
    MES = "mes"
    SEMANA = "semana"
    DIA = "dia"


class MetricaSecundaria(enum.StrEnum):
    EMISIONES = "emisiones"
    BUSQUEDAS = "busquedas"


class SentimientoFiltro(enum.StrEnum):
    """Igual que SentimentType más "todos" (sin filtrar) — ver TDD §8.6."""

    POSITIVO = "positivo"
    NEGATIVO = "negativo"
    NEUTRAL = "neutral"
    TODOS = "todos"


class KpisResponse(BaseModel):
    vistas_totales: int
    engagement_rate: float | None = Field(
        description="Promedio de DATA[Engagement] en el rango filtrado — fracción 0-1"
    )
    likes: int
    comentarios: int
    emisiones: int = Field(
        description="SUM(Es_Emision) en el rango filtrado (medida DAX Emisiones = SUM(Es_Emision); "
        "Es_Emision es un conteo por día, no un flag — puede haber varias emisiones el mismo día)"
    )
    pico_max_vivo: int | None = Field(
        description="MAX(DATA[Pico Max]) en el rango filtrado (programa/canal/fechas)"
    )
    promedio_vivo: float | None = Field(
        description="AVG(DATA[Promedio en Vivo]) en el rango filtrado (programa/canal/fechas)"
    )
    programas_distintos: int = Field(
        description="COUNT(DISTINCT programa_id) en el rango filtrado — usado por el frontend para "
        "calcular 'Promedio de Vistas' (vistas_totales / programas_distintos) cuando el filtro no "
        "acota a un único programa; con un programa puntual el frontend usa vistas_totales / "
        "emisiones en su lugar."
    )


class SentimentKpisResponse(BaseModel):
    pct_positivo: float | None = Field(description="Fracción 0-1, promedio de score_positivo")
    pct_negativo: float | None = Field(description="Fracción 0-1, promedio de score_negativo")
    pct_neutral: float | None = Field(description="Fracción 0-1, promedio de score_neutral")


class AuspicioOut(BaseModel):
    auspiciador: str
    mes_num: int
    mes_nombre: str


class AuspicioBusquedaItem(BaseModel):
    programa: str
    canal: str
    auspiciador: str
    mes_num: int
    mes_nombre: str


class AuspiciadorTopItem(BaseModel):
    auspiciador: str
    cantidad_programas: int = Field(
        description="Cantidad de programas distintos en los que aparece como auspiciador"
    )


class EvolutivoPoint(BaseModel):
    periodo: str = Field(
        description="Formato según granularidad: dia=YYYY-MM-DD, semana=YYYY-Wnn, "
        "mes=YYYY-MM, anio=YYYY"
    )
    vistas_totales: int
    metrica_secundaria: int | None = Field(
        default=None,
        description="Null solo en puntos proyectados (es_proyectado=True) — no se proyecta "
        "la métrica secundaria, solo vistas.",
    )
    es_proyectado: bool = Field(
        default=False,
        description="True si el punto es una proyección (no un dato real cargado) — solo "
        "puede venir en True cuando el request pidió incluir_forecast=true siendo Admin.",
    )


class ProgramaRankingItem(BaseModel):
    programa: str
    canal: str
    tipo: ProgramType | None = Field(description="DATA[Tipo]: podcast | programa (puede ser null)")
    vistas_totales: int
    ranking: int = Field(description="DENSE_RANK sobre vistas_totales DESC")


class KeywordOut(BaseModel):
    hashtag: str
    occurrences: int
    sentimiento: SentimentType


class SentimientoEvolutivoPoint(BaseModel):
    mes: str = Field(description="Formato YYYY-MM")
    pct_positivo: float | None
    pct_negativo: float | None
    pct_neutral: float | None


class PeriodoDisponibleResponse(BaseModel):
    fecha_min: date | None
    fecha_max: date | None


class HorarioAudienciaPoint(BaseModel):
    """Una fila de fact_audiencia (día) para el heatmap "Horario de mayor
    audiencia" — `hora_transmision` es la hora de inicio del video con más
    vistas ese día (ver fact_audiencia.hora_transmision); si ese día no
    tiene hora registrada, el punto no puede ubicarse en el heatmap.

    `programa` viaja siempre (aunque el filtro haya sido por `programa`
    exacto, donde es redundante en cada fila) para que el modo `canal`
    —que trae filas de varios programas mezcladas— pueda agruparlas en el
    frontend sin un segundo viaje al backend."""

    fecha: date
    hora_transmision: time | None
    vistas_diarias: int
    programa: str
