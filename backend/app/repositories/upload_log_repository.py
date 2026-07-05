import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.dependencies.pagination import PaginationParams
from app.models.enums import UploadFileType
from app.models.upload_log import UploadLog


async def get_by_id(session: AsyncSession, upload_id: uuid.UUID) -> UploadLog | None:
    result = await session.execute(
        select(UploadLog)
        .where(UploadLog.id == upload_id)
        .options(selectinload(UploadLog.uploaded_by))
    )
    return result.scalar_one_or_none()


async def list_paginated(
    session: AsyncSession,
    pagination: PaginationParams,
    *,
    file_type: UploadFileType | None = None,
) -> tuple[list[UploadLog], int]:
    filters = []
    if file_type is not None:
        filters.append(UploadLog.file_type == file_type)

    total = (
        await session.execute(select(func.count()).select_from(UploadLog).where(*filters))
    ).scalar_one()

    result = await session.execute(
        select(UploadLog)
        .where(*filters)
        .options(selectinload(UploadLog.uploaded_by))
        .order_by(UploadLog.started_at.desc())
        .offset(pagination.offset)
        .limit(pagination.page_size)
    )
    return list(result.scalars().all()), total
