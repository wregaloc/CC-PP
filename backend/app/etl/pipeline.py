"""Orquesta el flujo Extract → Validate → Transform → Load → Report para cada
tipo de archivo. Es la única capa que conoce el flujo completo — readers,
validators, normalizers y repository son piezas independientes y reusables
(cada una testeable por separado, sin depender de las demás).
"""

import uuid
from collections.abc import Awaitable, Callable
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.etl import repository
from app.etl.column_specs import (
    AUSPICIOS_SPEC,
    DATA_SPEC,
    KEYWORDS_SPEC,
    SPLIT_SENSE_SPEC,
    FileTypeSpec,
)
from app.etl.exceptions import FileStructureError, RowValidationError, UnknownProgramaError
from app.etl.models import LoadReport, ProgramaRef, RejectedRow
from app.etl.normalizers import (
    prepare_auspicios_row,
    prepare_data_row,
    prepare_keywords_row,
    prepare_split_sense_row,
)
from app.etl.readers import read_rows
from app.etl.validators import validate_row
from app.models.enums import UploadStatus
from app.models.upload_log import UploadLog

RowPreparer = Callable[[dict[str, Any]], tuple[dict[str, Any], ProgramaRef]]
BulkUpserter = Callable[[AsyncSession, list[dict[str, Any]]], Awaitable[None]]


async def run_data_pipeline(
    session: AsyncSession,
    file_path: Path,
    uploaded_by_id: uuid.UUID,
    original_filename: str | None = None,
) -> LoadReport:
    return await _run_pipeline(
        session,
        DATA_SPEC,
        file_path,
        uploaded_by_id,
        prepare_data_row,
        repository.upsert_fact_audiencia,
        original_filename,
    )


async def run_auspicios_pipeline(
    session: AsyncSession,
    file_path: Path,
    uploaded_by_id: uuid.UUID,
    original_filename: str | None = None,
) -> LoadReport:
    return await _run_pipeline(
        session,
        AUSPICIOS_SPEC,
        file_path,
        uploaded_by_id,
        prepare_auspicios_row,
        repository.upsert_dim_auspicios,
        original_filename,
    )


async def run_keywords_pipeline(
    session: AsyncSession,
    file_path: Path,
    uploaded_by_id: uuid.UUID,
    original_filename: str | None = None,
) -> LoadReport:
    return await _run_pipeline(
        session,
        KEYWORDS_SPEC,
        file_path,
        uploaded_by_id,
        prepare_keywords_row,
        repository.upsert_fact_keywords,
        original_filename,
    )


async def run_split_sense_pipeline(
    session: AsyncSession,
    file_path: Path,
    uploaded_by_id: uuid.UUID,
    original_filename: str | None = None,
) -> LoadReport:
    return await _run_pipeline(
        session,
        SPLIT_SENSE_SPEC,
        file_path,
        uploaded_by_id,
        prepare_split_sense_row,
        repository.upsert_fact_sentimiento,
        original_filename,
    )


