from collections.abc import Awaitable, Callable

import httpx
import pytest

from app.models.enums import UserRole
from app.models.user import User

pytestmark = pytest.mark.usefixtures("db_session")

SYSTEM_URL = "/api/v1/admin/system"


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


async def test_summary_requires_authentication(client: httpx.AsyncClient) -> None:
    response = await client.get(f"{SYSTEM_URL}/summary")

    assert response.status_code == 401


async def test_summary_rejects_non_admin(
    client: httpx.AsyncClient, make_user: Callable[..., Awaitable[User]]
) -> None:
    await make_user(email="interno-system@podpulse.pe", password="Valida123", role=UserRole.INTERNO)
    token = await _login(client, "interno-system@podpulse.pe", "Valida123")

    response = await client.get(f"{SYSTEM_URL}/summary", headers=_auth(token))

    assert response.status_code == 403
    assert response.json()["code"] == "INSUFFICIENT_ROLE"


async def test_summary_reports_ok_status_and_counts(
    client: httpx.AsyncClient, make_user: Callable[..., Awaitable[User]]
) -> None:
    token = await _make_admin_token(client, make_user, "admin-summary@podpulse.pe")
    await make_user(email="cliente-summary@podpulse.pe", password="Valida123", role=UserRole.CLIENTE)

    response = await client.get(f"{SYSTEM_URL}/summary", headers=_auth(token))

    assert response.status_code == 200
    body = response.json()
    assert body["api_status"] == "ok"
    assert body["database_status"] == "ok"
    assert body["overall_status"] == "ok"
    assert body["total_usuarios"] >= 1
    assert body["total_equipo"] >= 1
    assert "total_clientes" in body
    assert "last_upload" in body
    assert "last_update_at" in body
