import enum
from datetime import date

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


class SentimentKpisResponse(BaseModel):
    pct_positivo: float | None = Field(description="Fracción 0-1, promedio de score_positivo")
    pct_negativo: float | None = Field(description="Fracción 0-1, promedio de score_negativo")
    pct_neutral: float | None = Field(description="Fracción 0-1, promedio de score_neutral")


class AuspicioOut(BaseModel):
    auspiciador: str


class EvolutivoPoint(BaseModel):
    periodo: str = Field(
        description="Formato según granularidad: dia=YYYY-MM-DD, semana=YYYY-Wnn, "
        "mes=YYYY-MM, anio=YYYY"
    )
    vistas_totales: int
    metrica_secundaria: int


class ProgramaRankingItem(BaseModel):
    programa: str
    canal: str
    tipo: ProgramType | None = Field(description="DATA[Tipo]: podcast | programa (puede ser null)")
    vistas_totales: int
    ranking: int = Field(description="DENSE_RANK sobre vistas_totales DESC")


class CanalRankingItem(BaseModel):
    canal: str
    vistas_totales: int
    ranking: int


class CanalProgramaItem(BaseModel):
    programa: str
    vistas: int
    pico_max: int | None
    promedio_vivo: float | None


class CanalLiveStatsResponse(BaseModel):
    pico_max_vivo: int | None
    promedio_vivo: float | None


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
