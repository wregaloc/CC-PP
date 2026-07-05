"""Excepciones de dominio de la administración de usuarios (TDD §8.9, §5.3)."""


class EmailAlreadyExistsError(Exception):
    """El email ya está registrado por otro usuario (UNIQUE constraint de negocio)."""


class UserNotFoundError(Exception):
    """No existe un usuario con el id solicitado."""


class CannotChangeOwnRoleError(Exception):
    """TDD §5.3: "El Admin no puede cambiar el rol de su propia cuenta" — evita
    que un Admin se auto-degrade y pierda acceso administrativo por error."""
