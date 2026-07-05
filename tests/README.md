# tests/ (raíz)

Esta carpeta está **reservada para tests end-to-end / cross-service futuros** (por ejemplo, un flujo completo navegador → frontend → API → base de datos con Playwright u otra herramienta), que no pertenecen a un único workspace.

Los tests actuales del proyecto viven dentro de cada workspace:

- Tests de backend (unitarios e integración): `backend/tests/`
- Tests de frontend (componentes): junto al código en `frontend/src/` (Vitest + Testing Library)

Está vacía en esta fase del bootstrap — no hay todavía ninguna funcionalidad end-to-end que testear.
