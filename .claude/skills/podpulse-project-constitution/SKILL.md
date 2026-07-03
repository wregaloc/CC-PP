---
name: podpulse-project-constitution
description: Use this skill SIEMPRE que se trabaje en el proyecto PodPulse — para cualquier tarea de diseño, implementación, revisión o discusión dentro de este repositorio. Define las reglas permanentes e innegociables del proyecto (stack tecnológico fijo, modelo de roles, gobierno de cambios estructurales, TDD aprobado, y forma de desarrollo). Debe consultarse antes de proponer o cambiar arquitectura, tablas, endpoints, roles o stack, y antes de empezar cualquier módulo nuevo.
---

# PodPulse Project Constitution

Esta skill es la **constitución del proyecto PodPulse**: no es una especialización técnica opcional como las demás skills del repositorio, es el marco de reglas permanentes que gobierna cómo se toma cualquier decisión dentro de este proyecto. Ante un conflicto entre esta skill y una preferencia genérica de otra skill técnica, **esta constitución tiene prioridad** — las demás skills (arquitectura, backend, frontend, datos, seguridad, migración de Power BI) se aplican siempre *dentro* de los límites que aquí se establecen.

## Qué es PodPulse

PodPulse **reemplaza un dashboard de Power BI** existente por una aplicación web propia. Esto no es un proyecto greenfield sin contexto: cada dato, métrica o cálculo mostrado debe reproducir fielmente la lógica del dashboard original salvo que el usuario apruebe explícitamente un cambio. Cuando la tarea implique interpretar medidas, modelos o lógica proveniente de ese Power BI original, aplica [[power-bi-migration-expert]] (nunca asumir reglas de negocio no confirmadas, preservar siempre la lógica original).

## Stack tecnológico fijo

El stack de PodPulse **no se elige tarea a tarea, ya está decidido**:

- **Frontend**: React + TypeScript + Tailwind — aplica siempre [[react-enterprise-frontend]] (arquitectura feature-based, TanStack Query, React Router, Recharts, responsive, dark mode).
- **Backend**: FastAPI — aplica siempre [[fastapi-enterprise-backend]] (SQLAlchemy 2 async, Alembic, Pydantic, DI, JWT, estructura de carpetas por capas).
- **Base de datos**: PostgreSQL — aplica siempre [[data-engineering-postgresql]] (integridad de datos, migraciones seguras, constraints, auditoría).
- Toda decisión de seguridad (autenticación, roles, validación) sigue [[enterprise-security]].
- Toda decisión de diseño no trivial sigue el flujo de análisis-antes-que-código de [[enterprise-software-architect]].

No propongas ni introduzcas un framework, librería estructural o motor de base de datos alternativo "porque encaja mejor" para una tarea puntual — si genuinamente crees que el stack fijo es inadecuado para algo concreto, exponlo como riesgo/alternativa y espera aprobación explícita del usuario antes de desviarte (ver "Nunca cambiar sin justificar", abajo).

## Ingesta de datos: CSV y Excel

- Los archivos **CSV y Excel se cargan manualmente** — no asumas ni diseñes ingestas automáticas, conectores en vivo, sincronización programada ni integraciones directas con Power BI/fuentes externas salvo que el usuario lo pida explícitamente como un cambio de alcance.
- Toda carga de archivo sigue las reglas de [[data-engineering-postgresql]] en la sección ETL: perfilar antes de cargar, validar explícitamente, nunca descartar filas problemáticas en silencio, y dejar rastro auditable de cada carga (qué se cargó, cuántas filas, cuántas rechazadas, por quién, cuándo).

## Modelo de roles (fijo)

PodPulse tiene exactamente este modelo de acceso, que no se reinterpreta libremente:

- **Admin**: es el **único rol que puede subir archivos** (CSV/Excel). Cualquier endpoint o UI de carga de datos debe estar protegido para que sólo Admin pueda invocarlo — verificado siempre en el backend (ver [[enterprise-security]] — RBAC nunca confiado sólo al frontend).
- **Internos** y **Clientes**: son roles de **sólo visualización** — nunca deben tener, ni en UI ni en API, una vía para crear, modificar o eliminar datos. Cualquier endpoint de escritura debe rechazar estos roles por diseño (fail closed).
- **Todos los roles ven la misma información** — no existe segmentación de datos por rol ni por cliente en el alcance actual de PodPulse (a diferencia de un RLS multi-tenant típico). Si una tarea sugiere filtrar o mostrar datos distintos según quién consulta, es una señal de alcance que **debe confirmarse explícitamente con el usuario antes de implementarse**, porque contradice esta regla fija.

