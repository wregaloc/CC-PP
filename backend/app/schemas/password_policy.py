"""Política de contraseñas compartida (TDD §5.3) — usada por auth.py
(cambio de contraseña propia) y admin_user.py (Admin crea/asigna contraseñas).
"""

import re

PASSWORD_MIN_LENGTH = 8
# bcrypt trunca (o, según la versión, rechaza) cualquier byte más allá del 72 —
# ver requirements.txt sobre el pin de bcrypt==4.0.1. Un máximo explícito evita
# que un input absurdamente largo llegue a hash_password() sin necesidad
# (higiene de validación en el borde, ver [[enterprise-security]]).
PASSWORD_MAX_LENGTH = 128


def validate_password_policy(password: str) -> str:
    """Mínimo 8 caracteres, al menos 1 número y 1 mayúscula."""
    if len(password) < PASSWORD_MIN_LENGTH:
        raise ValueError(f"La contraseña debe tener al menos {PASSWORD_MIN_LENGTH} caracteres")
    if not re.search(r"\d", password):
        raise ValueError("La contraseña debe incluir al menos un número")
    if not re.search(r"[A-Z]", password):
        raise ValueError("La contraseña debe incluir al menos una mayúscula")
    return password
