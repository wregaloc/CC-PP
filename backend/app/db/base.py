from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    """Clase base declarativa de SQLAlchemy 2. Todos los modelos heredan de aquí.

    Alembic usa Base.metadata para autogenerar migraciones — ver backend/alembic/env.py.
    """


# Todos los modelos se importan en app/models/__init__.py para que
# Base.metadata los conozca al momento de generar migraciones con Alembic.
