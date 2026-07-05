"""Importa todos los modelos para que Base.metadata los conozca (autogenerate de Alembic)."""

from app.models.audit_log import AuditLog
from app.models.dim_auspicios import Auspicio
from app.models.dim_programa import Programa
from app.models.fact_audiencia import FactAudiencia
from app.models.fact_keywords import FactKeywords
from app.models.fact_sentimiento import FactSentimiento
from app.models.revoked_token import RevokedToken
from app.models.upload_log import UploadLog
from app.models.user import User

__all__ = [
    "AuditLog",
    "Auspicio",
    "Programa",
    "FactAudiencia",
    "FactKeywords",
    "FactSentimiento",
    "RevokedToken",
    "UploadLog",
    "User",
]
