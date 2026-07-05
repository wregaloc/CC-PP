"""Excepciones de dominio del módulo ETL.

No dependen de FastAPI ni HTTP — se traducen a respuestas HTTP en
app/exceptions/handlers.py (endpoints de carga en app/api/v1/endpoints/uploads.py).
"""


class ETLError(Exception):
    """Excepción base del módulo ETL."""


class FileStructureError(ETLError):
    """El archivo no tiene la estructura esperada: columnas faltantes, encoding
    inválido, o tamaño excedido. Bloqueante — rechaza el archivo completo
    (ver TDD §6.3, columna "Bloqueante").
    """


class RowValidationError(ETLError):
    """Una fila individual no es válida (tipo incorrecto, valor fuera de rango,
    etc.). Solo esa fila se omite — el resto del archivo se sigue procesando
    (ver TDD §6.3, columna "Por fila").
    """


class UnknownProgramaError(ETLError):
    """Una fila referencia un programa que no existe todavía y la fuente actual
    no trae suficiente información (canal) para crearlo. La fila se rechaza —
    nunca se inventa un canal placeholder para no corromper la dimensión.
    """
