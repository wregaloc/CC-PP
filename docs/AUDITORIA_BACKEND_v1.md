# Auditoría Técnica del Backend — PodPulse (previa al frontend)

> **Adenda (2026-07-05, post-aprobación)**: el usuario aprobó los resultados de esta auditoría y autorizó explícitamente el refactor de Unit of Work del hallazgo §3.1. Se implementó (ver §3.1 actualizado) y la suite completa (117 tests) sigue en verde. Los hallazgos §3.2 (IP tras reverse proxy) y §3.3 (`DEBUG` en producción) se mantienen pendientes/documentados tal como se decidió — no se implementan hasta que exista la infraestructura de despliegue (NGINX) correspondiente.

**Fecha**: 2026-07-05
**Alcance**: todo el código de `backend/app/` implementado hasta ahora (Auth, Módulo Administrativo — uploads/ETL/gestión de usuarios —, y API de Dashboard), más migraciones de Alembic, configuración y suite de tests.
**Metodología**: lectura completa y directa de los ~55 archivos de `backend/app/` (no por muestreo), contraste contra `docs/PODPULSE_TDD_v1.0.docx` y `docs/PODPULSE_Documentacion_Migracion.docx`, verificación de planes de ejecución SQL (`EXPLAIN ANALYZE`), verificación de deriva esquema↔modelos (`alembic check`), lint (`ruff`) y suite de tests completa (`pytest`) antes y después de los cambios.
**Regla seguida**: no se implementó ninguna funcionalidad nueva. Todo cambio de este documento es una corrección de un problema real y verificado — no una preferencia de estilo.

---

## 1. Resumen ejecutivo

Se revisó el backend contra las 20 dimensiones solicitadas. El diseño general es sólido: separación por capas consistente, tipado estricto, sin SQL injection, migraciones sincronizadas con los modelos, RBAC verificado siempre en backend, y una suite de 117 tests que sigue pasando. Se encontraron y corrigieron **6 problemas reales** (1 de severidad Alta, 3 de severidad Media, 2 de severidad Baja) y se documentan **3 hallazgos adicionales** que requieren tu aprobación explícita antes de tocarlos, porque implican una decisión de arquitectura o dependen de infraestructura de despliegue que todavía no existe en este repositorio.

| # | Hallazgo | Severidad | Estado |
|---|---|---|---|
| 1 | Timing side-channel en `/auth/login` permite enumerar emails registrados | **Alto** | ✅ Corregido |
| 2 | `revoked_tokens` crece sin límite (nunca se purgan filas vencidas) | Medio-Alto | ✅ Corregido |
| 3 | Race condition en `get_or_create_programa` (TOCTOU) | Medio | ✅ Corregido |
| 4 | Falta validar `Engagement >= 0` en la carga de DATA | Medio-Bajo | ✅ Corregido |
| 5 | Campos de contraseña sin `max_length` | Medio-Bajo | ✅ Corregido |
| 6 | 5 docstrings desactualizados (afirman "no implementado" de cosas que ya existen) | Bajo | ✅ Corregido |
| 7 | Los repositorios hacen `commit()` internamente → acciones multi-paso no son atómicas | Alto | ✅ Aprobado y corregido (refactor Unit of Work) |
| 8 | `request.client.host` no es confiable detrás de un reverse proxy (rompe el rate-limit en producción) | Medio (futuro) | ⚠️ Pendiente — depende de config. de NGINX aún no creada |
| 9 | `echo=DEBUG` de SQLAlchemy loguearía `password_hash` en claro si alguien pone `DEBUG=true` en producción | Bajo | ⚠️ Nota documentada, ya fail-safe por defecto |

---

## 2. Hallazgos corregidos

### 2.1 [Alto] Timing side-channel en login — enumeración de emails

**Archivo**: `app/services/auth_service.py:54-55` (antes del fix)

**Problema real**: el mensaje de error de `/auth/login` es intencionalmente idéntico para "email no existe", "contraseña incorrecta" y "cuenta desactivada" (`INVALID_CREDENTIALS`), precisamente para no filtrar qué emails están registrados. Pero el código tenía:

```python
user = await user_repository.get_by_email(session, email)
if user is None or not user.is_active or not verify_password(password, user.password_hash):
```

