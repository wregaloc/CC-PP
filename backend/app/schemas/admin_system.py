from datetime import datetime

from pydantic import BaseModel

from app.schemas.upload import UploadLogSummary


class SystemSummary(BaseModel):
    """Fase 10 §Módulo 1 (Dashboard del Sistema)."""

    api_status: str
    database_status: str
    overall_status: str
    total_clientes: int
    total_usuarios: int
    total_equipo: int
    last_upload: UploadLogSummary | None
    last_update_at: datetime | None
