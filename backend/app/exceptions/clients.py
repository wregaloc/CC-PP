"""Excepciones de dominio de la gestión de clientes (Fase 10 §Módulo 3)."""


class ClientNotFoundError(Exception):
    """No existe una empresa cliente con el id solicitado."""


class InvalidLogoImageError(Exception):
    """El archivo subido como logo no es una imagen PNG/JPEG/WEBP válida
    (validado por firma binaria real, no por extensión — ver [[enterprise-security]])."""
