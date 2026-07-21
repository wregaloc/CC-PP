# Imagen de producción para Cloud Run — ver [[local-development-environment]]
# (arquitectura compatible con Docker aunque el desarrollo local no lo use) y
# [[fastapi-enterprise-backend]]. Multi-stage: la etapa "builder" compila las
# dependencias que lo necesiten (bcrypt/cryptography), la imagen final solo
# contiene el runtime + el venv ya armado — no herramientas de compilación.

FROM python:3.12-slim AS builder

WORKDIR /build

# build-essential: algunas dependencias (bcrypt, cryptography) pueden no
# tener wheel prearmada para toda arquitectura/versión de Python y requieren
# compilar — se queda solo en esta etapa, no en la imagen final.
RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential \
    && rm -rf /var/lib/apt/lists/*

RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt


FROM python:3.12-slim AS runtime

# Usuario no-root (ver [[enterprise-security]] — minimizar privilegios del
# proceso que sirve tráfico real).
RUN groupadd --system app && useradd --system --gid app --home /app app

WORKDIR /app

COPY --from=builder /opt/venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH" \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

COPY app ./app
COPY alembic ./alembic
COPY alembic.ini .

RUN mkdir -p storage/uploads \
    && chown -R app:app /app

USER app

# Cloud Run inyecta $PORT (default 8080) y espera que el proceso escuche en
# esa variable, no en un puerto fijo — nunca hardcodear 8000 acá (ver
# [[local-development-environment]] — nunca asumir una topología de red que
# solo exista fuera de un contenedor). Sin --reload: es la imagen de
# producción, no la de desarrollo local (run_backend.ps1 sigue siendo la vía
# de desarrollo con reload).
EXPOSE 8080
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8080}"]