Por el cortocircuito de `or`, cuando `user is None` el intérprete **nunca llega a llamar a `verify_password`** (que ejecuta bcrypt, ~100-300ms con cost=12). Un email inexistente responde en milisegundos; un email existente con contraseña incorrecta responde ~100-300ms más tarde. Un atacante puede medir el tiempo de respuesta y enumerar emails válidos sin que el mensaje de error se lo diga — el mismo problema que el diseño del mensaje de error pretendía evitar, reintroducido por una vía distinta (temporal, no textual).

**Por qué es real y no especulativo**: es una categoría de vulnerabilidad reconocida (user enumeration via timing), y el propio código ya declaraba la intención de prevenir la enumeración de emails — este bug la reabre.

**Corrección aplicada**: se agregó una constante `_DUMMY_PASSWORD_HASH` (un hash bcrypt válido de una contraseña señuelo, calculado una vez al importar el módulo) y ahora `verify_password()` se llama **siempre**, con el hash real si el usuario existe o con el señuelo si no, antes de evaluar cualquier condición:

```python
password_hash = user.password_hash if user is not None else _DUMMY_PASSWORD_HASH
password_valid = verify_password(password, password_hash)
if user is None or not user.is_active or not password_valid:
```

El tiempo de respuesta ahora es equivalente exista o no el email.

---

### 2.2 [Medio-Alto] `revoked_tokens` crece indefinidamente

**Archivo**: `app/repositories/revoked_token_repository.py:10-12` (antes del fix)

**Problema real**: cada logout inserta una fila en `revoked_tokens` (la blacklist de refresh tokens, alternativa a Redis en este entorno). La tabla tiene una columna `expires_at` diseñada explícitamente para poder purgar filas vencidas (el propio docstring del modelo `RevokedToken` ya lo decía), pero ningún código llamaba nunca a un `DELETE` — la tabla iba a crecer para siempre, una fila por cada logout de la vida del sistema.

**Por qué es real**: es una fuga de recursos verificable (no especulativa): a más uso, más filas, sin límite ni mecanismo de limpieza, contradiciendo el propio diseño documentado de la tabla.

**Corrección aplicada**: `revoke()` ahora purga oportunistamente las filas ya vencidas antes de insertar la nueva, aprovechando que ya escribe en esa tabla en cada logout (no se creó un job/cron nuevo — no hay infraestructura de scheduling en este entorno y habría sido una funcionalidad nueva, no una corrección):

```python
await session.execute(delete(RevokedToken).where(RevokedToken.expires_at < datetime.now(UTC)))
session.add(RevokedToken(jti=jti, expires_at=expires_at))
```

---

### 2.3 [Medio] Race condition en `get_or_create_programa`

**Archivo**: `app/etl/repository.py` (función `get_or_create_programa`)

**Problema real**: el patrón era `SELECT` (¿existe el programa?) → si no existe, `INSERT`. Si dos cargas de archivos se procesan concurrentemente (dos requests distintos, dos sesiones de BD distintas) y ambas referencian un programa nuevo con el mismo nombre, ambas pueden ver "no existe" en el `SELECT` antes de que la otra confirme su `INSERT` — la segunda inserción viola la restricción `UNIQUE(nombre)` con un `IntegrityError` que **no se captura en ningún lugar**, y ese error se propaga como un 500 genérico, haciendo fallar toda la carga del archivo (no solo esa fila).

**Por qué es real**: es una condición de carrera clásica (TOCTOU) sobre una restricción `UNIQUE` real del esquema — no una hipótesis, es directamente reproducible con dos cargas concurrentes del mismo programa nuevo.

**Corrección aplicada**: se reemplazó el `INSERT` plano por `INSERT ... ON CONFLICT (nombre) DO NOTHING RETURNING id`, con un `SELECT` de respaldo si el conflicto ocurrió (la fila ya existe porque la otra transacción la creó primero) — el mismo patrón `ON CONFLICT` que ya se usaba para el resto de upserts de este archivo, así que no introduce un patrón nuevo, solo lo extiende al único lugar que no lo tenía.

---

### 2.4 [Medio-Bajo] Falta validar `Engagement >= 0` en la carga de DATA

**Archivo**: `app/etl/normalizers.py:54-62` (función `prepare_data_row`)

**Problema real**: la fila de DATA valida no-negatividad para `Vistas_Diarias`, `Busquedas_Diarias`, `Likes`, `Comentarios`, `Pico Max` y `Promedio en Vivo` — pero `Engagement` (también una métrica que no tiene sentido de negocio en negativo) se quedó fuera de esa lista, por lo que un archivo con un valor negativo en esa columna se cargaría sin rechazo y distorsionaría silenciosamente el promedio de `engagement_rate` en el dashboard.

