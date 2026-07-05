from datetime import datetime

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings
from app.core.security import (
    InvalidTokenError,
    TokenExpiredError,
    TokenType,
    create_access_token,
    create_refresh_token,
    decode_typed_token,
    hash_password,
    verify_password,
)
from app.exceptions.auth import (
    AccountInactiveError,
    InvalidCredentialsError,
    TooManyLoginAttemptsError,
)
from app.models.user import User
from app.repositories import audit_log_repository, revoked_token_repository, user_repository

# Hash bcrypt "señuelo" contra el que se compara cuando el email no existe, para
# que verify_password() siempre tarde lo mismo (~cost=12) exista o no el usuario.
# Sin esto, `user is None` corta el `or` antes de llamar a bcrypt y la respuesta
# de email-no-existe es mucho más rápida que la de contraseña-incorrecta — una
# fuga por timing que permite enumerar emails registrados aunque el mensaje de
# error sea idéntico en ambos casos (ver [[enterprise-security]]).
_DUMMY_PASSWORD_HASH = hash_password("timing-attack-mitigation-not-a-real-account")


class LoginResult:
    def __init__(self, access_token: str, refresh_token: str, refresh_expires_at: datetime) -> None:
        self.access_token = access_token
        self.refresh_token = refresh_token
        self.refresh_expires_at = refresh_expires_at


async def login(
    session: AsyncSession,
    settings: Settings,
    email: str,
    password: str,
    ip_address: str | None,
    user_agent: str | None,
) -> LoginResult:
    """TDD §9.1: verifica rate-limit, bcrypt, emite access+refresh y audita el intento."""
    recent_failures = await audit_log_repository.count_recent_login_failures(
        session, ip_address or "unknown", settings.login_lockout_minutes
    )
    if recent_failures >= settings.login_max_attempts:
        await audit_log_repository.record(
            session,
            action="LOGIN_BLOCKED",
            ip_address=ip_address,
            user_agent=user_agent,
            extra={"ip": ip_address, "attempts": recent_failures},
        )
        await session.commit()
        raise TooManyLoginAttemptsError(retry_after_seconds=settings.login_lockout_minutes * 60)

    user = await user_repository.get_by_email(session, email)
    # Siempre se llama a verify_password (con el hash real o el señuelo) para que
    # el tiempo de respuesta no revele si el email existe — ver _DUMMY_PASSWORD_HASH.
    password_hash = user.password_hash if user is not None else _DUMMY_PASSWORD_HASH
    password_valid = verify_password(password, password_hash)
    if user is None or not user.is_active or not password_valid:
        await audit_log_repository.record(
            session,
            action="LOGIN_FAIL",
            ip_address=ip_address,
            user_agent=user_agent,
            extra={"ip": ip_address, "email_intentado": email},
        )
        await session.commit()
        raise InvalidCredentialsError

    access_token = create_access_token(
        settings.jwt_secret_key,
        settings.jwt_algorithm,
        settings.jwt_access_token_expire_minutes,
        user.id,
        user.role,
        user.is_active,
    )
    refresh_token, _jti, refresh_expires_at = create_refresh_token(
        settings.jwt_secret_key,
        settings.jwt_algorithm,
        settings.jwt_refresh_token_expire_days,
        user.id,
    )

    await user_repository.update_last_login(session, user)
    await audit_log_repository.record(
        session,
        action="LOGIN_SUCCESS",
        user_id=user.id,
        ip_address=ip_address,
        user_agent=user_agent,
        extra={"ip": ip_address, "user_agent": user_agent},
    )
    # Un solo commit para las dos escrituras: si el proceso muere entre ambas,
    # no debe quedar un last_login_at actualizado sin su LOGIN_SUCCESS
    # correspondiente en audit_logs (Unit of Work — ver docs/AUDITORIA_BACKEND_v1.md §3.1).
    await session.commit()

    return LoginResult(access_token, refresh_token, refresh_expires_at)


async def refresh_access_token(
    session: AsyncSession, settings: Settings, refresh_token: str
) -> str:
    """TDD §8.2 /auth/refresh: valida el refresh token (firma, exp, tipo, no revocado,
    usuario activo) y emite un access_token nuevo — no rota el refresh token."""
    decoded = decode_typed_token(
        refresh_token, settings.jwt_secret_key, settings.jwt_algorithm, TokenType.REFRESH
    )

    if await revoked_token_repository.is_revoked(session, decoded.jti):
        raise InvalidTokenError

    user = await user_repository.get_by_id(session, decoded.user_id)
    if user is None or not user.is_active:
        raise AccountInactiveError

    return create_access_token(
        settings.jwt_secret_key,
        settings.jwt_algorithm,
        settings.jwt_access_token_expire_minutes,
        user.id,
        user.role,
        user.is_active,
    )


async def logout(
    session: AsyncSession,
    settings: Settings,
    user: User,
    refresh_token: str | None,
    ip_address: str | None,
    user_agent: str | None,
) -> None:
    """TDD §9.1: agrega el jti del refresh token a la blacklist (revoked_tokens)."""
    if refresh_token:
        try:
            decoded = decode_typed_token(
                refresh_token, settings.jwt_secret_key, settings.jwt_algorithm, TokenType.REFRESH
            )
        except (InvalidTokenError, TokenExpiredError):
            decoded = None
        if decoded is not None:
            await revoked_token_repository.revoke(session, decoded.jti, decoded.expires_at)

    await audit_log_repository.record(
        session, action="LOGOUT", user_id=user.id, ip_address=ip_address, user_agent=user_agent
    )
    await session.commit()


async def change_password(
    session: AsyncSession, user: User, current_password: str, new_password: str
) -> None:
    """TDD §8.2 /auth/change-password — requiere conocer la contraseña actual."""
    if not verify_password(current_password, user.password_hash):
        raise InvalidCredentialsError

    await user_repository.update_password(session, user, hash_password(new_password))
    await audit_log_repository.record(session, action="PASSWORD_CHANGE", user_id=user.id)
    await session.commit()
