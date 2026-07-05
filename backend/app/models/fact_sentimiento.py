from typing import TYPE_CHECKING

from sqlalchemy import (
    BigInteger,
    CheckConstraint,
    ForeignKey,
    Identity,
    Index,
    Integer,
    Numeric,
    SmallInteger,
    String,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.dim_programa import Programa


class FactSentimiento(Base):
    """Scores de sentimiento por programa/mes (fuente: SPLIT SENSE).

    Confirmado (P4): los tres scores suman 1.0 por fila en el origen. El CHECK
    de suma usa una tolerancia de +/-0.01 para absorber redondeos del archivo
    Excel original, en vez de exigir una igualdad exacta que rompería con datos
    reales limítrofes.
    """

    __tablename__ = "fact_sentimiento"

    id: Mapped[int] = mapped_column(BigInteger, Identity(), primary_key=True)
    anio: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    mes_num: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    mes_nombre: Mapped[str] = mapped_column(String(20), nullable=False)
    programa_id: Mapped[int] = mapped_column(
        ForeignKey("dim_programa.id", ondelete="RESTRICT"), nullable=False
    )
    score_positivo: Mapped[float] = mapped_column(Numeric(5, 4), nullable=False)
    score_negativo: Mapped[float] = mapped_column(Numeric(5, 4), nullable=False)
    score_neutral: Mapped[float] = mapped_column(Numeric(5, 4), nullable=False)
    search_id: Mapped[int | None] = mapped_column(Integer, nullable=True)

    programa: Mapped["Programa"] = relationship("Programa", back_populates="sentimiento")

    __table_args__ = (
        UniqueConstraint("anio", "mes_num", "programa_id", name="uq_fact_sentimiento_upsert_key"),
        CheckConstraint("mes_num BETWEEN 1 AND 12", name="ck_fact_sentimiento_mes_num_range"),
        CheckConstraint(
            "score_positivo BETWEEN 0 AND 1", name="ck_fact_sentimiento_positivo_range"
        ),
        CheckConstraint(
            "score_negativo BETWEEN 0 AND 1", name="ck_fact_sentimiento_negativo_range"
        ),
        CheckConstraint("score_neutral BETWEEN 0 AND 1", name="ck_fact_sentimiento_neutral_range"),
        CheckConstraint(
            "abs(score_positivo + score_negativo + score_neutral - 1) <= 0.01",
            name="ck_fact_sentimiento_scores_sum_to_one",
        ),
        Index("ix_fact_sentimiento_programa_periodo", "programa_id", "anio", "mes_num"),
    )
