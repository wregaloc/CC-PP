import uuid

from fastapi import APIRouter, Depends, File, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings, get_settings
from app.dependencies.auth import require_admin
from app.dependencies.db import get_db
from app.dependencies.pagination import PaginationParams, pagination_params
from app.models.user import User
from app.schemas.admin_user import AdminUserOut, PaginatedUsers
from app.schemas.client import ClientCreate, ClientOut, ClientUpdate, PaginatedClients
from app.services import admin_user_service, client_service

router = APIRouter(prefix="/admin/clients", tags=["admin-clients"])

_RBAC_RESPONSES = {401: {"description": "No autenticado"}, 403: {"description": "Solo Admin"}}
_NOT_FOUND_RESPONSE = {404: {"description": "No existe un cliente con ese id"}}


@router.get(
    "",
    response_model=PaginatedClients,
    summary="Listar clientes",
    description="Lista paginada de empresas cliente, filtrable por estado y nombre. "
    "Rol requerido: admin.",
    responses=_RBAC_RESPONSES,
)
async def list_clients(
    is_active: bool | None = None,
    search: str | None = None,
    pagination: PaginationParams = Depends(pagination_params),
    admin: User = Depends(require_admin),
    session: AsyncSession = Depends(get_db),
) -> PaginatedClients:
    items, total = await client_service.list_clients(
        session, pagination, is_active=is_active, search=search
    )
    return PaginatedClients(
        items=items, page=pagination.page, page_size=pagination.page_size, total=total
    )


@router.post(
    "",
    response_model=ClientOut,
    status_code=201,
    summary="Crear cliente",
    description="Rol requerido: admin.",
    responses=_RBAC_RESPONSES,
)
async def create_client(
    body: ClientCreate,
    admin: User = Depends(require_admin),
    session: AsyncSession = Depends(get_db),
) -> ClientOut:
    return await client_service.create_client(session, admin, name=body.name)


@router.get(
    "/{client_id}",
    response_model=ClientOut,
    summary="Detalle de un cliente",
    description="Rol requerido: admin.",
    responses={**_RBAC_RESPONSES, **_NOT_FOUND_RESPONSE},
)
async def get_client(
    client_id: uuid.UUID,
    admin: User = Depends(require_admin),
    session: AsyncSession = Depends(get_db),
) -> ClientOut:
    return await client_service.get_client(session, client_id)


@router.put(
    "/{client_id}",
    response_model=ClientOut,
    summary="Actualizar cliente",
    description="Rol requerido: admin.",
    responses={**_RBAC_RESPONSES, **_NOT_FOUND_RESPONSE},
)
async def update_client(
    client_id: uuid.UUID,
    body: ClientUpdate,
    admin: User = Depends(require_admin),
    session: AsyncSession = Depends(get_db),
) -> ClientOut:
    return await client_service.update_client(session, admin, client_id, name=body.name)


@router.patch(
    "/{client_id}/toggle-active",
    response_model=ClientOut,
    summary="Activar/desactivar cliente",
    description="Rol requerido: admin.",
    responses={**_RBAC_RESPONSES, **_NOT_FOUND_RESPONSE},
)
async def toggle_client_active(
    client_id: uuid.UUID,
    admin: User = Depends(require_admin),
    session: AsyncSession = Depends(get_db),
) -> ClientOut:
    return await client_service.toggle_active(session, admin, client_id)


@router.post(
    "/{client_id}/logo",
    response_model=ClientOut,
    summary="Subir logo del cliente",
    description="Acepta PNG/JPEG/WEBP hasta 2 MB, validado por firma binaria real "
    "(no por extensión). Rol requerido: admin.",
    responses={
        **_RBAC_RESPONSES,
        **_NOT_FOUND_RESPONSE,
        413: {"description": "El logo supera 2 MB"},
        422: {"description": "El archivo no es una imagen PNG/JPEG/WEBP válida"},
    },
)
async def upload_client_logo(
    client_id: uuid.UUID,
    file: UploadFile = File(...),
    admin: User = Depends(require_admin),
    session: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> ClientOut:
    return await client_service.set_logo(session, settings, admin, client_id, file)


@router.get(
    "/{client_id}/logo",
    summary="Logo del cliente",
    description="Sirve el archivo del logo directamente — sin autenticación, ya que un logo de "
    "empresa no es información sensible y el id es un UUID no adivinable (permite usarlo "
    "directamente en un <img src>). Rol requerido: público.",
    responses={404: {"description": "El cliente no existe o no tiene logo cargado"}},
)
async def get_client_logo(
    client_id: uuid.UUID,
    session: AsyncSession = Depends(get_db),
) -> FileResponse:
    logo_path = await client_service.get_logo_path(session, client_id)
    return FileResponse(logo_path)


@router.get(
    "/{client_id}/users",
    response_model=PaginatedUsers,
    summary="Usuarios asignados al cliente",
    description="Rol requerido: admin.",
    responses=_RBAC_RESPONSES,
)
async def list_client_users(
    client_id: uuid.UUID,
    pagination: PaginationParams = Depends(pagination_params),
    admin: User = Depends(require_admin),
    session: AsyncSession = Depends(get_db),
) -> PaginatedUsers:
    items, total = await admin_user_service.list_users(
        session, pagination, role=None, is_active=None, client_id=client_id
    )
    return PaginatedUsers(
        items=[AdminUserOut.model_validate(item) for item in items],
        page=pagination.page,
        page_size=pagination.page_size,
        total=total,
    )
