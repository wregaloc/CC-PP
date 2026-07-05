import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit_log import AuditLog


async def record(
    session: AsyncSession,
    action: str,
    user_id: uuid.UUID | None = None,
    ip_address: str | None = None,
    user_agent: str | None = None,
    extra: dict | None = None,
) -> None:
    """Inserta un evento de auditoría. Ver docs/PODPULSE_TDD_v1.0.docx §10.2 para
    el catálogo de `action` (LOGIN_SUCCESS, LOGIN_FAIL, LOGIN_BLOCKED, LOGOUT, ...).

    No hace commit — el service que orquesta la operación decide cuándo
    confirmar la transacción (Unit of Work), normalmente junto con la
    escritura de negocio que este evento audita."""
    session.add(
        AuditLog(
            user_id=user_id,
            action=action,
            ip_address=ip_address,
            user_agent=user_agent,
            extra=extra,
        )
    )


async def count_recent_login_failures(
    session: AsyncSession, ip_address: str, window_minutes: int
) -> int:
    """Cuenta LOGIN_FAIL de una IP en la ventana reciente — base del rate-limit de
    login sin Redis (ver [[enterprise-security]] y core/config.py: login_max_attempts)."""
    since = datetime.now(UTC) - timedelta(minutes=window_minutes)
    result = await session.execute(
        select(func.count())
        .select_from(AuditLog)
        .where(
            AuditLog.action == "LOGIN_FAIL",
            AuditLog.ip_address == ip_address,
            AuditLog.created_at >= since,
        )
    )
    return result.scalar_one()
