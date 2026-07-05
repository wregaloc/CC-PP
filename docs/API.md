# API — Auth, Usuarios, Módulo Administrativo y Dashboard

Referencia de los endpoints implementados hasta ahora. Documentación interactiva completa (Swagger) disponible en `http://127.0.0.1:8000/docs` con el backend corriendo — este archivo es un resumen de lectura rápida. Diseño de referencia: `docs/PODPULSE_TDD_v1.0.docx` §6, §8 y §9.

Todas las respuestas son `application/json`. Los errores tienen la forma `{ "detail": string, "code": string }` (los endpoints de carga de archivos añaden además el resumen completo del intento — ver más abajo).

## 1. Auth (`/api/v1/auth`)

### POST /api/v1/auth/login

Rol requerido: **público**.

Verifica email + contraseña (bcrypt). Si son válidas, emite un `access_token` (en el body) y un `refresh_token` (en una cookie `HttpOnly`, `Secure`*, `SameSite=Strict`, con `path=/api/v1/auth`).

**Request**
```json
{ "email": "admin@podpulse.pe", "password": "MiClave123" }
```

**Response 200**
```json
{ "access_token": "eyJ...", "token_type": "bearer", "expires_in": 900 }
```

**Errores**
| Status | code | Motivo |
|---|---|---|
| 401 | `INVALID_CREDENTIALS` | Email no existe, contraseña incorrecta, o la cuenta está desactivada (mismo error en los tres casos, para no filtrar qué emails existen) |
| 429 | `RATE_LIMIT_EXCEEDED` | 5 intentos fallidos de la misma IP en los últimos 15 min (configurable: `LOGIN_MAX_ATTEMPTS`, `LOGIN_LOCKOUT_MINUTES`). Incluye header `Retry-After` |

### POST /api/v1/auth/refresh

Rol requerido: **público** (autenticado implícitamente por la cookie de refresh token).

Lee la cookie `refresh_token` y, si es válida, no está revocada y el usuario sigue activo, emite un `access_token` nuevo. **No rota** el refresh token (se mantiene el mismo hasta que expire o se haga logout).

**Response 200**
```json
{ "access_token": "eyJ...", "token_type": "bearer", "expires_in": 900 }
```

**Errores**: `401 TOKEN_INVALID` (cookie ausente, con firma inválida, o revocada) / `401 TOKEN_EXPIRED` (refresh token vencido — hay que volver a hacer login).

### POST /api/v1/auth/logout

Rol requerido: **autenticado** (`Authorization: Bearer <access_token>`).

Agrega el `jti` del refresh token a la blacklist (tabla `revoked_tokens`) y limpia la cookie. Cualquier intento posterior de `/auth/refresh` con ese refresh token falla con `401 TOKEN_INVALID`.

**Response 200**
```json
{ "detail": "Sesión cerrada" }
```

### POST /api/v1/auth/change-password

Rol requerido: **autenticado**.

**Request**
```json
{ "current_password": "MiClave123", "new_password": "NuevaClave456" }
```

Política de contraseña (TDD §5.3): mínimo 8 caracteres, al menos 1 número y 1 mayúscula.

**Response 200**
```json
{ "detail": "Contraseña actualizada" }
```

**Errores**: `401 INVALID_CREDENTIALS` (contraseña actual incorrecta) / `422` si `new_password` no cumple la política.

---

## 2. Carga de Archivos (`/api/v1/uploads`)

Rol requerido en **todos** estos endpoints: **admin** (TDD §5.1: Admin es el único rol que puede subir archivos — verificado en el backend vía `Depends(require_admin)`, nunca solo en el frontend). `SUPPORT` no se implementa (decisión ya registrada: no se usa).

### POST /api/v1/uploads/{data|keywords|split-sense|auspicios}

`multipart/form-data` con un campo `file`. Flujo (TDD §6.2): valida rol → guarda el archivo en almacenamiento temporal con nombre único → ejecuta el pipeline ETL (Extract → Validate → Transform → Load) → registra el intento en `upload_logs` y `audit_logs` → borra el archivo temporal → responde con el resumen.