**Por qué es real**: es una inconsistencia verificable con el propio patrón que el código ya aplica a sus columnas hermanas — no una regla inventada, sino una omisión respecto de un patrón ya establecido.

**Corrección aplicada**: se agregó `"Engagement"` a la lista de campos validados con `validate_non_negative`.

---

### 2.5 [Medio-Bajo] Campos de contraseña sin `max_length`

**Archivos**: `app/schemas/auth.py` (`LoginRequest.password`, `ChangePasswordRequest.new_password`/`current_password`), `app/schemas/admin_user.py` (`AdminUserCreate.password`)

**Problema real**: los esquemas de contraseña solo declaraban un mínimo, nunca un máximo. Dos consecuencias concretas: (1) bcrypt trunca/rechaza cualquier byte más allá del 72 (de ahí el pin a `bcrypt==4.0.1` en `requirements.txt`), así que un input mucho más largo que eso da una falsa sensación de que "toda" la contraseña importa cuando en realidad bcrypt ignora el resto; (2) un endpoint público como `/auth/login` acepta y hashea con bcrypt (costoso por diseño, cost=12) cualquier string que el cliente mande en `password`, sin límite de tamaño — una entrada de borde razonable a acotar.

**Corrección aplicada**: se agregó `PASSWORD_MAX_LENGTH = 128` en `app/schemas/password_policy.py` (junto al mínimo ya existente) y se aplicó a los 4 campos de contraseña de la API.

---

### 2.6 [Bajo] 5 docstrings desactualizados

**Archivos y líneas**: `app/etl/exceptions.py:3-4`, `app/models/audit_log.py:18-19`, `app/models/upload_log.py:18-19`, `app/db/base.py:8`, `app/etl/models.py:38-39` (numeración antes del fix).

**Problema real**: todos afirmaban literalmente que algo "no está implementado todavía" / "es una fase futura" / "no existe ningún modelo todavía" — cuando esas cosas llevan implementadas desde los módulos de Auth/Admin/Dashboard construidos en sesiones anteriores. Un comentario desactualizado que afirma lo contrario de lo que el código hace es peor que no tener comentario: engaña a quien lo lea después (mantenibilidad).

**Corrección aplicada**: se actualizó cada docstring para que apunte al código real que hoy cumple esa responsabilidad, en vez de declarar que "no existe todavía".

---

## 3. Hallazgos que requerían aprobación

### 3.1 [Alto] ✅ RESUELTO — Los repositorios hacían `commit()` internamente — las acciones multi-paso no eran atómicas

**Dónde**: patrón consistente en **todos** los repositorios de escritura (`user_repository`, `audit_log_repository`, `revoked_token_repository`) — cada función de escritura llamaba a `session.commit()` ella misma.

**Por qué importaba**: cuando un service necesita dos escrituras que conceptualmente son una sola operación (ejemplo real: `auth_service.login()` hacía `update_last_login()` **y luego** `audit_log_repository.record(action="LOGIN_SUCCESS")` — dos `commit()` separados), si el proceso moría entre ambos, el `last_login_at` quedaba actualizado sin su registro de auditoría correspondiente. Lo mismo ocurría en `admin_user_service.create_user()`, `update_user()`, `toggle_active()`.

**Decisión**: aprobado por el usuario. Se implementó el refactor de Unit of Work:

1. `user_repository.py`, `audit_log_repository.py`, `revoked_token_repository.py` ya no llaman `session.commit()`. Solo `user_repository.create()` conserva un `session.flush()` (necesario para poblar `id`/`created_at`, generados por el servidor, antes de que el caller serialice la respuesta) — el resto de funciones de mutación ni siquiera necesitan `flush()` explícito, porque solo modifican atributos de un objeto ya cargado en la sesión.
2. `auth_service.py` y `admin_user_service.py` ahora hacen exactamente **un** `session.commit()` por operación de negocio, después de todas sus escrituras (incluida la de auditoría). En `login()`, los caminos de rechazo (`LOGIN_BLOCKED`, `LOGIN_FAIL`) también commitean antes de lanzar la excepción, para no perder el registro de auditoría de un intento fallido.
3. El módulo ETL (`etl/repository.py`, `etl/pipeline.py`) y `upload_service.py` **ya seguían este patrón desde que se construyeron** — no necesitaron cambios.

**Verificación**: los 117 tests existentes (incluida la suite completa de integración, que ejerce estos flujos vía HTTP real contra Supabase) siguen pasando sin modificar ni un solo test — la refactorización es transparente desde fuera del service.

