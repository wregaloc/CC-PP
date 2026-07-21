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

# pool_pre_ping evita servir una conexión muerta: Supabase (pgbouncer) y
# Cloud Run pueden cerrar conexiones ociosas sin avisar al cliente — sin esto,
# la primera query tras un período inactivo fallaría con una excepción de
# conexión en vez de reabrir la conexión de forma transparente. pool_size
# bajo (no el default de 5+10) porque cada instancia de Cloud Run mantiene su
# propio pool y puede haber varias instancias corriendo a la vez contra el
# límite de conexiones del pooler de Supabase (ver [[data-engineering-postgresql]]).
engine: AsyncEngine = create_async_engine(
    settings.database_url,
    echo=settings.debug,
    connect_args=_connect_args,
    pool_pre_ping=True,
    pool_recycle=1800,
    pool_size=5,
    max_overflow=5,
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
)
