from datetime import date

import httpx
import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.dim_auspicios import Auspicio
from app.models.enums import ProgramType, SentimentType, UserRole
from app.models.fact_audiencia import FactAudiencia
from app.models.fact_keywords import FactKeywords
from app.models.fact_sentimiento import FactSentimiento
from app.repositories import dashboard_repository

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
            FactKeywords(
                anio=2030, mes_num=2, mes_nombre="Febrero", programa_id=programa_a.id,
                hashtag="masvisto", occurrences=30, sentimiento=SentimentType.POSITIVO,
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


async def test_kpis_includes_pico_max_y_promedio_vivo(
    client: httpx.AsyncClient, seeded: dict
) -> None:
    """Solo programa_b (Canal Y) tiene pico_max_vivo/promedio_vivo sembrados
    (1000/800) — MAX/AVG ignoran los null de programa_a y programa_c, así que
    dentro del rango sembrado (2030-01-01) el resultado debe ser exactamente
    ese valor, y filtrando por TEST_A (que no tiene el dato) debe dar null.
    Se acota por fecha (igual que test_kpis_are_visible_to_non_admin_roles)
    para no mezclar con datos reales ya cargados en la misma base."""
    token = await _login(client, "viewer@podpulse.pe", "Valida123")
    rango = {"fecha_inicio": "2030-01-01", "fecha_fin": "2030-01-02"}

    sin_filtro_programa = await client.get(
        f"{DASHBOARD_URL}/kpis", headers=_auth(token), params=rango
    )
    assert sin_filtro_programa.status_code == 200
    body = sin_filtro_programa.json()
    assert body["pico_max_vivo"] == 1000
    assert body["promedio_vivo"] == pytest.approx(800)

    filtrado_por_a = await client.get(
        f"{DASHBOARD_URL}/kpis",
        headers=_auth(token),
        params={**rango, "programa": "TEST_A"},
    )
    assert filtrado_por_a.status_code == 200
    assert filtrado_por_a.json()["pico_max_vivo"] is None
    assert filtrado_por_a.json()["promedio_vivo"] is None


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


async def test_sentiment_kpis_includes_month_on_partial_range(
    client: httpx.AsyncClient, seeded: dict
) -> None:
    """El dato sembrado es de enero 2030 (mes_num=1). Un rango parcial que no
    incluye el día 1 del mes (10-20 de enero) debe seguir trayendo ese mes —
    antes se comparaba solo contra el día 1, así que este rango lo excluía
    por completo y devolvía None en los tres porcentajes."""
    token = await _login(client, "viewer@podpulse.pe", "Valida123")

    response = await client.get(
        f"{DASHBOARD_URL}/sentiment-kpis",
        headers=_auth(token),
        params={"programa": "TEST_A", "fecha_inicio": "2030-01-10", "fecha_fin": "2030-01-20"},
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
    assert response.json() == [{"auspiciador": "MarcaX", "mes_num": 1, "mes_nombre": "Enero"}]


async def test_buscar_auspicios_matches_partial_case_insensitive(
    client: httpx.AsyncClient, seeded: dict
) -> None:
    token = await _login(client, "viewer@podpulse.pe", "Valida123")

    response = await client.get(
        f"{DASHBOARD_URL}/auspicios/buscar", headers=_auth(token), params={"q": "marca"}
    )

    assert response.status_code == 200
    assert response.json() == [
        {
            "programa": "TEST_A",
            "canal": "Canal X",
            "auspiciador": "MarcaX",
            "mes_num": 1,
            "mes_nombre": "Enero",
        }
    ]


async def test_buscar_auspicios_no_match_returns_empty_list(
    client: httpx.AsyncClient, seeded: dict
) -> None:
    token = await _login(client, "viewer@podpulse.pe", "Valida123")

    response = await client.get(
        f"{DASHBOARD_URL}/auspicios/buscar", headers=_auth(token), params={"q": "noexiste"}
    )

    assert response.status_code == 200
    assert response.json() == []


async def test_buscar_auspicios_requires_min_length(
    client: httpx.AsyncClient, seeded: dict
) -> None:
    token = await _login(client, "viewer@podpulse.pe", "Valida123")

    response = await client.get(
        f"{DASHBOARD_URL}/auspicios/buscar", headers=_auth(token), params={"q": "a"}
    )

    assert response.status_code == 422


async def test_top_auspiciadores_orders_by_program_count_desc(
    seeded: dict, db_session: AsyncSession, make_programa
) -> None:
    """/auspicios/top no filtra por fecha (dim_auspicios no tiene año) — el conteo
    es sobre todo el dataset, así que la base de test/dev puede tener otros
    auspiciadores reales de por medio (mismo riesgo que en
    test_ranking_programas_programa_asegurado_included_beyond_limit). El endpoint
    HTTP limita `limit` a 50 (tope de UI razonable para un top-N), así que acá se
    llama al repository directamente con un `limit` grande para no depender de
    cuántos otros auspiciadores reales existan."""
    top_a = await make_programa("ZZZ_TOP_PROGA", "Canal Top", tipo=ProgramType.PODCAST)
    top_b = await make_programa("ZZZ_TOP_PROGB", "Canal Top", tipo=ProgramType.PODCAST)
    top_c = await make_programa("ZZZ_TOP_PROGC", "Canal Top", tipo=ProgramType.PODCAST)
    db_session.add_all(
        [
            Auspicio(mes_num=1, mes_nombre="Enero", programa_id=top_a.id, auspiciador="ZZZ_TOP_MARCA"),
            Auspicio(mes_num=1, mes_nombre="Enero", programa_id=top_b.id, auspiciador="ZZZ_TOP_MARCA"),
            Auspicio(mes_num=1, mes_nombre="Enero", programa_id=top_c.id, auspiciador="ZZZ_TOP_MARCA"),
            Auspicio(mes_num=1, mes_nombre="Enero", programa_id=top_a.id, auspiciador="ZZZ_LOW_MARCA"),
        ]
    )
    await db_session.flush()

    rows = await dashboard_repository.get_top_auspiciadores(db_session, limit=1_000_000)

    por_nombre = {row["auspiciador"]: row for row in rows}
    assert por_nombre["ZZZ_TOP_MARCA"]["cantidad_programas"] == 3
    assert por_nombre["ZZZ_LOW_MARCA"]["cantidad_programas"] == 1
    posicion_top = rows.index(por_nombre["ZZZ_TOP_MARCA"])
    posicion_low = rows.index(por_nombre["ZZZ_LOW_MARCA"])
    assert posicion_top < posicion_low


async def test_top_auspiciadores_respects_limit(client: httpx.AsyncClient, seeded: dict) -> None:
    token = await _login(client, "viewer@podpulse.pe", "Valida123")

    response = await client.get(
        f"{DASHBOARD_URL}/auspicios/top", headers=_auth(token), params={"limit": 1}
    )

    assert response.status_code == 200
    assert len(response.json()) == 1


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


async def test_ranking_programas_q_matches_partial_case_insensitive(
    client: httpx.AsyncClient, seeded: dict
) -> None:
    """`q` existe para encontrar programas fuera del top `limit` en bases
    grandes (1000+ programas) — acá se verifica que busca por texto parcial
    case-insensitive, sin depender de otros filtros (canal/tipo/formato)."""
    token = await _login(client, "viewer@podpulse.pe", "Valida123")

    response = await client.get(
        f"{DASHBOARD_URL}/ranking/programas", headers=_auth(token), params={"q": "test_b"}
    )

    assert response.status_code == 200
    body = response.json()
    assert len(body) == 1
    assert body[0]["programa"] == "TEST_B"


async def test_ranking_programas_programa_asegurado_included_beyond_limit(
    client: httpx.AsyncClient, seeded: dict
) -> None:
    """`programa_asegurado` debe viajar en la respuesta aunque su ranking
    quede fuera de `limit` — con limit=1 solo TEST_B (500 vistas, rank 1)
    entraría por el corte normal; TEST_A (300 vistas, rank 2) solo aparece
    porque se pide explícitamente vía programa_asegurado. Se acota por fecha
    (igual que otros tests de este archivo) para no mezclar con datos reales
    ya cargados en la misma base."""
    token = await _login(client, "viewer@podpulse.pe", "Valida123")

    response = await client.get(
        f"{DASHBOARD_URL}/ranking/programas",
        headers=_auth(token),
        params={
            "limit": 1,
            "programa_asegurado": "TEST_A",
            "fecha_inicio": "2030-01-01",
            "fecha_fin": "2030-01-02",
        },
    )

    assert response.status_code == 200
    names = {item["programa"] for item in response.json()}
    assert "TEST_B" in names
    assert "TEST_A" in names


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


async def test_keywords_filters_by_sentimiento_and_orders_by_occurrences(
    client: httpx.AsyncClient, seeded: dict
) -> None:
    """"masvisto" tiene dos filas (Enero=50, Febrero=30) — sin filtro de mes
    deben sumarse en una sola entrada (80), nunca devolverse como filas
    duplicadas (ver regresión: fact_keywords tiene grano mensual, la nube de
    palabras del frontend usaba hashtag+sentimiento como key de React y las
    filas duplicadas rompían el render al cambiar de tab de sentimiento)."""
    token = await _login(client, "viewer@podpulse.pe", "Valida123")

    response = await client.get(
        f"{DASHBOARD_URL}/keywords",
        headers=_auth(token),
        params={"programa": "TEST_A", "sentimiento": "positivo"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body == [{"hashtag": "masvisto", "occurrences": 80, "sentimiento": "positivo"}]


async def test_keywords_filters_by_multiple_meses(client: httpx.AsyncClient, seeded: dict) -> None:
    """`mes` acepta varios valores (rango del date picker, p. ej. Enero+Febrero)
    y suma occurrences del período combinado antes de sacar el top — no debe
    devolver solo el resultado de uno de los meses."""
    token = await _login(client, "viewer@podpulse.pe", "Valida123")

    solo_enero = await client.get(
        f"{DASHBOARD_URL}/keywords",
        headers=_auth(token),
        params={"programa": "TEST_A", "sentimiento": "positivo", "mes": 1},
    )
    assert solo_enero.json() == [{"hashtag": "masvisto", "occurrences": 50, "sentimiento": "positivo"}]

    enero_y_febrero = await client.get(
        f"{DASHBOARD_URL}/keywords",
        headers=_auth(token),
        params={"programa": "TEST_A", "sentimiento": "positivo", "mes": [1, 2]},
    )
    assert enero_y_febrero.status_code == 200
    assert enero_y_febrero.json() == [
        {"hashtag": "masvisto", "occurrences": 80, "sentimiento": "positivo"}
    ]


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


async def test_sentimiento_evolutivo_includes_month_on_partial_range(
    client: httpx.AsyncClient, seeded: dict
) -> None:
    """Mismo caso que test_sentiment_kpis_includes_month_on_partial_range,
    para el endpoint de evolutivo mensual."""
    token = await _login(client, "viewer@podpulse.pe", "Valida123")

    response = await client.get(
        f"{DASHBOARD_URL}/sentimiento/evolutivo",
        headers=_auth(token),
        params={"programa": "TEST_A", "fecha_inicio": "2030-01-10", "fecha_fin": "2030-01-20"},
    )

    assert response.status_code == 200
    assert response.json() == [
        {"mes": "2030-01", "pct_positivo": 0.5, "pct_negativo": 0.3, "pct_neutral": 0.2}
    ]
