from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import api_router
from app.core.config import get_settings
from app.core.logging import setup_logging
from app.core.middleware import RequestIDMiddleware
from app.exceptions.handlers import register_exception_handlers

settings = get_settings()
setup_logging(settings.log_level)

app = FastAPI(
    title="PodPulse API",
    version="0.1.0",
    debug=settings.debug,
)

app.add_middleware(RequestIDMiddleware)

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
