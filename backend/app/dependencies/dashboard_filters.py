from dataclasses import dataclass
from datetime import date

from fastapi import Query

from app.exceptions.dashboard import InvalidDateRangeError


@dataclass(frozen=True)
class DateRangeParams:
    fecha_inicio: date | None
    fecha_fin: date | None


def date_range_params(
    fecha_inicio: date | None = Query(default=None, description="Fecha inicio (incluida)"),
    fecha_fin: date | None = Query(default=None, description="Fecha fin (incluida)"),
) -> DateRangeParams:
    """Dependencia reutilizable de rango de fechas — ver TDD §8.3-8.6, común a
    casi todos los endpoints de dashboard (?fecha_inicio&fecha_fin)."""
    if fecha_inicio is not None and fecha_fin is not None and fecha_inicio > fecha_fin:
        raise InvalidDateRangeError
    return DateRangeParams(fecha_inicio=fecha_inicio, fecha_fin=fecha_fin)
