from collections.abc import AsyncGenerator, Callable

from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import AsyncSessionLocal


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Dependencia inyectable que provee una sesión de base de datos por request."""
    async with AsyncSessionLocal() as session:
        yield session


def get_session_factory() -> Callable[[], AsyncSession]:
    """Para endpoints que no deben mantener una sesión abierta durante toda la
    request (p. ej. el asistente de IA, que espera varios segundos de red a
    Gemini entre consultas) — reciben la *factory* y abren/cierran una sesión
    corta solo para el instante puntual de cada consulta, en vez de retener
    una conexión del pool todo el tiempo que dura la request. El tipo es
    "función sin argumentos que devuelve una sesión" (no específicamente
    `async_sessionmaker`) para que los tests puedan overridear con un
    callable propio apuntando a la conexión aislada del test — ver
    tests/conftest.py::db_session. Es su propia dependencia (no una envuelta
    sobre `get_db`) por la misma razón."""
    return AsyncSessionLocal
