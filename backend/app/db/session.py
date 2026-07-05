from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.core.config import get_settings

settings = get_settings()

# asyncpg no entiende el parámetro "sslmode" de libpq en la URL de conexión —
# se pasa explícitamente vía connect_args cuando el proveedor lo exige (Supabase, etc.).
_connect_args = {"ssl": "require"} if settings.database_ssl_required else {}

engine: AsyncEngine = create_async_engine(
    settings.database_url,
    echo=settings.debug,
    connect_args=_connect_args,
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
)
