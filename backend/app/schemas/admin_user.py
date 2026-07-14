import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from app.models.enums import UserRole
from app.schemas.password_policy import (
    PASSWORD_MAX_LENGTH,
    PASSWORD_MIN_LENGTH,
    validate_password_policy,
)


class AdminUserCreate(BaseModel):
    email: EmailStr
    full_name: str = Field(min_length=1, max_length=100)
    role: UserRole
    password: str = Field(
        min_length=PASSWORD_MIN_LENGTH,
        max_length=PASSWORD_MAX_LENGTH,
        description="Ver política de contraseñas",
    )
    cargo: str | None = Field(
        default=None, max_length=100, description="Solo aplica a role admin/interno (Fase 10)"
    )
    client_id: uuid.UUID | None = Field(
        default=None, description="Empresa asignada — solo aplica a role cliente (Fase 10)"
    )

    @field_validator("password")
    @classmethod
    def validate_password(cls, value: str) -> str:
        return validate_password_policy(value)


class AdminUserUpdate(BaseModel):
    """TDD §8.9 PUT /admin/users/{id}: "Actualiza email, nombre, rol" — la
    contraseña se cambia únicamente vía POST /admin/users/{id}/set-password
    (Fase 10 §Módulo 4) o /auth/change-password (autoservicio Interno)."""

    email: EmailStr
    full_name: str = Field(min_length=1, max_length=100)
    role: UserRole
    cargo: str | None = Field(default=None, max_length=100)
    client_id: uuid.UUID | None = None


class AdminUserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: str
    full_name: str
    role: UserRole
    cargo: str | None
    client_id: uuid.UUID | None
    is_active: bool
    created_at: datetime
    last_login_at: datetime | None
    created_by_id: uuid.UUID | None


class PaginatedUsers(BaseModel):
    items: list[AdminUserOut]
    page: int
    page_size: int
    total: int


class AdminSetPasswordRequest(BaseModel):
    """Fase 10 §Módulo 4: el Admin fija la contraseña directamente (no requiere
    conocer la actual, a diferencia de /auth/change-password) — es la única
    vía de gestión de credenciales para el rol Cliente."""

    password: str = Field(min_length=PASSWORD_MIN_LENGTH, max_length=PASSWORD_MAX_LENGTH)

    @field_validator("password")
    @classmethod
    def validate_password(cls, value: str) -> str:
        return validate_password_policy(value)
