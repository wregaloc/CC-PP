from collections.abc import Awaitable, Callable

import httpx
import pytest

from app.models.enums import UserRole
from app.models.user import User

pytestmark = pytest.mark.usefixtures("db_session")

USERS_URL = "/api/v1/admin/users"


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


async def test_list_users_requires_authentication(client: httpx.AsyncClient) -> None:
    response = await client.get(USERS_URL)

    assert response.status_code == 401


async def test_list_users_rejects_non_admin(
    client: httpx.AsyncClient, make_user: Callable[..., Awaitable[User]]
) -> None:
    await make_user(email="cliente-users@podpulse.pe", password="Valida123", role=UserRole.CLIENTE)
    token = await _login(client, "cliente-users@podpulse.pe", "Valida123")

    response = await client.get(USERS_URL, headers=_auth(token))

    assert response.status_code == 403
    assert response.json()["code"] == "INSUFFICIENT_ROLE"


async def test_create_user_success(
    client: httpx.AsyncClient, make_user: Callable[..., Awaitable[User]]
) -> None:
    token = await _make_admin_token(client, make_user, "admin-create@podpulse.pe")

    response = await client.post(
        USERS_URL,
        headers=_auth(token),
        json={
            "email": "nuevo.interno@podpulse.pe",
            "full_name": "Nuevo Interno",
            "role": "interno",
            "password": "Valida123",
        },
    )

    assert response.status_code == 201
    body = response.json()
    assert body["email"] == "nuevo.interno@podpulse.pe"
    assert body["role"] == "interno"
    assert body["is_active"] is True
    assert "password" not in body


async def test_create_user_duplicate_email_returns_409(
    client: httpx.AsyncClient, make_user: Callable[..., Awaitable[User]]
) -> None:
    token = await _make_admin_token(client, make_user, "admin-dup@podpulse.pe")
    payload = {
        "email": "duplicado@podpulse.pe",
        "full_name": "Alguien",
        "role": "cliente",
        "password": "Valida123",
    }
    first = await client.post(USERS_URL, headers=_auth(token), json=payload)
    assert first.status_code == 201

    second = await client.post(USERS_URL, headers=_auth(token), json=payload)

    assert second.status_code == 409
    assert second.json()["code"] == "RESOURCE_EXISTS"


async def test_create_user_weak_password_returns_422(
    client: httpx.AsyncClient, make_user: Callable[..., Awaitable[User]]
) -> None:
    token = await _make_admin_token(client, make_user, "admin-weakpass@podpulse.pe")

    response = await client.post(
        USERS_URL,
        headers=_auth(token),
        json={
            "email": "debil@podpulse.pe",
            "full_name": "Alguien",
            "role": "cliente",
            "password": "corta",
        },
    )

    assert response.status_code == 422


async def test_get_user_not_found_returns_404(
    client: httpx.AsyncClient, make_user: Callable[..., Awaitable[User]]
) -> None:
    token = await _make_admin_token(client, make_user, "admin-notfound@podpulse.pe")

    response = await client.get(
        f"{USERS_URL}/00000000-0000-0000-0000-000000000000", headers=_auth(token)
    )

    assert response.status_code == 404
    assert response.json()["code"] == "RESOURCE_NOT_FOUND"


