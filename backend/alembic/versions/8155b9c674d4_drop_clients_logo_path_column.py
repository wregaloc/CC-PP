"""drop clients logo_path column

Fase 12.2/12.3: se descarta la feature de logo de cliente (Módulo 3) antes de
llegar a producción — nunca se usó realmente, no vale la pena resolver su
almacenamiento persistente (disco local -> efímero en Cloud Run) para algo
que el equipo decidió no usar por el momento. Se puede reintroducir más
adelante como una migración nueva si hace falta.

Revision ID: 8155b9c674d4
Revises: c2d3e4f5a6b7
Create Date: 2026-07-20 23:19:45.505344

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '8155b9c674d4'
down_revision: Union[str, None] = 'c2d3e4f5a6b7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_column('clients', 'logo_path')


def downgrade() -> None:
    op.add_column('clients', sa.Column('logo_path', sa.Text(), nullable=True))
