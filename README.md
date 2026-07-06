# PodPulse

Plataforma de inteligencia de audiencias para el ecosistema de podcasting/streaming en Perú. PodPulse **reemplaza un dashboard de Power BI existente** por una aplicación web propia (ver `docs/`), preservando fielmente su lógica de negocio.

> **Estado actual: Fase 8 — Primera página del Dashboard (completada, pendiente de aprobación para el resto de páginas).** El backend está completo y auditado — ver `docs/API.md`. El frontend tiene su infraestructura (Fase 7: Axios con sesión/refresh, TanStack Query, React Router con Protected Routes, layout responsive) y ahora replica la Página 1 del Power BI original (Doc-Migración §5.1: barra de filtros, KPIs, evolutivo de vistas, ranking de programas, nube de keywords por sentimiento, KPIs de sentimiento, auspicios) consumiendo únicamente la API existente, sin lógica de negocio en el cliente. Todavía sin las páginas 2+ del dashboard original. Ver el plan de fases en `docs/PODPULSE_TDD_v1.0.docx` §11.

## Stack

| Capa | Tecnología |
|---|---|
| Frontend | React 18 + TypeScript + Vite + Tailwind CSS |
| Backend | FastAPI (Python 3.12+) + SQLAlchemy 2 (async) + Alembic |
| Base de datos | PostgreSQL gestionado vía **Supabase** (base de datos oficial de desarrollo — nunca una instalación local) |
| Autenticación (a partir de Fase 1) | JWT (access + refresh) |

**Docker no se usa en esta fase.** El proyecto corre completamente en local sobre Windows. La configuración (variables de entorno, sin rutas absolutas hardcodeadas) se mantiene compatible con una futura containerización, pero nada depende de Docker para funcionar hoy.

## Estructura del repositorio

```
podpulse/
├── backend/            # API FastAPI (SQLAlchemy 2 async, Alembic, Pydantic)
├── frontend/           # SPA React + TypeScript + Vite + Tailwind
├── database/           # Configuración de la base de datos oficial (Supabase) y scripts de seed
├── docs/               # Documentación fuente de verdad: TDD y documentación de migración
├── scripts/            # Scripts PowerShell de instalación/ejecución del entorno local
├── tests/              # Reservado para tests end-to-end/cross-service futuros
└── .claude/skills/     # Skills de Claude Code que definen las convenciones del proyecto
```

Cada workspace (`backend/`, `frontend/`) tiene su propio `requirements.txt`/`package.json` y su propio `.env.example` — ver la sección de variables de entorno más abajo.

### Estructura de `frontend/src/` (arquitectura feature-based)

```
src/
├── app/                # composición raíz: App, router (dashboard con lazy-loading), ProtectedRoute, providers
├── components/
│   ├── ui/              # primitivos reutilizables (Button, TextField, Toast, Skeleton, QueryState, ...)
│   └── layout/          # Navbar, Sidebar, AppLayout
├── features/
│   ├── auth/             # login/logout/sesión: api, context, pages, types
│   ├── dashboard/         # Página 1 del dashboard (Fase 8): api, hooks, context de filtros, components, pages
│   └── admin/            # página placeholder de administración (sin funcionalidad todavía)
├── lib/                 # cliente Axios + interceptores, normalización de errores, JWT, token store
├── types/               # tipos globales compartidos (roles)
└── hooks/                # reservado para hooks genéricos cross-feature
```

`features/dashboard/` sigue la misma arquitectura feature-based que `auth/`: `api/` (dashboardApi, filtersApi), `hooks/` (un hook TanStack Query por endpoint), `context/` (filtros compartidos: fecha/programa/canal), `components/` (KpiCard, DashboardCard, EvolutivoChart, RankingProgramasPanel, RankingTable, KeywordsCloud, SentimentKpiCards, AuspiciosPanel, FilterBar), `pages/DashboardPage.tsx`. Se usa `recharts` (ya presente desde el bootstrap) para los gráficos; la nube de palabras se implementó como una lista HTML con tamaño proporcional (Recharts no tiene un primitivo de nube de palabras).

