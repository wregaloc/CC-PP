import uuid
from datetime import datetime

from sqlalchemy import DateTime, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class RevokedToken(Base):
    """Blacklist de refresh tokens invalidados (logout).

    Alternativa a Redis para esta fase del proyecto: el entorno de desarrollo
    no tiene Docker ni Redis disponible (ver database/README.md — Supabase
    reemplaza a Postgres local por la misma razón). Una fila por jti revocado;
    expires_at permite purgar filas ya vencidas por token en vez de conservarlas
    indefinidamente. Ver docs/PODPULSE_TDD_v1.0.docx §9.1 y §13.1.
    """

    __tablename__ = "revoked_tokens"

    jti: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    revoked_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
