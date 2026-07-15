from datetime import date, time

import pytest

from app.etl.exceptions import RowValidationError
from app.etl.models import ProgramaRef
from app.etl.normalizers import (
    consolidate_data_rows,
    dedupe_auspicios_rows,
    derive_period_from_month_name,
    prepare_auspicios_row,
    prepare_data_row,
    prepare_keywords_row,
    prepare_split_sense_row,
    week_num_excel_style,
)


def _data_row(**overrides: object) -> dict[str, object]:
    """Fila DATA ya preparada (post prepare_data_row + programa_id resuelto)
    con valores base neutros — cada test pisa solo lo que le importa."""
    row: dict[str, object] = {
        "fecha": date(2026, 6, 1),
        "anio": 2026,
        "mes_num": 6,
        "semana_num": 23,
        "puesto": None,
        "es_emision": 0,
        "vistas_diarias": 0,
        "busquedas_diarias": 0,
        "likes": None,
        "comentarios": None,
        "engagement": None,
        "pico_max_vivo": None,
        "promedio_vivo": None,
        "formato": None,
        "titulo_video": None,
        "link_video": None,
        "programa_id": 1,
    }
    row.update(overrides)
    return row


def test_week_num_excel_style_week_one_contains_jan_first() -> None:
    assert week_num_excel_style(date(2026, 1, 1)) == 1
    assert week_num_excel_style(date(2026, 1, 4)) == 1  # domingo, misma semana que el 1


def test_week_num_excel_style_increments_on_monday() -> None:
    # 2026-01-01 es jueves; el primer lunes siguiente (2026-01-05) inicia la semana 2.
    assert week_num_excel_style(date(2026, 1, 5)) == 2


def test_derive_period_from_month_name_valid() -> None:
    period = derive_period_from_month_name(anio=2026, mes_nombre="Julio")
    assert period.anio == 2026
    assert period.mes_num == 7


def test_derive_period_from_month_name_invalid_raises() -> None:
    with pytest.raises(RowValidationError, match="no reconocido"):
        derive_period_from_month_name(anio=2026, mes_nombre="Mesinventado")


def test_prepare_data_row_derives_period_and_programa_ref() -> None:
    clean = {
        "Fecha": date(2026, 7, 5),
        "Programa": "Hablando Huevadas",
        "Canal": "Latina",
        "Categoria": "Conversacional",
        "Tipo": "podcast",
        "Puesto": 1,
        "Es_Emision": 2,
        "Vistas_Diarias": 1000,
        "Busquedas_Diarias": 50,
        "Likes": 10,
        "Comentarios": 2,
        "Engagement": 6.25,
        "Pico Max": 500,
        "Promedio en Vivo": 300,
        "Formato": "VIVO",
        "Titulo del Video": "Episodio 1",
        "Link del Video": "http://example.com",
        "Hora Trasmisión": "19:00:34",
        "Duración": "2:29:51",
    }

    row, ref = prepare_data_row(clean)

    assert row["hora_transmision"] == time(19, 0, 34)
    assert row["duracion_segundos"] == 2 * 3600 + 29 * 60 + 51
    assert row["fecha"] == date(2026, 7, 5)
    assert row["anio"] == 2026


def test_prepare_data_row_malformed_duracion_degrades_to_none_not_row_rejection() -> None:
    """Un artefacto de Excel en 'Duración' (visto en datos reales) no debe
    tumbar la fila entera — Vistas/Likes reales se conservan, solo la
    duración queda en blanco. Distinto de Formato/Tipo, que sí rechazan la
    fila por ser dimensiones de negocio con vocabulario fijo."""
    clean = {
        "Fecha": date(2026, 7, 5),
        "Programa": "X",
        "Canal": "Y",
        "Categoria": None,
        "Tipo": None,
        "Puesto": None,
        "Es_Emision": 1,
        "Vistas_Diarias": 5000,
        "Busquedas_Diarias": 0,
        "Likes": None,
        "Comentarios": None,
        "Engagement": None,
        "Pico Max": None,
        "Promedio en Vivo": None,
        "Formato": None,
        "Titulo del Video": None,
        "Link del Video": None,
        "Hora Trasmisión": "no-es-hora",
        "Duración": "1 day, 16:43:00",
    }

    row, _ = prepare_data_row(clean)

    assert row["hora_transmision"] is None
    assert row["duracion_segundos"] is None
    assert row["vistas_diarias"] == 5000  # el resto de la fila sobrevive intacto


