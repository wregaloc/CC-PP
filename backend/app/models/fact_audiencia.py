import uuid
from datetime import date
from typing import TYPE_CHECKING

from sqlalchemy import (
    BigInteger,
    CheckConstraint,
    Date,
    ForeignKey,
    Identity,
    Index,
    Numeric,
    SmallInteger,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.dim_programa import Programa
    from app.models.upload_log import UploadLog


class FactAudiencia(Base):
    """Hechos diarios de audiencia. Fuente única: archivo DATA (confirmado que
    manda sobre cualquier otra fuente; SUPPORT queda fuera de alcance).

    Nota importante: `semana_num` es solo el número de semana ISO (1-52), SIN el
    componente de año que tenía la columna calculada `Semana_Orden` del modelo
    DAX original. Cualquier consulta que agrupe/ordene por semana debe usar
    SIEMPRE (anio, semana_num) juntos — nunca semana_num en solitario — o se
    mezclarán semanas de años distintos (el dataset ya cruza el límite
    2025→2026). Ver índice ix_fact_audiencia_anio_semana.
    """

    __tablename__ = "fact_audiencia"

    id: Mapped[int] = mapped_column(BigInteger, Identity(), primary_key=True)
    fecha: Mapped[date] = mapped_column(Date, nullable=False)
    mes_num: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    anio: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    semana_num: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    puesto: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    programa_id: Mapped[int] = mapped_column(
        ForeignKey("dim_programa.id", ondelete="RESTRICT"), nullable=False
    )
    # Conteo de emisiones ese día (no un flag sí/no) — medida DAX original:
    # Emisiones = SUM(Es_Emision). Puede ser 0 o mayor a 1 (varias emisiones
    # el mismo día); ver docs/AUDITORIA_BACKEND_v1.md Adenda 2.
    es_emision: Mapped[int] = mapped_column(SmallInteger, nullable=False, server_default="0")
    vistas_diarias: Mapped[int] = mapped_column(BigInteger, nullable=False, server_default="0")
    busquedas_diarias: Mapped[int] = mapped_column(BigInteger, nullable=False, server_default="0")
    likes: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    comentarios: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    engagement: Mapped[float | None] = mapped_column(Numeric(6, 4), nullable=True)
    pico_max_vivo: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    promedio_vivo: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    formato: Mapped[str | None] = mapped_column(String(50), nullable=True)
    titulo_video: Mapped[str | None] = mapped_column(Text, nullable=True)
    link_video: Mapped[str | None] = mapped_column(Text, nullable=True)
    upload_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("upload_logs.id", ondelete="SET NULL"), nullable=True
    )

    programa: Mapped["Programa"] = relationship("Programa", back_populates="audiencia")
    upload: Mapped["UploadLog | None"] = relationship("UploadLog", back_populates="filas_audiencia")

    __table_args__ = (
        UniqueConstraint("fecha", "programa_id", name="uq_fact_audiencia_fecha_programa"),
        CheckConstraint("mes_num BETWEEN 1 AND 12", name="ck_fact_audiencia_mes_num_range"),
        CheckConstraint("es_emision >= 0", name="ck_fact_audiencia_es_emision_non_negative"),
        Index("ix_fact_audiencia_anio_mes", "anio", "mes_num"),
        Index("ix_fact_audiencia_programa", "programa_id"),
        Index("ix_fact_audiencia_anio_semana", "anio", "semana_num"),
        # La API de dashboard (ver docs/API.md) filtra por rango de fecha exacto
        # (?fecha_inicio&fecha_fin) en casi todos los endpoints — los índices de
        # arriba son por (anio, mes_num)/(anio, semana_num), que no cubren un
        # rango arbitrario de fechas dentro de un mismo mes/semana.
        Index("ix_fact_audiencia_fecha", "fecha"),
    )
