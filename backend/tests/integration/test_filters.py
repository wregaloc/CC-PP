from datetime import date

import httpx
import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import ProgramType, UserRole
from app.models.fact_audiencia import FactAudiencia

pytestmark = pytest.mark.usefixtures("db_session")

FILTERS_URL = "/api/v1/filters"


async def _login(client: httpx.AsyncClient, email: str, password: str) -> str:
    response = await client.post(
        "/api/v1/auth/login", json={"email": email, "password": password}
    )
    assert response.status_code == 200
    return response.json()["access_token"]


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
async def seeded(db_session: AsyncSession, make_user, make_programa):
    await make_user(email="filters-viewer@podpulse.pe", password="Valida123", role=UserRole.INTERNO)

    programa = await make_programa(
        "TEST_FILTROS_A", "Canal Filtros", categoria="CatFiltros", tipo=ProgramType.PODCAST
    )
    db_session.add(
        FactAudiencia(
            fecha=date(2026, 3, 10), mes_num=3, anio=2026, semana_num=10,
            programa_id=programa.id, es_emision=1, vistas_diarias=10,
        )
    )
    db_session.add(
        FactAudiencia(
            fecha=date(2026, 3, 20), mes_num=3, anio=2026, semana_num=12,
            programa_id=programa.id, es_emision=0, vistas_diarias=10,
        )
    )
    await db_session.flush()


async def test_filters_require_authentication(client: httpx.AsyncClient) -> None:
    response = await client.get(f"{FILTERS_URL}/programas")

    assert response.status_code == 401


async def test_filter_programas_includes_seeded_programa(
    client: httpx.AsyncClient, seeded: None
) -> None:
    token = await _login(client, "filters-viewer@podpulse.pe", "Valida123")

    response = await client.get(f"{FILTERS_URL}/programas", headers=_auth(token))

    assert response.status_code == 200
    assert "TEST_FILTROS_A" in response.json()


async def test_filter_canales_includes_seeded_canal(
    client: httpx.AsyncClient, seeded: None
) -> None:
    token = await _login(client, "filters-viewer@podpulse.pe", "Valida123")

    response = await client.get(f"{FILTERS_URL}/canales", headers=_auth(token))

    assert response.status_code == 200
    assert "Canal Filtros" in response.json()


async def test_filter_categorias_includes_seeded_categoria(
    client: httpx.AsyncClient, seeded: None
) -> None:
    token = await _login(client, "filters-viewer@podpulse.pe", "Valida123")

    response = await client.get(f"{FILTERS_URL}/categorias", headers=_auth(token))

    assert response.status_code == 200
    assert "CatFiltros" in response.json()


async def test_filter_periodos_covers_seeded_date_range(
    client: httpx.AsyncClient, seeded: None
) -> None:
    token = await _login(client, "filters-viewer@podpulse.pe", "Valida123")

    response = await client.get(f"{FILTERS_URL}/periodos", headers=_auth(token))

    assert response.status_code == 200
    body = response.json()
    assert body["fecha_min"] <= "2026-03-10"
    assert body["fecha_max"] >= "2026-03-20"
