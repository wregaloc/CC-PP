"""Excepciones de dominio del asistente de IA (Módulo IA — solo Admin)."""


class AssistantNotConfiguredError(Exception):
    """No hay GEMINI_API_KEY configurada — el asistente está deshabilitado.

    Se trata como 503 (servicio no disponible) y no como error del cliente:
    la request es válida, es el servidor el que no tiene el proveedor de IA
    configurado todavía."""


class AssistantUpstreamError(Exception):
    """El proveedor de IA (Gemini) devolvió un error o una respuesta inesperada.

    Nunca expone detalles del proveedor ni la API key al cliente — el mensaje
    concreto se registra en logs del servidor; al usuario se le devuelve un
    503 genérico (fail closed, ver [[enterprise-security]])."""
