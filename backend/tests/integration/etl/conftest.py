import uuid

import pandas as pd
import pytest
import pytest_asyncio
from sqlalchemy import delete, text

from app.db.session import AsyncSessionLocal
from app.models.audit_log import AuditLog
from app.models.dim_auspicios import Auspicio
from app.models.dim_programa import Programa
from app.models.enums import UserRole
from app.models.fact_audiencia import FactAudiencia
from app.models.fact_keywords import FactKeywords
from app.models.fact_sentimiento import FactSentimiento
from app.models.upload_log import UploadLog
from app.models.user import User

TEST_PROGRAMA_PREFIX = "TEST_ETL_"


@pytest_asyncio.fixture
async def db_session():
    async with AsyncSessionLocal() as session:
        yield session
        await session.rollback()


@pytest_asyncio.fixture
async def test_admin_user():
    """Crea un usuario Admin real para usar como `uploaded_by_id`, y limpia
    todo el rastro de datos de prueba (por prefijo TEST_ETL_) al finalizar.
    """
    async with AsyncSessionLocal() as session:
        user = User(
            email=f"etl-test-{uuid.uuid4()}@example.com",
            password_hash="x",
            full_name="ETL Test Admin",
            role=UserRole.ADMIN,
        )
        session.add(user)
        await session.commit()
        await session.refresh(user)
        user_id = user.id

    yield user_id

    async with AsyncSessionLocal() as session:
        programa_ids = (
            await session.execute(
                text(
                    "select id from dim_programa where nombre like :prefix"
                ).bindparams(prefix=f"{TEST_PROGRAMA_PREFIX}%")
            )
        ).scalars().all()

        if programa_ids:
            await session.execute(
                delete(FactAudiencia).where(FactAudiencia.programa_id.in_(programa_ids))
            )
            await session.execute(
                delete(FactKeywords).where(FactKeywords.programa_id.in_(programa_ids))
            )
            await session.execute(
                delete(FactSentimiento).where(FactSentimiento.programa_id.in_(programa_ids))
            )
            await session.execute(delete(Auspicio).where(Auspicio.programa_id.in_(programa_ids)))
            await session.execute(delete(Programa).where(Programa.id.in_(programa_ids)))

        await session.execute(delete(UploadLog).where(UploadLog.uploaded_by_id == user_id))
        await session.execute(delete(AuditLog).where(AuditLog.user_id == user_id))
        await session.execute(delete(User).where(User.id == user_id))
        await session.commit()


@pytest.fixture
def data_csv_factory(tmp_path):
    def _make(rows: list[dict], filename: str = "data.csv"):
        path = tmp_path / filename
        df = pd.DataFrame(rows)
        df.to_csv(path, sep=";", index=False, encoding="utf-8")
        return path

    return _make


@pytest.fixture
def excel_factory(tmp_path):
    def _make(rows: list[dict], filename: str, sheet_name: str | int = 0):
        path = tmp_path / filename
        df = pd.DataFrame(rows)
        with pd.ExcelWriter(path) as writer:
            df.to_excel(writer, sheet_name=str(sheet_name), index=False)
        return path

    return _make
