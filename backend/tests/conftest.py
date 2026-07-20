import os
from collections.abc import AsyncGenerator, Awaitable, Callable
from pathlib import Path

import httpx
import pytest
from dotenv import load_dotenv
from sqlalchemy.ext.asyncio import AsyncSession

# Carga primero el .env real si existe (p. ej. la conexión de Supabase para
# integration tests) — python-dotenv nunca sobreescribe una variable que ya
# esté en os.environ, así que esto es seguro de repetir.
load_dotenv(Path(__file__).resolve().parent.parent / ".env")

# Valores por defecto exclusivos para la suite de tests (no son credenciales reales,
# no se usan en desarrollo/producción) — permiten correr `pytest` en un clon nuevo
# del repositorio sin exigir un backend/.env ya configurado. os.environ.setdefault
# solo aplica si la línea de arriba no encontró un .env real con esa variable.
os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://postgres:postgres@localhost:5432/postgres")
os.environ.setdefault("JWT_SECRET_KEY", "test-only-secret-not-for-production")

from app.core.security import hash_password  # noqa: E402
from app.db.session import engine  # noqa: E402
from app.dependencies.db import get_db, get_session_factory  # noqa: E402
from app.main import app  # noqa: E402
from app.models.enums import UserRole  # noqa: E402
from app.models.user import User  # noqa: E402


@pytest.fixture
async def client() -> AsyncGenerator[httpx.AsyncClient, None]:
    """Cliente HTTP asíncrono contra la app real, sin levantar un servidor de verdad."""
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as ac:
        yield ac


@pytest.fixture
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    """Una transacción real por test (con SAVEPOINT) — ver [[fastapi-enterprise-backend]].

    Los servicios de auth llaman session.commit() en el camino normal (login,
    logout, etc.); bindear la sesión a una única conexión con
    join_transaction_mode="create_savepoint" hace que esos commit() sólo cierren
    un SAVEPOINT interno, mientras la transacción exterior de la conexión sigue
    abierta y se revierte al final del test — así ningún test deja datos en la
    base de datos de desarrollo/test.
    """
    async with engine.connect() as connection:
        outer_transaction = await connection.begin()
        session = AsyncSession(
            bind=connection, join_transaction_mode="create_savepoint", expire_on_commit=False
        )

        def _isolated_session_factory() -> AsyncSession:
            # Nueva sesión por llamada (mismo patrón que get_session_factory en
            # producción, ver app/dependencies/db.py), pero bindeada a la misma
            # `connection`/SAVEPOINT del test — así los datos sembrados en este
            # test siguen siendo visibles para endpoints que abren/cierran
            # sesiones cortas en vez de retener una del pool (p. ej. el
            # asistente de IA).
            return AsyncSession(
                bind=connection, join_transaction_mode="create_savepoint", expire_on_commit=False
            )

        app.dependency_overrides[get_db] = lambda: session
        app.dependency_overrides[get_session_factory] = lambda: _isolated_session_factory
        try:
            yield session
        finally:
            app.dependency_overrides.pop(get_db, None)
            app.dependency_overrides.pop(get_session_factory, None)
            await outer_transaction.rollback()


@pytest.fixture
def make_user(
    db_session: AsyncSession,
) -> Callable[..., Awaitable[User]]:
    """Factory para crear usuarios de prueba dentro de la transacción del test."""

    async def _make_user(
        email: str,
        password: str = "Valida123",
        role: UserRole = UserRole.CLIENTE,
        is_active: bool = True,
        full_name: str = "Test User",
    ) -> User:
        user = User(
            email=email,
            password_hash=hash_password(password),
            full_name=full_name,
            role=role,
            is_active=is_active,
        )
        db_session.add(user)
        await db_session.flush()
        return user

    return _make_user
