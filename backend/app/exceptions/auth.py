"""Excepciones de dominio de autenticación/autorización.

Las capas de servicio y dependencias lanzan estas excepciones; nunca
`HTTPException` directamente (ver [[fastapi-enterprise-backend]]) — la
traducción a respuestas HTTP vive en exceptions/handlers.py.
"""


class InvalidCredentialsError(Exception):
    """Email no existe, contraseña incorrecta, o cuenta inactiva.

    Se usa el mismo error para los tres casos deliberadamente: distinguir la
    respuesta filtraría qué emails están registrados (enumeración de usuarios).
    """


class TooManyLoginAttemptsError(Exception):
    """La IP superó el máximo de intentos fallidos configurado (rate limit)."""

    def __init__(self, retry_after_seconds: int) -> None:
        self.retry_after_seconds = retry_after_seconds


class AccountInactiveError(Exception):
    """El token es válido pero el usuario fue desactivado después de emitirlo."""


class InsufficientRoleError(Exception):
    """El usuario autenticado no tiene el rol requerido para la operación."""


class ClientCannotChangeCredentialsError(Exception):
    """Fase 10 §Módulo 4: el rol Cliente no gestiona sus propias credenciales
    (ni contraseña ni email) — es responsabilidad exclusiva del Admin."""
