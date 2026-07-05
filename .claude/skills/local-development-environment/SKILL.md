---
name: local-development-environment
description: Use this skill cuando se configure, ejecute, instale o modifique el entorno de desarrollo local del proyecto — scripts de instalación/ejecución, variables de entorno, sincronización de requirements.txt/package.json, o el README de setup. Sin usar Docker en esta fase. Dispara con peticiones como "genera el script de instalación", "configura el entorno local", "cómo se levanta el proyecto en mi máquina", "actualiza el .env.example", "arregla el README de setup", "agrega una dependencia nueva", o cualquier tarea sobre cómo se ejecuta backend/frontend/base de datos en la máquina de desarrollo.
---

# Local Development Environment

## Rol

Eres el responsable de que **cualquier persona pueda levantar PodPulse en una máquina Windows limpia, sin Docker, siguiendo únicamente scripts reproducibles** — no instrucciones manuales dispersas en la cabeza de quien lo configuró la primera vez. Todo lo que generes bajo esta skill debe poder ejecutarse tal cual, sin pasos implícitos no documentados. Esta skill es transversal: complementa a [[fastapi-enterprise-backend]] y [[react-enterprise-frontend]] en la parte de "cómo se levanta", no en "cómo se estructura el código" (eso lo definen esas otras skills).

## Backend

- Python 3.12+ dentro de un entorno virtual `.venv` — nunca instales dependencias en el Python global del sistema.
- Ejecución vía **Uvicorn** (`uvicorn app.main:app --reload` en desarrollo).
- Genera y mantén actualizados automáticamente:
  - `requirements.txt` — regenera o actualiza cuando se agregue/quite una dependencia; nunca lo dejes desincronizado de lo realmente importado en el código.
  - `.env.example` — ver sección Configuración.
  - `setup_dev.ps1` — script que crea el `.venv` si no existe, lo activa, instala `requirements.txt`, y copia `.env.example` a `.env` si este último no existe todavía (sin sobrescribir uno ya configurado).
  - `run_backend.ps1` — script que activa el `.venv` y levanta Uvicorn con reload en desarrollo.

## Frontend

- React + TypeScript + Vite + Tailwind (ver [[react-enterprise-frontend]] para arquitectura y estándares de código).
- Genera y mantén actualizados automáticamente:
  - `package.json` — con los scripts estándar de Vite (`dev`, `build`, `preview`) y las dependencias reales del proyecto.
  - `run_frontend.ps1` — script que ejecuta `npm install` (solo si `node_modules` no existe o `package-lock.json` cambió) y luego `npm run dev`.

## Base de datos

- **Supabase (PostgreSQL gestionado)** — base de datos oficial de desarrollo de PodPulse, no una instalación local (decisión permanente, ver [[podpulse-project-constitution]]). No generes ni sugieras pasos de instalación local de PostgreSQL para este proyecto.
- Toda conexión (host, puerto, usuario, contraseña, nombre de base de datos) se resuelve **exclusivamente vía variables de entorno** — nunca hardcodees una cadena de conexión en el código, en un script, ni en un archivo de configuración versionado.
- **Nunca usar credenciales hardcodeadas**, ni siquiera "temporalmente para probar" — ni en backend, ni en scripts `.ps1`, ni en ejemplos de documentación (usa placeholders claros tipo `<tu_password>` en la documentación, nunca una contraseña real de ejemplo que alguien pueda copiar y dejar en producción). Ver `database/README.md` para el procedimiento de configuración de Supabase.

## Configuración

- Toda configuración del proyecto (backend y frontend) vive en archivos `.env`, nunca en constantes en el código ni en `appsettings` hardcodeados.
- `.env` **nunca se versiona** (debe estar en `.gitignore` — verificar que lo esté antes de dar por cerrada cualquier tarea de configuración).
- `.env.example` sí se versiona y debe reflejar siempre, sin excepción, el conjunto completo y actual de variables que el proyecto necesita: cada vez que se agregue, renombre o elimine una variable de entorno en el código, `.env.example` se actualiza en el mismo cambio — nunca como una tarea "para después".
- Cada variable en `.env.example` debe tener un valor de ejemplo no sensible o un placeholder explícito, y un comentario breve si su propósito no es evidente por el nombre.

## Scripts

Siempre que se toque el entorno de ejecución, generar o mantener actualizados scripts PowerShell (`.ps1`, consistente con que el entorno de desarrollo es Windows) para las tres operaciones siguientes — nunca dejar un paso como "instrucción manual en el README" si puede ser un script:

- **Instalación** (`setup_dev.ps1` / equivalente frontend) — deja el entorno listo desde cero.
- **Ejecución** (`run_backend.ps1`, `run_frontend.ps1`) — levanta el servicio correspondiente.
- **Actualización** — cuando cambian dependencias (`requirements.txt` o `package.json`), el script de instalación debe poder volver a ejecutarse de forma idempotente para sincronizar el entorno existente, sin exigir borrar y recrear todo manualmente.

## Documentación

- El `README` del proyecto (raíz, y el de cada workspace si el monorepo los separa) debe **actualizarse automáticamente como parte del mismo cambio** cuando se modifique: la forma de instalar, la forma de ejecutar, una variable de entorno nueva, o un script nuevo/renombrado.
- Un README desactualizado respecto a los scripts reales es peor que no tener README — trátalo como parte del "definition of done" de cualquier cambio de configuración, no como una tarea de documentación aparte.

## Restricciones

- **Nunca asumir Docker durante el desarrollo** — ningún script, instrucción o pieza de configuración generada bajo esta skill debe requerir `docker`/`docker compose` para funcionar en esta fase del proyecto (consistente con [[podpulse-project-constitution]] y con las secciones "Desarrollo local" de [[fastapi-enterprise-backend]] y [[react-enterprise-frontend]]).
- **La arquitectura debe mantenerse compatible con Docker para una fase futura de despliegue**, aunque no se use ahora. En la práctica esto significa: toda configuración de host/puerto/credenciales sale de variables de entorno (nunca de un valor asumido como `localhost` fijo en el código), las rutas de archivos son relativas/configurables (no rutas absolutas de Windows del tipo `C:\Users\...`), y ningún proceso asume una topología de red que solo exista fuera de un contenedor. Si algo se implementa de una forma que funcionaría en local pero rompería dentro de un contenedor, señálalo como riesgo antes de darlo por terminado.
- **El código nunca debe depender exclusivamente de Docker para ejecutarse** — cualquier funcionalidad debe poder correr con `setup_dev.ps1` + `run_backend.ps1`/`run_frontend.ps1` sin Docker instalado en la máquina.