## Requisitos previos

- **Python 3.12+** instalado y disponible en el PATH.
- **Node.js 20 LTS+** y `npm` instalados y disponibles en el PATH.
- **Cuenta de Supabase** (gratuita) con un proyecto de desarrollo creado — ver [`database/README.md`](database/README.md). PodPulse **no usa una instalación local de PostgreSQL**: Supabase es la base de datos oficial de desarrollo (y de producción), siempre accedida vía `DATABASE_URL` en variables de entorno, nunca con credenciales hardcodeadas.
- PowerShell (Windows) para ejecutar los scripts de `scripts/`.

## Cómo levantar el proyecto en local

1. Crea (o pide acceso a) un proyecto de Supabase de **desarrollo** y obtén su cadena de conexión — sigue [`database/README.md`](database/README.md).
2. Configura las variables de entorno:
   - Copia `backend/.env.example` a `backend/.env` y completa los valores (`DATABASE_URL` de tu proyecto Supabase, secreto JWT).
   - Copia `frontend/.env.example` a `frontend/.env` y ajusta si es necesario.
   - (El script de instalación de abajo hace esta copia automáticamente si los archivos `.env` no existen todavía.)
3. Ejecuta el script de instalación (una sola vez, o cada vez que cambien las dependencias):
   ```powershell
   .\scripts\setup_dev.ps1
   ```
   Esto crea el entorno virtual de Python (`backend/.venv`), instala `requirements.txt`, instala las dependencias de `npm` del frontend, y prepara los archivos `.env`.
4. Levanta el backend:
   ```powershell
   .\scripts\run_backend.ps1
   ```
   Disponible en `http://127.0.0.1:8000` — documentación interactiva en `http://127.0.0.1:8000/docs`, health check en `http://127.0.0.1:8000/health`.
5. En otra terminal, levanta el frontend:
   ```powershell
   .\scripts\run_frontend.ps1
   ```
   Disponible en `http://localhost:5173`.

## Variables de entorno

Toda la configuración vive en archivos `.env` (nunca versionados — ver `.gitignore`). Los `.env.example` correspondientes sí se versionan y deben mantenerse siempre actualizados junto con cualquier cambio de configuración:

- [`backend/.env.example`](backend/.env.example) — conexión a la base de datos Supabase (`DATABASE_URL`), configuración de JWT, CORS, nivel de logging, almacenamiento temporal de archivos subidos.
- [`frontend/.env.example`](frontend/.env.example) — URL base de la API.

## Testing

- **Backend**: `pytest` (ver `backend/pyproject.toml`). Ejecutar desde `backend/` con el entorno virtual activado: `pytest`.
- **Frontend**: `vitest`. Ejecutar desde `frontend/`: `npm test`.

## Documentación

- [`docs/PODPULSE_TDD_v1.0.docx`](docs/PODPULSE_TDD_v1.0.docx) — Technical Design Document, fuente de verdad del diseño técnico.
- [`docs/PODPULSE_Documentacion_Migracion.docx`](docs/PODPULSE_Documentacion_Migracion.docx) — análisis del modelo Power BI original y plan de migración.
- [`docs/API.md`](docs/API.md) — referencia de los endpoints de autenticación, carga de archivos (ETL), administración de usuarios y dashboard (KPIs, evolutivo, rankings, keywords, sentimiento, auspicios), con roles y códigos de error.

## Convenciones de desarrollo

Las convenciones de arquitectura, seguridad, estilo de código y forma de trabajar en este proyecto están definidas como Claude Code Skills en [`.claude/skills/`](.claude/skills/), en particular `podpulse-project-constitution` (reglas permanentes del proyecto) y `local-development-environment` (cómo se ejecuta todo en local sin Docker).
