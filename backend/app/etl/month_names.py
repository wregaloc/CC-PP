"""Traducción de nombres de mes en español a número de mes (1-12).

Se evita depender del locale del sistema operativo (p. ej. datetime.strptime
con locale español) porque no es portable ni confiable entre entornos —
ver [[data-engineering-postgresql]] ("no asumas que el archivo es limpio").
"""

_SPANISH_MONTHS = {
    "enero": 1,
    "febrero": 2,
    "marzo": 3,
    "abril": 4,
    "mayo": 5,
    "junio": 6,
    "julio": 7,
    "agosto": 8,
    "septiembre": 9,
    "setiembre": 9,
    "octubre": 10,
    "noviembre": 11,
    "diciembre": 12,
}


def month_name_to_number(name: str) -> int | None:
    """Convierte un nombre de mes en español a su número (1-12).

    Devuelve None si el texto no coincide con ningún mes conocido — quien
    llama decide si eso es un error bloqueante para esa fila.
    """
    normalized = name.strip().lower()
    return _SPANISH_MONTHS.get(normalized)
