from datetime import date

import pytest

from app.etl.column_specs import ColumnSpec, FileTypeSpec
from app.etl.exceptions import RowValidationError
from app.etl.validators import (
    validate_non_negative,
    validate_row,
    validate_scores_sum_to_one,
    validate_sentimiento,
    validate_tipo,
)
from app.models.enums import UploadFileType

_SPEC = FileTypeSpec(
    file_type=UploadFileType.DATA,
    is_csv=True,
    delimiter=";",
    columns=(
        ColumnSpec("Fecha", "date"),
        ColumnSpec("Programa", "str"),
        ColumnSpec("Vistas_Diarias", "int"),
        ColumnSpec("Es_Emision", "bool"),
        ColumnSpec("Engagement", "float", required=False),
        ColumnSpec("Categoria", "str", required=False),
    ),
)


def test_validate_row_happy_path_coerces_types() -> None:
    raw = {
        "Fecha": "05/07/2026",
        "Programa": "Hablando Huevadas",
        "Vistas_Diarias": "1234",
        "Es_Emision": "1",
        "Engagement": "6.25",
        "Categoria": "Conversacional",
    }

    clean = validate_row(_SPEC, raw)

    assert clean["Fecha"] == date(2026, 7, 5)
    assert clean["Programa"] == "Hablando Huevadas"
    assert clean["Vistas_Diarias"] == 1234
    assert clean["Es_Emision"] is True
    assert clean["Engagement"] == pytest.approx(6.25)
    assert clean["Categoria"] == "Conversacional"


def test_validate_row_missing_required_raises() -> None:
    raw = {"Fecha": "05/07/2026", "Vistas_Diarias": "10", "Es_Emision": "1"}

    with pytest.raises(RowValidationError, match="Programa"):
        validate_row(_SPEC, raw)


def test_validate_row_missing_optional_becomes_none() -> None:
    raw = {
        "Fecha": "05/07/2026",
        "Programa": "X",
        "Vistas_Diarias": "10",
        "Es_Emision": "0",
    }

    clean = validate_row(_SPEC, raw)

    assert clean["Engagement"] is None
    assert clean["Categoria"] is None
    assert clean["Es_Emision"] is False


def test_validate_row_invalid_int_raises() -> None:
    raw = {
        "Fecha": "05/07/2026",
        "Programa": "X",
        "Vistas_Diarias": "no-es-numero",
        "Es_Emision": "1",
    }

    with pytest.raises(RowValidationError, match="Vistas_Diarias"):
        validate_row(_SPEC, raw)


def test_validate_row_invalid_date_raises() -> None:
    raw = {
        "Fecha": "no-es-fecha",
        "Programa": "X",
        "Vistas_Diarias": "10",
        "Es_Emision": "1",
    }

    with pytest.raises(RowValidationError, match="Fecha"):
        validate_row(_SPEC, raw)


def test_validate_non_negative_accepts_positive_and_none() -> None:
    validate_non_negative(10, "campo")
    validate_non_negative(0, "campo")
    validate_non_negative(None, "campo")


def test_validate_non_negative_rejects_negative() -> None:
    with pytest.raises(RowValidationError, match="campo"):
        validate_non_negative(-1, "campo")


def test_validate_tipo_accepts_known_values_case_insensitive() -> None:
    assert validate_tipo("Podcast") == "podcast"
    assert validate_tipo("PROGRAMA") == "programa"
    assert validate_tipo(None) is None


def test_validate_tipo_rejects_unknown_value() -> None:
    with pytest.raises(RowValidationError, match="Tipo"):
        validate_tipo("serie")


def test_validate_sentimiento_accepts_known_values_case_insensitive() -> None:
    assert validate_sentimiento("Positivo") == "positivo"
    assert validate_sentimiento("NEGATIVO") == "negativo"


def test_validate_sentimiento_rejects_unknown_value() -> None:
    with pytest.raises(RowValidationError, match="Sentimiento"):
        validate_sentimiento("mixto")


def test_validate_scores_sum_to_one_accepts_exact_and_within_tolerance() -> None:
    validate_scores_sum_to_one(0.3, 0.3, 0.4)
    validate_scores_sum_to_one(0.30, 0.30, 0.395)  # suma 0.995, dentro de tolerancia 0.01


def test_validate_scores_sum_to_one_rejects_outside_tolerance() -> None:
    with pytest.raises(RowValidationError, match="no suman 1.0"):
        validate_scores_sum_to_one(0.5, 0.5, 0.5)
