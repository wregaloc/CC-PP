from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import api_router
from app.core.config import get_settings
from app.core.logging import setup_logging
from app.core.middleware import RequestIDMiddleware, SecurityHeadersMiddleware
from app.exceptions.handlers import register_exception_handlers

settings = get_settings()
setup_logging(settings.log_level)

# En producción se ocultan /docs, /redoc y /openapi.json — la API no es
# pública ni tiene consumidores externos que necesiten Swagger UI expuesto,
# y no aporta ocultar menos superficie a quien no está autenticado (ver
# [[enterprise-security]]). Siguen disponibles en development/staging.
_docs_habilitados = not settings.is_production

app = FastAPI(
    title="PodPulse API",
    version="0.1.0",
    debug=settings.debug,
    docs_url="/docs" if _docs_habilitados else None,
    redoc_url="/redoc" if _docs_habilitados else None,
    openapi_url="/openapi.json" if _docs_habilitados else None,
)

app.add_middleware(RequestIDMiddleware)
app.add_middleware(SecurityHeadersMiddleware, hsts_enabled=settings.is_production)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

register_exception_handlers(app)

app.include_router(api_router, prefix="/api/v1")


@app.get("/health", tags=["infra"])
async def health_check() -> dict[str, str]:
    """Endpoint de verificación de arranque — no expone lógica de negocio."""
    return {"status": "ok"}
