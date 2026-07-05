"""Excepciones de dominio del flujo de carga de archivos (endpoints, no ETL puro).

Las excepciones del propio módulo ETL viven en app.etl.exceptions y no dependen
de HTTP — estas sí son específicas del límite entre la API y ese módulo.
"""

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.etl.models import LoadReport


class FileTooLargeError(Exception):
    """El archivo supera el tamaño máximo permitido (TDD §6.3: 10 MB) — se
    detecta mientras se transmite, antes de invocar el pipeline ETL."""

    def __init__(self, size_bytes: int, max_bytes: int) -> None:
        self.size_bytes = size_bytes
        self.max_bytes = max_bytes


class UploadRejectedError(Exception):
    """El pipeline ETL rechazó el archivo completo (columnas/encoding/formato
    inválido) — envuelve el LoadReport para que el handler HTTP devuelva el
    resumen completo (rows_total=0, error_message) con status 422."""

    def __init__(self, report: "LoadReport") -> None:
        self.report = report


class UploadNotFoundError(Exception):
    """No existe una carga (upload_log) con el id solicitado."""
