"""Utilidades de seguridad: hashing de contraseñas y JWT (access + refresh).

Ver [[enterprise-security]] — bcrypt cost=12, algoritmo de firma explícito
(nunca 'alg: none'), separación access/refresh con jti para poder revocar
refresh tokens en logout (ver app.models.revoked_token).
"""

import uuid
from datetime import UTC, datetime, timedelta
from enum import StrEnum
from typing import Any, NamedTuple

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.models.enums import UserRole

_pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto", bcrypt__rounds=12)


class TokenType(StrEnum):
    ACCESS = "access"
    REFRESH = "refresh"


class InvalidTokenError(Exception):
    """Firma inválida, claims faltantes/mal formadas, o tipo de token inesperado."""


class TokenExpiredError(Exception):
    """El token es válido criptográficamente pero ya expiró (exp vencido)."""


class DecodedToken(NamedTuple):
    user_id: uuid.UUID
    jti: uuid.UUID
    token_type: TokenType
    role: UserRole | None
    is_active: bool | None
    expires_at: datetime


def hash_password(plain_password: str) -> str:
    """Genera un hash bcrypt (cost=12) de la contraseña. El salt es único y lo gestiona bcrypt."""
    return _pwd_context.hash(plain_password)


def verify_password(plain_password: str, password_hash: str) -> bool:
    """Verifica una contraseña contra su hash, en tiempo constante (nunca comparar con ==)."""
    return _pwd_context.verify(plain_password, password_hash)


def create_token(
    subject: str,
    expires_delta: timedelta,
    secret_key: str,
    algorithm: str,
    extra_claims: dict[str, Any] | None = None,
) -> str:
    """Crea un JWT firmado con las claims mínimas (sub, iat, exp, jti) más las que se indiquen."""
    now = datetime.now(UTC)
    payload: dict[str, Any] = {
        "sub": subject,
        "iat": now,
        "exp": now + expires_delta,
        "jti": str(uuid.uuid4()),
    }
    if extra_claims:
        payload.update(extra_claims)

    return jwt.encode(payload, secret_key, algorithm=algorithm)


def decode_token(token: str, secret_key: str, algorithm: str) -> dict[str, Any]:
    """Decodifica y valida un JWT (firma + expiración + algoritmo exacto).

    `algorithms=[algorithm]` es una allowlist explícita: python-jose nunca
    acepta 'none' ni un algoritmo distinto al configurado, aunque el token
    entrante lo declare en su header.
    """
    return jwt.decode(token, secret_key, algorithms=[algorithm])


def create_access_token(
    secret_key: str,
    algorithm: str,
    expires_minutes: int,
    user_id: uuid.UUID,
    role: UserRole,
    is_active: bool,
) -> str:
    """Access token de vida corta — incluye role/is_active para autorizar sin ir a BD,
    aunque `is_active` igual se re-valida contra BD en cada request (ver dependencies/auth.py)."""
    return create_token(
        subject=str(user_id),
        expires_delta=timedelta(minutes=expires_minutes),
        secret_key=secret_key,
        algorithm=algorithm,
        extra_claims={"type": TokenType.ACCESS.value, "role": role.value, "is_active": is_active},
    )


def create_refresh_token(
    secret_key: str, algorithm: str, expires_days: int, user_id: uuid.UUID
) -> tuple[str, uuid.UUID, datetime]:
    """Refresh token de vida larga. Devuelve (token, jti, expires_at) — jti/expires_at
    se usan para registrar la revocación en logout (blacklist en Postgres)."""
    jti = uuid.uuid4()
    now = datetime.now(UTC)
    expires_at = now + timedelta(days=expires_days)
    token = jwt.encode(
        {
            "sub": str(user_id),
            "iat": now,
            "exp": expires_at,
            "jti": str(jti),
            "type": TokenType.REFRESH.value,
        },
        secret_key,
        algorithm=algorithm,
    )
    return token, jti, expires_at


def decode_typed_token(
    token: str, secret_key: str, algorithm: str, expected_type: TokenType
) -> DecodedToken:
    """Decodifica un access o refresh token y valida que sea del tipo esperado.

    Lanza TokenExpiredError / InvalidTokenError (fail closed) en vez de dejar
    escapar JWTError o KeyError — dependencies/auth.py y auth_service.py solo
    necesitan manejar estas dos excepciones de dominio.
    """
    try:
        payload = decode_token(token, secret_key, algorithm)
    except jwt.ExpiredSignatureError as exc:
        raise TokenExpiredError from exc
    except JWTError as exc:
        raise InvalidTokenError from exc

    if payload.get("type") != expected_type.value:
        raise InvalidTokenError

    try:
        user_id = uuid.UUID(str(payload["sub"]))
        jti = uuid.UUID(str(payload["jti"]))
    except (KeyError, ValueError, TypeError) as exc:
        raise InvalidTokenError from exc

    role_raw = payload.get("role")
    role = UserRole(role_raw) if role_raw is not None else None
    is_active = payload.get("is_active")

    try:
        expires_at = datetime.fromtimestamp(float(payload["exp"]), tz=UTC)
    except (KeyError, ValueError, TypeError) as exc:
        raise InvalidTokenError from exc

    return DecodedToken(
        user_id=user_id,
        jti=jti,
        token_type=expected_type,
        role=role,
        is_active=is_active,
        expires_at=expires_at,
    )


__all__ = [
    "hash_password",
    "verify_password",
    "create_token",
    "decode_token",
    "create_access_token",
    "create_refresh_token",
    "decode_typed_token",
    "TokenType",
    "DecodedToken",
    "InvalidTokenError",
    "TokenExpiredError",
    "JWTError",
]
