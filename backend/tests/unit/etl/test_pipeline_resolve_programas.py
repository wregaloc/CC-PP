from unittest.mock import AsyncMock

import pytest

from app.etl.exceptions import UnknownProgramaError
from app.etl.models import ProgramaRef
from app.etl.pipeline import _resolve_programas


@pytest.mark.asyncio
async def test_resolve_programas_caches_repeated_names(monkeypatch: pytest.MonkeyPatch) -> None:
    """Un mismo nombre de programa repetido en 3 filas debe resolverse con
    una sola llamada al repositorio, no tres — ver docstring de _resolve_programas.
    """
    get_or_create = AsyncMock(return_value=42)
    monkeypatch.setattr("app.etl.pipeline.repository.get_or_create_programa", get_or_create)

    ref = ProgramaRef(
        nombre="Hablando Huevadas", canal="Latina", categoria=None, tipo=None, authoritative=True
    )
    prepared = [
        (0, {"vistas_diarias": 100}, ref),
        (1, {"vistas_diarias": 200}, ref),
        (2, {"vistas_diarias": 300}, ref),
    ]
    rejected: list = []

    final_rows = await _resolve_programas(session=None, prepared=prepared, rejected=rejected)

    assert get_or_create.await_count == 1
    assert [r["programa_id"] for r in final_rows] == [42, 42, 42]
    assert rejected == []


@pytest.mark.asyncio
async def test_resolve_programas_rejects_all_rows_for_unknown_programa(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    get_or_create = AsyncMock(side_effect=UnknownProgramaError("no existe"))
    monkeypatch.setattr("app.etl.pipeline.repository.get_or_create_programa", get_or_create)

    ref = ProgramaRef(
        nombre="Programa Fantasma", canal=None, categoria=None, tipo=None, authoritative=False
    )
    prepared = [
        (0, {"hashtag": "a"}, ref),
        (1, {"hashtag": "b"}, ref),
    ]
    rejected: list = []

    final_rows = await _resolve_programas(session=None, prepared=prepared, rejected=rejected)

    assert final_rows == []
    assert len(rejected) == 2
    assert all("no existe" in r.reason for r in rejected)
    assert get_or_create.await_count == 1  # tambien se cachea el fallo, no se reintenta


@pytest.mark.asyncio
async def test_resolve_programas_handles_mixed_known_and_unknown(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async def fake_get_or_create(session, *, nombre, **kwargs):
        if nombre == "Conocido":
            return 1
        raise UnknownProgramaError(f"'{nombre}' no existe")

    monkeypatch.setattr("app.etl.pipeline.repository.get_or_create_programa", fake_get_or_create)

    ref_ok = ProgramaRef(
        nombre="Conocido", canal="C", categoria=None, tipo=None, authoritative=True
    )
    ref_bad = ProgramaRef(
        nombre="Desconocido", canal=None, categoria=None, tipo=None, authoritative=False
    )
    prepared = [
        (0, {"x": 1}, ref_ok),
        (1, {"x": 2}, ref_bad),
    ]
    rejected: list = []

    final_rows = await _resolve_programas(session=None, prepared=prepared, rejected=rejected)

    assert len(final_rows) == 1
    assert final_rows[0]["programa_id"] == 1
    assert len(rejected) == 1
    assert rejected[0].row_index == 1
