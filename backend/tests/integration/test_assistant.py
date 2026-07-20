"""Integration tests del asistente de IA — ver [[fastapi-enterprise-backend]].

Se ejercita el flujo completo real (auth, RBAC, DB real vía dashboard_service,
manejo de excepciones) y se mockea únicamente la llamada de red a Gemini
(`assistant_service._generate_content`) — es el único borde externo, y
pegarle de verdad en cada corrida de tests sería lento, costoso contra la
cuota gratuita, y flaky por depender de la red."""

from collections.abc import Awaitable, Callable
from datetime import date, time
from typing import Any

import httpx
import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings, get_settings
from app.main import app
from app.models.enums import ProgramType, UserRole
from app.models.fact_audiencia import FactAudiencia
from app.models.user import User
from app.services import assistant_service, assistant_tools

pytestmark = pytest.mark.usefixtures("db_session")

CHAT_URL = "/api/v1/assistant/chat"


async def _login(client: httpx.AsyncClient, email: str, password: str) -> str:
    response = await client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert response.status_code == 200
    return response.json()["access_token"]


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


async def _make_admin_token(
    client: httpx.AsyncClient, make_user: Callable[..., Awaitable[User]], email: str
) -> str:
    await make_user(email=email, password="Valida123", role=UserRole.ADMIN)
    return await _login(client, email, "Valida123")


def _text_response(text: str) -> dict[str, Any]:
    """Forma de una respuesta final de Gemini (sin functionCall)."""
    return {"candidates": [{"content": {"role": "model", "parts": [{"text": text}]}}]}


def _function_call_response(name: str, args: dict[str, Any]) -> dict[str, Any]:
    """Forma de una respuesta de Gemini que pide ejecutar una herramienta."""
    return {
        "candidates": [
            {"content": {"role": "model", "parts": [{"functionCall": {"name": name, "args": args}}]}}
        ]
    }


@pytest.fixture(autouse=True)
def _cleanup_settings_override():
    """Limpia cualquier override de `get_settings` que un test haya dejado,
    para no filtrar estado entre tests."""
    yield
    app.dependency_overrides.pop(get_settings, None)


async def test_chat_requires_authentication(client: httpx.AsyncClient) -> None:
    response = await client.post(CHAT_URL, json={"messages": [{"role": "user", "content": "hola"}]})

    assert response.status_code == 401


async def test_chat_rejects_non_admin(
    client: httpx.AsyncClient, make_user: Callable[..., Awaitable[User]]
) -> None:
    await make_user(email="interno-assistant@podpulse.pe", password="Valida123", role=UserRole.INTERNO)
    token = await _login(client, "interno-assistant@podpulse.pe", "Valida123")

    response = await client.post(
        CHAT_URL, json={"messages": [{"role": "user", "content": "hola"}]}, headers=_auth(token)
    )

    assert response.status_code == 403
    assert response.json()["code"] == "INSUFFICIENT_ROLE"


async def test_chat_returns_503_when_not_configured(
    client: httpx.AsyncClient, make_user: Callable[..., Awaitable[User]]
) -> None:
    token = await _make_admin_token(client, make_user, "admin-noconfig@podpulse.pe")
    app.dependency_overrides[get_settings] = lambda: Settings(gemini_api_key="")  # type: ignore[call-arg]

    response = await client.post(
        CHAT_URL, json={"messages": [{"role": "user", "content": "hola"}]}, headers=_auth(token)
    )

    assert response.status_code == 503
    assert response.json()["code"] == "ASSISTANT_NOT_CONFIGURED"


