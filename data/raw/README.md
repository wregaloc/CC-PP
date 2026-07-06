# Archivos crudos pendientes de carga

Esta carpeta es solo un punto de entrega local para los archivos CSV/Excel
antes de subirlos vía la API (`POST /api/v1/uploads/{data|keywords|split-sense|auspicios}`,
ver `docs/API.md` §2). **No se versiona** (ver `.gitignore`) — el dato ya
procesado vive en Postgres (Supabase); el archivo crudo no necesita
respaldarse aquí una vez cargado.

## Qué archivos van aquí

Coloca los 4 archivos con estos nombres exactos (ver
`backend/app/etl/column_specs.py` para las columnas esperadas de cada uno):

| Archivo esperado | Formato | Hoja/delimitador |
|---|---|---|
| `data.csv` | CSV | separador `;`, UTF-8 |
| `keywords.xlsx` | Excel | primera hoja |
| `split_sense.xlsx` | Excel | primera hoja |
| `auspicios.xlsx` | Excel | hoja `AUSPICIOS` |

`SUPPORT` no aplica — confirmado que no se usa en el modelo original.

## Qué pasa después

Una vez aquí, se procesan contra el backend (local, con un usuario Admin)
para validar el pipeline ETL con datos reales antes de construir el
dashboard. El archivo temporal de procesamiento del backend
(`backend/storage/uploads/`) es un directorio distinto y efímero: cada
archivo se borra automáticamente tras procesarse, éxito o rechazo.
