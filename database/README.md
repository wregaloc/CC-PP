# database/

Esta carpeta **no contiene el esquema vivo de la base de datos** — el esquema real se gestiona exclusivamente mediante Alembic dentro de `backend/alembic/` (ver [[data-engineering-postgresql]] y [[fastapi-enterprise-backend]]). Aquí solo viven instrucciones de configuración de la base de datos y, en fases futuras, scripts de seed/carga inicial que no forman parte del código de la aplicación.

> **Decisión de arquitectura (registrada):** PodPulse usa **Supabase** (PostgreSQL gestionado) como base de datos, en vez de una instalación local de PostgreSQL. Motivo: el equipo de desarrollo no tiene permisos de instalación de software con elevación en su equipo (bloqueado por política corporativa), y Supabase provee un Postgres real accesible sin instalar nada localmente. El resto de la arquitectura (backend FastAPI, frontend React+Vite) sigue corriendo 100% en local, sin Docker — solo la base de datos es un servicio gestionado.

## Configuración de Supabase

1. **Usa un proyecto de Supabase separado para desarrollo**, distinto del proyecto marcado como producción (`main`). Crea uno nuevo en [supabase.com/dashboard](https://supabase.com/dashboard) → "New project" → elige un nombre (p. ej. `PodPulse-dev`), región, y define una contraseña de base de datos (guárdala, la necesitas para el paso 3).
2. Dentro del proyecto de desarrollo, haz clic en el botón verde **"Connect"** (arriba a la derecha del dashboard del proyecto).
3. En el panel que se abre, selecciona la pestaña **"Direct"** (ícono de base de datos, "Connection string") — no "Framework", "Server", "ORM" ni "MCP".
   - Si en tu proyecto solo aparecen las variantes de pooler (pestaña "ORM", con `DATABASE_URL` en modo *transaction pooler* puerto `6543` y `DIRECT_URL` en modo *session pooler* puerto `5432`), usa la de **modo session (puerto 5432)** — es la que etiquetan como `DIRECT_URL`. El modo *transaction* (puerto 6543, `pgbouncer=true`) tiene una incompatibilidad conocida con el cacheo de prepared statements de `asyncpg`.
4. Esa cadena viene con el esquema `postgresql://...` — para usarla en el backend hay que anteponerle `+asyncpg`, quedando `postgresql+asyncpg://...`, y reemplazar `[YOUR-PASSWORD]` por tu contraseña real.
5. Actualiza `backend/.env` (nunca `backend/.env.example`, que no lleva secretos reales) con **un solo** `DATABASE_URL` (no hace falta la distinción `DATABASE_URL`/`DIRECT_URL` de Prisma — nuestro backend usa una sola variable para todo):

   ```
   DATABASE_URL=postgresql+asyncpg://postgres.<tu-project-ref>:<tu_password>@aws-1-<region>.pooler.supabase.com:5432/postgres
   DATABASE_SSL_REQUIRED=true
   ```

6. La extensión `pgcrypto` (necesaria para `gen_random_uuid()` en las claves primarias `UUID`) ya viene habilitada por defecto en todo proyecto nuevo de Supabase — no requiere ningún paso adicional.
7. **Base de datos de test**: se recomienda un segundo proyecto de Supabase (o, como mínimo, un esquema separado dentro del mismo proyecto de desarrollo) exclusivo para la suite de integration tests del backend (ver [[fastapi-enterprise-backend]] — nunca correr tests contra los mismos datos de desarrollo).
8. Las tablas se crean/actualizan **exclusivamente vía migraciones de Alembic** (`backend/alembic`), nunca manualmente desde el editor SQL de Supabase — eso rompería la trazabilidad de versiones del esquema.

### Troubleshooting: `socket.gaierror: [Errno 11001] getaddrinfo failed`

Si `alembic upgrade`/`pytest`/la app fallan con este error (o uno equivalente de DNS), la causa casi siempre es que `DATABASE_URL` usa el host **directo** (`db.<project-ref>.supabase.co`) en vez del **pooler**: el host directo hoy solo publica un registro DNS `AAAA` (IPv6) y no `A` (IPv4). Si tu red/equipo no tiene ruta IPv6 (frecuente en redes corporativas), la resolución falla por completo, incluso aunque el mismo comando haya funcionado antes en otra red. Solución: cambia `DATABASE_URL` al host `aws-1-<region>.pooler.supabase.com` (paso 3-5 arriba), que sí resuelve por IPv4.

## Notas de seguridad

- Nunca pegues la cadena de conexión completa (con contraseña) en el chat, en un commit, ni en ningún archivo versionado — solo vive en `backend/.env` local.
- Las "API Keys" del panel de Supabase (`sb_publishable_...`, `sb_secret_...`) son para las APIs propias de Supabase (Data API / Auth) — el backend de PodPulse **no las usa**, se conecta directamente a Postgres vía SQLAlchemy/asyncpg con la cadena de conexión de la sección anterior.

## scripts/

Reservado para scripts de carga inicial de datos (seed) en fases futuras. El script de creación del primer usuario Admin (TDD §5.3) vive en [`backend/scripts/seed_admin.py`](../backend/scripts/seed_admin.py) en vez de aquí, porque necesita las utilidades de hashing y el engine async del propio backend (`app.core.security`, `app.db.session`) — mantenerlo dentro de `backend/` evita duplicar esa lógica.
