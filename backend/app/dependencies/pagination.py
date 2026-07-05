from dataclasses import dataclass

from fastapi import Query

MAX_PAGE_SIZE = 200


@dataclass(frozen=True)
class PaginationParams:
    page: int
    page_size: int

    @property
    def offset(self) -> int:
        return (self.page - 1) * self.page_size


def pagination_params(
    page: int = Query(default=1, ge=1, description="Página, empieza en 1"),
    page_size: int = Query(default=50, ge=1, le=MAX_PAGE_SIZE, description="Filas por página"),
) -> PaginationParams:
    """Dependencia reutilizable de paginación (?page&page_size) — ver TDD §8.1."""
    return PaginationParams(page=page, page_size=page_size)
