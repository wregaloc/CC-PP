from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, Enum, Identity, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.enums import ProgramType

if TYPE_CHECKING:
    from app.models.dim_auspicios import Auspicio
    from app.models.fact_audiencia import FactAudiencia
    from app.models.fact_keywords import FactKeywords
    from app.models.fact_sentimiento import FactSentimiento


class Programa(Base):
    """Dimensión de programas/podcasts. `nombre` es la clave natural (única).

    `canal` vive como atributo simple de esta fila (no como tabla propia) — sigue
    la simplificación ya aprobada en el TDD §9.2/§7.2. Si en el futuro un mismo
    nombre de programa aparece bajo más de un canal, este modelo no lo soporta
    y habrá que revisarlo (riesgo ya señalado en la revisión de consistencia).
    """

    __tablename__ = "dim_programa"

    id: Mapped[int] = mapped_column(Identity(), primary_key=True)
    nombre: Mapped[str] = mapped_column(String(200), unique=True, nullable=False)
    canal: Mapped[str] = mapped_column(String(200), nullable=False)
    categoria: Mapped[str | None] = mapped_column(String(100), nullable=True)
    tipo: Mapped[ProgramType | None] = mapped_column(
        Enum(
            ProgramType,
            name="program_type",
            native_enum=True,
            values_callable=lambda enum_cls: [member.value for member in enum_cls],
        ),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    audiencia: Mapped[list["FactAudiencia"]] = relationship(
        "FactAudiencia", back_populates="programa"
    )
    keywords: Mapped[list["FactKeywords"]] = relationship(
        "FactKeywords", back_populates="programa"
    )
    sentimiento: Mapped[list["FactSentimiento"]] = relationship(
        "FactSentimiento", back_populates="programa"
    )
    auspicios: Mapped[list["Auspicio"]] = relationship("Auspicio", back_populates="programa")