| Endpoint | Formato | Tabla destino |
|---|---|---|
| `POST /uploads/data` | `.csv` (separador `;`) | `fact_audiencia` |
| `POST /uploads/keywords` | `.xlsx` | `fact_keywords` |
| `POST /uploads/split-sense` | `.xlsx` | `fact_sentimiento` |
| `POST /uploads/auspicios` | `.xlsx` (hoja `AUSPICIOS`) | `dim_auspicios` |

**Response 201** (éxito — incluso si algunas filas se rechazaron individualmente):
```json
{
  "file_type": "DATA",
  "original_filename": "audiencia_julio.csv",
  "rows_total": 120,
  "rows_loaded": 118,
  "rows_skipped": 2,
  "status": "success",
  "error_message": null,
  "upload_log_id": "b6a6...",
  "rejected": [
    { "row_index": 41, "reason": "El valor 'treinta' de 'Vistas_Diarias' no es un int válido", "raw_data": { "...": "..." } }
  ]
}
```

**Errores** (siempre con el mismo resumen embebido en el body, incluido `rows_total`/`rejected` cuando aplica):
| Status | code | Motivo |
|---|---|---|
| 401 | `TOKEN_INVALID` | No autenticado |
| 403 | `INSUFFICIENT_ROLE` | Rol distinto de admin |
| 413 | `FILE_TOO_LARGE` | Archivo > 10 MB — se detecta mientras se transmite, sin llegar a guardarlo completo |
| 422 | `ETL_ERROR` | Rechazo de **todo** el archivo: columnas requeridas faltantes, encoding no UTF-8 (CSV), o el contenido real no coincide con la extensión declarada (verificación de magic bytes en `.xlsx`) |

Nota: un rechazo por fila (tipo de dato inválido, programa desconocido, etc.) **no** hace fallar el archivo completo — el resto de filas válidas se cargan igual (`status: "success"` con `rows_skipped > 0`); solo un problema estructural del archivo entero produce `422`.

### GET /api/v1/uploads/history

Query params: `?file_type={DATA|KEYWORDS|SPLIT_SENSE|AUSPICIOS}&page=1&page_size=50`. Lista paginada, más recientes primero.

```json
{
  "items": [
    {
      "id": "b6a6...", "file_type": "DATA", "original_filename": "audiencia_julio.csv",
      "status": "success", "rows_total": 120, "rows_loaded": 118, "rows_skipped": 2,
      "uploaded_by": { "id": "...", "email": "admin@podpulse.pe", "full_name": "Administrador PodPulse" },
      "started_at": "2026-07-05T10:00:00Z", "completed_at": "2026-07-05T10:00:03Z"
    }
  ],
  "page": 1, "page_size": 50, "total": 1
}
```

### GET /api/v1/uploads/{upload_id}

Igual que un ítem del historial, más `error_detail` (las filas rechazadas con su motivo, o el error estructural si `status: "error"`). `404 RESOURCE_NOT_FOUND` si el id no existe.

---

## 3. Administración de Usuarios (`/api/v1/admin/users`)

Rol requerido en todos: **admin**. No hay auto-registro — todo usuario (Interno/Cliente, u otro Admin) lo crea un Admin existente.

### GET /api/v1/admin/users

Query params: `?role={admin|interno|cliente}&is_active={true|false}&page=1&page_size=50`.

### POST /api/v1/admin/users

```json
{ "email": "interno@podpulse.pe", "full_name": "Nombre Apellido", "role": "interno", "password": "Clave123" }
```
Misma política de contraseña que `change-password`. `409 RESOURCE_EXISTS` si el email ya está registrado.

### GET /api/v1/admin/users/{user_id}

`404 RESOURCE_NOT_FOUND` si no existe.

### PUT /api/v1/admin/users/{user_id}

Actualiza `email`, `full_name` y `role` (la contraseña se cambia únicamente vía `/auth/change-password`, no aquí).

