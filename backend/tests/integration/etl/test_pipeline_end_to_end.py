"""Tests de integración del ETL contra una base de datos real (Supabase).

Verifican lo que un test unitario no puede: que el UPSERT es realmente
idempotente, que las FK/constraints de Postgres se respetan, y que el flujo
completo (Extract → Validate → Transform → Load → Report) funciona de punta
a punta. Toda fila creada usa el prefijo TEST_ETL_ y el fixture `test_admin_user`
limpia todo el rastro al finalizar (ver conftest.py).
"""

from datetime import date, timedelta

from sqlalchemy import select

from app.etl.pipeline import (
    run_auspicios_pipeline,
    run_data_pipeline,
    run_keywords_pipeline,
    run_split_sense_pipeline,
)
from app.models.dim_programa import Programa
from app.models.fact_audiencia import FactAudiencia
from tests.integration.etl.conftest import TEST_PROGRAMA_PREFIX

PROGRAMA = f"{TEST_PROGRAMA_PREFIX}Hablando Huevadas"


async def test_data_pipeline_loads_and_upserts_idempotently(
    db_session, test_admin_user, data_csv_factory
):
    rows = [
        {
            "Fecha": "05/07/2026",
            "Mes": "Julio",
            "Puesto": 1,
            "Programa": PROGRAMA,
            "Categoria": "Conversacional",
            "Canal": "Latina",
            "Es_Emision": 1,
            "Vistas_Diarias": 1000,
            "Busquedas_Diarias": 50,
            "Likes": 10,
            "Comentarios": 2,
            "Engagement": 6.25,
            "Formato": "Vivo",
            "Titulo del Video": "Episodio 1",
            "Link del Video": "http://example.com/1",
            "Tipo": "podcast",
            "Pico Max": 500,
            "Promedio en Vivo": 300,
        }
    ]
    csv_path = data_csv_factory(rows)

    report = await run_data_pipeline(db_session, csv_path, test_admin_user)
    await db_session.commit()

    assert report.status == "success"
    assert report.rows_loaded == 1
    assert report.rows_skipped == 0

    programa = (
        await db_session.execute(select(Programa).where(Programa.nombre == PROGRAMA))
    ).scalar_one()
    assert programa.canal == "Latina"
    assert programa.tipo.value == "podcast"

    facts = (
        await db_session.execute(
            select(FactAudiencia).where(FactAudiencia.programa_id == programa.id)
        )
    ).scalars().all()
    assert len(facts) == 1
    assert facts[0].vistas_diarias == 1000

    # Recargar el mismo dia/programa con un valor distinto debe actualizar,
    # no duplicar (UPSERT por (fecha, programa_id)).
    rows[0]["Vistas_Diarias"] = 9999
    csv_path_2 = data_csv_factory(rows, filename="data_v2.csv")
    report_2 = await run_data_pipeline(db_session, csv_path_2, test_admin_user)
    await db_session.commit()

    assert report_2.rows_loaded == 1

    # El UPSERT es una sentencia Core (ON CONFLICT), no pasa por el unit-of-work
    # del ORM — se pide populate_existing para sobreescribir el objeto ya
    # cacheado en la identity map con el valor real recién actualizado.
    facts_after = (
        await db_session.execute(
            select(FactAudiencia)
            .where(FactAudiencia.programa_id == programa.id)
            .execution_options(populate_existing=True)
        )
    ).scalars().all()
    assert len(facts_after) == 1  # sigue siendo 1 fila, no 2
    assert facts_after[0].vistas_diarias == 9999


async def test_data_pipeline_upserts_batch_over_asyncpg_param_limit(
    db_session, test_admin_user, data_csv_factory
):
    """Regresión: asyncpg rechaza una sola consulta con más de 32,767
    parámetros. Con ~17 columnas por fila, una sola sentencia INSERT con más
    de ~1927 filas ya la excede — este test usa 2200 filas de un mismo
    programa (una fecha distinta cada una, vía date+timedelta) para forzar
    más de un lote en `_upsert` (ver app/etl/repository.py,
    _UPSERT_BATCH_SIZE=1000) y confirmar que una carga con volumen real
    (decenas de miles de filas) no vuelve a romper con `InterfaceError: the
    number of query arguments cannot exceed 32767`."""
    row_count = 2200
    base = date(2020, 1, 1)
    programa = f"{TEST_PROGRAMA_PREFIX}Programa Bulk"
    rows = [
        {
            "Fecha": (base + timedelta(days=i)).strftime("%d/%m/%Y"),
            "Mes": "Enero",
            "Puesto": 1,
            "Programa": programa,
            "Categoria": "Conversacional",
            "Canal": "Latina",
            "Es_Emision": 1,
            "Vistas_Diarias": 100,
            "Busquedas_Diarias": 10,
            "Likes": 1,
            "Comentarios": 1,
            "Engagement": 0.05,
            "Formato": "Grabado",
            "Titulo del Video": None,
            "Link del Video": None,
            "Tipo": "podcast",
            "Pico Max": None,
            "Promedio en Vivo": None,
        }
        for i in range(row_count)
    ]
    csv_path = data_csv_factory(rows)

    report = await run_data_pipeline(db_session, csv_path, test_admin_user)
    await db_session.commit()

    assert report.status == "success"
    assert report.rows_loaded == row_count
    assert report.rows_skipped == 0

    programa_row = (
        await db_session.execute(select(Programa).where(Programa.nombre == programa))
    ).scalar_one()
    facts = (
        await db_session.execute(
            select(FactAudiencia).where(FactAudiencia.programa_id == programa_row.id)
        )
    ).scalars().all()
    assert len(facts) == row_count


