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

**Errores**: `401 INVALID_CREDENTIALS` (contraseña actual incorrecta) / `422` si `new_password` no cumple la política / `403 INSUFFICIENT_ROLE` si el usuario autenticado es rol **cliente** (Fase 10 §Módulo 4: el rol Cliente no gestiona sus propias credenciales — solo el Admin puede fijarle una contraseña, ver `POST /admin/users/{id}/set-password`). El rol Interno conserva el autoservicio.

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

Query params: `?role={admin|interno|cliente}&is_active={true|false}&client_id={uuid}&page=1&page_size=50`. `role` es repetible (`?role=admin&role=interno`) para pedir varios roles a la vez — usado por el panel de administración para separar "Equipo" (`admin`+`interno`) de "Usuarios" (`cliente`), ver Fase 10 §Módulos 2 y 4. `client_id` filtra por la empresa asignada (solo aplica a usuarios rol `cliente`).

### POST /api/v1/admin/users

```json
{
  "email": "interno@podpulse.pe", "full_name": "Nombre Apellido", "role": "interno",
  "password": "Clave123", "cargo": "Analista de Datos", "client_id": null
}
```
`cargo` (Fase 10 §Módulo 2) y `client_id` (Fase 10 §Módulo 3/4) son opcionales — `cargo` tiene sentido para `admin`/`interno`, `client_id` para `cliente` (no hay validación cruzada estricta a nivel de esquema, es responsabilidad del frontend mostrar el campo correcto según el rol elegido). Misma política de contraseña que `change-password`. `409 RESOURCE_EXISTS` si el email ya está registrado.

### GET /api/v1/admin/users/{user_id}

`404 RESOURCE_NOT_FOUND` si no existe.

### PUT /api/v1/admin/users/{user_id}

Actualiza `email`, `full_name`, `role`, `cargo` y `client_id` (la contraseña se cambia vía `/auth/change-password` — autoservicio, solo Interno — o `POST .../set-password` — Admin, ver abajo).

```json
{ "email": "interno@podpulse.pe", "full_name": "Nombre Nuevo", "role": "cliente", "cargo": null, "client_id": "8e55..." }
```

**Errores**: `409 RESOURCE_EXISTS` (email ya usado por otro usuario) / `400 CANNOT_CHANGE_OWN_ROLE` (TDD §5.3: un Admin no puede cambiar el rol de su propia cuenta, para evitar auto-degradarse por error — sí puede actualizar su propio email/nombre).

### PATCH /api/v1/admin/users/{user_id}/toggle-active

Alterna `is_active` (activar/desactivar) — no hay borrado físico de usuarios (TDD §5.3). Un usuario desactivado recibe `401 TOKEN_INVALID` en cualquier request, incluido intentar hacer login, aunque su contraseña siga siendo correcta.

### POST /api/v1/admin/users/{user_id}/set-password

Fase 10 §Módulo 4. El Admin fija la contraseña directamente (no requiere conocer la actual, a diferencia de `/auth/change-password`) — es la única vía de gestión de credenciales para el rol Cliente, que no tiene autoservicio.

```json
{ "password": "NuevaClave456" }
```
Misma política de contraseña. `404 RESOURCE_NOT_FOUND` si el usuario no existe.

Toda acción administrativa (`USER_CREATE`, `USER_UPDATE`, `USER_ACTIVATE`, `USER_DEACTIVATE`, `USER_PASSWORD_RESET`) queda en `audit_logs` con el id del Admin que la ejecutó.

---

## 3.5. Administración de Clientes (`/api/v1/admin/clients`) — Fase 10 §Módulo 3

Rol requerido: **admin** en todos, salvo el `GET .../logo` (público, ver abajo). Un "cliente" es una empresa — puramente administrativo, agrupa usuarios rol `cliente` para gestión: **no filtra los datos que ve el dashboard principal** (todos los roles siguen viendo la misma información, ver constitución del proyecto).

