"""Excepciones de dominio de los endpoints de dashboard (solo lectura)."""


class InvalidDateRangeError(Exception):
    """fecha_inicio es posterior a fecha_fin — el resto de validaciones de forma
    (enums de granularidad/sentimiento, etc.) ya las cubre Pydantic/FastAPI."""
