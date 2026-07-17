from app.services.client_service import _detect_extension


def test_detect_extension_returns_png_for_png_signature() -> None:
    header = b"\x89PNG\r\n\x1a\n" + b"\x00" * 4  # 12 bytes, igual que lo que lee client_service

    assert _detect_extension(header) == ".png"


def test_detect_extension_returns_jpg_for_jpeg_signature() -> None:
    header = b"\xff\xd8\xff" + b"\x00" * 9

    assert _detect_extension(header) == ".jpg"


def test_detect_extension_returns_webp_for_riff_webp_signature() -> None:
    header = b"RIFF" + b"\x00\x00\x00\x00" + b"WEBP"

    assert _detect_extension(header) == ".webp"


def test_detect_extension_rejects_riff_container_that_is_not_webp() -> None:
    """RIFF es un contenedor genérico (WAV de audio también lo usa) — solo el
    fourcc "WEBP" en el byte 8 confirma que es una imagen, no cualquier
    archivo RIFF."""
    header = b"RIFF" + b"\x00\x00\x00\x00" + b"WAVE"

    assert _detect_extension(header) is None


def test_detect_extension_rejects_plain_text() -> None:
    assert _detect_extension(b"esto no es una imagen") is None


def test_detect_extension_rejects_empty_header() -> None:
    assert _detect_extension(b"") is None
