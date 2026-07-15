"""Chequeo de sanidad previo a una carga de DATA o AUSPICIOS.

Compara un archivo Excel fuente contra el estado ACTUAL de la base y
reporta inconsistencias que romperían o corromperían la carga si se sube
tal cual — nunca escribe nada, es solo lectura.

Nace de la sesión del 15/07/2026: sin este chequeo, un Excel con nombres de
programa con distinta capitalización/tildes que la base crea un programa
duplicado nuevo (ver fusión de 93 grupos), un `Tipo` desalineado pisa una
corrección ya hecha en la base, y un `Formato` no reconocido rechaza filas
en silencio recién al momento de cargar.

Uso (desde backend/, con el entorno virtual activado):
    python scripts/check_precarga.py "../data/raw/DATATUBE_2026.xlsx"
    python scripts/check_precarga.py "../data/raw/auspicios.xlsx"

Detecta automáticamente si es un archivo DATA o AUSPICIOS por las columnas
presentes (`Tipo`/`Formato` vs. `Auspiciadores`).
"""

import argparse
import asyncio
import sys
import unicodedata
from difflib import SequenceMatcher
from pathlib import Path

# Permite ejecutar `python scripts/check_precarga.py` directamente — igual
# que seed_admin.py, sys.path[0] es backend/scripts (no backend/) al
# invocarse así, y el paquete `app` no se encuentra sin este insert.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import pandas as pd  # noqa: E402
from sqlalchemy import text  # noqa: E402
from sqlalchemy.ext.asyncio import AsyncSession  # noqa: E402

from app.db.session import AsyncSessionLocal  # noqa: E402
from app.etl.validators import VALID_FORMATOS  # noqa: E402

_SIMILITUD_TYPO = 0.85


def clave(nombre: str) -> str:
    """Normaliza un nombre para comparar ignorando mayúsculas/tildes/espacios
    repetidos — misma función usada en la fusión de programas duplicados."""
    sin_tilde = "".join(c for c in unicodedata.normalize("NFKD", nombre) if not unicodedata.combining(c))
    return " ".join(sin_tilde.strip().lower().split())


async def cargar_programas(session: AsyncSession) -> list[dict]:
    result = await session.execute(text("SELECT nombre, tipo FROM dim_programa"))
    return [dict(row._mapping) for row in result.all()]


async def cargar_auspiciadores(session: AsyncSession) -> list[str]:
    result = await session.execute(text("SELECT DISTINCT auspiciador FROM dim_auspicios"))
    return [row[0] for row in result.all()]


def check_nombres_duplicados(programas_excel: list[str], programas_db: list[dict]) -> list[str]:
    """Programas del Excel cuya grafía no coincide EXACTO con la base, pero sí
    ignorando mayúsculas/tildes — crearían una variante duplicada del mismo
    programa en vez de reusar el existente."""
    db_por_clave: dict[str, str] = {}
    for p in programas_db:
        db_por_clave.setdefault(clave(p["nombre"]), p["nombre"])

    hallazgos = []
    for nombre in sorted({str(n).strip() for n in programas_excel}):
        existente = db_por_clave.get(clave(nombre))
        if existente is not None and existente != nombre:
            hallazgos.append(f"  '{nombre}' (Excel) -> corregir a '{existente}' (ya existe en la base)")
    return hallazgos


def check_tipos(df: pd.DataFrame, programas_db: list[dict]) -> list[str]:
    """`Tipo` es autoritativo desde DATA: si el Excel trae un valor distinto
    al de la base, una recarga lo pisaría — incluso si esa diferencia es
    justamente una corrección manual ya aplicada en la base."""
    if "Tipo" not in df.columns or "Programa" not in df.columns:
        return []
    db_tipo = {p["nombre"]: p["tipo"] for p in programas_db if p["tipo"] is not None}

    excel_tipo: dict[str, str] = {}
    con_tipo = df.dropna(subset=["Tipo"])[["Programa", "Tipo"]].drop_duplicates("Programa")
    for programa, tipo in con_tipo.itertuples(index=False):
        excel_tipo.setdefault(str(programa).strip(), str(tipo).strip().lower())

    hallazgos = []
    for nombre, tipo_excel in sorted(excel_tipo.items()):
        tipo_db = db_tipo.get(nombre)
        if tipo_db is not None and tipo_excel != tipo_db:
            hallazgos.append(f"  '{nombre}': Excel dice '{tipo_excel}' -> la base dice '{tipo_db}'")
    return hallazgos