### 3.2 [Medio, efecto futuro] `request.client.host` no es confiable detrás de un reverse proxy — pendiente, en espera de infraestructura

**Dónde**: `app/api/v1/endpoints/auth.py` (`request.client.host if request.client else None`), usado para el rate-limiting de login por IP.

**Por qué importa**: el TDD (§9.3) asume NGINX como reverse proxy en producción (Fase 7, todavía no construida). Cuando eso exista, **todas** las requests le llegarán a Uvicorn con `request.client.host` = la IP de NGINX, no la del cliente real — el rate-limiting por IP dejaría de discriminar entre usuarios (todos comparten la "IP" del proxy) y, en el peor caso, un solo IP malicioso podría bloquear a todos los usuarios reales detrás del mismo proxy.

**Por qué no lo arreglé ya**: la corrección correcta (confiar en `X-Forwarded-For` solo cuando la request viene de una IP de proxy conocida y confiable) necesita la lista de IPs del/los proxy(s) de producción, que no existen todavía en este repositorio (Fase 7 del TDD). Confiar en ese header sin una allowlist de proxies sería peor que el problema actual: cualquier cliente podría falsificar su propia IP para evadir el rate-limit. Ahora mismo (sin NGINX en desarrollo) el código es correcto — el problema es únicamente latente, a activarse en el despliegue.

**Recomendación**: cuando se configure NGINX (Fase 7), usar `uvicorn.middleware.proxy_headers.ProxyHeadersMiddleware` con `trusted_hosts` apuntando a la IP interna de NGINX, y documentar esa IP en `database/README.md` o equivalente de despliegue.

### 3.3 [Bajo, ya mitigado por defecto] `echo=settings.debug` puede loguear `password_hash` en claro

**Dónde**: `app/db/session.py:18` (`echo=settings.debug`).

**Por qué importa**: con `DEBUG=true`, SQLAlchemy loguea cada sentencia SQL **con sus parámetros**, incluyendo el `password_hash` (bcrypt) que se inserta en `users` al crear/cambiar contraseña. Un hash bcrypt no es la contraseña en sí, pero sigue siendo material sensible que en principio no debería aparecer en logs de aplicación.

**Por qué no lo "arreglé"**: `Settings.debug` por defecto es `False` (ver `core/config.py`) — el único escenario de exposición es que alguien ponga explícitamente `DEBUG=true` en un `.env` de producción, lo cual ya sería un error de configuración de despliegue más amplio (también expondría trazas de error detalladas, etc.), no un bug de este código puntual. No hay un cambio de código que "arregle" una mala configuración de entorno.

**Recomendación**: dejarlo documentado como regla dura para el despliegue (Fase 7): `DEBUG` nunca debe ser `true` en producción. No requiere cambio de código.

---

## 4. Checklist de las 20 dimensiones solicitadas

