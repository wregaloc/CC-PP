from datetime import date

import httpx
import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.dim_auspicios import Auspicio
from app.models.enums import ProgramType, SentimentType, UserRole
from app.models.fact_audiencia import FactAudiencia
from app.models.fact_keywords import FactKeywords
from app.models.fact_sentimiento import FactSentimiento

pytestmark = pytest.mark.usefixtures("db_session")

DASHBOARD_URL = "/api/v1/dashboard"


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
    """Datos base para los tests de dashboard: 3 programas en 2 canales, con
    empate deliberado de vistas entre A y C (para verificar DENSE_RANK)."""
    user = await make_user(
        email="viewer@podpulse.pe", password="Valida123", role=UserRole.CLIENTE
    )

    programa_a = await make_programa(
        "TEST_A", "Canal X", categoria="Cat1", tipo=ProgramType.PODCAST
    )
    programa_b = await make_programa(
        "TEST_B", "Canal Y", categoria="Cat1", tipo=ProgramType.PODCAST
    )
    programa_c = await make_programa(
        "TEST_C", "Canal X", categoria="Cat2", tipo=ProgramType.PROGRAMA
    )

    db_session.add_all(
        [
            FactAudiencia(
                fecha=date(2030, 1, 1), mes_num=1, anio=2030, semana_num=1,
                programa_id=programa_a.id, es_emision=1, vistas_diarias=150,
                busquedas_diarias=20, likes=10, comentarios=1, engagement=0.05,
            ),
            FactAudiencia(
                fecha=date(2030, 1, 2), mes_num=1, anio=2030, semana_num=1,
                programa_id=programa_a.id, es_emision=0, vistas_diarias=150,
                busquedas_diarias=10, likes=5, comentarios=2, engagement=0.03,
            ),
            FactAudiencia(
                fecha=date(2030, 1, 1), mes_num=1, anio=2030, semana_num=1,
                programa_id=programa_c.id, es_emision=0, vistas_diarias=300,
                busquedas_diarias=0, likes=0, comentarios=0,
            ),
            FactAudiencia(
                fecha=date(2030, 1, 1), mes_num=1, anio=2030, semana_num=1,
                programa_id=programa_b.id, es_emision=2, vistas_diarias=500,
                busquedas_diarias=5, pico_max_vivo=1000, promedio_vivo=800,
            ),
        ]
    )
    db_session.add(
        FactSentimiento(
            anio=2030, mes_num=1, mes_nombre="Enero", programa_id=programa_a.id,
            score_positivo=0.5, score_negativo=0.3, score_neutral=0.2,
        )
    )
    db_session.add_all(
        [
            FactKeywords(
                anio=2030, mes_num=1, mes_nombre="Enero", programa_id=programa_a.id,
                hashtag="masvisto", occurrences=50, sentimiento=SentimentType.POSITIVO,
            ),
            FactKeywords(
                anio=2030, mes_num=1, mes_nombre="Enero", programa_id=programa_a.id,
                hashtag="menosvisto", occurrences=10, sentimiento=SentimentType.NEGATIVO,
            ),
        ]
    )
    db_session.add(
        Auspicio(mes_num=1, mes_nombre="Enero", programa_id=programa_a.id, auspiciador="MarcaX")
    )
    await db_session.flush()

    return {
        "user": user,
        "programa_a": programa_a,
        "programa_b": programa_b,
        "programa_c": programa_c,
    }


async def test_kpis_requires_authentication(client: httpx.AsyncClient) -> None:
    response = await client.get(f"{DASHBOARD_URL}/kpis")

    assert response.status_code == 401


