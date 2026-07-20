import enum

from pydantic import BaseModel, Field


class ChatRole(enum.StrEnum):
    """Rol de cada turno de la conversación, desde la óptica del frontend.

    Se mapea internamente a los roles de Gemini (`user` / `model`) en el
    service — el frontend no conoce la nomenclatura del proveedor."""

    USER = "user"
    ASSISTANT = "assistant"


class ChatMessage(BaseModel):
    role: ChatRole
    content: str = Field(min_length=1, max_length=4000)


class ChatRequest(BaseModel):
    """Conversación completa enviada en cada request.

    El backend del asistente es stateless (no se guarda historial en BD, por
    decisión de alcance): el frontend manda el hilo entero cada vez. Se acota
    el largo para contener el costo/tamaño de contexto enviado al proveedor."""

    messages: list[ChatMessage] = Field(min_length=1, max_length=40)


class AssistantChatResponse(BaseModel):
    reply: str = Field(description="Respuesta en lenguaje natural del asistente")
    tools_used: list[str] = Field(
        default_factory=list,
        description="Nombres de las herramientas de datos que el asistente consultó para "
        "construir la respuesta (transparencia: qué datos reales se usaron)",
    )
