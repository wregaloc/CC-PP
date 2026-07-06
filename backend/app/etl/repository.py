"""Load: upsert a PostgreSQL vía SQLAlchemy Core (INSERT ... ON CONFLICT), y
registro de auditoría (upload_logs, audit_logs). Es la única capa del ETL que
toca la base de datos — ver [[fastapi-enterprise-backend]] (separación por capas)
y [[data-engineering-postgresql]] (UPSERT con ON CONFLICT, nunca duplicar filas).
"""

import uuid
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.etl.exceptions import UnknownProgramaError
from app.models.audit_log import AuditLog
from app.models.dim_auspicios import Auspicio
from app.models.dim_programa import Programa
from app.models.enums import UploadFileType, UploadStatus
from app.models.fact_audiencia import FactAudiencia
from app.models.fact_keywords import FactKeywords
from app.models.fact_sentimiento import FactSentimiento
from app.models.upload_log import UploadLog


async def get_or_create_programa(
    session: AsyncSession,
    *,
    nombre: str,
    canal: str | None,
    categoria: str | None,
    tipo: str | None,
    authoritative: bool,
) -> int:
    """Resuelve el id de un programa por nombre (clave natural).

    - Si ya existe y `authoritative` (fuente DATA): actualiza canal/categoria/tipo
      sin condiciones — "DATA manda" sobre la dimensión programa (decisión
      confirmada explícitamente por el usuario durante el diseño del esquema).
    - Si ya existe y no es autoritativa (p. ej. AUSPICIOS): nunca sobreescribe
      canal/categoria/tipo existentes, aunque difieran de los del archivo actual.
    - Si no existe y hay `canal`: se crea (DATA o AUSPICIOS pueden crear
      programas nuevos, porque ambos traen esa información).
    - Si no existe y no hay `canal` (KEYWORDS, SPLIT SENSE): se rechaza — nunca
      se inventa un canal placeholder que corrompería la dimensión.
    """
    result = await session.execute(select(Programa).where(Programa.nombre == nombre))
    programa = result.scalar_one_or_none()

    if programa is not None:
        if authoritative:
            if canal is not None:
                programa.canal = canal
            if categoria is not None:
                programa.categoria = categoria
            if tipo is not None:
                programa.tipo = tipo
        return programa.id

    if canal is None:
        raise UnknownProgramaError(
            f"El programa '{nombre}' no existe todavía y este archivo no trae "
            "el canal necesario para crearlo (requiere una carga de DATA o "
            "AUSPICIOS primero)."
        )

    # INSERT ... ON CONFLICT DO NOTHING en vez de un INSERT plano: si dos cargas
    # concurrentes ven ambas "no existe" en el SELECT de arriba (TOCTOU) y
    # ambas intentan crear el mismo programa nuevo, un INSERT plano rompería
    # la segunda con un IntegrityError sin manejar (falla toda la carga con un
    # 500 confuso). Con ON CONFLICT, la segunda simplemente no inserta nada y
    # el SELECT de abajo recupera la fila que sí se creó.
    stmt = (
        pg_insert(Programa)
        .values(nombre=nombre, canal=canal, categoria=categoria, tipo=tipo)
        .on_conflict_do_nothing(index_elements=["nombre"])
        .returning(Programa.id)
    )
    programa_id = (await session.execute(stmt)).scalar_one_or_none()
    if programa_id is not None:
        return programa_id

    result = await session.execute(select(Programa.id).where(Programa.nombre == nombre))
    return result.scalar_one()


async def upsert_fact_audiencia(session: AsyncSession, rows: list[dict[str, Any]]) -> None:
    await _upsert(session, FactAudiencia, rows, conflict_cols=["fecha", "programa_id"])


async def upsert_fact_keywords(session: AsyncSession, rows: list[dict[str, Any]]) -> None:
    await _upsert(
        session,
        FactKeywords,
        rows,
        conflict_cols=["anio", "mes_num", "programa_id", "hashtag", "sentimiento"],
    )


async def upsert_fact_sentimiento(session: AsyncSession, rows: list[dict[str, Any]]) -> None:
    await _upsert(session, FactSentimiento, rows, conflict_cols=["anio", "mes_num", "programa_id"])


async def upsert_dim_auspicios(session: AsyncSession, rows: list[dict[str, Any]]) -> None:
    await _upsert(
        session, Auspicio, rows, conflict_cols=["mes_num", "programa_id", "auspiciador"]
    )


# asyncpg/PostgreSQL rechaza una sola consulta con más de 32,767 parámetros
# ($1, $2, ...) — un INSERT de todas las filas de una carga real (decenas de
# miles) en una sola sentencia lo supera fácilmente. 1000 filas por lote deja
# margen holgado incluso para el modelo con más columnas de los 4 (~17), sin
# acercarse al límite.
_UPSERT_BATCH_SIZE = 1000


async def _upsert(
    session: AsyncSession, model: type, rows: list[dict[str, Any]], *, conflict_cols: list[str]
) -> None:
    if not rows:
        return
    for i in range(0, len(rows), _UPSERT_BATCH_SIZE):
        batch = rows[i : i + _UPSERT_BATCH_SIZE]
        stmt = pg_insert(model).values(batch)
        update_cols = {
            c.name: getattr(stmt.excluded, c.name)
            for c in model.__table__.columns
            if c.name not in {"id", *conflict_cols}
        }
        stmt = stmt.on_conflict_do_update(index_elements=conflict_cols, set_=update_cols)
        await session.execute(stmt)


async def create_upload_log(
    session: AsyncSession,
    *,
    uploaded_by_id: uuid.UUID,
    file_type: UploadFileType,
    file_path: Path,
    original_filename: str | None = None,
) -> UploadLog:
    upload_log = UploadLog(
        uploaded_by_id=uploaded_by_id,
        file_type=file_type,
        original_filename=original_filename or file_path.name,
        stored_path=str(file_path),
        file_size_bytes=file_path.stat().st_size,
        status=UploadStatus.PROCESSING,
        started_at=datetime.now(UTC),
    )
    session.add(upload_log)
    await session.flush()
    return upload_log


async def complete_upload_log(
    session: AsyncSession,
    upload_log: UploadLog,
    *,
    rows_total: int,
    rows_loaded: int,
    rows_skipped: int,
    status: UploadStatus,
    error_detail: dict[str, Any] | None,
) -> None:
    upload_log.rows_total = rows_total
    upload_log.rows_loaded = rows_loaded
    upload_log.rows_skipped = rows_skipped
    upload_log.status = status
    upload_log.error_detail = error_detail
    upload_log.completed_at = datetime.now(UTC)


async def write_audit_log(
    session: AsyncSession,
    *,
    user_id: uuid.UUID | None,
    action: str,
    extra: dict[str, Any] | None = None,
) -> None:
    session.add(AuditLog(user_id=user_id, action=action, resource_type="upload", extra=extra))
