from datetime import date

import pytest

from app.etl.exceptions import RowValidationError
from app.etl.models import ProgramaRef
from app.etl.normalizers import (
    derive_period_from_month_name,
    prepare_auspicios_row,
    prepare_data_row,
    prepare_keywords_row,
    prepare_split_sense_row,
    week_num_excel_style,
)


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
        "Formato": "Vivo",
        "Titulo del Video": "Episodio 1",
        "Link del Video": "http://example.com",
    }

    row, ref = prepare_data_row(clean)

    assert row["fecha"] == date(2026, 7, 5)
    assert row["anio"] == 2026
    assert row["mes_num"] == 7
    assert row["semana_num"] == week_num_excel_style(date(2026, 7, 5))
    assert row["vistas_diarias"] == 1000
    assert row["es_emision"] == 2  # varias emisiones el mismo día son válidas, no solo 0/1
    assert ref == ProgramaRef(
        nombre="Hablando Huevadas",
        canal="Latina",
        categoria="Conversacional",
        tipo="podcast",
        authoritative=True,
    )


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


def test_prepare_auspicios_row() -> None:
    clean = {
        "Mes": "Enero",
        "Programa": "Hablando Huevadas",
        "Canal": "Latina",
        "Categoria": "Conversacional",
        "Auspiciadores": "Adidas",
    }

    row, ref = prepare_auspicios_row(clean)

    assert row == {"mes_num": 1, "mes_nombre": "Enero", "auspiciador": "Adidas"}
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
