import pandas as pd
import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.dim_programa import Programa
from app.models.enums import ProgramType


@pytest.fixture
def make_programa(db_session: AsyncSession):
    """Factory para crear programas de prueba dentro de la transacción del test
    (usado por los tests de dashboard, que agregan sobre fact_audiencia/etc.)."""

    async def _make(
        nombre: str,
        canal: str,
        categoria: str | None = None,
        tipo: ProgramType | None = None,
    ) -> Programa:
        programa = Programa(nombre=nombre, canal=canal, categoria=categoria, tipo=tipo)
        db_session.add(programa)
        await db_session.flush()
        return programa

    return _make


@pytest.fixture
def data_csv_factory(tmp_path):
    """Genera un CSV con el formato de DATA_SPEC (separador ';') para subir vía HTTP."""

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
