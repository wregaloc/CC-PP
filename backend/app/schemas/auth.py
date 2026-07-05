from pydantic import BaseModel, EmailStr, Field, field_validator

from app.schemas.password_policy import (
    PASSWORD_MAX_LENGTH,
    PASSWORD_MIN_LENGTH,
    validate_password_policy,
)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(
        min_length=1,
        max_length=PASSWORD_MAX_LENGTH,
        description="Contraseña en texto plano, nunca logueada",
    )


class TokenResponse(BaseModel):
    access_token: str = Field(description="JWT de vida corta — enviar en Authorization: Bearer")
    token_type: str = "bearer"
    expires_in: int = Field(description="Segundos hasta la expiración del access_token")


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(min_length=1, max_length=PASSWORD_MAX_LENGTH)
    new_password: str = Field(
        min_length=PASSWORD_MIN_LENGTH,
        max_length=PASSWORD_MAX_LENGTH,
        description="Ver política de contraseñas",
    )

    @field_validator("new_password")
    @classmethod
    def validate_new_password(cls, value: str) -> str:
        return validate_password_policy(value)


class MessageResponse(BaseModel):
    detail: str