def check_formato(df: pd.DataFrame) -> list[str]:
    """Valores de Formato que el ETL rechazaría fila por fila al cargar (ver
    validate_formato) — detectarlos antes evita sorpresas en el resultado
    de la carga."""
    if "Formato" not in df.columns:
        return []
    validos = set(VALID_FORMATOS)
    no_reconocidos = sorted(
        {str(v).strip() for v in df["Formato"].dropna() if str(v).strip().lower() not in validos}
    )
    return [f"  '{v}'" for v in no_reconocidos]


def check_auspiciadores_typos(marcas_excel: list[str], marcas_db: list[str]) -> list[str]:
    """Pares de auspiciadores (dentro del Excel, o Excel vs. base) con
    nombres muy parecidos (typo/espaciado) — mismo patrón que unificó
    Johnnie/Jhonnie Walker, Betcris/Bectris, etc."""
    excel_norm = sorted({m.strip().upper() for m in marcas_excel})
    db_norm = sorted({m.strip().upper() for m in marcas_db})
    universo = sorted(set(excel_norm) | set(db_norm))

    hallazgos = []
    vistos: set[tuple[str, str]] = set()
    for i, a in enumerate(universo):
        for b in universo[i + 1 :]:
            if (a, b) in vistos:
                continue
            # Al menos una de las dos variantes debe venir del archivo — no
            # tiene sentido reportar pares que ya conviven en la base.
            if a not in excel_norm and b not in excel_norm:
                continue
            if SequenceMatcher(None, a, b).ratio() >= _SIMILITUD_TYPO:
                hallazgos.append(f"  '{a}' <-> '{b}'")
                vistos.add((a, b))
    return hallazgos


def _print_seccion(titulo: str, hallazgos: list[str]) -> None:
    print(f"\n== {titulo} ({len(hallazgos)}) ==")
    print("\n".join(hallazgos) if hallazgos else "  ninguno")


async def main() -> None:
    parser = argparse.ArgumentParser(description="Chequeo previo a una carga de DATA o AUSPICIOS.")
    parser.add_argument("archivo", help="Ruta al .xlsx a verificar")
    parser.add_argument("--sheet", default=None, help="Hoja a leer (por defecto: la primera)")
    args = parser.parse_args()

    path = Path(args.archivo)
    if not path.exists():
        print(f"No existe el archivo: {path}", file=sys.stderr)
        raise SystemExit(1)

    xls = pd.ExcelFile(path)
    sheet = args.sheet or xls.sheet_names[0]
    df = pd.read_excel(path, sheet_name=sheet, dtype=str)
    df.columns = [str(c).strip() for c in df.columns]

    es_data = "Tipo" in df.columns or "Formato" in df.columns
    es_auspicios = "Auspiciadores" in df.columns
    tipo_archivo = "DATA" if es_data else "AUSPICIOS" if es_auspicios else "desconocido"

    print(f"Archivo: {path.name} (hoja: {sheet})")
    print(f"Tipo detectado: {tipo_archivo}")

    if tipo_archivo == "desconocido":
        print("\nNo se reconocen columnas de DATA (Tipo/Formato) ni de AUSPICIOS "
              "(Auspiciadores) — nada que chequear.", file=sys.stderr)
        raise SystemExit(1)

    hay_hallazgos = False
    async with AsyncSessionLocal() as session:
        programas_db = await cargar_programas(session)
        programas_excel = df["Programa"].dropna().tolist() if "Programa" in df.columns else []

        dup = check_nombres_duplicados(programas_excel, programas_db)
        _print_seccion("Nombres de programa con grafía distinta a la base", dup)
        hay_hallazgos |= bool(dup)

        if es_data:
            tipos = check_tipos(df, programas_db)
            _print_seccion("Tipos distintos entre Excel y base", tipos)
            hay_hallazgos |= bool(tipos)

            formatos = check_formato(df)
            _print_seccion("Valores de Formato no reconocidos", formatos)
            hay_hallazgos |= bool(formatos)

        if es_auspicios and "Auspiciadores" in df.columns:
            marcas_db = await cargar_auspiciadores(session)
            typos = check_auspiciadores_typos(df["Auspiciadores"].dropna().tolist(), marcas_db)
            _print_seccion("Posibles typos en Auspiciadores", typos)
            hay_hallazgos |= bool(typos)

    print()
    if hay_hallazgos:
        print("Hay inconsistencias — corrígelas en el Excel antes de cargar.")
        raise SystemExit(1)
    print("Sin inconsistencias. El archivo está alineado con la base.")


if __name__ == "__main__":
    asyncio.run(main())
