from pathlib import Path

import pandas as pd
import pytest

from app.etl.column_specs import ColumnSpec, FileTypeSpec
from app.etl.exceptions import FileStructureError
from app.etl.readers import MAX_FILE_SIZE_BYTES, read_rows
from app.models.enums import UploadFileType

_CSV_SPEC = FileTypeSpec(
    file_type=UploadFileType.DATA,
    is_csv=True,
    delimiter=";",
    columns=(
        ColumnSpec("Fecha", "date"),
        ColumnSpec("Programa", "str"),
        ColumnSpec("Vistas_Diarias", "int"),
    ),
)

_EXCEL_SPEC = FileTypeSpec(
    file_type=UploadFileType.AUSPICIOS,
    is_csv=False,
    sheet_name="AUSPICIOS",
    columns=(
        ColumnSpec("Programa", "str"),
        ColumnSpec("Auspiciadores", "str"),
    ),
)


def test_read_rows_csv_happy_path(tmp_path: Path) -> None:
    csv_path = tmp_path / "data.csv"
    csv_path.write_text(
        "Fecha;Programa;Vistas_Diarias\n05/07/2026;Hablando Huevadas;1000\n",
        encoding="utf-8",
    )

    rows = read_rows(_CSV_SPEC, csv_path)

    assert len(rows) == 1
    assert rows[0]["Programa"] == "Hablando Huevadas"


def test_read_rows_csv_missing_required_column_raises(tmp_path: Path) -> None:
    csv_path = tmp_path / "data.csv"
    csv_path.write_text("Fecha;Programa\n05/07/2026;X\n", encoding="utf-8")

    with pytest.raises(FileStructureError, match="Vistas_Diarias"):
        read_rows(_CSV_SPEC, csv_path)


def test_read_rows_csv_bad_encoding_raises(tmp_path: Path) -> None:
    csv_path = tmp_path / "data.csv"
    # Escribe en latin-1 con un caracter que no es valido UTF-8 (ñ en 0xF1)
    csv_path.write_bytes("Fecha;Programa;Vistas_Diarias\n05/07/2026;Ni\xf1o;1\n".encode("latin-1"))

    with pytest.raises(FileStructureError, match="UTF-8"):
        read_rows(_CSV_SPEC, csv_path)


def test_read_rows_file_too_large_raises(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    csv_path = tmp_path / "data.csv"
    csv_path.write_text(
        "Fecha;Programa;Vistas_Diarias\n05/07/2026;Hablando Huevadas;1000\n",
        encoding="utf-8",
    )
    monkeypatch.setattr("app.etl.readers.MAX_FILE_SIZE_BYTES", 10)
    assert MAX_FILE_SIZE_BYTES != 10  # el monkeypatch no afecta la constante importada arriba

    with pytest.raises(FileStructureError, match="tamaño"):
        read_rows(_CSV_SPEC, csv_path)


def test_read_rows_excel_happy_path(tmp_path: Path) -> None:
    excel_path = tmp_path / "auspicios.xlsx"
    df = pd.DataFrame({"Programa": ["Hablando Huevadas"], "Auspiciadores": ["Adidas"]})
    with pd.ExcelWriter(excel_path) as writer:
        df.to_excel(writer, sheet_name="AUSPICIOS", index=False)

    rows = read_rows(_EXCEL_SPEC, excel_path)

    assert rows == [{"Programa": "Hablando Huevadas", "Auspiciadores": "Adidas"}]
