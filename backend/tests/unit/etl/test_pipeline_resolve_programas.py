from unittest.mock import AsyncMock

import pytest

from app.etl.models import ProgramaRef
from app.etl.pipeline import _resolve_programas


@pytest.mark.asyncio
async def test_resolve_programas_deduplicates_names_before_bulk_call(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Un mismo nombre repetido en 3 filas viaja UNA sola vez a la resolución
    en bloque — ver docstring de _resolve_programas."""
    bulk_resolve = AsyncMock(return_value={"Hablando Huevadas": 42})
    monkeypatch.setattr("app.etl.pipeline.repository.bulk_resolve_programas", bulk_resolve)

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

    bulk_resolve.assert_awaited_once()
    refs_enviados = bulk_resolve.await_args.args[1]
    assert refs_enviados == [ref]
    assert [r["programa_id"] for r in final_rows] == [42, 42, 42]
    assert rejected == []


@pytest.mark.asyncio
async def test_resolve_programas_rejects_all_rows_for_unresolved_programa(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Un nombre que la resolución en bloque no devuelve (no existe y el
    archivo no trae canal) rechaza TODAS sus filas con motivo explícito."""
    bulk_resolve = AsyncMock(return_value={})
    monkeypatch.setattr("app.etl.pipeline.repository.bulk_resolve_programas", bulk_resolve)

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
    assert all("Programa Fantasma" in r.reason for r in rejected)
    assert all("no existe todavía" in r.reason for r in rejected)


@pytest.mark.asyncio
async def test_resolve_programas_handles_mixed_known_and_unknown(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    bulk_resolve = AsyncMock(return_value={"Conocido": 1})
    monkeypatch.setattr("app.etl.pipeline.repository.bulk_resolve_programas", bulk_resolve)

    ref_ok = ProgramaRef(nombre="Conocido", canal="C", categoria=None, tipo=None, authoritative=True)
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
