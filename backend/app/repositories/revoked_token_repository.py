import uuid
from datetime import UTC, datetime

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.revoked_token import RevokedToken


async def revoke(session: AsyncSession, jti: uuid.UUID, expires_at: datetime) -> None:
    # Purga oportunista: una fila revocada deja de ser necesaria en cuanto el
    # propio token expira (decode_typed_token ya lo rechazaría por exp vencido).
    # Sin esto, revoked_tokens crece para siempre — un logout por fila, jamás
    # borrada — pese a que el modelo se diseñó justo para poder purgarse
    # (ver RevokedToken.expires_at). Se hace aquí, no en un job aparte, porque
    # no hay Redis/cron en este entorno y cada logout ya escribe en la tabla.
    #
    # No hace commit — el service decide cuándo confirmar (Unit of Work), junto
    # con el audit log de LOGOUT que acompaña a esta revocación.
    await session.execute(delete(RevokedToken).where(RevokedToken.expires_at < datetime.now(UTC)))
    session.add(RevokedToken(jti=jti, expires_at=expires_at))


async def is_revoked(session: AsyncSession, jti: uuid.UUID) -> bool:
    result = await session.execute(select(RevokedToken.jti).where(RevokedToken.jti == jti))
    return result.scalar_one_or_none() is not None