async def _run_pipeline(
    session: AsyncSession,
    spec: FileTypeSpec,
    file_path: Path,
    uploaded_by_id: uuid.UUID,
    prepare_row: RowPreparer,
    bulk_upsert: BulkUpserter,
    original_filename: str | None = None,
) -> LoadReport:
    # `file_path` puede ser un nombre temporal generado por el servidor (UUID)
    # distinto del archivo que el Admin subió — `original_filename` es lo que
    # se muestra/audita; por defecto (scripts, tests) coincide con file_path.name.
    display_name = original_filename or file_path.name

    started_at = datetime.now(UTC)
    upload_log = await repository.create_upload_log(
        session,
        uploaded_by_id=uploaded_by_id,
        file_type=spec.file_type,
        file_path=file_path,
        original_filename=display_name,
    )
    await repository.write_audit_log(
        session,
        user_id=uploaded_by_id,
        action="FILE_UPLOAD_START",
        extra={"file_type": spec.file_type.value, "filename": display_name},
    )

    try:
        raw_rows = read_rows(spec, file_path)
    except FileStructureError as exc:
        return await _finish_as_structure_error(
            session, upload_log, spec, display_name, uploaded_by_id, started_at, exc
        )

    rejected: list[RejectedRow] = []
    prepared: list[tuple[int, dict[str, Any], ProgramaRef]] = []

    for index, raw_row in enumerate(raw_rows):
        try:
            clean = validate_row(spec, raw_row)
            row, programa_ref = prepare_row(clean)
            prepared.append((index, row, programa_ref))
        except RowValidationError as exc:
            rejected.append(RejectedRow(row_index=index, reason=str(exc), raw_data=raw_row))

    final_rows = await _resolve_programas(session, prepared, rejected)

    await bulk_upsert(session, final_rows)

    status = UploadStatus.SUCCESS
    await repository.complete_upload_log(
        session,
        upload_log,
        rows_total=len(raw_rows),
        rows_loaded=len(final_rows),
        rows_skipped=len(rejected),
        status=status,
        error_detail={"rejected": [r.__dict__ for r in rejected]} if rejected else None,
    )
    await repository.write_audit_log(
        session,
        user_id=uploaded_by_id,
        action="FILE_UPLOAD_SUCCESS",
        extra={
            "file_type": spec.file_type.value,
            "rows_loaded": len(final_rows),
            "rows_skipped": len(rejected),
            "upload_id": str(upload_log.id),
        },
    )

    return LoadReport(
        file_type=spec.file_type.value,
        original_filename=display_name,
        rows_total=len(raw_rows),
        rows_loaded=len(final_rows),
        rows_skipped=len(rejected),
        rejected=rejected,
        status=status.value,
        started_at=started_at,
        completed_at=datetime.now(UTC),
        upload_log_id=upload_log.id,
    )


async def _resolve_programas(
    session: AsyncSession,
    prepared: list[tuple[int, dict[str, Any], ProgramaRef]],
    rejected: list[RejectedRow],
) -> list[dict[str, Any]]:
    """Resuelve programa_id en batch, con una sola consulta/creación por
    nombre de programa único en el archivo (no una por fila) para no hacer
    N round-trips a la base de datos cuando el mismo programa se repite en
    cientos de filas (caso típico de audiencia diaria).
    """
    programa_cache: dict[str, int | None] = {}
    programa_errors: dict[str, str] = {}
    final_rows: list[dict[str, Any]] = []

    for index, row, ref in prepared:
        if ref.nombre not in programa_cache:
            try:
                programa_cache[ref.nombre] = await repository.get_or_create_programa(
                    session,
                    nombre=ref.nombre,
                    canal=ref.canal,
                    categoria=ref.categoria,
                    tipo=ref.tipo,
                    authoritative=ref.authoritative,
                )
            except UnknownProgramaError as exc:
                programa_cache[ref.nombre] = None
                programa_errors[ref.nombre] = str(exc)

        programa_id = programa_cache[ref.nombre]
        if programa_id is None:
            rejected.append(
                RejectedRow(row_index=index, reason=programa_errors[ref.nombre], raw_data=row)
            )
            continue

        row["programa_id"] = programa_id
        final_rows.append(row)

    return final_rows


async def _finish_as_structure_error(
    session: AsyncSession,
    upload_log: UploadLog,
    spec: FileTypeSpec,
    display_name: str,
    uploaded_by_id: uuid.UUID,
    started_at: datetime,
    exc: FileStructureError,
) -> LoadReport:
    await repository.complete_upload_log(
        session,
        upload_log,
        rows_total=0,
        rows_loaded=0,
        rows_skipped=0,
        status=UploadStatus.ERROR,
        error_detail={"error": str(exc)},
    )
    await repository.write_audit_log(
        session,
        user_id=uploaded_by_id,
        action="FILE_UPLOAD_ERROR",
        extra={"file_type": spec.file_type.value, "error": str(exc)},
    )
    return LoadReport(
        file_type=spec.file_type.value,
        original_filename=display_name,
        rows_total=0,
        rows_loaded=0,
        rows_skipped=0,
        rejected=[],
        status="error",
        started_at=started_at,
        completed_at=datetime.now(UTC),
        upload_log_id=upload_log.id,
        error_message=str(exc),
    )