async def test_update_user_success(
    client: httpx.AsyncClient, make_user: Callable[..., Awaitable[User]]
) -> None:
    token = await _make_admin_token(client, make_user, "admin-update@podpulse.pe")
    create_response = await client.post(
        USERS_URL,
        headers=_auth(token),
        json={
            "email": "antes@podpulse.pe",
            "full_name": "Nombre Viejo",
            "role": "cliente",
            "password": "Valida123",
        },
    )
    user_id = create_response.json()["id"]

    response = await client.put(
        f"{USERS_URL}/{user_id}",
        headers=_auth(token),
        json={"email": "despues@podpulse.pe", "full_name": "Nombre Nuevo", "role": "interno"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["email"] == "despues@podpulse.pe"
    assert body["full_name"] == "Nombre Nuevo"
    assert body["role"] == "interno"


async def test_admin_cannot_change_own_role(
    client: httpx.AsyncClient, make_user: Callable[..., Awaitable[User]]
) -> None:
    token = await _make_admin_token(client, make_user, "admin-selfrole@podpulse.pe")
    me = await client.get(USERS_URL, headers=_auth(token), params={"page_size": 200})
    own = next(u for u in me.json()["items"] if u["email"] == "admin-selfrole@podpulse.pe")

    response = await client.put(
        f"{USERS_URL}/{own['id']}",
        headers=_auth(token),
        json={"email": own["email"], "full_name": own["full_name"], "role": "cliente"},
    )

    assert response.status_code == 400
    assert response.json()["code"] == "CANNOT_CHANGE_OWN_ROLE"


async def test_admin_can_update_own_email_and_name_without_changing_role(
    client: httpx.AsyncClient, make_user: Callable[..., Awaitable[User]]
) -> None:
    token = await _make_admin_token(client, make_user, "admin-selfupdate@podpulse.pe")
    me = await client.get(USERS_URL, headers=_auth(token), params={"page_size": 200})
    own = next(u for u in me.json()["items"] if u["email"] == "admin-selfupdate@podpulse.pe")

    response = await client.put(
        f"{USERS_URL}/{own['id']}",
        headers=_auth(token),
        json={"email": own["email"], "full_name": "Nombre Actualizado", "role": own["role"]},
    )

    assert response.status_code == 200
    assert response.json()["full_name"] == "Nombre Actualizado"


async def test_toggle_active_deactivates_and_reactivates_user(
    client: httpx.AsyncClient, make_user: Callable[..., Awaitable[User]]
) -> None:
    token = await _make_admin_token(client, make_user, "admin-toggle@podpulse.pe")
    create_response = await client.post(
        USERS_URL,
        headers=_auth(token),
        json={
            "email": "atogglear@podpulse.pe",
            "full_name": "Toggle User",
            "role": "cliente",
            "password": "Valida123",
        },
    )
    user_id = create_response.json()["id"]
    assert create_response.json()["is_active"] is True

    deactivated = await client.patch(f"{USERS_URL}/{user_id}/toggle-active", headers=_auth(token))
    assert deactivated.status_code == 200
    assert deactivated.json()["is_active"] is False

    login_while_inactive = await client.post(
        "/api/v1/auth/login", json={"email": "atogglear@podpulse.pe", "password": "Valida123"}
    )
    assert login_while_inactive.status_code == 401

    reactivated = await client.patch(f"{USERS_URL}/{user_id}/toggle-active", headers=_auth(token))
    assert reactivated.status_code == 200
    assert reactivated.json()["is_active"] is True


async def test_set_password_allows_login_with_the_new_password(
    client: httpx.AsyncClient, make_user: Callable[..., Awaitable[User]]
) -> None:
    token = await _make_admin_token(client, make_user, "admin-setpass@podpulse.pe")
    create_response = await client.post(
        USERS_URL,
        headers=_auth(token),
        json={
            "email": "cliente-setpass@podpulse.pe",
            "full_name": "Cliente Set Pass",
            "role": "cliente",
            "password": "Original123",
        },
    )
    user_id = create_response.json()["id"]

    response = await client.post(
        f"{USERS_URL}/{user_id}/set-password",
        headers=_auth(token),
        json={"password": "NuevaClave123"},
    )

    assert response.status_code == 200

    new_token = await _login(client, "cliente-setpass@podpulse.pe", "NuevaClave123")
    assert new_token

    login_with_old = await client.post(
        "/api/v1/auth/login",
        json={"email": "cliente-setpass@podpulse.pe", "password": "Original123"},
    )
    assert login_with_old.status_code == 401


async def test_set_password_rejects_weak_password(
    client: httpx.AsyncClient, make_user: Callable[..., Awaitable[User]]
) -> None:
    token = await _make_admin_token(client, make_user, "admin-setpass-weak@podpulse.pe")
    create_response = await client.post(
        USERS_URL,
        headers=_auth(token),
        json={
            "email": "cliente-setpass-weak@podpulse.pe",
            "full_name": "Cliente Weak",
            "role": "cliente",
            "password": "Original123",
        },
    )
    user_id = create_response.json()["id"]

    response = await client.post(
        f"{USERS_URL}/{user_id}/set-password", headers=_auth(token), json={"password": "corta"}
    )

    assert response.status_code == 422


async def test_list_users_filters_by_role(
    client: httpx.AsyncClient, make_user: Callable[..., Awaitable[User]]
) -> None:
    token = await _make_admin_token(client, make_user, "admin-filter@podpulse.pe")
    await client.post(
        USERS_URL,
        headers=_auth(token),
        json={
            "email": "filtro.interno@podpulse.pe",
            "full_name": "Interno Filtro",
            "role": "interno",
            "password": "Valida123",
        },
    )

    response = await client.get(USERS_URL, headers=_auth(token), params={"role": "interno"})

    assert response.status_code == 200
    body = response.json()
    assert all(u["role"] == "interno" for u in body["items"])
    assert any(u["email"] == "filtro.interno@podpulse.pe" for u in body["items"])
