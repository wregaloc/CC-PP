"""fact_audiencia: agrega hora_transmision y duracion_segundos

Revision ID: c2d3e4f5a6b7
Revises: 3bfe205e7a1e
Create Date: 2026-07-15 00:00:00.000000

Columnas nuevas, nullable, sin backfill — el usuario tiene los datos en un
archivo aparte que se cruza por Link Video y se recarga vía el flujo normal
de DATA (ver app/etl/validators.py::parse_hora_transmision/
parse_duracion_a_segundos). No hay pérdida de datos posible: es un
ADD COLUMN puro sobre una tabla existente.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c2d3e4f5a6b7'
down_revision: Union[str, None] = '3bfe205e7a1e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('fact_audiencia', sa.Column('hora_transmision', sa.Time(), nullable=True))
    op.add_column('fact_audiencia', sa.Column('duracion_segundos', sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column('fact_audiencia', 'duracion_segundos')
    op.drop_column('fact_audiencia', 'hora_transmision')
