"""Estructuras de datos del pipeline ETL — sin lógica de negocio ni I/O."""

import math
import uuid
from dataclasses import dataclass
from datetime import datetime
from typing import Any


def _json_safe(value: Any) -> Any:
    """Convierte NaN/Infinity (que pandas produce para celdas vacías) a None.

    JSON estándar no admite NaN/Infinity — PostgreSQL rechaza esos valores al
    guardarlos en una columna JSONB ("invalid input syntax for type json").
    Se sanea recursivamente porque raw_data puede ser un dict anidado.
    """
    if isinstance(value, float) and (math.isnan(value) or math.isinf(value)):
        return None
    if isinstance(value, dict):
        return {k: _json_safe(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_json_safe(v) for v in value]
    return value


@dataclass
class RejectedRow:
    row_index: int
    reason: str
    raw_data: dict

    def __post_init__(self) -> None:
        self.raw_data = _json_safe(self.raw_data)


@dataclass
class LoadReport:
    """Reporte de una carga — se persiste en upload_logs.error_detail y lo
    devuelve app/services/upload_service.py como respuesta del endpoint."""

    file_type: str
    original_filename: str
    rows_total: int
    rows_loaded: int
    rows_skipped: int
    rejected: list[RejectedRow]
    status: str  # "success" | "error"
    started_at: datetime
    completed_at: datetime | None = None
    upload_log_id: uuid.UUID | None = None
    error_message: str | None = None

    def to_summary_dict(self) -> dict:
        return {
            "file_type": self.file_type,
            "original_filename": self.original_filename,
            "rows_total": self.rows_total,
            "rows_loaded": self.rows_loaded,
            "rows_skipped": self.rows_skipped,
            "status": self.status,
            "error_message": self.error_message,
            "upload_log_id": str(self.upload_log_id) if self.upload_log_id else None,
            "rejected": [
                {"row_index": r.row_index, "reason": r.reason, "raw_data": r.raw_data}
                for r in self.rejected
            ],
        }


@dataclass(frozen=True)
class ProgramaRef:
    """Referencia a un programa mencionada por una fila, antes de resolverse
    a un programa_id real contra la base de datos.
    """

    nombre: str
    canal: str | None
    categoria: str | None
    tipo: str | None
    authoritative: bool