| Endpoint | Descripción |
|---|---|
| `GET /admin/clients` | Lista paginada, filtrable por `is_active` y `search` (nombre, `ILIKE`). Cada ítem incluye `user_count` (cantidad de usuarios asignados). |
| `POST /admin/clients` | `{ "name": "Empresa S.A." }` |
| `GET /admin/clients/{id}` | `404 RESOURCE_NOT_FOUND` si no existe. |
| `PUT /admin/clients/{id}` | `{ "name": "Nuevo Nombre" }` |
| `PATCH /admin/clients/{id}/toggle-active` | Alterna `is_active` — mismo criterio que usuarios (sin borrado físico). |
| `POST /admin/clients/{id}/logo` | `multipart/form-data`, campo `file`. Acepta PNG/JPEG/WEBP hasta 2 MB, validado por **firma binaria real** (no por extensión declarada, ver `app/services/client_service.py::_detect_extension`). `413` si supera 2 MB, `422 VALIDATION_ERROR` si el contenido no es una imagen válida. |
| `GET /admin/clients/{id}/logo` | Sirve el archivo del logo directamente. **Sin autenticación**: un logo de empresa no es información sensible y el id es un UUID no adivinable — permite usarlo tal cual en un `<img src>` sin resolver fetch-with-auth en el frontend. `404` si el cliente no existe o no tiene logo cargado. |
| `GET /admin/clients/{id}/users` | Usuarios (rol `cliente`) con `client_id` igual a este cliente — mismo formato que `GET /admin/users`. |

Asignar/quitar un usuario de un cliente se hace desde `PUT /admin/users/{id}` (campo `client_id`), no hay un endpoint separado para la dirección inversa.

`CLIENT_LOGO_STORAGE_DIR` (`.env`, por defecto `backend/storage/client_logos/`): a diferencia de `UPLOAD_STORAGE_DIR`, estos archivos **se conservan** (no son un insumo transitorio de un ETL).

Acciones auditadas: `CLIENT_CREATE`, `CLIENT_UPDATE`, `CLIENT_ACTIVATE`, `CLIENT_DEACTIVATE`, `CLIENT_LOGO_UPDATE`.

## 3.6. Dashboard del Sistema (`/api/v1/admin/system`) — Fase 10 §Módulo 1

### GET /api/v1/admin/system/summary

Rol requerido: **admin**.

```json
{
  "api_status": "ok",
  "database_status": "ok",
  "overall_status": "ok",
  "total_clientes": 12,
  "total_usuarios": 34,
  "total_equipo": 5,
  "last_upload": { "id": "...", "file_type": "DATA", "status": "success", "...": "..." },
  "last_update_at": "2026-07-12T18:03:00Z"
}
```
`database_status` es un `SELECT 1` real contra Supabase (no un chequeo superficial, a diferencia de `GET /health`). `total_usuarios` cuenta rol `cliente`; `total_equipo` cuenta `admin`+`interno`; `total_clientes` cuenta empresas **activas**. `last_upload` es el intento de carga más reciente sin importar el resultado; `last_update_at` es el `completed_at` de la carga **exitosa** más reciente (cuándo se refrescaron por última vez los datos que ve el dashboard principal) — son conceptos distintos a propósito.

---

## 3.7. Asistente de IA (`/api/v1/assistant`) — Módulo IA (extensión del TDD)

Widget flotante de chat en lenguaje natural sobre los datos del dashboard. **No forma parte del TDD v1.0** — es una extensión de alcance aprobada explícitamente por el usuario (ver nota de diseño "Fase 10 amplía el TDD v1.0" para el precedente de este tipo de extensión).

### POST /api/v1/assistant/chat

Rol requerido: **admin** (único rol habilitado por ahora — decisión explícita de alcance, no una limitación técnica).

```json
// Request
{ "messages": [{ "role": "user", "content": "¿Qué programa tuvo más vistas?" }] }

// Response 200
{ "reply": "Hablando Huevadas, con 258.9M de vistas totales.", "tools_used": ["obtener_ranking_programas"] }
```

