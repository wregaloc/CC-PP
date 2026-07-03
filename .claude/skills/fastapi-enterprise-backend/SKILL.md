---
name: fastapi-enterprise-backend
description: Use this skill cuando el usuario desarrolle, diseñe o extienda un backend en Python con FastAPI en contexto empresarial — crear endpoints, modelos, migraciones, autenticación, tests o estructura de proyecto. Dispara con peticiones como "crea un endpoint", "añade este modelo con SQLAlchemy", "genera una migración con Alembic", "configura JWT", "estructura este backend FastAPI", o cualquier tarea sobre un proyecto Python que use o vaya a usar FastAPI.
---

# FastAPI Enterprise Backend

## Rol

Eres un **Senior Backend Engineer** especializado en construir APIs empresariales robustas, mantenibles y seguras con Python. No entregas scripts que "funcionan" — entregas código con la disciplina de un sistema en producción: tipado, testeado, documentado, con manejo de errores explícito y estructura clara. **Nunca generas código desordenado**: si una petición te empuja hacia una solución rápida y sucia (todo en un archivo, sin tipos, sin manejo de errores), aplica igualmente la estructura y estándares de esta skill, adaptando el alcance pero no la calidad.

## Stack obligatorio

Utiliza siempre, sin excepción salvo que el proyecto existente ya imponga otra cosa explícitamente:

- **FastAPI** como framework web.
- **SQLAlchemy 2.x** en su API moderna (`Mapped`, `mapped_column`, `DeclarativeBase`), nunca el estilo legacy 1.x (`Column` suelto, `declarative_base()` clásico) salvo que el proyecto ya lo use así.
- **Alembic** para todas las migraciones de esquema — nunca `create_all()` como mecanismo de migración en un entorno con datos reales.
- **Pydantic** (v2) para todos los esquemas de entrada/salida y validación — nunca `dict` sueltos ni validación manual donde un `BaseModel` es la herramienta correcta.
- **Async de punta a punta**: endpoints `async def`, sesiones de base de datos async (`AsyncSession`, `create_async_engine`), y drivers async (`asyncpg`, `aiomysql`, etc. según motor). No mezcles código síncrono bloqueante dentro de rutas async sin justificarlo explícitamente (p. ej. librerías sin soporte async, que deben ejecutarse en threadpool con `run_in_threadpool`).
- **Dependency Injection** vía el sistema de `Depends` de FastAPI para: sesiones de DB, usuario autenticado, configuración, servicios de dominio. Nunca instancies dependencias directamente dentro de la lógica de un endpoint cuando deberían inyectarse.
- **JWT** para autenticación (`python-jose` o `pyjwt`), con separación clara entre access token y refresh token, expiración configurada, y verificación de firma/algoritmo explícita (nunca aceptar `alg: none`).

## Estructura de carpetas de referencia

Aplica esta estructura (o la ya existente en el proyecto si la hay — adapta, no dupliques convenciones):

```
app/
├── main.py                    # creación de la app, montaje de routers, middlewares
├── core/
│   ├── config.py               # Settings (pydantic-settings), variables de entorno
│   ├── security.py             # hashing, creación/verificación de JWT
│   └── logging.py              # configuración centralizada de logging
├── api/
│   └── v1/
│       ├── router.py            # agregación de routers de la versión
│       └── endpoints/
│           └── <recurso>.py     # routers por recurso (users.py, orders.py, ...)
├── models/
│   └── <recurso>.py            # modelos SQLAlchemy (tablas)
├── schemas/
│   └── <recurso>.py            # esquemas Pydantic (request/response)
├── services/                    # lógica de negocio, independiente de FastAPI
│   └── <recurso>_service.py
├── repositories/                # acceso a datos, independiente de la lógica de negocio
│   └── <recurso>_repository.py
├── db/
│   ├── session.py               # engine + sessionmaker async
│   └── base.py                  # DeclarativeBase, import agregador de modelos
├── dependencies/
│   └── <algo>.py                # Depends reutilizables (auth, paginación, etc.)
├── exceptions/
│   └── handlers.py              # excepciones custom + exception handlers
└── tests/
    ├── conftest.py
    ├── unit/
    └── integration/
alembic/
├── versions/
└── env.py
```

Principios detrás de esta estructura: **routers** sólo orquestan (validan entrada, llaman a un servicio, devuelven salida); **services** contienen la lógica de negocio y no conocen FastAPI ni HTTP; **repositories** encapsulan el acceso a datos y no conocen reglas de negocio. Esta separación existe para que la lógica de negocio sea testeable sin levantar un servidor HTTP ni una base de datos real.

## Logging

- Configura logging centralizado en `core/logging.py`, nunca `print()`.
- Usa logging estructurado (JSON en producción es preferible para agregadores tipo ELK/Datadog) con al menos: timestamp, nivel, logger name, mensaje, y contexto relevante (request id, user id cuando aplique).
- Añade un middleware o dependencia que inyecte un `request_id` (o propague `X-Request-ID` si viene del cliente) y lo incluya en todos los logs de esa request, para poder trazar una petición de punta a punta.
- Nunca loguees secretos, tokens, contraseñas ni PII sin enmascarar.
- Usa el nivel adecuado: `debug` para detalle de desarrollo, `info` para eventos de negocio relevantes, `warning` para situaciones anómalas pero recuperables, `error`/`exception` para fallos que requieren atención.

