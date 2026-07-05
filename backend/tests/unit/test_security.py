import uuid

import pytest

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
from app.models.enums import UserRole

SECRET = "unit-test-secret"
ALGORITHM = "HS256"


def test_hash_password_produces_a_verifiable_bcrypt_hash() -> None:
    hashed = hash_password("Sup3rSecret")

    assert hashed != "Sup3rSecret"
    assert verify_password("Sup3rSecret", hashed)


def test_verify_password_rejects_wrong_password() -> None:
    hashed = hash_password("Sup3rSecret")

    assert not verify_password("otra-cosa", hashed)


def test_access_token_roundtrip_preserves_claims() -> None:
    user_id = uuid.uuid4()
    token = create_access_token(SECRET, ALGORITHM, 15, user_id, UserRole.ADMIN, True)

    decoded = decode_typed_token(token, SECRET, ALGORITHM, TokenType.ACCESS)

    assert decoded.user_id == user_id
    assert decoded.role == UserRole.ADMIN
    assert decoded.is_active is True
    assert decoded.token_type == TokenType.ACCESS


def test_refresh_token_roundtrip_preserves_jti() -> None:
    user_id = uuid.uuid4()
    token, jti, expires_at = create_refresh_token(SECRET, ALGORITHM, 30, user_id)

    decoded = decode_typed_token(token, SECRET, ALGORITHM, TokenType.REFRESH)

    assert decoded.user_id == user_id
    assert decoded.jti == jti
    # El claim "exp" de un JWT es un timestamp entero (segundos) — se pierde la
    # precisión de microsegundos del datetime original al codificar.
    assert abs((decoded.expires_at - expires_at).total_seconds()) < 1


def test_decode_rejects_wrong_token_type() -> None:
    user_id = uuid.uuid4()
    access_token = create_access_token(SECRET, ALGORITHM, 15, user_id, UserRole.CLIENTE, True)

    with pytest.raises(InvalidTokenError):
        decode_typed_token(access_token, SECRET, ALGORITHM, TokenType.REFRESH)


def test_decode_rejects_expired_token() -> None:
    user_id = uuid.uuid4()
    expired_token = create_access_token(SECRET, ALGORITHM, -1, user_id, UserRole.CLIENTE, True)

    with pytest.raises(TokenExpiredError):
        decode_typed_token(expired_token, SECRET, ALGORITHM, TokenType.ACCESS)


def test_decode_rejects_token_signed_with_a_different_secret() -> None:
    user_id = uuid.uuid4()
    token = create_access_token(SECRET, ALGORITHM, 15, user_id, UserRole.CLIENTE, True)

    with pytest.raises(InvalidTokenError):
        decode_typed_token(token, "otro-secret-completamente-distinto", ALGORITHM, TokenType.ACCESS)