**Sin historial en base de datos** (decisión explícita de alcance): el endpoint es *stateless* — el frontend manda el hilo completo de la conversación en cada request (hasta 40 turnos, 4000 caracteres c/u); no hay tabla ni migración nueva para esto.

**Motor**: Google Gemini (`gemini-flash-latest`, tier gratuito — decisión explícita de costo). La API key vive en `GEMINI_API_KEY` (backend, nunca en el frontend).

**Datos reales vía tool-use, nunca SQL directo**: el modelo no tiene acceso a la base — solo puede invocar un set fijo de herramientas (`app/services/assistant_tools.py`) que son envoltorios delgados sobre funciones ya existentes y testeadas de `dashboard_service`: `obtener_kpis`, `obtener_ranking_programas`, `obtener_evolutivo`, `listar_filtros_disponibles`, `obtener_sentimiento`, `obtener_keywords`, `obtener_auspicios_programa`, `buscar_programas_por_auspiciador`, `obtener_top_auspiciadores`, `obtener_horario_audiencia`. Así el asistente nunca ve más de lo que ya ve cualquier usuario en el dashboard, y no hay superficie de inyección SQL. `obtener_horario_audiencia` replica en Python exactamente la misma agregación (día de semana × hora) que usa el panel "Horario de Mayor Audiencia" del frontend (`horarioAudiencia.ts`), para que el asistente nunca dé una respuesta distinta a la que el usuario vería en pantalla.

**Errores**: `503 ASSISTANT_NOT_CONFIGURED` si falta `GEMINI_API_KEY`; `503 ASSISTANT_UNAVAILABLE` si Gemini no responde (se reintenta automáticamente ante 429/503 transitorios del proveedor antes de fallar).

---

## 4. Dashboard (`/api/v1/dashboard`)

Rol requerido en **todos** estos endpoints: **cualquier usuario autenticado** (admin/interno/cliente — TDD §5.1: "todos los roles ven la misma información", sin segmentación de datos por rol). Todas las fórmulas replican las medidas DAX del dashboard Power BI original documentadas en `docs/PODPULSE_Documentacion_Migracion.docx` §4 — ver referencia cruzada en los docstrings de `app/repositories/dashboard_repository.py`.

Parámetro común a casi todos: `?fecha_inicio&fecha_fin` (ambos opcionales; `422 VALIDATION_ERROR` si `fecha_inicio > fecha_fin`).

### GET /dashboard/kpis
`?fecha_inicio&fecha_fin&programa&canal&categoria` → `{vistas_totales, engagement_rate, likes, comentarios, emisiones, pico_max_vivo, promedio_vivo}`. `engagement_rate` es una **fracción 0-1** (no un porcentaje ya multiplicado por 100) — mismo criterio que `score_positivo/negativo/neutral`. `emisiones` = `SUM(Es_Emision)` en el rango (medida DAX `Emisiones = SUM(Es_Emision)`) — `Es_Emision` es un conteo de emisiones por día (puede ser >1), no un booleano. `pico_max_vivo`/`promedio_vivo` = `MAX(Pico Max)`/`AVG(Promedio en Vivo)`, respetando `programa` + `canal` + `categoria` + fechas igual que el resto de KPIs de este endpoint. `categoria` filtra por `dim_programa.categoria` (nombre exacto), igual que `canal`.

### GET /dashboard/sentiment-kpis
`?fecha_inicio&fecha_fin&programa` → `{pct_positivo, pct_negativo, pct_neutral}` (fracciones 0-1). `fact_sentimiento` solo tiene grano (año, mes) — un mes se incluye si se solapa con `[fecha_inicio, fecha_fin]` (no solo si el día 1 del mes cae dentro del rango), así que un rango parcial dentro de un mes (p. ej. 10-20 de abril) igual trae los datos de ese mes completo.

