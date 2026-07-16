"""Excepciones de dominio de los endpoints de dashboard (solo lectura)."""


class InvalidDateRangeError(Exception):
    """fecha_inicio es posterior a fecha_fin — el resto de validaciones de forma
    (enums de granularidad/sentimiento, etc.) ya las cubre Pydantic/FastAPI."""


class HorarioAudienciaFiltroInvalidoError(Exception):
    """/dashboard/horario-audiencia exige exactamente uno de `programa`/`canal`
    — sin ninguno no hay vista agregada de "Todos"; con ambos, la intención
    del usuario (un programa puntual vs. todos los del canal) es ambigua."""
