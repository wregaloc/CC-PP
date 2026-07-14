from fastapi import APIRouter

from app.api.v1.endpoints import (
    admin_clients,
    admin_system,
    admin_users,
    auth,
    dashboard,
    filters,
    uploads,
)

# Agregador de routers de la versión v1 de la API.
api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(uploads.router)
api_router.include_router(admin_users.router)
api_router.include_router(admin_clients.router)
api_router.include_router(admin_system.router)
api_router.include_router(dashboard.router)
api_router.include_router(filters.router)
