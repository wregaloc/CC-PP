from collections.abc import Awaitable, Callable

import httpx
import pytest

from app.models.enums import UserRole
from app.models.user import User

pytestmark = pytest.mark.usefixtures("db_session")

UPLOAD_DATA_URL = "/api/v1/uploads/data"
UPLOAD_AUSPICIOS_URL = "/api/v1/uploads/auspicios"
HISTORY_URL = "/api/v1/uploads/history"

DATA_ROW = {
    "Fecha": "01/07/2026",
    "Programa": "TEST_ADMIN_Programa Upload",
    "Canal": "Latina",
    "Es_Emision": 1,
    "Vistas_Diarias": 500,
    "Busquedas_Diarias": 20,
}


async def _login(client: httpx.AsyncClient, email: str, password: str) -> str:
    response = await client.post(
        "/api/v1/auth/login", json={"email": email, "password": password}
    )
    assert response.status_code == 200
    return response.json()["access_token"]


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


async def _make_admin_token(
    client: httpx.AsyncClient, make_user: Callable[..., Awaitable[User]], email: str
) -> str:
    await make_user(email=email, password="Valida123", role=UserRole.ADMIN)
    return await _login(client, email, "Valida123")


async def test_upload_requires_authentication(client: httpx.AsyncClient) -> None:
    response = await client.post(UPLOAD_DATA_URL)

    assert response.status_code == 401


async def test_upload_rejects_non_admin_roles(
    client: httpx.AsyncClient, make_user: Callable[..., Awaitable[User]], data_csv_factory
) -> None:
    await make_user(email="interno@podpulse.pe", password="Valida123", role=UserRole.INTERNO)
    token = await _login(client, "interno@podpulse.pe", "Valida123")
    csv_path = data_csv_factory([DATA_ROW])

    with csv_path.open("rb") as f:
        response = await client.post(
            UPLOAD_DATA_URL, headers=_auth(token), files={"file": ("data.csv", f, "text/csv")}
        )

    assert response.status_code == 403
    assert response.json()["code"] == "INSUFFICIENT_ROLE"


async def test_upload_data_success(
    client: httpx.AsyncClient, make_user: Callable[..., Awaitable[User]], data_csv_factory
) -> None:
    token = await _make_admin_token(client, make_user, "admin-upload-ok@podpulse.pe")
    csv_path = data_csv_factory([DATA_ROW])

    with csv_path.open("rb") as f:
        response = await client.post(
            UPLOAD_DATA_URL, headers=_auth(token), files={"file": ("data.csv", f, "text/csv")}
        )

    assert response.status_code == 201
    body = response.json()
    assert body["status"] == "success"
    assert body["rows_loaded"] == 1
    assert body["rows_skipped"] == 0
    assert body["upload_log_id"] is not None
    assert body["original_filename"] == "data.csv"


async def test_upload_reports_rejected_rows_without_failing_the_whole_file(
    client: httpx.AsyncClient, make_user: Callable[..., Awaitable[User]], data_csv_factory
) -> None:
    token = await _make_admin_token(client, make_user, "admin-upload-mixed@podpulse.pe")
    bad_row = dict(DATA_ROW, Fecha="fecha-invalida", Programa="TEST_ADMIN_Programa Invalido")
    csv_path = data_csv_factory([DATA_ROW, bad_row], filename="mixed.csv")

    with csv_path.open("rb") as f:
        response = await client.post(
            UPLOAD_DATA_URL, headers=_auth(token), files={"file": ("mixed.csv", f, "text/csv")}
        )

    assert response.status_code == 201
    body = response.json()
    assert body["rows_total"] == 2
    assert body["rows_loaded"] == 1
    assert body["rows_skipped"] == 1
    assert "Fecha" in body["rejected"][0]["reason"]


async def test_upload_missing_required_columns_returns_422(
    client: httpx.AsyncClient, make_user: Callable[..., Awaitable[User]], tmp_path
) -> None:
    token = await _make_admin_token(client, make_user, "admin-upload-badcols@podpulse.pe")
    csv_path = tmp_path / "incompleto.csv"
    csv_path.write_text("Fecha;Programa\n01/07/2026;X\n", encoding="utf-8")

    with csv_path.open("rb") as f:
        response = await client.post(
            UPLOAD_DATA_URL, headers=_auth(token), files={"file": ("incompleto.csv", f, "text/csv")}
        )

    assert response.status_code == 422
    body = response.json()
    assert body["code"] == "ETL_ERROR"
    assert body["rows_total"] == 0


