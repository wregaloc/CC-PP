# PodPulse

Plataforma de inteligencia de audiencias para el ecosistema de podcasting/streaming en Perú. PodPulse **reemplaza un dashboard de Power BI existente** por una aplicación web propia (ver `docs/`), preservando fielmente su lógica de negocio.

> **Estado actual: Fase 7 — Infraestructura de Frontend (completada, pendiente de aprobación para dashboards).** El backend está completo y auditado: modelo de datos, autenticación (login, logout, JWT + refresh, bcrypt, roles, protección de rutas), módulo administrativo (carga de archivos con ETL, historial de cargas, detalle de errores, administración de usuarios) y API de dashboard (KPIs, evolutivo, rankings, keywords, sentimiento, auspicios, filtros) — ver `docs/API.md`. El frontend ahora tiene su infraestructura completa (React + TypeScript + Vite + Tailwind, Axios con manejo de sesión/refresh, TanStack Query, React Router con Protected Routes, layout responsive con Navbar/Sidebar, manejo global de errores) lista para consumir la API existente — **todavía sin dashboards, gráficos ni KPIs implementados**, a la espera de aprobación explícita. Ver el plan de fases en `docs/PODPULSE_TDD_v1.0.docx` §11.

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
├── app/                # composición raíz: App, router, ProtectedRoute, providers globales
├── components/
│   ├── ui/              # primitivos reutilizables agnósticos de negocio (Button, TextField, Toast, ...)
│   └── layout/          # Navbar, Sidebar, AppLayout
├── features/
│   ├── auth/             # login/logout/sesión: api, context, pages, types
│   ├── home/             # página placeholder post-login (sin KPIs todavía)
│   └── admin/            # página placeholder de administración (sin funcionalidad todavía)
├── lib/                 # cliente Axios + interceptores, normalización de errores, JWT, token store
├── types/               # tipos globales compartidos (roles)
└── hooks/                # reservado para hooks genéricos cross-feature
```

Dependencias clave añadidas en esta fase: `axios` (cliente HTTP con interceptores de sesión). El resto del stack (`react-router-dom`, `@tanstack/react-query`) ya venía del bootstrap inicial.

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
