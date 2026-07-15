"""Validate: coerción de tipos y detección de errores por fila.

Sigue la regla de [[data-engineering-postgresql]]: nunca "limpia" datos de
forma silenciosa — cada fila que no puede coercionarse a un tipo válido, o que
viola una regla de negocio conocida, se rechaza con un motivo explícito.
"""

import re
from datetime import date
from typing import Any

import pandas as pd

from app.etl.column_specs import ColumnSpec, FileTypeSpec
from app.etl.exceptions import RowValidationError

VALID_TIPOS = {"podcast", "programa"}
VALID_SENTIMIENTOS = {"positivo", "negativo", "neutral"}
# Formato canónico capitalizado (ver Adenda 3 de la auditoría / DATA[Formato]
# original) — mapeado desde minúsculas para aceptar cualquier capitalización
# de entrada (el CSV de origen no es consistente entre archivos: "VIVO" vs
# "Vivo" vs "vivo" para el mismo valor) y normalizar siempre al mismo casing.
VALID_FORMATOS = {"grabado": "Grabado", "vivo": "Vivo", "finalizado": "Finalizado"}


def validate_row(spec: FileTypeSpec, raw_row: dict[str, Any]) -> dict[str, Any]:
    """Valida y coerciona una fila cruda según el spec del tipo de archivo.

    Devuelve un dict con valores ya tipados en Python (no strings). Lanza
    RowValidationError con un motivo legible si algún valor no es válido.
    """
    clean: dict[str, Any] = {}
    for col in spec.columns:
        raw_value = raw_row.get(col.name)
        if _is_missing(raw_value):
            if col.required:
                raise RowValidationError(f"Falta el valor requerido de '{col.name}'")
            clean[col.name] = None
            continue

        clean[col.name] = _coerce(col, str(raw_value).strip())

    return clean


def _is_missing(value: Any) -> bool:
    if value is None:
        return True
    if isinstance(value, float):
        return pd.isna(value)
    if isinstance(value, str):
        return value.strip() == ""
    return False


def _coerce(col: ColumnSpec, value: str) -> Any:
    try:
        if col.dtype == "str":
            return value
        if col.dtype == "int":
            return int(float(value))  # tolera "10.0" además de "10"
        if col.dtype == "float":
            # DATA[Engagement] viene formateado como porcentaje ("1.56%") en el
            # CSV de origen — se guarda como fracción 0-1 (0.0156), consistente
            # con como el resto del sistema trata Engagement (KPIs, formatPercent
            # en el frontend). Sin este strip, float("1.56%") lanza ValueError y
            # la FILA ENTERA se rechazaba (no solo el campo), perdiendo también
            # vistas/likes/comentarios válidos de esa fila.
            if value.endswith("%"):
                return float(value[:-1]) / 100
            return float(value)
        if col.dtype == "bool":
            return _coerce_bool(value)
        if col.dtype == "date":
            return _coerce_date(value)
    except (ValueError, TypeError) as exc:
        raise RowValidationError(
            f"El valor '{value}' de '{col.name}' no es un {col.dtype} válido"
        ) from exc

    raise RowValidationError(f"Tipo de columna desconocido: {col.dtype}")


def _coerce_bool(value: str) -> bool:
    if value.lower() in {"1", "true"}:
        return True
    if value.lower() in {"0", "false"}:
        return False
    raise ValueError(f"valor booleano no reconocido: {value}")


# "YYYY-MM-DD" al inicio del string — formato en que pandas serializa las
# celdas datetime de Excel al leer con dtype=str ("2026-01-08 00:00:00").
_ISO_DATE_PREFIX = re.compile(r"^\d{4}-\d{2}-\d{2}")


def _coerce_date(value: str) -> date:
    # dayfirst=True existe para el formato del CSV histórico ("08/01/2026" =
    # 8 de enero). Pero aplicado a un string ISO lo INVIERTE en silencio:
    # pd.to_datetime("2026-01-08", dayfirst=True) devuelve 2026-08-01 (bug
    # verificado con pandas 2.x) — corrompería todas las fechas con día <= 12
    # de un Excel real. ISO es inequívoco: se parsea como ISO, sin dayfirst.
    if _ISO_DATE_PREFIX.match(value):
        parsed = pd.to_datetime(value, dayfirst=False, errors="raise")
    else:
        parsed = pd.to_datetime(value, dayfirst=True, errors="raise")
    return parsed.date()


def validate_non_negative(value: int | float | None, field_name: str) -> None:
    if value is not None and value < 0:
        raise RowValidationError(f"'{field_name}' no puede ser negativo: {value}")


def validate_tipo(value: str | None) -> str | None:
    if value is None:
        return None
    normalized = value.strip().lower()
    if normalized not in VALID_TIPOS:
        raise RowValidationError(
            f"'Tipo' inválido: '{value}' (valores permitidos: {sorted(VALID_TIPOS)})"
        )
    return normalized


def validate_formato(value: str | None) -> str | None:
    if value is None:
        return None
    normalized = value.strip().lower()
    if normalized not in VALID_FORMATOS:
        raise RowValidationError(
            f"'Formato' inválido: '{value}' (valores permitidos: {sorted(VALID_FORMATOS.values())})"
        )
    return VALID_FORMATOS[normalized]


def validate_sentimiento(value: str) -> str:
    normalized = value.strip().lower()
    if normalized not in VALID_SENTIMIENTOS:
        raise RowValidationError(
            f"Sentimiento inválido: '{value}' (valores permitidos: {sorted(VALID_SENTIMIENTOS)})"
        )
    return normalized


def validate_scores_sum_to_one(positive: float, negative: float, neutral: float) -> None:
    total = positive + negative + neutral
    if abs(total - 1) > 0.01:
        raise RowValidationError(
            f"Los scores de sentimiento no suman 1.0 (suman {total:.4f}): "
            f"positive={positive}, negative={negative}, neutral={neutral}"
        )
