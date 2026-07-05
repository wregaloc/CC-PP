"""Tipos ENUM nativos de PostgreSQL usados por el modelo relacional.

Ver docs/PODPULSE_TDD_v1.0.docx §7.2 y las respuestas confirmadas sobre el
modelo original de Power BI (Doc-Migración) para el origen de cada valor.
"""

import enum


class UserRole(enum.StrEnum):
    ADMIN = "admin"
    INTERNO = "interno"
    CLIENTE = "cliente"


class ProgramType(enum.StrEnum):
    """Valores confirmados de DATA.Tipo en el modelo Power BI original: solo estos dos."""

    PODCAST = "podcast"
    PROGRAMA = "programa"


class SentimentType(enum.StrEnum):
    POSITIVO = "positivo"
    NEGATIVO = "negativo"
    NEUTRAL = "neutral"


class UploadFileType(enum.StrEnum):
    """SUPPORT se excluye deliberadamente: confirmado que no se usa (ver decisión registrada)."""

    DATA = "DATA"
    KEYWORDS = "KEYWORDS"
    SPLIT_SENSE = "SPLIT_SENSE"
    AUSPICIOS = "AUSPICIOS"


class UploadStatus(enum.StrEnum):
    PENDING = "pending"
    PROCESSING = "processing"
    SUCCESS = "success"
    ERROR = "error"