async def test_chat_admin_receives_text_reply_without_tools(
    client: httpx.AsyncClient,
    make_user: Callable[..., Awaitable[User]],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    token = await _make_admin_token(client, make_user, "admin-textreply@podpulse.pe")

    async def fake_generate_content(client_, model, api_key, payload):
        return _text_response("¡Hola! Soy el asistente de PodPulse.")

    monkeypatch.setattr(assistant_service, "_generate_content", fake_generate_content)

    response = await client.post(
        CHAT_URL,
        json={"messages": [{"role": "user", "content": "hola"}]},
        headers=_auth(token),
    )

    assert response.status_code == 200
    body = response.json()
    assert body["reply"] == "¡Hola! Soy el asistente de PodPulse."
    assert body["tools_used"] == []


async def test_chat_admin_tool_call_reads_real_data(
    client: httpx.AsyncClient,
    make_user: Callable[..., Awaitable[User]],
    make_programa,
    db_session: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """El modelo pide `obtener_kpis`; el backend lo ejecuta contra datos reales
    sembrados en la base (no un mock del dato), y le devuelve el resultado al
    modelo, que responde en base a eso — verifica el loop de tool-use completo."""
    token = await _make_admin_token(client, make_user, "admin-tooluse@podpulse.pe")

    programa = await make_programa("TEST_ASISTENTE", "Canal Asistente", tipo=ProgramType.PODCAST)
    db_session.add(
        FactAudiencia(
            fecha=date(2030, 3, 1), mes_num=3, anio=2030, semana_num=9,
            programa_id=programa.id, es_emision=1, vistas_diarias=777,
            busquedas_diarias=0, likes=0, comentarios=0,
        )
    )
    await db_session.flush()

    calls: list[dict[str, Any]] = []

    async def fake_generate_content(client_, model, api_key, payload):
        calls.append(payload)
        if len(calls) == 1:
            return _function_call_response("obtener_kpis", {"programa": "TEST_ASISTENTE"})
        return _text_response("El programa TEST_ASISTENTE tiene 777 vistas totales.")

    monkeypatch.setattr(assistant_service, "_generate_content", fake_generate_content)

    response = await client.post(
        CHAT_URL,
        json={"messages": [{"role": "user", "content": "¿Cuántas vistas tiene TEST_ASISTENTE?"}]},
        headers=_auth(token),
    )

    assert response.status_code == 200
    body = response.json()
    assert body["tools_used"] == ["obtener_kpis"]
    assert "777" in body["reply"]
    # El segundo request a Gemini debe llevar el resultado real de la tool.
    assert len(calls) == 2
    second_call_contents = calls[1]["contents"]
    tool_result_part = second_call_contents[-1]["parts"][0]["functionResponse"]
    assert tool_result_part["response"]["vistas_totales"] == 777


async def test_chat_upstream_error_returns_503(
    client: httpx.AsyncClient,
    make_user: Callable[..., Awaitable[User]],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    token = await _make_admin_token(client, make_user, "admin-upstream@podpulse.pe")

    async def fake_generate_content(client_, model, api_key, payload):
        return {"candidates": []}

    monkeypatch.setattr(assistant_service, "_generate_content", fake_generate_content)

    response = await client.post(
        CHAT_URL, json={"messages": [{"role": "user", "content": "hola"}]}, headers=_auth(token)
    )

    assert response.status_code == 503
    assert response.json()["code"] == "ASSISTANT_UNAVAILABLE"


async def test_obtener_horario_audiencia_programa_suma_por_dia_y_hora(
    db_session: AsyncSession, make_programa
) -> None:
    """Modo programa: dos filas en el mismo (día de semana, hora) suman sus
    vistas — replica construirGrillaHeatmap del frontend, no un simple max."""
    programa = await make_programa("TEST_HORARIO_A", "Canal Horario Test 1", tipo=ProgramType.PODCAST)
    # 2030-01-07 y 2030-01-14 caen en el mismo día de semana (7 días de diferencia).
    db_session.add_all(
        [
            FactAudiencia(
                fecha=date(2030, 1, 7), mes_num=1, anio=2030, semana_num=2,
                programa_id=programa.id, es_emision=1, vistas_diarias=100,
                hora_transmision=time(9, 0),
            ),
            FactAudiencia(
                fecha=date(2030, 1, 14), mes_num=1, anio=2030, semana_num=3,
                programa_id=programa.id, es_emision=1, vistas_diarias=150,
                hora_transmision=time(9, 30),
            ),
            FactAudiencia(
                fecha=date(2030, 1, 21), mes_num=1, anio=2030, semana_num=4,
                programa_id=programa.id, es_emision=1, vistas_diarias=50,
                hora_transmision=time(14, 0),
            ),
        ]
    )
    await db_session.flush()

    result = await assistant_tools.execute_tool(
        db_session, "obtener_horario_audiencia", {"programa": "TEST_HORARIO_A"}
    )

    assert result["bloque_max"]["dia_semana"] == assistant_tools._DIAS_SEMANA[date(2030, 1, 7).weekday()]
    assert result["bloque_max"]["hora"] == 9
    assert result["bloque_max"]["vistas"] == 250
    assert "programa_lider" not in result["bloque_max"]


async def test_obtener_horario_audiencia_canal_toma_maximo_y_atribuye_programa(
    db_session: AsyncSession, make_programa
) -> None:
    """Modo canal: el bloque no suma entre programas — se queda con la fila
    de mayor vistas_diarias y reporta qué programa la generó."""
    programa_a = await make_programa("TEST_HORARIO_CANAL_A", "Canal Horario Test 2", tipo=ProgramType.PODCAST)
    programa_b = await make_programa("TEST_HORARIO_CANAL_B", "Canal Horario Test 2", tipo=ProgramType.PODCAST)
    db_session.add_all(
        [
            FactAudiencia(
                fecha=date(2030, 2, 4), mes_num=2, anio=2030, semana_num=6,
                programa_id=programa_a.id, es_emision=1, vistas_diarias=80,
                hora_transmision=time(10, 0),
            ),
            FactAudiencia(
                fecha=date(2030, 2, 11), mes_num=2, anio=2030, semana_num=7,
                programa_id=programa_b.id, es_emision=1, vistas_diarias=200,
                hora_transmision=time(10, 15),
            ),
        ]
    )
    await db_session.flush()

    result = await assistant_tools.execute_tool(
        db_session, "obtener_horario_audiencia", {"canal": "Canal Horario Test 2"}
    )

    assert result["bloque_max"]["hora"] == 10
    assert result["bloque_max"]["vistas"] == 200
    assert result["bloque_max"]["programa_lider"] == "TEST_HORARIO_CANAL_B"