async def test_upload_xlsx_rejects_file_with_fake_extension(
    client: httpx.AsyncClient, make_user: Callable[..., Awaitable[User]], tmp_path
) -> None:
    token = await _make_admin_token(client, make_user, "admin-upload-fakext@podpulse.pe")
    fake_xlsx = tmp_path / "no_es_excel.xlsx"
    fake_xlsx.write_text("esto no es un archivo xlsx real", encoding="utf-8")

    with fake_xlsx.open("rb") as f:
        response = await client.post(
            UPLOAD_AUSPICIOS_URL,
            headers=_auth(token),
            files={"file": ("no_es_excel.xlsx", f, "application/vnd.ms-excel")},
        )

    assert response.status_code == 422
    assert response.json()["code"] == "ETL_ERROR"


async def test_upload_oversized_file_returns_413(
    client: httpx.AsyncClient, make_user: Callable[..., Awaitable[User]], tmp_path
) -> None:
    token = await _make_admin_token(client, make_user, "admin-upload-big@podpulse.pe")
    big_file = tmp_path / "grande.csv"
    with big_file.open("wb") as f:
        f.write(b"a" * (11 * 1024 * 1024))  # 11 MB > límite de 10 MB

    with big_file.open("rb") as f:
        response = await client.post(
            UPLOAD_DATA_URL, headers=_auth(token), files={"file": ("grande.csv", f, "text/csv")}
        )

    assert response.status_code == 413
    assert response.json()["code"] == "FILE_TOO_LARGE"


async def test_upload_history_is_paginated_and_filterable_by_file_type(
    client: httpx.AsyncClient, make_user: Callable[..., Awaitable[User]], data_csv_factory
) -> None:
    token = await _make_admin_token(client, make_user, "admin-history@podpulse.pe")
    for i in range(2):
        row = dict(DATA_ROW, Programa=f"TEST_ADMIN_Historial {i}")
        csv_path = data_csv_factory([row], filename=f"historial_{i}.csv")
        with csv_path.open("rb") as f:
            resp = await client.post(
                UPLOAD_DATA_URL, headers=_auth(token), files={"file": (f"h{i}.csv", f, "text/csv")}
            )
            assert resp.status_code == 201

    response = await client.get(
        HISTORY_URL, headers=_auth(token), params={"page": 1, "page_size": 1, "file_type": "DATA"}
    )

    assert response.status_code == 200
    body = response.json()
    assert body["page"] == 1
    assert body["page_size"] == 1
    assert len(body["items"]) == 1
    assert body["total"] >= 2
    assert body["items"][0]["file_type"] == "DATA"
    assert body["items"][0]["uploaded_by"]["email"] == "admin-history@podpulse.pe"


async def test_upload_detail_returns_rejected_rows(
    client: httpx.AsyncClient, make_user: Callable[..., Awaitable[User]], data_csv_factory
) -> None:
    token = await _make_admin_token(client, make_user, "admin-detail@podpulse.pe")
    bad_row = dict(DATA_ROW, Fecha="no-es-fecha", Programa="TEST_ADMIN_Detalle")
    csv_path = data_csv_factory([bad_row], filename="detalle.csv")

    with csv_path.open("rb") as f:
        upload_response = await client.post(
            UPLOAD_DATA_URL, headers=_auth(token), files={"file": ("detalle.csv", f, "text/csv")}
        )
    upload_id = upload_response.json()["upload_log_id"]

    response = await client.get(f"/api/v1/uploads/{upload_id}", headers=_auth(token))

    assert response.status_code == 200
    body = response.json()
    assert body["rows_skipped"] == 1
    assert "Fecha" in body["error_detail"]["rejected"][0]["reason"]


async def test_upload_detail_not_found_returns_404(
    client: httpx.AsyncClient, make_user: Callable[..., Awaitable[User]]
) -> None:
    token = await _make_admin_token(client, make_user, "admin-detail-404@podpulse.pe")

    response = await client.get(
        "/api/v1/uploads/00000000-0000-0000-0000-000000000000", headers=_auth(token)
    )

    assert response.status_code == 404