```json
{ "email": "interno@podpulse.pe", "full_name": "Nombre Nuevo", "role": "cliente" }
```

**Errores**: `409 RESOURCE_EXISTS` (email ya usado por otro usuario) / `400 CANNOT_CHANGE_OWN_ROLE` (TDD §5.3: un Admin no puede cambiar el rol de su propia cuenta, para evitar auto-degradarse por error — sí puede actualizar su propio email/nombre).

### PATCH /api/v1/admin/users/{user_id}/toggle-active

Alterna `is_active` (activar/desactivar) — no hay borrado físico de usuarios (TDD §5.3). Un usuario desactivado recibe `401 TOKEN_INVALID` en cualquier request, incluido intentar hacer login, aunque su contraseña siga siendo correcta.

Toda acción administrativa (`USER_CREATE`, `USER_UPDATE`, `USER_ACTIVATE`, `USER_DEACTIVATE`) queda en `audit_logs` con el id del Admin que la ejecutó.

---

## 4. Dashboard (`/api/v1/dashboard`)

Rol requerido en **todos** estos endpoints: **cualquier usuario autenticado** (admin/interno/cliente — TDD §5.1: "todos los roles ven la misma información", sin segmentación de datos por rol). Todas las fórmulas replican las medidas DAX del dashboard Power BI original documentadas en `docs/PODPULSE_Documentacion_Migracion.docx` §4 — ver referencia cruzada en los docstrings de `app/repositories/dashboard_repository.py`.

Parámetro común a casi todos: `?fecha_inicio&fecha_fin` (ambos opcionales; `422 VALIDATION_ERROR` si `fecha_inicio > fecha_fin`).

### GET /dashboard/kpis
`?fecha_inicio&fecha_fin&programa&canal` → `{vistas_totales, engagement_rate, likes, comentarios, emisiones}`. `engagement_rate` es una **fracción 0-1** (no un porcentaje ya multiplicado por 100) — mismo criterio que `score_positivo/negativo/neutral`. `emisiones` = cantidad de días con `es_emision=true` en el rango (medida DAX `Emisiones = SUM(Es_Emision)`).

### GET /dashboard/sentiment-kpis
`?fecha_inicio&fecha_fin&programa` → `{pct_positivo, pct_negativo, pct_neutral}` (fracciones 0-1). `fact_sentimiento` solo tiene grano (año, mes) — el rango de fechas se aplica sobre el primer día de cada mes.

### GET /dashboard/auspicios
`?programa&mes` → `[{auspiciador}]`, sin duplicados. Nota: el contrato del TDD no incluye `anio` para este endpoint (se sigue literalmente).

### GET /dashboard/evolutivo
`?fecha_inicio&fecha_fin&granularidad={anio|mes|semana|dia}&metrica_secundaria={emisiones|busquedas}&programa&canal` → `[{periodo, vistas_totales, metrica_secundaria}]`. Reemplaza la medida DAX "KPI Vistas Promedio Dinámico" (que el propio TDD marcó como lógica frágil, basada en `CONTAINSSTRING` sobre texto) por un switch explícito sobre un enum — agrupa siempre por columnas ya materializadas en el ETL (`anio`/`mes_num`/`semana_num`), nunca recalculando fecha en SQL. Formato de `periodo`: `dia`→`YYYY-MM-DD`, `semana`→`YYYY-Wnn`, `mes`→`YYYY-MM`, `anio`→`YYYY`.

### GET /dashboard/ranking/programas y /dashboard/ranking/canales
`?fecha_inicio&fecha_fin&canal&tipo&limit=20` (programas) / `?fecha_inicio&fecha_fin&limit=20` (canales) → `[{programa, canal, vistas_totales, ranking}]` / `[{canal, vistas_totales, ranking}]`. `ranking` usa `DENSE_RANK()` (equivalente exacto a `RANKX ... Dense` en la medida DAX original) — los empates comparten el mismo puesto y el siguiente valor no deja huecos.

