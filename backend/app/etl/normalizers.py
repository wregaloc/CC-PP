"""Transform: deriva columnas calculadas y prepara cada fila para el upsert.

No toca la base de datos — la resolución de programa_id (que sí la toca) vive
en repository.py. Cada `prepare_*_row` devuelve (fila_lista_para_upsert, ProgramaRef).
"""

from dataclasses import dataclass
from datetime import date
from typing import Any

from app.etl.exceptions import RowValidationError
from app.etl.models import ProgramaRef
from app.etl.month_names import month_name_to_number
from app.etl.validators import (
    validate_formato,
    validate_non_negative,
    validate_scores_sum_to_one,
    validate_sentimiento,
    validate_tipo,
)


def week_num_excel_style(d: date) -> int:
    """Replica WEEKNUM(fecha, 2) de DAX/Excel: semanas de lunes a domingo,
    semana 1 = la que contiene el 1 de enero, contadas de forma secuencial
    desde esa fecha.

    Deliberadamente NO se usa date.isocalendar() (semana ISO 8601, basada en
    la regla del "primer jueves"): darían números distintos cerca de un
    cambio de año, y el objetivo es preservar la lógica original del
    dashboard (ver [[power-bi-migration-expert]]), no adoptar el estándar ISO.
    """
    jan1 = date(d.year, 1, 1)
    jan1_weekday = jan1.weekday()  # lunes=0
    days_since_jan1 = (d - jan1).days
    return (days_since_jan1 + jan1_weekday) // 7 + 1


@dataclass(frozen=True)
class DerivedPeriod:
    anio: int
    mes_num: int


def derive_period_from_month_name(anio: int, mes_nombre: str) -> DerivedPeriod:
    mes_num = month_name_to_number(mes_nombre)
    if mes_num is None:
        raise RowValidationError(f"Nombre de mes no reconocido: '{mes_nombre}'")
    return DerivedPeriod(anio=anio, mes_num=mes_num)


def prepare_data_row(clean: dict[str, Any]) -> tuple[dict[str, Any], ProgramaRef]:
    fecha: date = clean["Fecha"]
    tipo = validate_tipo(clean.get("Tipo"))
    for field_name in (
        "Vistas_Diarias",
        "Busquedas_Diarias",
        "Likes",
        "Comentarios",
        "Pico Max",
        "Promedio en Vivo",
        "Engagement",
        "Es_Emision",
    ):
        validate_non_negative(clean.get(field_name), field_name)

    programa_ref = ProgramaRef(
        nombre=clean["Programa"],
        canal=clean["Canal"],
        categoria=clean.get("Categoria"),
        tipo=tipo,
        authoritative=True,  # DATA manda sobre la dimensión programa (decisión confirmada)
    )
    row = {
        "fecha": fecha,
        "anio": fecha.year,
        "mes_num": fecha.month,
        "semana_num": week_num_excel_style(fecha),
        "puesto": clean.get("Puesto"),
        "es_emision": clean["Es_Emision"],
        "vistas_diarias": clean["Vistas_Diarias"],
        "busquedas_diarias": clean["Busquedas_Diarias"],
        "likes": clean.get("Likes"),
        "comentarios": clean.get("Comentarios"),
        "engagement": clean.get("Engagement"),
        "pico_max_vivo": clean.get("Pico Max"),
        "promedio_vivo": clean.get("Promedio en Vivo"),
        "formato": validate_formato(clean.get("Formato")),
        "titulo_video": clean.get("Titulo del Video"),
        "link_video": clean.get("Link del Video"),
    }
    return row, programa_ref