def test_prepare_data_row_rejects_negative_metric() -> None:
    clean = {
        "Fecha": date(2026, 7, 5),
        "Programa": "X",
        "Canal": "Y",
        "Categoria": None,
        "Tipo": None,
        "Puesto": None,
        "Es_Emision": 0,
        "Vistas_Diarias": -5,
        "Busquedas_Diarias": 0,
        "Likes": None,
        "Comentarios": None,
        "Engagement": None,
        "Pico Max": None,
        "Promedio en Vivo": None,
        "Formato": None,
        "Titulo del Video": None,
        "Link del Video": None,
    }

    with pytest.raises(RowValidationError, match="Vistas_Diarias"):
        prepare_data_row(clean)


def test_prepare_data_row_rejects_negative_es_emision() -> None:
    clean = {
        "Fecha": date(2026, 7, 5),
        "Programa": "X",
        "Canal": "Y",
        "Categoria": None,
        "Tipo": None,
        "Puesto": None,
        "Es_Emision": -1,
        "Vistas_Diarias": 0,
        "Busquedas_Diarias": 0,
        "Likes": None,
        "Comentarios": None,
        "Engagement": None,
        "Pico Max": None,
        "Promedio en Vivo": None,
        "Formato": None,
        "Titulo del Video": None,
        "Link del Video": None,
    }

    with pytest.raises(RowValidationError, match="Es_Emision"):
        prepare_data_row(clean)


def test_dedupe_auspicios_rows_drops_exact_key_duplicates() -> None:
    """Misma clave (mes, programa, auspiciador) repetida en el archivo — sin
    esto el UPSERT falla con 'ON CONFLICT DO UPDATE cannot affect row a
    second time' y tumba la carga completa."""
    a = {"mes_num": 1, "mes_nombre": "Enero", "programa_id": 1, "auspiciador": "BETCRIS"}
    b = {"mes_num": 1, "mes_nombre": "Enero", "programa_id": 1, "auspiciador": "BETCRIS"}

    result = dedupe_auspicios_rows([a, b])

    assert result == [a]


def test_dedupe_auspicios_rows_keeps_distinct_keys() -> None:
    a = {"mes_num": 1, "mes_nombre": "Enero", "programa_id": 1, "auspiciador": "BETCRIS"}
    b = {"mes_num": 2, "mes_nombre": "Febrero", "programa_id": 1, "auspiciador": "BETCRIS"}
    c = {"mes_num": 1, "mes_nombre": "Enero", "programa_id": 2, "auspiciador": "BETCRIS"}
    d = {"mes_num": 1, "mes_nombre": "Enero", "programa_id": 1, "auspiciador": "PEDIDOSYA"}

    result = dedupe_auspicios_rows([a, b, c, d])

    assert result == [a, b, c, d]


def test_consolidate_data_rows_passes_single_rows_untouched() -> None:
    row = _data_row(vistas_diarias=100, engagement=0.05)

    result = consolidate_data_rows([row])

    assert result == [row]


def test_consolidate_data_rows_padding_rows_keep_real_row_values() -> None:
    """Caso mayoritario del Excel real (92%): 1 fila con datos + filas de
    relleno todo en cero — el resultado debe ser la fila real intacta."""
    real = _data_row(
        es_emision=1,
        vistas_diarias=5796,
        likes=361,
        comentarios=64,
        engagement=0.0733,
        formato="Vivo",
        titulo_video="Episodio 1",
    )
    padding = [_data_row(), _data_row()]

    result = consolidate_data_rows([real, *padding])

    assert len(result) == 1
    merged = result[0]
    assert merged["vistas_diarias"] == 5796
    assert merged["likes"] == 361
    assert merged["formato"] == "Vivo"
    assert merged["titulo_video"] == "Episodio 1"
    # (361 + 64) / 5796 — recalculado con la definición confirmada, coincide
    # con el engagement original de la fila real
    assert merged["engagement"] == pytest.approx((361 + 64) / 5796)


