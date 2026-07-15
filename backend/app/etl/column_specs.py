"""Especificación declarativa de las columnas esperadas por tipo de archivo.

Fuente: docs/PODPULSE_Documentacion_Migracion.docx (estructura del modelo Power
BI original) y la estructura real de DATA confirmada por el usuario. SUPPORT
se excluye deliberadamente (confirmado que no se usa — ver decisión registrada
en [[podpulse-project-constitution]] / historial de la migración de la BD).
"""

from dataclasses import dataclass

from app.models.enums import UploadFileType


@dataclass(frozen=True)
class ColumnSpec:
    name: str
    dtype: str  # "str" | "int" | "float" | "bool" | "date"
    required: bool = True


@dataclass(frozen=True)
class FileTypeSpec:
    file_type: UploadFileType
    columns: tuple[ColumnSpec, ...]
    is_csv: bool
    delimiter: str | None = None
    encoding: str = "utf-8"
    sheet_name: str | int = 0


# DATA acepta .csv (histórico) y también .xlsx — ver readers.read_rows: la
# fuente pasó a entregar Excel (primera hoja; sheet_name=0 por defecto en vez
# del nombre "DATA" para no romper si renombran la hoja).
DATA_SPEC = FileTypeSpec(
    file_type=UploadFileType.DATA,
    is_csv=True,
    delimiter=";",
    encoding="utf-8",
    columns=(
        ColumnSpec("Fecha", "date"),
        ColumnSpec("Mes", "str", required=False),  # informativo; mes_num se deriva de Fecha
        ColumnSpec("Puesto", "int", required=False),
        ColumnSpec("Programa", "str"),
        ColumnSpec("Categoria", "str", required=False),
        ColumnSpec("Canal", "str"),
        ColumnSpec("Es_Emision", "int"),  # conteo de emisiones/día, no flag (DAX: SUM(Es_Emision))
        ColumnSpec("Vistas_Diarias", "int"),
        ColumnSpec("Busquedas_Diarias", "int"),
        ColumnSpec("Likes", "int", required=False),
        ColumnSpec("Comentarios", "int", required=False),
        ColumnSpec("Engagement", "float", required=False),
        ColumnSpec("Formato", "str", required=False),
        ColumnSpec("Titulo del Video", "str", required=False),
        ColumnSpec("Link del Video", "str", required=False),
        ColumnSpec("Hora Trasmisión", "str", required=False),
        ColumnSpec("Duración", "str", required=False),
        ColumnSpec("Tipo", "str", required=False),
        ColumnSpec("Pico Max", "int", required=False),
        ColumnSpec("Promedio en Vivo", "int", required=False),
    ),
)

AUSPICIOS_SPEC = FileTypeSpec(
    file_type=UploadFileType.AUSPICIOS,
    is_csv=False,
    sheet_name="AUSPICIOS",
    columns=(
        ColumnSpec("Mes", "str"),
        ColumnSpec("Programa", "str"),
        ColumnSpec("Canal", "str"),
        ColumnSpec("Categoria", "str", required=False),
        ColumnSpec("Auspiciadores", "str"),
    ),
)

KEYWORDS_SPEC = FileTypeSpec(
    file_type=UploadFileType.KEYWORDS,
    is_csv=False,
    sheet_name=0,
    columns=(
        ColumnSpec("AÑO", "int"),
        ColumnSpec("HASHTAG", "str"),
        ColumnSpec("OCCURRENCES", "int"),
        ColumnSpec("SENTIMENT", "str"),
        ColumnSpec("SEARCH_ID", "int", required=False),
        ColumnSpec("PROGRAMA", "str"),
        ColumnSpec("MES", "str"),
    ),
)

SPLIT_SENSE_SPEC = FileTypeSpec(
    file_type=UploadFileType.SPLIT_SENSE,
    is_csv=False,
    sheet_name=0,
    columns=(
        ColumnSpec("AÑO", "int"),
        ColumnSpec("SEARCH_ID", "int", required=False),
        ColumnSpec("PROGRAMA", "str"),
        ColumnSpec("MES", "str"),
        ColumnSpec("POSITIVE", "float"),
        ColumnSpec("NEGATIVE", "float"),
        ColumnSpec("NEUTRAL", "float"),
    ),
)