## TDD aprobado

Existe un **Technical Design Document (TDD) aprobado** para PodPulse que es la fuente de verdad del diseño técnico del proyecto. Antes de tomar decisiones de arquitectura, modelo de datos o contratos de API:

- Localiza y consulta el TDD aprobado en el repositorio (o pregunta al usuario dónde se encuentra si no es evidente) antes de asumir un diseño alternativo.
- Toda implementación debe ser consistente con lo que el TDD define. Si una petición del usuario entra en conflicto con el TDD, señálalo explícitamente en vez de implementar en silencio una desviación.
- Si no encuentras un TDD accesible en el repositorio al empezar una tarea de diseño relevante, dilo explícitamente y pregunta antes de improvisar una arquitectura propia desde cero.

## Nunca cambiar sin justificar técnicamente

Los siguientes elementos son **estructurales** y no se modifican como efecto colateral de una tarea puntual:

- **Arquitectura** (capas, separación frontend/backend, patrones de la app)
- **Tablas** (esquema de base de datos ya establecido)
- **Endpoints** (contratos de API ya expuestos y consumidos)
- **Roles** (Admin / Internos / Clientes y sus permisos)

Cualquier cambio sobre estos cuatro elementos requiere, antes de tocar código:
1. Justificación técnica explícita (qué problema concreto resuelve, qué alternativas se consideraron).
2. Análisis de impacto (qué se rompe, qué necesita migrarse, qué consumidores del contrato actual se ven afectados).
3. Aprobación explícita del usuario — siguiendo el mismo protocolo de "no implementar hasta aprobación" de [[enterprise-software-architect]].

Un cambio conveniente para resolver una tarea más rápido, pero no justificado técnicamente, no se hace — se expone como alternativa y se espera decisión.

## Desarrollo incremental

- El desarrollo de PodPulse avanza **módulo por módulo**, no en paralelo disperso ni con múltiples módulos a medio terminar simultáneamente.
- **Cada módulo debe quedar funcional (end-to-end: backend + frontend + datos reales, no sólo maquetado) antes de empezar el siguiente.** No inicies el siguiente módulo mientras el actual tenga pendientes bloqueantes conocidos, salvo que el usuario decida explícitamente reordenar prioridades.
- Si una tarea nueva implica empezar un módulo distinto al que está en curso, señala explícitamente ese cambio de foco antes de proceder, para que sea una decisión consciente y no un desvío accidental.

## Documentar decisiones importantes

- Toda decisión relevante (elección de alternativa de diseño, cambio aprobado sobre arquitectura/tablas/endpoints/roles, desviación del TDD, trade-off de seguridad o rendimiento) debe **quedar documentada**, no sólo resuelta en la conversación.
- Prioriza documentar en el lugar donde el equipo la buscará después: el propio TDD si aplica, un `ADR` (Architecture Decision Record) si el proyecto usa ese patrón, o comentarios de PR/commit si es una decisión de implementación acotada — pregunta al usuario cuál es la convención ya establecida en PodPulse si no es evidente, en lugar de inventar una nueva.
- Una decisión documentada debe incluir al menos: qué se decidió, por qué (alternativas descartadas y motivo), y qué impacto tiene sobre lo ya construido.

## Resumen operativo (checklist mental antes de actuar en PodPulse)

1. ¿Esta tarea toca arquitectura, tablas, endpoints o roles? → Si sí, justifica técnicamente y espera aprobación antes de tocar código.
2. ¿Hay lógica de negocio proveniente del Power BI original involucrada? → Consulta [[power-bi-migration-expert]], no asumas la regla.
3. ¿Es carga de archivos? → Sólo Admin, siempre validado en backend, siempre auditado.
4. ¿Implica mostrar datos distintos según el rol? → Contradice la regla de "todos ven la misma información": confirma con el usuario antes de construirlo.
5. ¿Estoy empezando un módulo nuevo mientras el actual no está funcional end-to-end? → No, salvo decisión explícita del usuario.
6. ¿Esta decisión merece quedar registrada para el futuro? → Documéntala en el lugar correcto, no sólo en el chat.
