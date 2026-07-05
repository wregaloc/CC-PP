"""Orquesta la carga HTTP de archivos: guarda el UploadFile en disco de forma
segura y streameada (nunca confía en Content-Length del cliente), despacha al
pipeline ETL correspondiente, y borra el archivo temporal al terminar — el
archivo crudo no se conserva, el dato ya vive en Postgres (ver docs/API.md).
"""

import uuid
from datetime import UTC, datetime
from pathlib import Path

from fastapi import UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings
from app.dependencies.pagination import PaginationParams
from app.etl import pipeline
from app.etl.models import LoadReport
from app.etl.readers import MAX_FILE_SIZE_BYTES
from app.exceptions.uploads import FileTooLargeError, UploadRejectedError
from app.models.enums import UploadFileType
from app.models.upload_log import UploadLog
from app.repositories import upload_log_repository

_CHUNK_SIZE_BYTES = 1024 * 1024  # 1 MB — no se lee el archivo completo en memoria

_PIPELINES = {
    UploadFileType.DATA: pipeline.run_data_pipeline,
    UploadFileType.AUSPICIOS: pipeline.run_auspicios_pipeline,
    UploadFileType.KEYWORDS: pipeline.run_keywords_pipeline,
    UploadFileType.SPLIT_SENSE: pipeline.run_split_sense_pipeline,
}


async def process_upload(
    session: AsyncSession,
    settings: Settings,
    file_type: UploadFileType,
    upload_file: UploadFile,
    uploaded_by_id: uuid.UUID,
) -> LoadReport:
    """Guarda, procesa y limpia. Lanza UploadRejectedError (422) si el pipeline
    rechazó el archivo completo — el llamador (endpoint) no necesita chequear
    report.status, el error ya viene traducido a HTTP en exceptions/handlers.py.
    """
    original_filename = upload_file.filename or "archivo_sin_nombre"
    file_path = await _save_upload_file(settings, upload_file)

    try:
        run_pipeline = _PIPELINES[file_type]
        report = await run_pipeline(session, file_path, uploaded_by_id, original_filename)
        await session.commit()
    finally:
        file_path.unlink(missing_ok=True)

    if report.status == "error":
        raise UploadRejectedError(report)
    return report


async def _save_upload_file(settings: Settings, upload_file: UploadFile) -> Path:
    storage_dir = Path(settings.upload_storage_dir)
    storage_dir.mkdir(parents=True, exist_ok=True)

    suffix = Path(upload_file.filename or "").suffix
    unique_name = f"{datetime.now(UTC):%Y%m%dT%H%M%S%f}_{uuid.uuid4().hex}{suffix}"
    destination = storage_dir / unique_name

    size = 0
    try:
        with destination.open("wb") as buffer:
            while chunk := await upload_file.read(_CHUNK_SIZE_BYTES):
                size += len(chunk)
                if size > MAX_FILE_SIZE_BYTES:
                    raise FileTooLargeError(size_bytes=size, max_bytes=MAX_FILE_SIZE_BYTES)
                buffer.write(chunk)
    except FileTooLargeError:
        destination.unlink(missing_ok=True)
        raise
    finally:
        await upload_file.close()

    return destination


async def get_upload_detail(session: AsyncSession, upload_id: uuid.UUID) -> UploadLog | None:
    return await upload_log_repository.get_by_id(session, upload_id)


async def list_upload_history(
    session: AsyncSession, pagination: PaginationParams, file_type: UploadFileType | None
) -> tuple[list[UploadLog], int]:
    return await upload_log_repository.list_paginated(session, pagination, file_type=file_type)
