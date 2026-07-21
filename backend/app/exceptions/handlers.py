import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from app.core.security import InvalidTokenError, TokenExpiredError
from app.etl.exceptions import FileStructureError
from app.exceptions.admin_users import (
    CannotChangeOwnRoleError,
    EmailAlreadyExistsError,
    UserNotFoundError,
)
from app.exceptions.assistant import AssistantNotConfiguredError, AssistantUpstreamError
from app.exceptions.auth import (
    AccountInactiveError,
    ClientCannotChangeCredentialsError,
    InsufficientRoleError,
    InvalidCredentialsError,
    TooManyLoginAttemptsError,
)
from app.exceptions.clients import ClientNotFoundError, InvalidLogoImageError
from app.exceptions.dashboard import HorarioAudienciaFiltroInvalidoError, InvalidDateRangeError
from app.exceptions.uploads import FileTooLargeError, UploadNotFoundError, UploadRejectedError

logger = logging.getLogger(__name__)


def _error(status_code: int, code: str, detail: str) -> JSONResponse:
    return JSONResponse(status_code=status_code, content={"detail": detail, "code": code})


def register_exception_handlers(app: FastAPI) -> None:
    """Registra los exception handlers globales de la aplicación.

    Traduce excepciones de dominio (auth, ver [[enterprise-security]]) a los
    códigos de error estándar del TDD (docs/PODPULSE_TDD_v1.0.docx §8.10) —
    los servicios/dependencias nunca lanzan HTTPException directamente.
    """

    @app.exception_handler(InvalidCredentialsError)
    async def invalid_credentials_handler(
        request: Request, exc: InvalidCredentialsError
    ) -> JSONResponse:
        return _error(401, "INVALID_CREDENTIALS", "Email o contraseña incorrectos")

    @app.exception_handler(TokenExpiredError)
    async def token_expired_handler(request: Request, exc: TokenExpiredError) -> JSONResponse:
        return _error(401, "TOKEN_EXPIRED", "El token expiró")

    @app.exception_handler(InvalidTokenError)
    async def token_invalid_handler(request: Request, exc: InvalidTokenError) -> JSONResponse:
        return _error(401, "TOKEN_INVALID", "Token ausente o inválido")

    @app.exception_handler(AccountInactiveError)
    async def account_inactive_handler(request: Request, exc: AccountInactiveError) -> JSONResponse:
        return _error(401, "TOKEN_INVALID", "La cuenta está desactivada")

    @app.exception_handler(InsufficientRoleError)
    async def insufficient_role_handler(
        request: Request, exc: InsufficientRoleError
    ) -> JSONResponse:
        return _error(403, "INSUFFICIENT_ROLE", "Rol sin permiso para esta operación")

    @app.exception_handler(ClientCannotChangeCredentialsError)
    async def client_cannot_change_credentials_handler(
        request: Request, exc: ClientCannotChangeCredentialsError
    ) -> JSONResponse:
        return _error(
            403,
            "INSUFFICIENT_ROLE",
            "El rol Cliente no gestiona sus propias credenciales — contactá a un Admin",
        )

    @app.exception_handler(TooManyLoginAttemptsError)
    async def too_many_attempts_handler(
        request: Request, exc: TooManyLoginAttemptsError
    ) -> JSONResponse:
        response = _error(429, "RATE_LIMIT_EXCEEDED", "Demasiados intentos de login")
        response.headers["Retry-After"] = str(exc.retry_after_seconds)
        return response

    @app.exception_handler(FileTooLargeError)
    async def file_too_large_handler(request: Request, exc: FileTooLargeError) -> JSONResponse:
        return _error(
            413,
            "FILE_TOO_LARGE",
            f"El archivo ({exc.size_bytes} bytes) supera el máximo permitido "
            f"({exc.max_bytes} bytes)",
        )

    @app.exception_handler(UploadRejectedError)
    async def upload_rejected_handler(request: Request, exc: UploadRejectedError) -> JSONResponse:
        return JSONResponse(
            status_code=422,
            content={
                "detail": exc.report.error_message or "El archivo fue rechazado",
                "code": "ETL_ERROR",
                **exc.report.to_summary_dict(),
            },
        )

    @app.exception_handler(FileStructureError)
    async def file_structure_error_handler(
        request: Request, exc: FileStructureError
    ) -> JSONResponse:
        return _error(422, "ETL_ERROR", str(exc))

    @app.exception_handler(UploadNotFoundError)
    async def upload_not_found_handler(request: Request, exc: UploadNotFoundError) -> JSONResponse:
        return _error(404, "RESOURCE_NOT_FOUND", "No existe una carga con ese id")

    @app.exception_handler(EmailAlreadyExistsError)
    async def email_exists_handler(request: Request, exc: EmailAlreadyExistsError) -> JSONResponse:
        return _error(409, "RESOURCE_EXISTS", "El email ya está registrado")

    @app.exception_handler(UserNotFoundError)
    async def user_not_found_handler(request: Request, exc: UserNotFoundError) -> JSONResponse:
        return _error(404, "RESOURCE_NOT_FOUND", "Usuario no encontrado")

    @app.exception_handler(CannotChangeOwnRoleError)
    async def cannot_change_own_role_handler(
        request: Request, exc: CannotChangeOwnRoleError
    ) -> JSONResponse:
        return _error(
            400, "CANNOT_CHANGE_OWN_ROLE", "Un Admin no puede cambiar el rol de su propia cuenta"
        )

    @app.exception_handler(ClientNotFoundError)
    async def client_not_found_handler(request: Request, exc: ClientNotFoundError) -> JSONResponse:
        return _error(404, "RESOURCE_NOT_FOUND", "No existe un cliente con ese id")

    @app.exception_handler(InvalidLogoImageError)
    async def invalid_logo_image_handler(
        request: Request, exc: InvalidLogoImageError
    ) -> JSONResponse:
        return _error(422, "VALIDATION_ERROR", "El archivo no es una imagen PNG/JPEG/WEBP válida")

    @app.exception_handler(InvalidDateRangeError)
    async def invalid_date_range_handler(
        request: Request, exc: InvalidDateRangeError
    ) -> JSONResponse:
        return _error(422, "VALIDATION_ERROR", "fecha_inicio no puede ser posterior a fecha_fin")

    @app.exception_handler(HorarioAudienciaFiltroInvalidoError)
    async def horario_audiencia_filtro_invalido_handler(
        request: Request, exc: HorarioAudienciaFiltroInvalidoError
    ) -> JSONResponse:
        return _error(
            422,
            "VALIDATION_ERROR",
            "Indicá `programa` o `canal` (exactamente uno) para ver el horario de audiencia",
        )

    @app.exception_handler(AssistantNotConfiguredError)
    async def assistant_not_configured_handler(
        request: Request, exc: AssistantNotConfiguredError
    ) -> JSONResponse:
        return _error(
            503, "ASSISTANT_NOT_CONFIGURED", "El asistente de IA no está configurado todavía"
        )

    @app.exception_handler(AssistantUpstreamError)
    async def assistant_upstream_error_handler(
        request: Request, exc: AssistantUpstreamError
    ) -> JSONResponse:
        return _error(
            503, "ASSISTANT_UNAVAILABLE", "El asistente de IA no pudo responder, intentá de nuevo"
        )

    @app.exception_handler(RequestValidationError)
    async def request_validation_error_handler(
        request: Request, exc: RequestValidationError
    ) -> JSONResponse:
        """FastAPI/Pydantic validan la request ANTES de que el código propio
        corra, así que estos errores nunca pasan por `_error()` — su forma
        default (`detail` como lista de objetos, no un string) rompía el
        contrato `{detail, code}` que el resto de la API respeta, y el
        frontend terminaba mostrando "[object Object]" (confirmado en vivo
        probando el formulario de Clientes con el nombre vacío)."""
        errores = exc.errors()
        primero = errores[0] if errores else None
        if primero is None:
            detalle = "Datos inválidos"
        else:
            # loc[0] es "body"/"query"/"path" — se omite, no aporta al usuario.
            campo = ".".join(str(parte) for parte in primero["loc"][1:])
            detalle = f"{campo}: {primero['msg']}" if campo else str(primero["msg"])
        return _error(422, "VALIDATION_ERROR", detalle)

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
        logger.exception("Unhandled exception on %s %s", request.method, request.url.path)
        return JSONResponse(
            status_code=500,
            content={"detail": "Internal server error", "code": "SERVER_ERROR"},
        )
