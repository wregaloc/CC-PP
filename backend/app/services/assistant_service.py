"""Orquesta la conversación del asistente de IA con Google Gemini.

Flujo (patrón "tool use" / function calling):
  1. Se manda la conversación + las declaraciones de herramientas a Gemini.
  2. Si el modelo pide llamar una herramienta, se ejecuta contra los datos
     reales (ver `assistant_tools`, que reusa `dashboard_service`) y se le
     devuelve el resultado.
  3. Se repite hasta que el modelo responde en texto, o hasta un tope de
     iteraciones (guarda contra loops).

Se usa la API REST de Gemini vía httpx (ya presente en el proyecto) en vez de
un SDK nuevo — la superficie que usamos es chica y así no agregamos dependencia
(ver [[fastapi-enterprise-backend]]). La API key nunca viaja en la URL ni se
loguea: va en el header `x-goog-api-key` (ver [[enterprise-security]])."""

import asyncio
import logging
from datetime import date
from typing import Any

import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings
from app.exceptions.assistant import AssistantNotConfiguredError, AssistantUpstreamError
from app.schemas.assistant import AssistantChatResponse, ChatMessage, ChatRole
from app.services import assistant_tools

logger = logging.getLogger(__name__)

_GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models"
_REQUEST_TIMEOUT_SECONDS = 60.0
# 429/503 de Gemini son transitorios (cuota del tier gratis, sobrecarga del
# modelo) — confirmado en la práctica: "This model is currently experiencing
# high demand" desaparece con un reintento a los pocos segundos. Otros
# códigos (400, 403) son errores de la request en sí; reintentarlos no
# cambia el resultado, así que no entran en este retry.
_RETRYABLE_STATUS_CODES = {429, 503}
_MAX_RETRIES = 2
_RETRY_BACKOFF_SECONDS = 2.0


def _system_instruction() -> str:
    hoy = date.today().isoformat()
    return (
        "Sos el asistente de datos de PodPulse, un dashboard de analítica de podcasts y "
        "programas. Respondé en español, de forma breve y concreta.\n"
        f"La fecha de hoy es {hoy}.\n"
        "Reglas:\n"
        "- Para cualquier dato numérico (vistas, engagement, ranking, tendencias) SIEMPRE "
        "usá las herramientas disponibles; nunca inventes ni estimes números.\n"
        "- Si el usuario nombra un programa o canal y no estás seguro del nombre exacto, "
        "usá obtener_ranking_programas con 'q' o listar_filtros_disponibles para descubrirlo.\n"
        "- Formateá los números grandes de forma legible (p. ej. 2.4M, 122k).\n"
        "- Si las herramientas no alcanzan para responder, decilo con honestidad en vez de "
        "inventar.\n"
        "- Solo respondés sobre los datos de PodPulse; si te preguntan otra cosa, aclaralo.\n"
        "- Respondé en texto plano, sin markdown (nada de **negrita**, *cursiva*, `código`, "
        "encabezados con # ni listas con guiones o asteriscos) — el chat no renderiza markdown, "
        "así que esos símbolos se verían literalmente. Para listar varios datos, separalos con "
        "comas o saltos de línea simples."
    )


def _to_gemini_contents(messages: list[ChatMessage]) -> list[dict[str, Any]]:
    """Traduce los turnos del frontend (user/assistant) al formato de Gemini
    (user/model). El asistente es stateless: el hilo completo llega en cada
    request."""
    role_map = {ChatRole.USER: "user", ChatRole.ASSISTANT: "model"}
    return [
        {"role": role_map[msg.role], "parts": [{"text": msg.content}]} for msg in messages
    ]


async def _generate_content(
    client: httpx.AsyncClient, model: str, api_key: str, payload: dict[str, Any]
) -> dict[str, Any]:
    """Una llamada a generateContent, con reintento corto ante 429/503
    transitorios de Gemini (ver `_RETRYABLE_STATUS_CODES`). Aislada para
    poder mockearla en tests sin tocar la red."""
    last_response: httpx.Response | None = None
    for attempt in range(_MAX_RETRIES + 1):
        response = await client.post(
            f"{_GEMINI_BASE_URL}/{model}:generateContent",
            headers={"x-goog-api-key": api_key, "Content-Type": "application/json"},
            json=payload,
        )
        if response.status_code == 200:
            return response.json()
        last_response = response
        if response.status_code not in _RETRYABLE_STATUS_CODES or attempt == _MAX_RETRIES:
            break
        logger.warning(
            "Gemini respondió %s (intento %s/%s), reintentando...",
            response.status_code, attempt + 1, _MAX_RETRIES,
        )
        await asyncio.sleep(_RETRY_BACKOFF_SECONDS)

    # No se filtra el cuerpo crudo del proveedor al cliente; se loguea para
    # diagnóstico y se traduce a un 503 genérico en el handler.
    assert last_response is not None
    logger.error("Gemini respondió %s: %s", last_response.status_code, last_response.text[:500])
    raise AssistantUpstreamError(f"Gemini HTTP {last_response.status_code}")


def _extract_parts(data: dict[str, Any]) -> list[dict[str, Any]]:
    candidates = data.get("candidates") or []
    if not candidates:
        raise AssistantUpstreamError("Respuesta de Gemini sin candidates")
    return candidates[0].get("content", {}).get("parts", []) or []


async def chat(
    session: AsyncSession, messages: list[ChatMessage], settings: Settings
) -> AssistantChatResponse:
    """Procesa una conversación y devuelve la respuesta del asistente.

    Lanza AssistantNotConfiguredError si falta la API key (503), o
    AssistantUpstreamError ante fallos del proveedor (503) — fail closed."""
    if not settings.gemini_api_key:
        raise AssistantNotConfiguredError

    contents = _to_gemini_contents(messages)
    tools = [{"functionDeclarations": assistant_tools.TOOL_DECLARATIONS}]
    base_payload = {
        "system_instruction": {"parts": [{"text": _system_instruction()}]},
        "tools": tools,
    }
    tools_used: list[str] = []

    async with httpx.AsyncClient(timeout=_REQUEST_TIMEOUT_SECONDS) as client:
        for _ in range(settings.assistant_max_tool_iterations):
            data = await _generate_content(
                client,
                settings.gemini_model,
                settings.gemini_api_key,
                {**base_payload, "contents": contents},
            )
            parts = _extract_parts(data)
            function_calls = [p["functionCall"] for p in parts if "functionCall" in p]

            if not function_calls:
                text = "".join(p.get("text", "") for p in parts).strip()
                if not text:
                    raise AssistantUpstreamError("Respuesta de Gemini vacía")
                return AssistantChatResponse(reply=text, tools_used=tools_used)

            # El modelo pidió herramientas: se agrega su turno y se responden.
            contents.append({"role": "model", "parts": parts})
            tool_response_parts: list[dict[str, Any]] = []
            for call in function_calls:
                name = call.get("name", "")
                args = call.get("args") or {}
                tools_used.append(name)
                result = await assistant_tools.execute_tool(session, name, args)
                tool_response_parts.append(
                    {"functionResponse": {"name": name, "response": result}}
                )
            contents.append({"role": "user", "parts": tool_response_parts})

    # Se agotaron las iteraciones sin una respuesta de texto final.
    logger.warning("Asistente: se alcanzó el tope de iteraciones de herramientas")
    raise AssistantUpstreamError("Se alcanzó el tope de iteraciones de herramientas")
