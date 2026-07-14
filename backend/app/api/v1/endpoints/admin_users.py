import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies.auth import require_admin
from app.dependencies.db import get_db
from app.dependencies.pagination import PaginationParams, pagination_params
from app.models.enums import UserRole
from app.models.user import User
from app.schemas.admin_user import (
    AdminSetPasswordRequest,
    AdminUserCreate,
    AdminUserOut,
    AdminUserUpdate,
    PaginatedUsers,
)
from app.services import admin_user_service

router = APIRouter(prefix="/admin/users", tags=["admin-users"])

_RBAC_RESPONSES = {401: {"description": "No autenticado"}, 403: {"description": "Solo Admin"}}


@router.get(
    "",
    response_model=PaginatedUsers,
    summary="Listar usuarios",
    description="Lista paginada, filtrable por rol (repetible: ?role=admin&role=interno), "
    "estado y cliente asignado. Rol requerido: admin.",
    responses=_RBAC_RESPONSES,
)
async def list_users(
    role: list[UserRole] | None = Query(default=None),
    is_active: bool | None = None,
    client_id: uuid.UUID | None = None,
    pagination: PaginationParams = Depends(pagination_params),
    admin: User = Depends(require_admin),
    session: AsyncSession = Depends(get_db),
) -> PaginatedUsers:
    items, total = await admin_user_service.list_users(
        session, pagination, role=role, is_active=is_active, client_id=client_id
    )
    return PaginatedUsers(
        items=[AdminUserOut.model_validate(item) for item in items],
        page=pagination.page,
        page_size=pagination.page_size,
        total=total,
    )


@router.post(
    "",
    response_model=AdminUserOut,
    status_code=201,
    summary="Crear usuario",
    description="Crea un usuario Interno o Cliente (o otro Admin). Rol requerido: admin.",
    responses={**_RBAC_RESPONSES, 409: {"description": "Email ya registrado"}},
)
async def create_user(
    body: AdminUserCreate,
    admin: User = Depends(require_admin),
    session: AsyncSession = Depends(get_db),
) -> AdminUserOut:
    user = await admin_user_service.create_user(
        session,
        admin,
        email=body.email,
        full_name=body.full_name,
        role=body.role,
        password=body.password,
        cargo=body.cargo,
        client_id=body.client_id,
    )
    return AdminUserOut.model_validate(user)


@router.get(
    "/{user_id}",
    response_model=AdminUserOut,
    summary="Detalle de un usuario",
    description="Rol requerido: admin.",
    responses={**_RBAC_RESPONSES, 404: {"description": "Usuario no encontrado"}},
)
async def get_user(
    user_id: uuid.UUID,
    admin: User = Depends(require_admin),
    session: AsyncSession = Depends(get_db),
) -> AdminUserOut:
    user = await admin_user_service.get_user(session, user_id)
    return AdminUserOut.model_validate(user)


@router.put(
    "/{user_id}",
    response_model=AdminUserOut,
    summary="Actualizar usuario",
    description="Actualiza email, nombre y rol. Un Admin no puede cambiar su propio rol "
    "(evita auto-degradarse). Rol requerido: admin.",
    responses={
        **_RBAC_RESPONSES,
        400: {"description": "Un Admin no puede cambiar el rol de su propia cuenta"},
        404: {"description": "Usuario no encontrado"},
        409: {"description": "Email ya registrado por otro usuario"},
    },
)
async def update_user(
    user_id: uuid.UUID,
    body: AdminUserUpdate,
    admin: User = Depends(require_admin),
    session: AsyncSession = Depends(get_db),
) -> AdminUserOut:
    user = await admin_user_service.update_user(
        session,
        admin,
        user_id,
        email=body.email,
        full_name=body.full_name,
        role=body.role,
        cargo=body.cargo,
        client_id=body.client_id,
    )
    return AdminUserOut.model_validate(user)


@router.patch(
    "/{user_id}/toggle-active",
    response_model=AdminUserOut,
    summary="Activar/desactivar usuario",
    description="Alterna is_active. Un usuario desactivado recibe 401 en cualquier "
    "request aunque su token siga siendo válido. Rol requerido: admin.",
    responses={**_RBAC_RESPONSES, 404: {"description": "Usuario no encontrado"}},
)
async def toggle_active(
    user_id: uuid.UUID,
    admin: User = Depends(require_admin),
    session: AsyncSession = Depends(get_db),
) -> AdminUserOut:
    user = await admin_user_service.toggle_active(session, admin, user_id)
    return AdminUserOut.model_validate(user)


@router.post(
    "/{user_id}/set-password",
    response_model=AdminUserOut,
    summary="Fijar contraseña de un usuario",
    description="Fase 10 §Módulo 4: el Admin fija la contraseña directamente, sin conocer la "
    "actual — es la única vía de gestión de credenciales para el rol Cliente "
    "(ver POST /auth/change-password). Rol requerido: admin.",
    responses={**_RBAC_RESPONSES, 404: {"description": "Usuario no encontrado"}},
)
async def set_password(
    user_id: uuid.UUID,
    body: AdminSetPasswordRequest,
    admin: User = Depends(require_admin),
    session: AsyncSession = Depends(get_db),
) -> AdminUserOut:
    user = await admin_user_service.set_password(session, admin, user_id, new_password=body.password)
    return AdminUserOut.model_validate(user)
