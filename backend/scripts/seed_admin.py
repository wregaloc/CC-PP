"""Crea el primer usuario Admin de PodPulse.

TDD §5.3: "El primer usuario Admin debe crearse mediante un script de seed
(no desde la UI)". Idempotente: si el email ya existe, no hace nada.

Uso (desde backend/, con el entorno virtual activado):
    $env:SEED_ADMIN_EMAIL = "admin@podpulse.pe"
    $env:SEED_ADMIN_PASSWORD = "CambiaEsto123"
    $env:SEED_ADMIN_FULL_NAME = "Administrador PodPulse"
    python scripts/seed_admin.py
"""

import asyncio
import os
import sys
from pathlib import Path

# Permite ejecutar `python scripts/seed_admin.py` directamente: al invocarse así,
# sys.path[0] es backend/scripts (no backend/), y el paquete `app` no se encuentra.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.core.security import hash_password  # noqa: E402
from app.db.session import AsyncSessionLocal  # noqa: E402
from app.models.enums import UserRole  # noqa: E402
from app.models.user import User  # noqa: E402
from app.repositories import user_repository  # noqa: E402


async def seed_admin() -> None:
    email = os.environ.get("SEED_ADMIN_EMAIL")
    password = os.environ.get("SEED_ADMIN_PASSWORD")
    full_name = os.environ.get("SEED_ADMIN_FULL_NAME")

    if not email or not password or not full_name:
        print(
            "Faltan variables de entorno: SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD, "
            "SEED_ADMIN_FULL_NAME son obligatorias.",
            file=sys.stderr,
        )
        raise SystemExit(1)

    async with AsyncSessionLocal() as session:
        existing = await user_repository.get_by_email(session, email)
        if existing is not None:
            print(f"Ya existe un usuario con email {email} — no se crea de nuevo.")
            return

        admin = User(
            email=email,
            password_hash=hash_password(password),
            full_name=full_name,
            role=UserRole.ADMIN,
            is_active=True,
        )
        session.add(admin)
        await session.commit()
        print(f"Admin creado: {email} ({admin.id})")


if __name__ == "__main__":
    asyncio.run(seed_admin())
