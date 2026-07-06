"""fact_audiencia.es_emision: boolean -> smallint (conteo de emisiones)

Revision ID: b1c2d3e4f5a6
Revises: 470711ded83e
Create Date: 2026-07-05 15:30:00.000000

Corrige una desviación de la lógica original del Power BI: la medida DAX
`Emisiones = SUM(Es_Emision)` asume que `Es_Emision` es un conteo, no un
booleano. Datos reales confirmaron valores >1 (varias emisiones el mismo
día para un programa) — un booleano los truncaba a "hubo o no hubo emisión"
y la API calculaba `emisiones` como COUNT en vez de SUM, subestimando el KPI
en cualquier rango con más de 1 emisión diaria. Ver docs/AUDITORIA_BACKEND_v1.md
Adenda 2.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b1c2d3e4f5a6'
down_revision: Union[str, None] = '470711ded83e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Postgres no castea automáticamente el DEFAULT existente (booleano
    # "false") al nuevo tipo — hay que quitarlo antes de cambiar el tipo y
    # volver a fijarlo después, en vez de un solo alter_column con type_ +
    # server_default juntos.
    op.alter_column('fact_audiencia', 'es_emision', server_default=None)
    op.alter_column(
        'fact_audiencia',
        'es_emision',
        type_=sa.SmallInteger(),
        postgresql_using='es_emision::int',
        existing_nullable=False,
    )
    op.alter_column('fact_audiencia', 'es_emision', server_default='0')
    op.create_check_constraint(
        'ck_fact_audiencia_es_emision_non_negative',
        'fact_audiencia',
        'es_emision >= 0',
    )


def downgrade() -> None:
    # Solo reversible sin pérdida de datos si todos los valores existentes
    # son 0/1 (Postgres rechaza castear a boolean cualquier entero >1) — si
    # ya se cargaron conteos reales >1, esta reversión fallará a propósito
    # en vez de truncar datos silenciosamente.
    op.drop_constraint(
        'ck_fact_audiencia_es_emision_non_negative', 'fact_audiencia', type_='check'
    )
    op.alter_column('fact_audiencia', 'es_emision', server_default=None)
    op.alter_column(
        'fact_audiencia',
        'es_emision',
        type_=sa.Boolean(),
        postgresql_using='es_emision::int::bool',
        existing_nullable=False,
    )
    op.alter_column('fact_audiencia', 'es_emision', server_default='false')