### GET /dashboard/canal/{canal_id}/programas y /dashboard/canal/{canal_id}/live-stats
`?fecha_inicio&fecha_fin&categoria` (solo `/programas`) → `[{programa, vistas, pico_max, promedio_vivo}]` / `{pico_max_vivo, promedio_vivo}`.

**Supuesto documentado (⚠️ no confirmado con el usuario, revisar si no aplica):**
- **`canal_id` es el nombre del canal**, no un id numérico — el esquema aprobado (TDD §7.2) no tiene una tabla `dim_canal` propia (`canal` es una columna de texto en `dim_programa`), así que no existe un ID numérico real que usar en la URL. Se documenta así para que sea explícito y transparente.
- **`pico_max` = `MAX(pico_max_vivo)`** — confirmado literalmente en `Doc-Migración §5.2`: *"PICO MAX EN VIVO: MAX de DATA[Pico Max]"*.
- **`promedio_vivo` = `AVG(promedio_vivo)`** — a diferencia de `pico_max`, la Doc-Migración **no** documenta una medida DAX explícita para este agregado (no está en la lista de 15 medidas de §4); solo aparece como una tarjeta de KPI sin fórmula. Se interpretó como `AVG` (promedio de un valor que ya es en sí mismo "audiencia promedio durante el vivo" por fila) porque sumar varios promedios diarios produciría una magnitud sin sentido de negocio. Si la intención original era otra (`SUM`, último valor, etc.), avisar para corregirlo — es un cambio de una línea en `dashboard_repository.py`.

### GET /dashboard/keywords
`?programa&mes&sentimiento={positivo|negativo|neutral|todos}&limit=100` → `[{hashtag, occurrences, sentimiento}]`, ordenado por `occurrences` DESC (tamaño de palabra en la nube original). Sin filtro de año, igual que `/auspicios` — el contrato del TDD no lo incluye.

### GET /dashboard/sentimiento/evolutivo
`?programa&fecha_inicio&fecha_fin` → `[{mes, pct_positivo, pct_negativo, pct_neutral}]`, un punto por mes (formato `YYYY-MM`).

## 5. Filtros (`/api/v1/filters`)

Rol requerido: cualquier usuario autenticado. Alimentan los selectores de la UI (fecha, programa, canal, categoría).

| Endpoint | Response |
|---|---|
| `GET /filters/programas` | `["Programa A", "Programa B", ...]` |
| `GET /filters/canales` | `["Canal X", "Canal Y", ...]` |
| `GET /filters/categorias` | `["Conversacional", "Deportes", ...]` |
| `GET /filters/periodos` | `{"fecha_min": "2026-01-01", "fecha_max": "2026-06-30"}` |

## Nota de diseño: optimización de consultas del dashboard

Todas las consultas se resuelven en una sola sentencia agregada en Postgres (SQL con `GROUP BY`/`DENSE_RANK() OVER (...)`), nunca cargando filas a Python para sumar/promediar ahí. Se añadió el índice `ix_fact_audiencia_fecha` (columna `fecha` sola) porque es el filtro presente en casi todos los endpoints y los índices previos (`(anio, mes_num)`, `(anio, semana_num)`) no cubren un rango de fechas arbitrario dentro de un mismo mes/semana. Verificado con `EXPLAIN (ANALYZE, BUFFERS)` contra la base de desarrollo real (Supabase): las consultas de KPIs, evolutivo y ranking usan `Index Scan`/`Bitmap Index Scan` sobre `ix_fact_audiencia_fecha` en vez de un `Seq Scan`. No se implementó caché (Redis) — ver nota de diseño "sin Redis" más abajo; con el volumen de datos esperado (analítica de un solo mercado, no a escala de internet) los índices son suficientes.

## Nota: datos de muestra en la base de desarrollo

