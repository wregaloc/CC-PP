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

from app.etl.models import ProgramaRef
from app.models.audit_log import AuditLog
from app.models.dim_auspicios import Auspicio
from app.models.dim_programa import Programa
from app.models.enums import UploadFileType, UploadStatus
from app.models.fact_audiencia import FactAudiencia
from app.models.fact_keywords import FactKeywords
from app.models.fact_sentimiento import FactSentimiento
from app.models.upload_log import UploadLog


# Tope de nombres por sentencia (IN / INSERT masivo) — muy por debajo del
# límite de 32,767 parámetros de asyncpg incluso con 4 columnas por fila.
_RESOLVE_CHUNK = 1000


async def bulk_resolve_programas(
    session: AsyncSession, refs: list[ProgramaRef]
) -> dict[str, int]:
    """Resuelve TODOS los programas de una carga en un puñado de consultas en
    bloque (SELECT + INSERT masivo + re-SELECT), en vez de un round-trip por
    programa único: con ~1,300 programas únicos y un pooler remoto (Supabase),
    la versión fila-a-fila mantenía la transacción abierta varios minutos y la
    conexión terminaba cortada a mitad de carga (visto en dev, 15/07/2026).

    Misma semántica que la versión fila-a-fila que reemplaza:
    - Existente + authoritative (DATA): pisa canal/categoria/tipo con los
      valores no-None del archivo — "DATA manda" sobre la dimensión programa.
    - Existente + no authoritative (AUSPICIOS): no toca nada.
    - Nuevo + canal presente: se crea (ON CONFLICT DO NOTHING para que dos
      cargas concurrentes no rompan con IntegrityError — TOCTOU).
    - Nuevo + sin canal (KEYWORDS, SPLIT SENSE): queda fuera del dict
      devuelto — el caller rechaza sus filas, nunca se inventa un canal
      placeholder que corrompería la dimensión.
    """
    unique: dict[str, ProgramaRef] = {}
    for ref in refs:
        unique.setdefault(ref.nombre, ref)
    nombres = list(unique)
    resolved: dict[str, int] = {}

    # 1) Existentes — entidades completas porque los refs autoritativos
    #    actualizan atributos (el flush agrupa los UPDATEs en executemany).
    for i in range(0, len(nombres), _RESOLVE_CHUNK):
        chunk = nombres[i : i + _RESOLVE_CHUNK]
        result = await session.execute(select(Programa).where(Programa.nombre.in_(chunk)))
        for programa in result.scalars():
            ref = unique[programa.nombre]
            if ref.authoritative:
                if ref.canal is not None:
                    programa.canal = ref.canal
                if ref.categoria is not None:
                    programa.categoria = ref.categoria
                if ref.tipo is not None:
                    programa.tipo = ref.tipo
            resolved[programa.nombre] = programa.id

    # 2) Nuevos con canal → INSERT masivo.
    nuevos = [unique[n] for n in nombres if n not in resolved and unique[n].canal is not None]
    for i in range(0, len(nuevos), _RESOLVE_CHUNK):
        chunk = nuevos[i : i + _RESOLVE_CHUNK]
        stmt = (
            pg_insert(Programa)
            .values(
                [
                    {"nombre": r.nombre, "canal": r.canal, "categoria": r.categoria, "tipo": r.tipo}
                    for r in chunk
                ]
            )
            .on_conflict_do_nothing(index_elements=["nombre"])
            .returning(Programa.id, Programa.nombre)
        )
        for programa_id, nombre in (await session.execute(stmt)).all():
            resolved[nombre] = programa_id

    # 3) Los que el DO NOTHING saltó (otra transacción los creó entre el
    #    SELECT y el INSERT) — un re-SELECT los recupera.
    faltantes = [r.nombre for r in nuevos if r.nombre not in resolved]
    if faltantes:
        result = await session.execute(
            select(Programa.id, Programa.nombre).where(Programa.nombre.in_(faltantes))
        )
        for programa_id, nombre in result.all():
            resolved[nombre] = programa_id

    return resolved


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
