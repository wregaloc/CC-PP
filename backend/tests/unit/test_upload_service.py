import io
from pathlib import Path

import pytest
from fastapi import UploadFile

from app.exceptions.uploads import FileTooLargeError
from app.services.upload_service import _save_upload_file


class _FakeSettings:
    def __init__(self, storage_dir: str) -> None:
        self.upload_storage_dir = storage_dir


async def test_save_upload_file_writes_to_storage_dir_with_unique_name(tmp_path: Path) -> None:
    settings = _FakeSettings(str(tmp_path))
    upload = UploadFile(file=io.BytesIO(b"a;b;c\n1;2;3\n"), filename="data.csv")

    saved_path = await _save_upload_file(settings, upload)

    assert saved_path.exists()
    assert saved_path.parent == tmp_path
    assert saved_path.suffix == ".csv"
    assert saved_path.name != "data.csv"  # nombre único generado, no el original
    assert saved_path.read_bytes() == b"a;b;c\n1;2;3\n"


async def test_save_upload_file_rejects_oversized_file_and_cleans_up(tmp_path: Path) -> None:
    settings = _FakeSettings(str(tmp_path))
    big_content = b"x" * (11 * 1024 * 1024)  # 11 MB > límite de 10 MB
    upload = UploadFile(file=io.BytesIO(big_content), filename="grande.csv")

    with pytest.raises(FileTooLargeError):
        await _save_upload_file(settings, upload)

    assert list(tmp_path.iterdir()) == []  # no deja el archivo parcial en disco