def test_consolidate_data_rows_genuine_conflict_sums_and_recomputes_engagement() -> None:
    """Dos videos reales el mismo día: métricas aditivas se suman y el
    Engagement se recalcula como (ΣLikes + ΣComentarios) / ΣVistas — nunca
    promediando porcentajes."""
    video_a = _data_row(vistas_diarias=8000, likes=300, comentarios=100, engagement=0.05, pico_max_vivo=500)
    video_b = _data_row(vistas_diarias=2000, likes=100, comentarios=0, engagement=0.05, pico_max_vivo=900)

    result = consolidate_data_rows([video_a, video_b])

    assert len(result) == 1
    merged = result[0]
    assert merged["vistas_diarias"] == 10000
    assert merged["likes"] == 400
    assert merged["comentarios"] == 100
    assert merged["engagement"] == pytest.approx((400 + 100) / 10000)
    assert merged["pico_max_vivo"] == 900  # MAX, no suma


def test_consolidate_data_rows_groups_by_fecha_and_programa() -> None:
    """Claves distintas (otro día u otro programa) nunca se mezclan."""
    rows = [
        _data_row(programa_id=1, vistas_diarias=10),
        _data_row(programa_id=2, vistas_diarias=20),
        _data_row(programa_id=1, fecha=date(2026, 6, 2), vistas_diarias=30),
    ]

    result = consolidate_data_rows(rows)

    assert len(result) == 3


def test_prepare_auspicios_row() -> None:
    clean = {
        "Mes": "Enero",
        "Programa": "Hablando Huevadas",
        "Canal": "Latina",
        "Categoria": "Conversacional",
        "Auspiciadores": "Adidas",
    }

    row, ref = prepare_auspicios_row(clean)

    # "Adidas" -> "ADIDAS": normalizado a mayúsculas para no duplicar la
    # misma marca por distinta capitalización entre archivos/filas.
    assert row == {"mes_num": 1, "mes_nombre": "Enero", "auspiciador": "ADIDAS"}
    assert ref.nombre == "Hablando Huevadas"
    assert ref.canal == "Latina"
    assert ref.authoritative is False


def test_prepare_keywords_row() -> None:
    clean = {
        "AÑO": 2026,
        "HASHTAG": "comedia",
        "OCCURRENCES": 42,
        "SENTIMENT": "Positivo",
        "SEARCH_ID": 7,
        "PROGRAMA": "Hablando Huevadas",
        "MES": "Enero",
    }

    row, ref = prepare_keywords_row(clean)

    assert row["anio"] == 2026
    assert row["mes_num"] == 1
    assert row["hashtag"] == "comedia"
    assert row["sentimiento"] == "positivo"
    assert ref.canal is None
    assert ref.authoritative is False


def test_prepare_split_sense_row() -> None:
    clean = {
        "AÑO": 2026,
        "SEARCH_ID": None,
        "PROGRAMA": "Hablando Huevadas",
        "MES": "Enero",
        "POSITIVE": 0.3,
        "NEGATIVE": 0.3,
        "NEUTRAL": 0.4,
    }

    row, ref = prepare_split_sense_row(clean)

    assert row["score_positivo"] == 0.3
    assert row["score_negativo"] == 0.3
    assert row["score_neutral"] == 0.4
    assert ref.nombre == "Hablando Huevadas"


def test_prepare_split_sense_row_rejects_bad_sum() -> None:
    clean = {
        "AÑO": 2026,
        "SEARCH_ID": None,
        "PROGRAMA": "X",
        "MES": "Enero",
        "POSITIVE": 0.9,
        "NEGATIVE": 0.9,
        "NEUTRAL": 0.9,
    }

    with pytest.raises(RowValidationError, match="no suman 1.0"):
        prepare_split_sense_row(clean)
