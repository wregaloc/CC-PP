import uuid

from fastapi import APIRouter, Depends, File, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings, get_settings
from app.dependencies.auth import require_admin
from app.dependencies.db import get_db
from app.dependencies.pagination import PaginationParams, pagination_params
from app.exceptions.uploads import UploadNotFoundError
from app.models.enums import UploadFileType
from app.models.user import User
from app.schemas.upload import (
    PaginatedUploadHistory,
    UploadLogDetail,
    UploadLogSummary,
    UploadResultResponse,
)
from app.services import upload_service

router = APIRouter(prefix="/uploads", tags=["uploads"])

_UPLOAD_RESPONSES = {
    401: {"description": "No autenticado"},
    403: {"description": "Rol sin permiso (solo Admin)"},
    413: {"description": "Archivo supera 10 MB"},
    422: {"description": "Archivo con formato, columnas o encoding inválido"},
}


async def _upload(
    file_type: UploadFileType,
    file: UploadFile,
    admin: User,
    session: AsyncSession,
    settings: Settings,
) -> UploadResultResponse:
    report = await upload_service.process_upload(session, settings, file_type, file, admin.id)
    return UploadResultResponse.from_report(report)


@router.post(
    "/data",
    response_model=UploadResultResponse,
    status_code=201,
    summary="Subir archivo DATA (.csv o .xlsx)",
    description="Procesa audiencia diaria. Rol requerido: admin.",
    responses=_UPLOAD_RESPONSES,
)
async def upload_data(
    file: UploadFile = File(...),
    admin: User = Depends(require_admin),
    session: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> UploadResultResponse:
    return await _upload(UploadFileType.DATA, file, admin, session, settings)


@router.post(
    "/keywords",
    response_model=UploadResultResponse,
    status_code=201,
    summary="Subir archivo KEYWORDS (.xlsx)",
    description="Procesa hashtags/keywords por programa. Rol requerido: admin.",
    responses=_UPLOAD_RESPONSES,
)
async def upload_keywords(
    file: UploadFile = File(...),
    admin: User = Depends(require_admin),
    session: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> UploadResultResponse:
    return await _upload(UploadFileType.KEYWORDS, file, admin, session, settings)


@router.post(
    "/split-sense",
    response_model=UploadResultResponse,
    status_code=201,
    summary="Subir archivo SPLIT SENSE (.xlsx)",
    description="Procesa scores de sentimiento por programa/mes. Rol requerido: admin.",
    responses=_UPLOAD_RESPONSES,
)
async def upload_split_sense(
    file: UploadFile = File(...),
    admin: User = Depends(require_admin),
    session: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> UploadResultResponse:
    return await _upload(UploadFileType.SPLIT_SENSE, file, admin, session, settings)


@router.post(
    "/auspicios",
    response_model=UploadResultResponse,
    status_code=201,
    summary="Subir archivo AUSPICIOS (.xlsx)",
    description="Procesa marcas patrocinadoras por programa/mes. Rol requerido: admin.",
    responses=_UPLOAD_RESPONSES,
)
async def upload_auspicios(
    file: UploadFile = File(...),
    admin: User = Depends(require_admin),
    session: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> UploadResultResponse:
    return await _upload(UploadFileType.AUSPICIOS, file, admin, session, settings)


@router.get(
    "/history",
    response_model=PaginatedUploadHistory,
    summary="Historial de cargas",
    description="Lista paginada de cargas de archivo, más recientes primero. Rol requerido: admin.",
    responses={401: {"description": "No autenticado"}, 403: {"description": "Solo Admin"}},
)
async def get_upload_history(
    file_type: UploadFileType | None = None,
    pagination: PaginationParams = Depends(pagination_params),
    admin: User = Depends(require_admin),
    session: AsyncSession = Depends(get_db),
) -> PaginatedUploadHistory:
    items, total = await upload_service.list_upload_history(session, pagination, file_type)
    return PaginatedUploadHistory(
        items=[UploadLogSummary.from_model(item) for item in items],
        page=pagination.page,
        page_size=pagination.page_size,
        total=total,
    )


@router.get(
    "/{upload_id}",
    response_model=UploadLogDetail,
    summary="Detalle de una carga",
    description="Incluye las filas rechazadas y el motivo de cada una. Rol requerido: admin.",
    responses={
        401: {"description": "No autenticado"},
        403: {"description": "Solo Admin"},
        404: {"description": "No existe una carga con ese id"},
    },
)
async def get_upload_detail(
    upload_id: uuid.UUID,
    admin: User = Depends(require_admin),
    session: AsyncSession = Depends(get_db),
) -> UploadLogDetail:
    upload_log = await upload_service.get_upload_detail(session, upload_id)
    if upload_log is None:
        raise UploadNotFoundError
    return UploadLogDetail.from_model(upload_log)
