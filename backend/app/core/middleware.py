"""Middleware de correlación de requests (X-Request-ID) para logging estructurado.

Ver [[fastapi-enterprise-backend]] (sección Logging): cada log de una request
debe poder correlacionarse vía request_id. Este middleware propaga el header
si el cliente ya lo envía, o genera uno nuevo, y lo expone a los logs de esa
request mediante un ContextVar (logging.py lo lee al formatear cada registro).
"""

import logging
import time
import uuid
from collections.abc import Awaitable, Callable
from contextvars import ContextVar

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

request_id_ctx: ContextVar[str | None] = ContextVar("request_id", default=None)

logger = logging.getLogger("app.request")


class RequestIDMiddleware(BaseHTTPMiddleware):
    async def dispatch(
        self, request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        request_id = request.headers.get("X-Request-ID", str(uuid.uuid4()))
        token = request_id_ctx.set(request_id)
        start = time.monotonic()
        try:
            response = await call_next(request)
        finally:
            request_id_ctx.reset(token)

        duration_ms = round((time.monotonic() - start) * 1000, 2)
        response.headers["X-Request-ID"] = request_id
        logger.info(
            "%s %s -> %s (%sms)",
            request.method,
            request.url.path,
            response.status_code,
            duration_ms,
            extra={"request_id": request_id},
        )
        return response


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Cabeceras de defensa en profundidad (ver [[enterprise-security]] — OWASP).

    HTTPS en sí lo termina la plataforma (Cloud Run/Vercel), no esta app —
    acá solo se agregan las cabeceras que si dependen del código: HSTS para
    forzar HTTPS en visitas futuras, y las de anti-sniffing/clickjacking que
    no tienen downside para una API JSON pura (sin vistas HTML propias).
    """

    def __init__(self, app: object, hsts_enabled: bool) -> None:
        super().__init__(app)  # type: ignore[arg-type]
        self._hsts_enabled = hsts_enabled

    async def dispatch(
        self, request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
        if self._hsts_enabled:
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        return response
