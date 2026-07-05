import json
import logging
from datetime import UTC, datetime

from app.core.middleware import request_id_ctx


class JsonFormatter(logging.Formatter):
    """Formatter de logging estructurado en JSON.

    Ver [[fastapi-enterprise-backend]] (sección Logging).
    """

    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, object] = {
            "timestamp": datetime.now(UTC).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }
        if record.exc_info:
            payload["exception"] = self.formatException(record.exc_info)

        request_id = getattr(record, "request_id", None)
        if request_id is not None:
            payload["request_id"] = request_id

        return json.dumps(payload, ensure_ascii=False)


class RequestIDFilter(logging.Filter):
    """Inyecta el request_id del ContextVar en cualquier log emitido durante una
    request, sin que cada llamada a logger.info(...) tenga que pasarlo a mano."""

    def filter(self, record: logging.LogRecord) -> bool:
        if not hasattr(record, "request_id"):
            record.request_id = request_id_ctx.get()
        return True


def setup_logging(log_level: str) -> None:
    """Configura el logging raíz de la aplicación. Debe llamarse una única vez al arrancar."""
    handler = logging.StreamHandler()
    handler.setFormatter(JsonFormatter())
    handler.addFilter(RequestIDFilter())

    root_logger = logging.getLogger()
    root_logger.handlers = [handler]
    root_logger.setLevel(log_level.upper())