async def test_data_pipeline_rejects_invalid_rows_but_loads_valid_ones(
    db_session, test_admin_user, data_csv_factory
):
    rows = [
        {
            "Fecha": "06/07/2026",
            "Mes": "Julio",
            "Puesto": 1,
            "Programa": f"{TEST_PROGRAMA_PREFIX}Programa Valido",
            "Categoria": "Conversacional",
            "Canal": "Latina",
            "Es_Emision": 1,
            "Vistas_Diarias": 500,
            "Busquedas_Diarias": 10,
            "Likes": None,
            "Comentarios": None,
            "Engagement": None,
            "Formato": None,
            "Titulo del Video": None,
            "Link del Video": None,
            "Tipo": None,
            "Pico Max": None,
            "Promedio en Vivo": None,
        },
        {
            "Fecha": "fecha-invalida",  # fila invalida: debe rechazarse, no romper el archivo
            "Mes": "Julio",
            "Puesto": 1,
            "Programa": f"{TEST_PROGRAMA_PREFIX}Programa Invalido",
            "Categoria": "Conversacional",
            "Canal": "Latina",
            "Es_Emision": 1,
            "Vistas_Diarias": 500,
            "Busquedas_Diarias": 10,
            "Likes": None,
            "Comentarios": None,
            "Engagement": None,
            "Formato": None,
            "Titulo del Video": None,
            "Link del Video": None,
            "Tipo": None,
            "Pico Max": None,
            "Promedio en Vivo": None,
        },
    ]
    csv_path = data_csv_factory(rows, filename="data_mixed.csv")

    report = await run_data_pipeline(db_session, csv_path, test_admin_user)
    await db_session.commit()

    assert report.status == "success"
    assert report.rows_total == 2
    assert report.rows_loaded == 1
    assert report.rows_skipped == 1
    assert "Fecha" in report.rejected[0].reason


async def test_keywords_pipeline_rejects_unknown_programa(
    db_session, test_admin_user, excel_factory
):
    rows = [
        {
            "AÑO": 2026,
            "HASHTAG": "test",
            "OCCURRENCES": 5,
            "SENTIMENT": "Positivo",
            "SEARCH_ID": 1,
            "PROGRAMA": f"{TEST_PROGRAMA_PREFIX}Programa Que No Existe Todavia",
            "MES": "Julio",
        }
    ]
    excel_path = excel_factory(rows, filename="keywords.xlsx")

    report = await run_keywords_pipeline(db_session, excel_path, test_admin_user)
    await db_session.commit()

    assert report.rows_loaded == 0
    assert report.rows_skipped == 1
    assert "no existe todavía" in report.rejected[0].reason


async def test_auspicios_and_split_sense_pipelines(db_session, test_admin_user, excel_factory):
    # AUSPICIOS crea el programa (trae canal) para que luego SPLIT SENSE lo pueda referenciar.
    auspicios_rows = [
        {
            "Mes": "Julio",
            "Programa": f"{TEST_PROGRAMA_PREFIX}Programa Auspiciado",
            "Canal": "Latina",
            "Categoria": "Editorial",
            "Auspiciadores": "Marca X",
        }
    ]
    auspicios_path = excel_factory(auspicios_rows, "auspicios.xlsx", sheet_name="AUSPICIOS")
    report_auspicios = await run_auspicios_pipeline(db_session, auspicios_path, test_admin_user)
    await db_session.commit()

    assert report_auspicios.rows_loaded == 1

    split_rows = [
        {
            "AÑO": 2026,
            "SEARCH_ID": 1,
            "PROGRAMA": f"{TEST_PROGRAMA_PREFIX}Programa Auspiciado",
            "MES": "Julio",
            "POSITIVE": 0.3,
            "NEGATIVE": 0.3,
            "NEUTRAL": 0.4,
        }
    ]
    split_path = excel_factory(split_rows, "split_sense.xlsx")
    report_split = await run_split_sense_pipeline(db_session, split_path, test_admin_user)
    await db_session.commit()

    assert report_split.rows_loaded == 1
    assert report_split.rows_skipped == 0
