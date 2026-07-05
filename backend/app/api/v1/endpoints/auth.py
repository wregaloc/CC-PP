from fastapi import APIRouter, Depends, Request, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings, get_settings
from app.core.security import InvalidTokenError
from app.dependencies.auth import get_current_user
from app.dependencies.db import get_db
from app.models.user import User
from app.schemas.auth import ChangePasswordRequest, LoginRequest, MessageResponse, TokenResponse
from app.services import auth_service

router = APIRouter(prefix="/auth", tags=["auth"])

REFRESH_COOKIE_NAME = "refresh_token"
REFRESH_COOKIE_PATH = "/api/v1/auth"


def _set_refresh_cookie(
    response: Response, settings: Settings, token: str, max_age_seconds: int
) -> None:
    response.set_cookie(
        key=REFRESH_COOKIE_NAME,
        value=token,
        httponly=True,
        secure=settings.cookie_secure,
        samesite="strict",
        max_age=max_age_seconds,
        path=REFRESH_COOKIE_PATH,
    )


@router.post(
    "/login",
    response_model=TokenResponse,
    summary="Login",
    description="Verifica email+contraseña (bcrypt) y emite access_token + refresh_token "
    "(cookie HttpOnly). Rol requerido: público.",
    responses={
        401: {"description": "Credenciales inválidas"},
        429: {"description": "Demasiados intentos de login (rate limit por IP)"},
    },
)
async def login(
    body: LoginRequest,
    request: Request,
    response: Response,
    session: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> TokenResponse:
    result = await auth_service.login(
        session,
        settings,
        email=body.email,
        password=body.password,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    _set_refresh_cookie(
        response, settings, result.refresh_token, settings.jwt_refresh_token_expire_days * 24 * 3600
    )
    return TokenResponse(
        access_token=result.access_token,
        expires_in=settings.jwt_access_token_expire_minutes * 60,
    )


@router.post(
    "/refresh",
    response_model=TokenResponse,
    summary="Refresh",
    description="Emite un nuevo access_token a partir del refresh_token (cookie). "
    "Rol requerido: público (refresh token).",
    responses={401: {"description": "Refresh token ausente, inválido, expirado o revocado"}},
)
async def refresh(
    request: Request,
    session: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> TokenResponse:
    refresh_token = request.cookies.get(REFRESH_COOKIE_NAME)
    if refresh_token is None:
        raise InvalidTokenError

    access_token = await auth_service.refresh_access_token(session, settings, refresh_token)
    return TokenResponse(
        access_token=access_token, expires_in=settings.jwt_access_token_expire_minutes * 60
    )


@router.post(
    "/logout",
    response_model=MessageResponse,
    summary="Logout",
    description="Invalida el refresh_token (blacklist) y limpia la cookie. "
    "Rol requerido: autenticado.",
)
async def logout(
    request: Request,
    response: Response,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> MessageResponse:
    refresh_token = request.cookies.get(REFRESH_COOKIE_NAME)
    await auth_service.logout(
        session,
        settings,
        current_user,
        refresh_token,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    response.delete_cookie(REFRESH_COOKIE_NAME, path=REFRESH_COOKIE_PATH)
    return MessageResponse(detail="Sesión cerrada")


@router.post(
    "/change-password",
    response_model=MessageResponse,
    summary="Cambiar contraseña",
    description="Cambia la contraseña del usuario autenticado. Rol requerido: autenticado.",
    responses={401: {"description": "Contraseña actual incorrecta o no autenticado"}},
)
async def change_password(
    body: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> MessageResponse:
    await auth_service.change_password(
        session, current_user, body.current_password, body.new_password
    )
    return MessageResponse(detail="Contraseña actualizada")
