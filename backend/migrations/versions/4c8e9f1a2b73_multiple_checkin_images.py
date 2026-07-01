"""multiple checkin images

Revision ID: 4c8e9f1a2b73
Revises: 2b7c41f20b81
Create Date: 2026-07-01 20:55:00.000000

"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "4c8e9f1a2b73"
down_revision: str | Sequence[str] | None = "2b7c41f20b81"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table("checkins") as batch_op:
        batch_op.add_column(sa.Column("note_image_urls", sa.Text(), nullable=True))
        batch_op.add_column(sa.Column("exercise_image_urls", sa.Text(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("checkins") as batch_op:
        batch_op.drop_column("exercise_image_urls")
        batch_op.drop_column("note_image_urls")
