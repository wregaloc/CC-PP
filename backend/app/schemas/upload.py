import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from app.etl.models import LoadReport
from app.models.enums import UploadFileType, UploadStatus
from app.models.upload_log import UploadLog


class RejectedRowOut(BaseModel):
    row_index: int = Field(description="Índice de la fila dentro del archivo (0-based)")
    reason: str
    raw_data: dict[str, Any]


class UploadResultResponse(BaseModel):
    """Resumen devuelto tras procesar una carga — TDD §6.2 punto 8."""

    file_type: str
    original_filename: str
    rows_total: int
    rows_loaded: int
    rows_skipped: int
    status: str
    error_message: str | None
    upload_log_id: uuid.UUID | None
    rejected: list[RejectedRowOut]

    @classmethod
    def from_report(cls, report: LoadReport) -> "UploadResultResponse":
        return cls(
            file_type=report.file_type,
            original_filename=report.original_filename,
            rows_total=report.rows_total,
            rows_loaded=report.rows_loaded,
            rows_skipped=report.rows_skipped,
            status=report.status,
            error_message=report.error_message,
            upload_log_id=report.upload_log_id,
            rejected=[
                RejectedRowOut(row_index=r.row_index, reason=r.reason, raw_data=r.raw_data)
                for r in report.rejected
            ],
        )


class UploadedByOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: str
    full_name: str


class UploadLogSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    file_type: UploadFileType
    original_filename: str
    status: UploadStatus
    rows_total: int | None
    rows_loaded: int | None
    rows_skipped: int | None
    uploaded_by: UploadedByOut
    started_at: datetime
    completed_at: datetime | None

    @classmethod
    def from_model(cls, upload_log: UploadLog) -> "UploadLogSummary":
        return cls.model_validate(upload_log)


class UploadLogDetail(UploadLogSummary):
    error_detail: dict[str, Any] | None = Field(
        description="Filas rechazadas (ver rejected) o el error estructural del archivo"
    )

    @classmethod
    def from_model(cls, upload_log: UploadLog) -> "UploadLogDetail":
        return cls.model_validate(upload_log)


class PaginatedUploadHistory(BaseModel):
    items: list[UploadLogSummary]
    page: int
    page_size: int
    total: int
