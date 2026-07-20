from collections.abc import Callable

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings, get_settings
from app.dependencies.auth import require_admin
from app.dependencies.db import get_session_factory
from app.models.user import User
from app.schemas.assistant import AssistantChatResponse, ChatRequest
from app.services import assistant_service

router = APIRouter(prefix="/assistant", tags=["assistant"])

_AUTH_RESPONSES = {
    401: {"description": "No autenticado"},
    403: {"description": "Rol sin permiso — solo Admin"},
    503: {"description": "Asistente no configurado o el proveedor de IA no respondió"},
}


@router.post(
    "/chat",
    response_model=AssistantChatResponse,
    summary="Conversar con el asistente de IA sobre los datos de PodPulse",
    description="Envía el hilo completo de la conversación (el backend es stateless, no guarda "
    "historial) y devuelve la respuesta del asistente, que puede haber consultado datos reales "
    "del dashboard vía tool-use. Rol requerido: Admin.",
    responses=_AUTH_RESPONSES,
)
async def chat(
    body: ChatRequest,
    user: User = Depends(require_admin),
    session_factory: Callable[[], AsyncSession] = Depends(get_session_factory),
    settings: Settings = Depends(get_settings),
) -> AssistantChatResponse:
    return await assistant_service.chat(session_factory, body.messages, settings)
