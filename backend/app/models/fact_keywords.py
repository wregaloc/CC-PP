from typing import TYPE_CHECKING

from sqlalchemy import (
    BigInteger,
    CheckConstraint,
    Enum,
    ForeignKey,
    Identity,
    Index,
    Integer,
    SmallInteger,
    String,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.enums import SentimentType

if TYPE_CHECKING:
    from app.models.dim_programa import Programa


class FactKeywords(Base):
    """Consolida las 4 tablas KEYWORDS/KEYWORDS_NEGATIVE/NEUTRAL/POSITIVE del modelo
    original en una sola, filtrable por `sentimiento` (simplificación ya aprobada
    en el TDD §9.2). No usa la columna compuesta Clave_Programa_Mes del modelo DAX
    original (con su inconsistencia de separador "-"/"_") — la relación con el
    programa y el período se resuelve con columnas estructuradas (programa_id,
    anio, mes_num), lo que elimina ese riesgo de raíz en vez de solo normalizarlo.
    """

    __tablename__ = "fact_keywords"

    id: Mapped[int] = mapped_column(BigInteger, Identity(), primary_key=True)
    anio: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    mes_num: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    mes_nombre: Mapped[str] = mapped_column(String(20), nullable=False)
    programa_id: Mapped[int] = mapped_column(
        ForeignKey("dim_programa.id", ondelete="RESTRICT"), nullable=False
    )
    hashtag: Mapped[str] = mapped_column(String(200), nullable=False)
    occurrences: Mapped[int] = mapped_column(Integer, nullable=False, server_default="1")
    sentimiento: Mapped[SentimentType] = mapped_column(
        Enum(
            SentimentType,
            name="sentiment_type",
            native_enum=True,
            values_callable=lambda enum_cls: [member.value for member in enum_cls],
        ),
        nullable=False,
    )
    search_id: Mapped[int | None] = mapped_column(Integer, nullable=True)

    programa: Mapped["Programa"] = relationship("Programa", back_populates="keywords")

    __table_args__ = (
        UniqueConstraint(
            "anio", "mes_num", "programa_id", "hashtag", "sentimiento",
            name="uq_fact_keywords_upsert_key",
        ),
        CheckConstraint("mes_num BETWEEN 1 AND 12", name="ck_fact_keywords_mes_num_range"),
        Index("ix_fact_keywords_programa_periodo", "programa_id", "anio", "mes_num"),
        Index("ix_fact_keywords_sentimiento", "sentimiento"),
    )
