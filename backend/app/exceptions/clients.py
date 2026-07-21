"""Excepciones de dominio de la gestión de clientes (Fase 10 §Módulo 3)."""


class ClientNotFoundError(Exception):
    """No existe una empresa cliente con el id solicitado."""