### GET /dashboard/auspicios
`?programa&mes` → `[{auspiciador, mes_num, mes_nombre}]`, sin duplicados (una fila por auspiciador+mes). `mes_num`/`mes_nombre` se agregaron para que el frontend pueda agrupar auspiciadores por mes cuando no se filtra un mes específico (antes solo se devolvía `auspiciador`). Nota: el contrato del TDD no incluye `anio` para este endpoint (se sigue literalmente).

### GET /dashboard/auspicios/buscar
`?q` (mínimo 2 caracteres) → `[{programa, canal, auspiciador, mes_num, mes_nombre}]`. Búsqueda inversa a `/auspicios`: dado un texto de marca (ej. `BCP`), devuelve los programas/canales donde aparece como auspiciador — coincidencia parcial, case-insensitive (`ILIKE %q%`), sin filtro de fecha en el backend (el frontend recorta por mes en el cliente, igual que `/auspicios` con rango multi-mes).

### GET /dashboard/auspicios/top
`?limit=5` (1-50) → `[{auspiciador, cantidad_programas}]`, ordenado por `cantidad_programas` DESC. Ranking global de auspiciadores por cantidad de programas distintos en los que aparecen — sobre todo el dataset, sin filtrar por programa ni fecha (`dim_auspicios` no tiene columna de año, igual que `/auspicios`). Usado en el panel Auspicios como contenido de reemplazo mientras no se eligió un programa (antes ese estado solo mostraba un aviso).

### GET /dashboard/evolutivo
`?fecha_inicio&fecha_fin&granularidad={anio|mes|semana|dia}&metrica_secundaria={emisiones|busquedas}&programa&canal&categoria&incluir_forecast` → `[{periodo, vistas_totales, metrica_secundaria, es_proyectado}]`. Reemplaza la medida DAX "KPI Vistas Promedio Dinámico" (que el propio TDD marcó como lógica frágil, basada en `CONTAINSSTRING` sobre texto) por un switch explícito sobre un enum — agrupa siempre por columnas ya materializadas en el ETL (`anio`/`mes_num`/`semana_num`), nunca recalculando fecha en SQL. Formato de `periodo`: `dia`→`YYYY-MM-DD`, `semana`→`YYYY-Wnn`, `mes`→`YYYY-MM`, `anio`→`YYYY`. `categoria` filtra por `dim_programa.categoria` (nombre exacto), igual que `canal`.

**`incluir_forecast` (excepción deliberada a "todos los roles ven la misma información" — ver [[podpulse-project-constitution]]):** agrega puntos proyectados (`es_proyectado=true`, `metrica_secundaria=null`) desde el último período real hasta el 31/12 de ese mismo año, **solo cuando `granularidad` es `semana` o `mes`** (a nivel `dia` sería demasiado ruidoso como horizonte; a nivel `anio` no hay sub-puntos que proyectar dentro del propio año) — con otra granularidad el flag no tiene efecto. Solo tiene efecto real para rol **Admin**; para Interno/Cliente el backend lo ignora silenciosamente (nunca 403 — el chart sigue funcionando igual, solo sin la proyección). Método: regresión lineal ponderada por recencia sobre `vistas_totales` de los puntos reales ya devueltos (`app/services/forecast_service.py`), sin componente estacional — se necesitarían ≥2 ciclos anuales completos de historia para ajustar una estacionalidad sin arriesgar inventar un patrón que el dato todavía no sustenta. Requiere un mínimo de 4 puntos reales; si hay menos, no se agrega nada (mismo resultado que con el flag apagado). Se recalcula en cada request — no hay tabla ni job de forecast, así que cada carga semanal de datos nueva mueve el punto de corte automáticamente.