Para validar las queries de este módulo se insertaron ~1000 filas de datos sintéticos (8 programas de prueba, todos con el prefijo `TEST_DASH_`, en `dim_programa`/`fact_audiencia`/`fact_keywords`/`fact_sentimiento`/`dim_auspicios` de la Supabase de **desarrollo**). Quedan ahí deliberadamente para que puedas explorar `/docs` con datos reales mientras no subas archivos propios. Para borrarlos (las FK de `fact_*`/`dim_auspicios` hacia `dim_programa` son `ON DELETE RESTRICT`, así que hay que borrar los hijos antes que el programa):

```sql
DELETE FROM fact_audiencia WHERE programa_id IN (SELECT id FROM dim_programa WHERE nombre LIKE 'TEST_DASH_%');
DELETE FROM fact_keywords WHERE programa_id IN (SELECT id FROM dim_programa WHERE nombre LIKE 'TEST_DASH_%');
DELETE FROM fact_sentimiento WHERE programa_id IN (SELECT id FROM dim_programa WHERE nombre LIKE 'TEST_DASH_%');
DELETE FROM dim_auspicios WHERE programa_id IN (SELECT id FROM dim_programa WHERE nombre LIKE 'TEST_DASH_%');
DELETE FROM dim_programa WHERE nombre LIKE 'TEST_DASH_%';
```

---

## Autenticación en endpoints protegidos

Enviar el access_token en cada request:
```
Authorization: Bearer <access_token>
```

El backend re-valida en cada request que el usuario siga activo en BD (no solo el claim `is_active` del JWT) — un usuario desactivado recibe `401 TOKEN_INVALID` aunque su access_token no haya expirado todavía.

## Roles

`admin` | `interno` | `cliente` (ver `app/models/enums.py::UserRole`). Los endpoints de carga de archivos y administración de usuarios usan `Depends(require_admin)`; los endpoints de dashboard y filtros usan `Depends(require_authenticated)` (ver `app/dependencies/auth.py`), ya que todos los roles ven la misma información (TDD §5.1). Cualquier dependencia de rol devuelve `403 INSUFFICIENT_ROLE` si el usuario autenticado no califica.

## Primer usuario Admin

No hay endpoint de registro. El primer Admin se crea con el script de seed (TDD §5.3):

```powershell
cd backend
$env:SEED_ADMIN_EMAIL = "admin@podpulse.pe"
$env:SEED_ADMIN_PASSWORD = "CambiaEsto123"
$env:SEED_ADMIN_FULL_NAME = "Administrador PodPulse"
.\.venv\Scripts\python.exe scripts\seed_admin.py
```

Es idempotente: si el email ya existe, no hace nada.

## Nota de diseño: almacenamiento de archivos sin Docker

El TDD (§6.2) prevé un volumen Docker para el almacenamiento temporal de archivos subidos. Sin Docker en esta fase, se usa disco local (`UPLOAD_STORAGE_DIR`, por defecto `backend/storage/uploads/`, no versionado). Cada archivo se borra inmediatamente después de procesarse (éxito o rechazo) — el dato ya vive en Postgres y `upload_logs.error_detail` conserva el detalle de cualquier fila rechazada, así que no hace falta retener el archivo crudo para auditoría.

También se agregó una verificación de "magic bytes" para `.xlsx` (firma ZIP `PK\x03\x04`) como sustituto de `python-magic`/libmagic (TDD §9.3), que no tiene una instalación confiable sin Docker en Windows — ver `app/etl/readers.py`.

## Nota de diseño: sin Redis

El TDD especifica Redis para la blacklist de refresh tokens y el rate-limit de login. El entorno de desarrollo actual no tiene Docker ni Redis disponible (ver `database/README.md`), así que esta fase implementa ambos mecanismos contra PostgreSQL: tabla `revoked_tokens` (blacklist por `jti`) y conteo de eventos `LOGIN_FAIL` en `audit_logs` (rate-limit). Redis queda para cuando se implemente el caché del dashboard (Fase 3 del TDD), donde sí aporta valor real (TTLs de caché de queries).

\* `Secure` en la cookie de refresh token se controla con `COOKIE_SECURE` (`.env`) — `false` en desarrollo local sobre HTTP, `true` obligatorio en producción (HTTPS).