def consolidate_data_rows(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Consolida filas DATA que comparten (fecha, programa_id) en una sola —
    el grano de fact_audiencia es una fila por programa-día, pero la fuente
    real trae a veces varias (filas de relleno en cero, o varios videos del
    mismo día). Sin esto, el UPSERT falla con "ON CONFLICT DO UPDATE cannot
    affect row a second time" y la carga entera se cae.

    Reglas (aprobadas por el usuario — perfilado del Excel ENE_JUL_2026):
    - Métricas aditivas (vistas, búsquedas, likes, comentarios, emisiones):
      SUMA — mismo resultado que las medidas SUM del Power BI original.
    - Engagement: se RECALCULA con su definición confirmada
      (Likes + Comentarios) / Vistas sobre los totales consolidados — nunca
      se suman porcentajes. Si no hay likes/comentarios en el grupo, se
      conserva el de la fila dominante.
    - pico_max_vivo: MAX del grupo (es un pico).
    - Campos descriptivos (formato, título, link, puesto, promedio_vivo):
      de la fila dominante (la de más vistas) — en el caso típico (1 fila
      real + relleno en cero) es exactamente la fila real.
    """
    grouped: dict[tuple[Any, Any], list[dict[str, Any]]] = {}
    for row in rows:
        grouped.setdefault((row["fecha"], row["programa_id"]), []).append(row)

    return [
        group[0] if len(group) == 1 else _merge_data_group(group) for group in grouped.values()
    ]


def _sum_optional(values: list[Any]) -> Any:
    present = [v for v in values if v is not None]
    return sum(present) if present else None


def _merge_data_group(group: list[dict[str, Any]]) -> dict[str, Any]:
    base = max(group, key=lambda r: r["vistas_diarias"]).copy()
    base["vistas_diarias"] = sum(r["vistas_diarias"] for r in group)
    base["busquedas_diarias"] = sum(r["busquedas_diarias"] for r in group)
    base["es_emision"] = sum(r["es_emision"] for r in group)
    base["likes"] = _sum_optional([r["likes"] for r in group])
    base["comentarios"] = _sum_optional([r["comentarios"] for r in group])
    picos = [r["pico_max_vivo"] for r in group if r["pico_max_vivo"] is not None]
    base["pico_max_vivo"] = max(picos) if picos else None

    has_interacciones = base["likes"] is not None or base["comentarios"] is not None
    if has_interacciones and base["vistas_diarias"] > 0:
        interacciones = (base["likes"] or 0) + (base["comentarios"] or 0)
        base["engagement"] = interacciones / base["vistas_diarias"]

    return base


def dedupe_auspicios_rows(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Deduplica filas AUSPICIOS que comparten (mes_num, programa_id,
    auspiciador) — la clave de dim_auspicios. Pueden repetirse en el archivo
    fuente (p. ej. la misma marca escrita dos veces con distinto espaciado
    que la normalización unifica) y el UPSERT falla con "ON CONFLICT DO
    UPDATE cannot affect row a second time" si viajan en el mismo lote. Un
    duplicado exacto aquí no aporta información (la fila solo registra
    presencia de la marca ese mes), así que se queda la primera."""
    vistos: set[tuple[Any, Any, Any]] = set()
    unicas: list[dict[str, Any]] = []
    for row in rows:
        key = (row["mes_num"], row["programa_id"], row["auspiciador"])
        if key in vistos:
            continue
        vistos.add(key)
        unicas.append(row)
    return unicas


def prepare_auspicios_row(clean: dict[str, Any]) -> tuple[dict[str, Any], ProgramaRef]:
    mes_num = month_name_to_number(clean["Mes"])
    if mes_num is None:
        raise RowValidationError(f"Nombre de mes no reconocido: '{clean['Mes']}'")

    programa_ref = ProgramaRef(
        nombre=clean["Programa"],
        canal=clean["Canal"],
        categoria=clean.get("Categoria"),
        tipo=None,
        authoritative=False,
    )
    row = {
        "mes_num": mes_num,
        "mes_nombre": clean["Mes"],
        # Normalizado a mayúsculas: la misma marca llega con distinta
        # capitalización entre archivos/filas (p. ej. "Samsung" / "SAMSUNG"),
        # lo que duplicaba auspiciadores en la UI y en el conteo del KPI.
        "auspiciador": clean["Auspiciadores"].strip().upper(),
    }
    return row, programa_ref


def prepare_keywords_row(clean: dict[str, Any]) -> tuple[dict[str, Any], ProgramaRef]:
    period = derive_period_from_month_name(anio=clean["AÑO"], mes_nombre=clean["MES"])
    sentimiento = validate_sentimiento(clean["SENTIMENT"])
    validate_non_negative(clean["OCCURRENCES"], "OCCURRENCES")

    programa_ref = ProgramaRef(
        nombre=clean["PROGRAMA"], canal=None, categoria=None, tipo=None, authoritative=False
    )
    row = {
        "anio": period.anio,
        "mes_num": period.mes_num,
        "mes_nombre": clean["MES"],
        "hashtag": clean["HASHTAG"],
        "occurrences": clean["OCCURRENCES"],
        "sentimiento": sentimiento,
        "search_id": clean.get("SEARCH_ID"),
    }
    return row, programa_ref


def prepare_split_sense_row(clean: dict[str, Any]) -> tuple[dict[str, Any], ProgramaRef]:
    period = derive_period_from_month_name(anio=clean["AÑO"], mes_nombre=clean["MES"])
    validate_scores_sum_to_one(clean["POSITIVE"], clean["NEGATIVE"], clean["NEUTRAL"])

    programa_ref = ProgramaRef(
        nombre=clean["PROGRAMA"], canal=None, categoria=None, tipo=None, authoritative=False
    )
    row = {
        "anio": period.anio,
        "mes_num": period.mes_num,
        "mes_nombre": clean["MES"],
        "score_positivo": clean["POSITIVE"],
        "score_negativo": clean["NEGATIVE"],
        "score_neutral": clean["NEUTRAL"],
        "search_id": clean.get("SEARCH_ID"),
    }
    return row, programa_ref
