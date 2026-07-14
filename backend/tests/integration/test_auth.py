from collections.abc import Awaitable, Callable

import httpx
import pytest

from app.models.enums import UserRole
from app.models.user import User

pytestmark = pytest.mark.usefixtures("db_session")

LOGIN_URL = "/api/v1/auth/login"
REFRESH_URL = "/api/v1/auth/refresh"
LOGOUT_URL = "/api/v1/auth/logout"
CHANGE_PASSWORD_URL = "/api/v1/auth/change-password"


async def _login(client: httpx.AsyncClient, email: str, password: str) -> httpx.Response:
    return await client.post(LOGIN_URL, json={"email": email, "password": password})


async def test_login_success_returns_access_token_and_sets_refresh_cookie(
    client: httpx.AsyncClient, make_user: Callable[..., Awaitable[User]]
) -> None:
    await make_user(email="cliente@podpulse.pe", password="Valida123", role=UserRole.CLIENTE)

    response = await _login(client, "cliente@podpulse.pe", "Valida123")

    assert response.status_code == 200
    body = response.json()
    assert body["token_type"] == "bearer"
    assert body["access_token"]
    assert "refresh_token" in response.cookies


async def test_login_wrong_password_returns_invalid_credentials(
    client: httpx.AsyncClient, make_user: Callable[..., Awaitable[User]]
) -> None:
    await make_user(email="wrongpass@podpulse.pe", password="Valida123")

    response = await _login(client, "wrongpass@podpulse.pe", "otra-cosa")

    assert response.status_code == 401
    assert response.json()["code"] == "INVALID_CREDENTIALS"


async def test_login_unknown_email_returns_the_same_generic_error(
    client: httpx.AsyncClient,
) -> None:
    response = await _login(client, "no-existe@podpulse.pe", "Valida123")

    assert response.status_code == 401
    assert response.json()["code"] == "INVALID_CREDENTIALS"


async def test_login_inactive_user_is_rejected(
    client: httpx.AsyncClient, make_user: Callable[..., Awaitable[User]]
) -> None:
    await make_user(email="inactivo@podpulse.pe", password="Valida123", is_active=False)

    response = await _login(client, "inactivo@podpulse.pe", "Valida123")

    assert response.status_code == 401
    assert response.json()["code"] == "INVALID_CREDENTIALS"


async def test_login_is_rate_limited_after_max_attempts(
    client: httpx.AsyncClient, make_user: Callable[..., Awaitable[User]]
) -> None:
    await make_user(email="ratelimit@podpulse.pe", password="Valida123")

    for _ in range(5):
        response = await _login(client, "ratelimit@podpulse.pe", "password-incorrecto")
        assert response.status_code == 401

    blocked_response = await _login(client, "ratelimit@podpulse.pe", "password-incorrecto")

    assert blocked_response.status_code == 429
    assert blocked_response.json()["code"] == "RATE_LIMIT_EXCEEDED"
    assert "Retry-After" in blocked_response.headers


async def test_refresh_returns_a_new_access_token(
    client: httpx.AsyncClient, make_user: Callable[..., Awaitable[User]]
) -> None:
    await make_user(email="refresh@podpulse.pe", password="Valida123")
    login_response = await _login(client, "refresh@podpulse.pe", "Valida123")

    refresh_response = await client.post(REFRESH_URL)

    assert refresh_response.status_code == 200
    assert refresh_response.json()["access_token"] != login_response.json()["access_token"]


async def test_refresh_without_cookie_is_rejected(client: httpx.AsyncClient) -> None:
    response = await client.post(REFRESH_URL)

    assert response.status_code == 401
    assert response.json()["code"] == "TOKEN_INVALID"


async def test_logout_revokes_the_refresh_token(
    client: httpx.AsyncClient, make_user: Callable[..., Awaitable[User]]
) -> None:
    await make_user(email="logout@podpulse.pe", password="Valida123")
    login_response = await _login(client, "logout@podpulse.pe", "Valida123")
    access_token = login_response.json()["access_token"]

    logout_response = await client.post(
        LOGOUT_URL, headers={"Authorization": f"Bearer {access_token}"}
    )
    assert logout_response.status_code == 200

    refresh_after_logout = await client.post(REFRESH_URL)
    assert refresh_after_logout.status_code == 401
    assert refresh_after_logout.json()["code"] == "TOKEN_INVALID"


async def test_change_password_requires_authentication(client: httpx.AsyncClient) -> None:
    response = await client.post(
        CHANGE_PASSWORD_URL, json={"current_password": "x", "new_password": "Nueva1234"}
    )

    assert response.status_code == 401


async def test_change_password_rejects_wrong_current_password(
    client: httpx.AsyncClient, make_user: Callable[..., Awaitable[User]]
) -> None:
    # role=INTERNO: el rol Cliente no tiene autoservicio de contraseña desde
    # Fase 10 §Módulo 4 (ver test_change_password_rejects_cliente_role) — este
    # test verifica el rechazo por contraseña incorrecta, no por rol.
    await make_user(email="changepass@podpulse.pe", password="Valida123", role=UserRole.INTERNO)
    login_response = await _login(client, "changepass@podpulse.pe", "Valida123")
    access_token = login_response.json()["access_token"]

    response = await client.post(
        CHANGE_PASSWORD_URL,
        json={"current_password": "incorrecta", "new_password": "Nueva1234"},
        headers={"Authorization": f"Bearer {access_token}"},
    )

    assert response.status_code == 401


async def test_change_password_success_allows_login_with_the_new_password(
    client: httpx.AsyncClient, make_user: Callable[..., Awaitable[User]]
) -> None:
    await make_user(email="changeok@podpulse.pe", password="Valida123", role=UserRole.INTERNO)
    login_response = await _login(client, "changeok@podpulse.pe", "Valida123")
    access_token = login_response.json()["access_token"]

    change_response = await client.post(
        CHANGE_PASSWORD_URL,
        json={"current_password": "Valida123", "new_password": "Nueva1234"},
        headers={"Authorization": f"Bearer {access_token}"},
    )
    assert change_response.status_code == 200

    new_login = await _login(client, "changeok@podpulse.pe", "Nueva1234")
    assert new_login.status_code == 200

    old_login = await _login(client, "changeok@podpulse.pe", "Valida123")
    assert old_login.status_code == 401


async def test_change_password_rejects_cliente_role(
    client: httpx.AsyncClient, make_user: Callable[..., Awaitable[User]]
) -> None:
    """Fase 10 §Módulo 4: el rol Cliente no gestiona sus propias credenciales."""
    await make_user(email="changecliente@podpulse.pe", password="Valida123", role=UserRole.CLIENTE)
    login_response = await _login(client, "changecliente@podpulse.pe", "Valida123")
    access_token = login_response.json()["access_token"]

    response = await client.post(
        CHANGE_PASSWORD_URL,
        json={"current_password": "Valida123", "new_password": "Nueva1234"},
        headers={"Authorization": f"Bearer {access_token}"},
    )

    assert response.status_code == 403
    assert response.json()["code"] == "INSUFFICIENT_ROLE"


async def test_protected_endpoint_rejects_missing_token(client: httpx.AsyncClient) -> None:
    response = await client.post(LOGOUT_URL)

    assert response.status_code == 401
    assert response.json()["code"] == "TOKEN_INVALID"
