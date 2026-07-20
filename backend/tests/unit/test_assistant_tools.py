from datetime import date

import pytest

from app.services.assistant_tools import (
    ToolArgumentError,
    _date_range,
    _parse_date,
    _parse_tipo,
    execute_tool,
)


def test_parse_date_accepts_iso_format() -> None:
    assert _parse_date("2026-01-15", "fecha_inicio") == date(2026, 1, 15)


def test_parse_date_returns_none_for_empty_values() -> None:
    assert _parse_date(None, "fecha_inicio") is None
    assert _parse_date("", "fecha_inicio") is None


def test_parse_date_rejects_malformed_string() -> None:
    with pytest.raises(ToolArgumentError):
        _parse_date("15/01/2026", "fecha_inicio")


def test_parse_date_rejects_non_string() -> None:
    with pytest.raises(ToolArgumentError):
        _parse_date(20260115, "fecha_inicio")


def test_parse_tipo_accepts_valid_enum_values() -> None:
    from app.models.enums import ProgramType

    assert _parse_tipo("podcast") == ProgramType.PODCAST
    assert _parse_tipo("programa") == ProgramType.PROGRAMA


def test_parse_tipo_returns_none_for_empty() -> None:
    assert _parse_tipo(None) is None
    assert _parse_tipo("") is None


def test_parse_tipo_rejects_invalid_value() -> None:
    with pytest.raises(ToolArgumentError):
        _parse_tipo("otro")


def test_date_range_rejects_inicio_posterior_a_fin() -> None:
    with pytest.raises(ToolArgumentError):
        _date_range({"fecha_inicio": "2026-06-01", "fecha_fin": "2026-01-01"})


async def test_execute_tool_returns_error_for_unknown_tool() -> None:
    # execute_tool no necesita sesión real para una tool inexistente — el
    # lookup falla antes de tocar la base.
    result = await execute_tool(session=None, name="borrar_todo", args={})  # type: ignore[arg-type]

    assert "error" in result
    assert "borrar_todo" in result["error"]


async def test_execute_tool_surfaces_argument_errors_without_raising() -> None:
    """Un ToolArgumentError se traduce a {"error": ...} — el modelo puede leerlo
    y corregir el argumento, no debe tumbar la conversación."""
    result = await execute_tool(
        session=None,  # type: ignore[arg-type]
        name="obtener_kpis",
        args={"tipo": "no-es-un-tipo-valido"},
    )

    assert "error" in result
