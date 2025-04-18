"""empty message

Revision ID: f1c05f2b7b87
Revises: 6abe494959cc
Create Date: 2025-04-14 12:52:38.223070

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'f1c05f2b7b87'
down_revision = '6abe494959cc'
branch_labels = None
depends_on = None


def upgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    with op.batch_alter_table('kml', schema=None) as batch_op:
        batch_op.drop_column('area')
        batch_op.drop_column('poligono')

    # ### end Alembic commands ###


def downgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    with op.batch_alter_table('kml', schema=None) as batch_op:
        batch_op.add_column(sa.Column('poligono', sa.VARCHAR(length=255), autoincrement=False, nullable=False))
        batch_op.add_column(sa.Column('area', sa.VARCHAR(length=255), autoincrement=False, nullable=False))

    # ### end Alembic commands ###
