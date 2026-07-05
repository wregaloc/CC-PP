from typing import TYPE_CHECKING

from sqlalchemy import (
    BigInteger,
    CheckConstraint,
    ForeignKey,
    Identity,
    Index,
    SmallInteger,
    String,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.dim_programa import Programa


class Auspicio(Base):
    """Relación programa-marca patrocinadora, por mes (fuente: AUSPICIOS)."""

    __tablename__ = "dim_auspicios"

    id: Mapped[int] = mapped_column(BigInteger, Identity(), primary_key=True)
    mes_num: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    mes_nombre: Mapped[str] = mapped_column(String(20), nullable=False)
    programa_id: Mapped[int] = mapped_column(
        ForeignKey("dim_programa.id", ondelete="RESTRICT"), nullable=False
    )
    auspiciador: Mapped[str] = mapped_column(String(200), nullable=False)

    programa: Mapped["Programa"] = relationship("Programa", back_populates="auspicios")

    __table_args__ = (
        UniqueConstraint(
            "mes_num", "programa_id", "auspiciador", name="uq_dim_auspicios_upsert_key"
        ),
        CheckConstraint("mes_num BETWEEN 1 AND 12", name="ck_dim_auspicios_mes_num_range"),
        Index("ix_dim_auspicios_programa", "programa_id"),
    )