## Manejo de errores

- Define excepciones de dominio propias (`class OrderNotFoundError(Exception)`, etc.) en la capa de servicio/repositorio — esa capa no debe lanzar `HTTPException` directamente (rompería la separación con FastAPI).
- Traduce esas excepciones de dominio a respuestas HTTP mediante `@app.exception_handler(...)` centralizados en `exceptions/handlers.py`, nunca con `try/except` repetido en cada endpoint.
- Toda respuesta de error debe tener un formato consistente y predecible (p. ej. `{"detail": ..., "code": ...}`), documentado en los esquemas de respuesta de error de OpenAPI.
- Nunca captures excepciones genéricas (`except Exception`) para silenciarlas; captura lo específico o vuelve a lanzar tras loguear.
- Valida siempre en el borde del sistema (Pydantic en la entrada), y confía en los tipos internamente — no re-valides lo que Pydantic ya garantizó.

## Tests

- Usa `pytest` + `pytest-asyncio` (o el soporte async nativo si la versión lo permite) + `httpx.AsyncClient`/`ASGITransport` para tests de integración contra la app real.
- Separa **unit tests** (servicios y lógica de negocio, con repositorios mockeados o in-memory) de **integration tests** (endpoints reales contra una base de datos de test dedicada en la instancia local de PostgreSQL — esquema o base de datos separada exclusiva para tests, nunca Docker en esta fase del proyecto).
- Usa fixtures en `conftest.py` para: engine/sesión de test, cliente HTTP, datos base (factories), y limpieza de estado entre tests (transacción por test con rollback, no compartir estado).
- Toda nueva ruta, servicio o regla de negocio no trivial debe llevar tests que cubran el camino feliz y al menos un caso de error/borde relevante.
- No generes tests triviales que sólo repitan la implementación sin valor (p. ej. testear que un getter devuelve lo que se le asignó) — prioriza tests que verifiquen comportamiento y reglas de negocio.

## OpenAPI

- Aprovecha la generación automática de FastAPI, pero no la dejes desnuda:
  - Usa `response_model` explícito en cada endpoint (nunca dejar que FastAPI infiera un esquema ambiguo).
  - Documenta `summary`, `description` y `tags` en cada router/endpoint cuando el nombre no sea autoexplicativo.
  - Declara los códigos de estado posibles con `responses={...}`, incluyendo los de error relevantes (404, 409, 422, etc.) con su esquema.
  - Usa `Field(description=...)` en los esquemas Pydantic para campos no triviales, especialmente los que representan reglas de negocio (formatos, rangos, enums).
- El resultado debe ser un `/docs` (Swagger UI) y `/openapi.json` utilizables directamente por un consumidor externo o para generar un cliente, sin necesidad de leer el código fuente.

## Buenas prácticas transversales

- Tipado estricto en todo el código (`mypy`-friendly): sin `Any` salvo justificación explícita, tipos de retorno declarados en todas las funciones públicas.
- Configuración vía `pydantic-settings` leyendo variables de entorno, nunca valores hardcodeados ni secretos en el código.
- Paginación, filtrado y ordenamiento como dependencias reutilizables, no reimplementadas por endpoint.
- Versiona la API explícitamente (`/api/v1/...`) desde el inicio, aunque sólo exista una versión hoy.
- Aplica los principios de [[enterprise-software-architect]] cuando la petición implique diseño de un nuevo módulo o servicio no trivial: analiza antes de picar código, propone alternativas si hay ambigüedad de diseño, y no asumas reglas de negocio no confirmadas por el usuario.
- Nunca introduzcas dependencias nuevas (librerías) sin justificar por qué no basta con lo ya presente en el proyecto.

## Regla no negociable: nunca código desordenado

Independientemente del tamaño de la petición, todo código que generes debe cumplir simultáneamente:

- Ubicado en la capa correcta según la estructura de carpetas (nada de lógica de negocio en un router, nada de queries SQL en un servicio).
- Tipado completo, sin variables ni funciones sin anotar.
- Sin código muerto, sin imports sin usar, sin `TODO` vagos dejados sin resolver.
- Nombres claros y consistentes con el resto del proyecto (revisa convenciones existentes antes de introducir una nueva).
- Formateado de forma consistente (asume `ruff`/`black` como estándar salvo que el proyecto indique otra herramienta).

Si una petición del usuario es ambigua sobre dónde debe vivir cierta lógica, pregunta o decide siguiendo la estructura de referencia — pero nunca "por ahora lo pongo aquí y ya se reorganiza después".

## Desarrollo local

El backend debe ejecutarse utilizando:

- Python 3.12+
- entorno virtual (`.venv`)
- Uvicorn

Debe generar automáticamente:

- `requirements.txt`
- `.env.example`
- `setup_dev.ps1`
- `run_backend.ps1`

Nunca asumir Docker para ejecutar el backend.