### GET /dashboard/ranking/programas
`?fecha_inicio&fecha_fin&canal&tipo&formato&limit=20&q&programa_asegurado&categoria` → `[{programa, canal, tipo, vistas_totales, ranking}]`. `ranking` usa `DENSE_RANK()` (equivalente exacto a `RANKX ... Dense` en la medida DAX original), calculado sobre el total de programas que matchean los filtros — el recorte por `limit` se aplica por *valor* de `ranking` (`ranking <= limit`), no por cantidad de filas, así que nunca corta un grupo de empatados a la mitad y el `ranking` devuelto siempre es la posición real. `tipo` (`podcast`/`programa`/`null`) se incluye en cada item además de servir como filtro, para que el consumidor pueda distinguir/colorear por tipo sin tener que hacer una llamada por cada valor. `formato` filtra por `DATA[Formato]` (valores reales: `Grabado`, `Vivo`, `Finalizado` — sin normalizar ni agrupar, se pasa tal cual a la columna). `q` (mínimo 2 caracteres) busca por texto parcial case-insensitive sobre `programa` — necesario porque la base tiene 1000+ programas y `limit` tiene un tope de 100, así que sin `q` no hay forma de encontrar/seleccionar un programa fuera del top 100 por vistas. `programa_asegurado` (nombre exacto) garantiza que ese programa viaje en la respuesta aunque quede fuera del top `limit` — usado para resaltar en el ranking el programa elegido en el filtro superior del dashboard sin perder el resto del top N como contexto de comparación. `categoria` filtra por `dim_programa.categoria` (nombre exacto), igual que `canal`.

### GET /dashboard/keywords
`?programa&mes&sentimiento={positivo|negativo|neutral|todos}&limit=100` → `[{hashtag, occurrences, sentimiento}]`, ordenado por `occurrences` DESC (tamaño de palabra en la nube original). `mes` acepta uno o varios valores (`?mes=4&mes=5`) — con varios meses, `occurrences` es la suma del período combinado antes de sacar el top (no el top de un solo mes del rango). Sin filtro de año, igual que `/auspicios` — el contrato del TDD no lo incluye.

### GET /dashboard/sentimiento/evolutivo
`?programa&fecha_inicio&fecha_fin` → `[{mes, pct_positivo, pct_negativo, pct_neutral}]`, un punto por mes (formato `YYYY-MM`).

## 5. Filtros (`/api/v1/filters`)

Rol requerido: cualquier usuario autenticado. Alimentan los selectores de la UI (fecha, programa, canal, categoría).

| Endpoint | Response |
|---|---|
| `GET /filters/programas` | `["Programa A", "Programa B", ...]` |
| `GET /filters/canales` | `["Canal X", "Canal Y", ...]` |
| `GET /filters/categorias` | `["Cat1", "Cat2", ...]` — excluye `NULL` (`categoria` es nullable en `dim_programa`, a diferencia de `canal`) |
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

## Nota de diseño: Fase 10 amplía el TDD v1.0

El TDD v1.0 (`docs/PODPULSE_TDD_v1.0.docx`) define su plan de fases hasta la Fase 7 (Despliegue Producción) y no contempla un Panel de Administración ni la entidad "Cliente" como empresa (en el TDD, "Cliente" es únicamente un valor de `role`). La Fase 10 — Panel de Administración (Backoffice), documentada en las secciones 3.5 y 3.6 de arriba más los campos `cargo`/`client_id` de la sección 3, es una extensión de alcance aprobada explícitamente por el usuario, no una desviación silenciosa del TDD. Queda registrada acá como la fuente de verdad de este alcance nuevo hasta que se actualice el propio TDD.

## Nota de diseño: sin Redis

El TDD especifica Redis para la blacklist de refresh tokens y el rate-limit de login. El entorno de desarrollo actual no tiene Docker ni Redis disponible (ver `database/README.md`), así que esta fase implementa ambos mecanismos contra PostgreSQL: tabla `revoked_tokens` (blacklist por `jti`) y conteo de eventos `LOGIN_FAIL` en `audit_logs` (rate-limit). Redis queda para cuando se implemente el caché del dashboard (Fase 3 del TDD), donde sí aporta valor real (TTLs de caché de queries).

\* `Secure` en la cookie de refresh token se controla con `COOKIE_SECURE` (`.env`) — `false` en desarrollo local sobre HTTP, `true` obligatorio en producción (HTTPS).
