"""Extract: lee archivos CSV/Excel a una lista de filas (dict), sin validar
tipos ni transformar todavía — ver [[data-engineering-postgresql]] (patrón
Extract → Validate → Transform → Load). Solo valida lo estructural (tamaño,
encoding, columnas requeridas presentes): eso es "Bloqueante", rechaza el
archivo completo antes de procesar una sola fila.
"""

from pathlib import Path
from typing import Any

import pandas as pd

from app.etl.column_specs import FileTypeSpec
from app.etl.exceptions import FileStructureError

MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024  # 10 MB — ver TDD §6.3

# .xlsx es un paquete ZIP (OOXML); todo ZIP empieza con esta firma. Verificarla
# antes de invocar openpyxl detecta un archivo con extensión falsa (p. ej. un
# .csv o binario renombrado a .xlsx) sin depender de python-magic/libmagic,
# que no tiene wheel binario confiable en Windows sin instalar nada aparte
# (ver [[enterprise-security]] — validar el tipo real de contenido subido).
_XLSX_MAGIC_BYTES = b"PK\x03\x04"


def read_rows(spec: FileTypeSpec, file_path: Path) -> list[dict[str, Any]]:
    """Lee el archivo según el spec del tipo y devuelve sus filas como lista
    de dicts (valores todavía sin tipar — eso lo hace validators.validate_row).
    """
    _validate_file_size(file_path)

    df = _read_csv(spec, file_path) if spec.is_csv else _read_excel(spec, file_path)
    df.columns = [str(c).strip() for c in df.columns]
    _validate_required_columns(spec, df)

    return df.to_dict(orient="records")


def _validate_file_size(file_path: Path) -> None:
    size = file_path.stat().st_size
    if size > MAX_FILE_SIZE_BYTES:
        raise FileStructureError(
            f"El archivo supera el tamaño máximo permitido "
            f"({size} bytes > {MAX_FILE_SIZE_BYTES} bytes)."
        )


def _read_csv(spec: FileTypeSpec, file_path: Path) -> pd.DataFrame:
    try:
        return pd.read_csv(file_path, sep=spec.delimiter, encoding=spec.encoding, dtype=str)
    except UnicodeDecodeError as exc:
        raise FileStructureError(
            f"El archivo no está en codificación {spec.encoding}. "
            "Vuelve a exportarlo en UTF-8."
        ) from exc


def _read_excel(spec: FileTypeSpec, file_path: Path) -> pd.DataFrame:
    _validate_xlsx_magic_bytes(file_path)
    try:
        return pd.read_excel(file_path, sheet_name=spec.sheet_name, dtype=str)
    except ValueError as exc:
        raise FileStructureError(
            f"No se pudo leer la hoja '{spec.sheet_name}' del archivo Excel: {exc}"
        ) from exc


def _validate_xlsx_magic_bytes(file_path: Path) -> None:
    with file_path.open("rb") as f:
        header = f.read(4)
    if header != _XLSX_MAGIC_BYTES:
        raise FileStructureError(
            "El archivo no tiene el formato real de un .xlsx (la extensión no "
            "coincide con el contenido). Vuelve a exportarlo desde Excel."
        )


def _validate_required_columns(spec: FileTypeSpec, df: pd.DataFrame) -> None:
    required = {c.name for c in spec.columns if c.required}
    missing = required - set(df.columns)
    if missing:
        raise FileStructureError(
            f"Faltan columnas requeridas: {sorted(missing)}. "
            f"Columnas encontradas: {sorted(df.columns)}."
        )
