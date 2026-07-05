import pytest

from app.etl.month_names import month_name_to_number


@pytest.mark.parametrize(
    ("name", "expected"),
    [
        ("Enero", 1),
        ("febrero", 2),
        ("MARZO", 3),
        ("  Abril  ", 4),
        ("septiembre", 9),
        ("setiembre", 9),  # variante regional aceptada
        ("Diciembre", 12),
    ],
)
def test_month_name_to_number_known_months(name: str, expected: int) -> None:
    assert month_name_to_number(name) == expected


def test_month_name_to_number_unknown_returns_none() -> None:
    assert month_name_to_number("Not A Month") is None