| # | Dimensión | Resultado |
|---|---|---|
| 1 | Cumplimiento del TDD | ✅ Endpoints, roles y modelo de datos coinciden con TDD §7-§8. Las desviaciones (sin Redis, sin dim_canal, `canal_id`=nombre) ya estaban documentadas en `docs/API.md` de sesiones previas. |
| 2 | Cumplimiento de Skills | ✅ SQLAlchemy 2.x moderno, Alembic para todo cambio de esquema (`alembic check` sin deriva), Pydantic v2 en todo I/O, `/api/v1` versionado. |
| 3 | Arquitectura | ✅ Separación router→service→repository respetada en los 4 módulos. Hallazgo #7 (commits) corregido con el refactor de Unit of Work. |
| 4 | Clean Architecture | ✅ Los services no importan FastAPI; los repositories no contienen reglas de negocio. |
| 5 | SOLID | ✅ Sin violaciones estructurales relevantes encontradas — factories de dependencias (`require_role`) siguen abierto/cerrado razonablemente bien. |
| 6 | Organización de carpetas | ✅ Coincide con la estructura de referencia de [[fastapi-enterprise-backend]] en los 4 módulos. |
| 7 | SQL | ✅ Sin concatenación/f-strings con input de usuario — todo parametrizado vía ORM/Core. Corregido el único patrón `SELECT`-then-`INSERT` sin proteger (#3). |
| 8 | Índices | ✅ Verificado con `EXPLAIN ANALYZE` en la sesión de dashboard; sin cambios adicionales necesarios ahora. |
| 9 | Seguridad | ✅ Corregido el timing side-channel (#1, el hallazgo más serio de esta auditoría). |
| 10 | Autenticación | ✅ JWT con algoritmo explícito, separación access/refresh, revocación funcional (y ahora purgada, #2). |
| 11 | Autorización | ✅ Todos los endpoints de escritura verifican rol en el backend (`require_admin`/`require_authenticated`), nunca solo en el contrato de OpenAPI. |
| 12 | Validaciones | ✅ Corregidos los dos huecos encontrados (#4 Engagement, #5 max_length). |
| 13 | Manejo de errores | ✅ Excepciones de dominio + handlers centralizados consistentes; el hallazgo de fondo (#7, atomicidad) ya corregido vía Unit of Work. |
| 14 | Logging | ✅ Logging estructurado JSON con request_id, sin `print()`, sin secretos en claro salvo el escenario ya mitigado por defecto (#9 en la sección 3). |
| 15 | Tipado | ✅ Tipado estricto en todo el código revisado; sin `Any` sin justificar. |
| 16 | Duplicación de código | ✅ Patrones de filtrado/paginación ya extraídos a dependencias reutilizables (`pagination_params`, `date_range_params`); sin duplicación relevante nueva. |
| 17 | Rendimiento | ✅ Agregaciones siempre en SQL, nunca en Python; `EXPLAIN ANALYZE` confirmó uso de índices. |
| 18 | Escalabilidad | ✅ Corregido el único problema de crecimiento sin límite encontrado (#2). Hallazgo #8 (IP tras proxy) queda documentado para el despliegue. |
| 19 | Mantenibilidad | ✅ Corregidos los 5 docstrings desactualizados (#6). |
| 20 | Deuda técnica | ✅ Los hallazgos #2, #3 y #7 eran la deuda técnica real encontrada; los tres corregidos (#7 vía el refactor de Unit of Work aprobado). |

---

## 5. Verificación final

```
ruff check app scripts tests   → All checks passed!
pytest -q                      → 117 passed
alembic check                  → No new upgrade operations detected (sin deriva esquema↔modelos)
```

Ningún test existente se modificó para que esto pasara — los 117 tests son los mismos de antes de la auditoría, y todos siguen en verde tras los 6 cambios originales **y** tras el refactor de Unit of Work aplicado después de la aprobación.

---

## 6. Archivos modificados en esta auditoría

**Ronda 1 (hallazgos corregidos directamente):**
- `app/services/auth_service.py` — mitigación de timing side-channel (#1)
- `app/repositories/revoked_token_repository.py` — purga de tokens vencidos (#2)
- `app/etl/repository.py` — `ON CONFLICT` en `get_or_create_programa` (#3)
- `app/etl/normalizers.py` — validación de `Engagement` (#4)
- `app/schemas/password_policy.py`, `app/schemas/auth.py`, `app/schemas/admin_user.py` — `max_length` en contraseñas (#5)
- `app/etl/exceptions.py`, `app/models/audit_log.py`, `app/models/upload_log.py`, `app/db/base.py`, `app/etl/models.py` — docstrings actualizados (#6)

**Ronda 2 (refactor de Unit of Work, tras aprobación — hallazgo #7):**
- `app/repositories/user_repository.py` — quitados los `commit()` de `update_last_login`, `update_password`, `update_profile`, `set_active`; `create()` pasa a `flush()`.
- `app/repositories/audit_log_repository.py` — quitado el `commit()` de `record()`.
- `app/repositories/revoked_token_repository.py` — quitado el `commit()` de `revoke()` (ya tenía la purga de la ronda 1).
- `app/services/auth_service.py` — `login()`, `logout()` y `change_password()` ahora hacen un único `session.commit()` por operación.
- `app/services/admin_user_service.py` — `create_user()`, `update_user()` y `toggle_active()` ídem.

---

## 7. Estado final

Todos los hallazgos de esta auditoría están cerrados o explícitamente diferidos por decisión del usuario:

- **9 problemas reales corregidos** en total (6 de la ronda 1 + el refactor de Unit of Work de la ronda 2).
- **§3.2** (IP tras reverse proxy) queda diferido a la Fase 7 del TDD (despliegue con NGINX) — no hay código que corregir todavía sin esa infraestructura.
- **§3.3** (`DEBUG` en producción) queda como regla documentada, sin cambio funcional, tal como se decidió.

Backend verificado y listo — se continúa con la Fase 7 (frontend) sobre esta base.