async def test_kpis_are_visible_to_non_admin_roles(
    client: httpx.AsyncClient, seeded: dict
) -> None:
    token = await _login(client, "viewer@podpulse.pe", "Valida123")

    response = await client.get(
        f"{DASHBOARD_URL}/kpis",
        headers=_auth(token),
        params={"fecha_inicio": "2030-01-01", "fecha_fin": "2030-01-02"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["vistas_totales"] == 1100  # 150+150+300+500
    assert body["likes"] == 15
    assert body["comentarios"] == 3
    assert body["emisiones"] == 3  # SUM: programa_a día1 (1) + programa_b (2, no COUNT de filas)


async def test_kpis_filters_by_programa(client: httpx.AsyncClient, seeded: dict) -> None:
    token = await _login(client, "viewer@podpulse.pe", "Valida123")

    response = await client.get(
        f"{DASHBOARD_URL}/kpis", headers=_auth(token), params={"programa": "TEST_A"}
    )

    assert response.status_code == 200
    body = response.json()
    assert body["vistas_totales"] == 300
    assert body["emisiones"] == 1


async def test_invalid_date_range_returns_422(client: httpx.AsyncClient, seeded: dict) -> None:
    token = await _login(client, "viewer@podpulse.pe", "Valida123")

    response = await client.get(
        f"{DASHBOARD_URL}/kpis",
        headers=_auth(token),
        params={"fecha_inicio": "2030-02-01", "fecha_fin": "2030-01-01"},
    )

    assert response.status_code == 422
    assert response.json()["code"] == "VALIDATION_ERROR"


async def test_sentiment_kpis(client: httpx.AsyncClient, seeded: dict) -> None:
    token = await _login(client, "viewer@podpulse.pe", "Valida123")

    response = await client.get(
        f"{DASHBOARD_URL}/sentiment-kpis", headers=_auth(token), params={"programa": "TEST_A"}
    )

    assert response.status_code == 200
    body = response.json()
    assert body["pct_positivo"] == pytest.approx(0.5)
    assert body["pct_negativo"] == pytest.approx(0.3)
    assert body["pct_neutral"] == pytest.approx(0.2)


async def test_auspicios_lists_sponsors_for_programa(
    client: httpx.AsyncClient, seeded: dict
) -> None:
    token = await _login(client, "viewer@podpulse.pe", "Valida123")

    response = await client.get(
        f"{DASHBOARD_URL}/auspicios", headers=_auth(token), params={"programa": "TEST_A", "mes": 1}
    )

    assert response.status_code == 200
    assert response.json() == [{"auspiciador": "MarcaX"}]


async def test_evolutivo_groups_by_dia(client: httpx.AsyncClient, seeded: dict) -> None:
    token = await _login(client, "viewer@podpulse.pe", "Valida123")

    response = await client.get(
        f"{DASHBOARD_URL}/evolutivo",
        headers=_auth(token),
        params={
            "granularidad": "dia",
            "metrica_secundaria": "busquedas",
            "programa": "TEST_A",
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body == [
        {"periodo": "2030-01-01", "vistas_totales": 150, "metrica_secundaria": 20},
        {"periodo": "2030-01-02", "vistas_totales": 150, "metrica_secundaria": 10},
    ]


async def test_evolutivo_groups_by_mes_with_emisiones(
    client: httpx.AsyncClient, seeded: dict
) -> None:
    token = await _login(client, "viewer@podpulse.pe", "Valida123")

    response = await client.get(
        f"{DASHBOARD_URL}/evolutivo",
        headers=_auth(token),
        params={
            "granularidad": "mes",
            "metrica_secundaria": "emisiones",
            "fecha_inicio": "2030-01-01",
            "fecha_fin": "2030-01-31",
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert len(body) == 1
    assert body[0]["periodo"] == "2030-01"
    assert body[0]["vistas_totales"] == 1100
    assert body[0]["metrica_secundaria"] == 3  # SUM(es_emision): 1+0+0+2


async def test_ranking_programas_dense_rank_ties(client: httpx.AsyncClient, seeded: dict) -> None:
    token = await _login(client, "viewer@podpulse.pe", "Valida123")

    response = await client.get(
        f"{DASHBOARD_URL}/ranking/programas", headers=_auth(token), params={"canal": "Canal X"}
    )

    assert response.status_code == 200
    body = response.json()
    by_name = {item["programa"]: item for item in body}
    assert by_name["TEST_A"]["vistas_totales"] == 300
    assert by_name["TEST_C"]["vistas_totales"] == 300
    assert by_name["TEST_A"]["ranking"] == 1
    assert by_name["TEST_C"]["ranking"] == 1  # empate: mismo rank, DENSE_RANK
    # `tipo` viaja en la respuesta (no solo como filtro) — ver Doc-Migración
    # §5.1, el ranking original colorea cada barra por tipo simultáneamente.
    assert by_name["TEST_A"]["tipo"] == "podcast"
    assert by_name["TEST_C"]["tipo"] == "programa"


async def test_ranking_programas_filters_by_formato(
    client: httpx.AsyncClient, db_session: AsyncSession, make_programa, make_user
) -> None:
    await make_user(email="viewer-formato@podpulse.pe", password="Valida123", role=UserRole.CLIENTE)
    token = await _login(client, "viewer-formato@podpulse.pe", "Valida123")
    programa = await make_programa("TEST_FORMATO", "Canal Formato", tipo=ProgramType.PODCAST)
    db_session.add_all(
        [
            FactAudiencia(
                fecha=date(2030, 2, 1), mes_num=2, anio=2030, semana_num=5,
                programa_id=programa.id, es_emision=1, vistas_diarias=100, formato="Vivo",
            ),
            FactAudiencia(
                fecha=date(2030, 2, 2), mes_num=2, anio=2030, semana_num=5,
                programa_id=programa.id, es_emision=0, vistas_diarias=900, formato="Grabado",
            ),
        ]
    )
    await db_session.flush()

    response = await client.get(
        f"{DASHBOARD_URL}/ranking/programas",
        headers=_auth(token),
        params={"canal": "Canal Formato", "formato": "Vivo"},
    )

    assert response.status_code == 200
    body = response.json()
    assert len(body) == 1
    assert body[0]["programa"] == "TEST_FORMATO"
    assert body[0]["vistas_totales"] == 100  # solo la fila "Vivo", no las 900 de "Grabado"


async def test_ranking_canales(client: httpx.AsyncClient, seeded: dict) -> None:
    token = await _login(client, "viewer@podpulse.pe", "Valida123")

    response = await client.get(
        f"{DASHBOARD_URL}/ranking/canales",
        headers=_auth(token),
        params={"fecha_inicio": "2030-01-01", "fecha_fin": "2030-01-02"},
    )

    assert response.status_code == 200
    body = response.json()
    by_name = {item["canal"]: item for item in body}
    assert by_name["Canal Y"]["vistas_totales"] == 500
    assert by_name["Canal X"]["vistas_totales"] == 600
    assert by_name["Canal X"]["ranking"] == 1
    assert by_name["Canal Y"]["ranking"] == 2


async def test_canal_programas_uses_canal_name_as_path_param(
    client: httpx.AsyncClient, seeded: dict
) -> None:
    token = await _login(client, "viewer@podpulse.pe", "Valida123")

    response = await client.get(f"{DASHBOARD_URL}/canal/Canal Y/programas", headers=_auth(token))

    assert response.status_code == 200
    body = response.json()
    assert body == [{"programa": "TEST_B", "vistas": 500, "pico_max": 1000, "promedio_vivo": 800.0}]


async def test_canal_live_stats(client: httpx.AsyncClient, seeded: dict) -> None:
    token = await _login(client, "viewer@podpulse.pe", "Valida123")

    response = await client.get(f"{DASHBOARD_URL}/canal/Canal Y/live-stats", headers=_auth(token))

    assert response.status_code == 200
    assert response.json() == {"pico_max_vivo": 1000, "promedio_vivo": 800.0}


async def test_keywords_filters_by_sentimiento_and_orders_by_occurrences(
    client: httpx.AsyncClient, seeded: dict
) -> None:
    token = await _login(client, "viewer@podpulse.pe", "Valida123")

    response = await client.get(
        f"{DASHBOARD_URL}/keywords",
        headers=_auth(token),
        params={"programa": "TEST_A", "sentimiento": "positivo"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body == [{"hashtag": "masvisto", "occurrences": 50, "sentimiento": "positivo"}]


async def test_keywords_todos_returns_every_sentimiento(
    client: httpx.AsyncClient, seeded: dict
) -> None:
    token = await _login(client, "viewer@podpulse.pe", "Valida123")

    response = await client.get(
        f"{DASHBOARD_URL}/keywords", headers=_auth(token), params={"programa": "TEST_A"}
    )

    assert response.status_code == 200
    assert len(response.json()) == 2


async def test_sentimiento_evolutivo(client: httpx.AsyncClient, seeded: dict) -> None:
    token = await _login(client, "viewer@podpulse.pe", "Valida123")

    response = await client.get(
        f"{DASHBOARD_URL}/sentimiento/evolutivo",
        headers=_auth(token),
        params={"programa": "TEST_A"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body == [
        {"mes": "2030-01", "pct_positivo": 0.5, "pct_negativo": 0.3, "pct_neutral": 0.2}
    ]
