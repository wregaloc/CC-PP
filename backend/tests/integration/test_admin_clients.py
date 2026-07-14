from collections.abc import Awaitable, Callable

import httpx
import pytest

from app.models.enums import UserRole
from app.models.user import User

pytestmark = pytest.mark.usefixtures("db_session")

CLIENTS_URL = "/api/v1/admin/clients"

# Firma PNG real (los 8 bytes que app/services/client_service.py::_detect_extension
# reconoce) — no hace falta un PNG válido completo, solo la firma binaria.
_PNG_BYTES = b"\x89PNG\r\n\x1a\n" + b"\x00" * 32
_TEXT_BYTES = b"esto no es una imagen"


async def _login(client: httpx.AsyncClient, email: str, password: str) -> str:
    response = await client.post(
        "/api/v1/auth/login", json={"email": email, "password": password}
    )
    assert response.status_code == 200
    return response.json()["access_token"]


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


async def _make_admin_token(
    client: httpx.AsyncClient, make_user: Callable[..., Awaitable[User]], email: str
) -> str:
    await make_user(email=email, password="Valida123", role=UserRole.ADMIN)
    return await _login(client, email, "Valida123")


async def test_list_clients_requires_authentication(client: httpx.AsyncClient) -> None:
    response = await client.get(CLIENTS_URL)

    assert response.status_code == 401


async def test_list_clients_rejects_non_admin(
    client: httpx.AsyncClient, make_user: Callable[..., Awaitable[User]]
) -> None:
    await make_user(email="interno-clients@podpulse.pe", password="Valida123", role=UserRole.INTERNO)
    token = await _login(client, "interno-clients@podpulse.pe", "Valida123")

    response = await client.get(CLIENTS_URL, headers=_auth(token))

    assert response.status_code == 403


async def test_create_and_get_client(
    client: httpx.AsyncClient, make_user: Callable[..., Awaitable[User]]
) -> None:
    token = await _make_admin_token(client, make_user, "admin-clients-create@podpulse.pe")

    create_response = await client.post(
        CLIENTS_URL, headers=_auth(token), json={"name": "TEST_CLIENTE_ACME"}
    )
    assert create_response.status_code == 201
    body = create_response.json()
    assert body["name"] == "TEST_CLIENTE_ACME"
    assert body["is_active"] is True
    assert body["user_count"] == 0
    assert body["logo_path"] is None

    get_response = await client.get(f"{CLIENTS_URL}/{body['id']}", headers=_auth(token))
    assert get_response.status_code == 200
    assert get_response.json()["name"] == "TEST_CLIENTE_ACME"


async def test_get_client_not_found_returns_404(
    client: httpx.AsyncClient, make_user: Callable[..., Awaitable[User]]
) -> None:
    token = await _make_admin_token(client, make_user, "admin-clients-404@podpulse.pe")

    response = await client.get(
        f"{CLIENTS_URL}/00000000-0000-0000-0000-000000000000", headers=_auth(token)
    )

    assert response.status_code == 404
    assert response.json()["code"] == "RESOURCE_NOT_FOUND"


async def test_update_client_name(
    client: httpx.AsyncClient, make_user: Callable[..., Awaitable[User]]
) -> None:
    token = await _make_admin_token(client, make_user, "admin-clients-update@podpulse.pe")
    created = await client.post(CLIENTS_URL, headers=_auth(token), json={"name": "TEST_ANTES"})
    client_id = created.json()["id"]

    response = await client.put(
        f"{CLIENTS_URL}/{client_id}", headers=_auth(token), json={"name": "TEST_DESPUES"}
    )

    assert response.status_code == 200
    assert response.json()["name"] == "TEST_DESPUES"


async def test_toggle_client_active(
    client: httpx.AsyncClient, make_user: Callable[..., Awaitable[User]]
) -> None:
    token = await _make_admin_token(client, make_user, "admin-clients-toggle@podpulse.pe")
    created = await client.post(CLIENTS_URL, headers=_auth(token), json={"name": "TEST_TOGGLE"})
    client_id = created.json()["id"]

    deactivated = await client.patch(f"{CLIENTS_URL}/{client_id}/toggle-active", headers=_auth(token))
    assert deactivated.status_code == 200
    assert deactivated.json()["is_active"] is False

    reactivated = await client.patch(f"{CLIENTS_URL}/{client_id}/toggle-active", headers=_auth(token))
    assert reactivated.status_code == 200
    assert reactivated.json()["is_active"] is True


async def test_upload_logo_success_and_serves_it_back(
    client: httpx.AsyncClient, make_user: Callable[..., Awaitable[User]]
) -> None:
    token = await _make_admin_token(client, make_user, "admin-clients-logo@podpulse.pe")
    created = await client.post(CLIENTS_URL, headers=_auth(token), json={"name": "TEST_LOGO"})
    client_id = created.json()["id"]

    upload_response = await client.post(
        f"{CLIENTS_URL}/{client_id}/logo",
        headers=_auth(token),
        files={"file": ("logo.png", _PNG_BYTES, "image/png")},
    )
    assert upload_response.status_code == 200
    assert upload_response.json()["logo_path"] is not None

    # GET del logo es público (sin Authorization) — ver admin_clients.py.
    logo_response = await client.get(f"{CLIENTS_URL}/{client_id}/logo")
    assert logo_response.status_code == 200
    assert logo_response.content == _PNG_BYTES


async def test_upload_logo_rejects_non_image_content(
    client: httpx.AsyncClient, make_user: Callable[..., Awaitable[User]]
) -> None:
    token = await _make_admin_token(client, make_user, "admin-clients-badlogo@podpulse.pe")
    created = await client.post(CLIENTS_URL, headers=_auth(token), json={"name": "TEST_BADLOGO"})
    client_id = created.json()["id"]

    response = await client.post(
        f"{CLIENTS_URL}/{client_id}/logo",
        headers=_auth(token),
        files={"file": ("fake.png", _TEXT_BYTES, "image/png")},
    )

    assert response.status_code == 422
    assert response.json()["code"] == "VALIDATION_ERROR"


async def test_list_client_users_returns_assigned_users(
    client: httpx.AsyncClient, make_user: Callable[..., Awaitable[User]]
) -> None:
    token = await _make_admin_token(client, make_user, "admin-clients-users@podpulse.pe")
    created = await client.post(CLIENTS_URL, headers=_auth(token), json={"name": "TEST_CON_USUARIOS"})
    client_id = created.json()["id"]

    await client.post(
        "/api/v1/admin/users",
        headers=_auth(token),
        json={
            "email": "asignado@podpulse.pe",
            "full_name": "Usuario Asignado",
            "role": "cliente",
            "password": "Valida123",
            "client_id": client_id,
        },
    )

    response = await client.get(f"{CLIENTS_URL}/{client_id}/users", headers=_auth(token))

    assert response.status_code == 200
    body = response.json()
    assert any(u["email"] == "asignado@podpulse.pe" for u in body["items"])
