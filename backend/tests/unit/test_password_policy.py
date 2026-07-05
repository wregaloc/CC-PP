import pytest
from pydantic import ValidationError

from app.schemas.auth import ChangePasswordRequest


def test_accepts_a_password_meeting_the_policy() -> None:
    request = ChangePasswordRequest(current_password="old", new_password="Valida123")

    assert request.new_password == "Valida123"


@pytest.mark.parametrize(
    "new_password",
    [
        "corta1A",  # menos de 8 caracteres
        "sinnumeromayus",  # sin dígito ni mayúscula
        "MinusculasSolo",  # sin dígito
        "minusculas123",  # sin mayúscula
    ],
)
def test_rejects_passwords_that_violate_the_policy(new_password: str) -> None:
    with pytest.raises(ValidationError):
        ChangePasswordRequest(current_password="old", new_password=new_password)
