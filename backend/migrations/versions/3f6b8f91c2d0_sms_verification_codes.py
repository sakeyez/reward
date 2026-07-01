"""sms verification codes

Revision ID: 3f6b8f91c2d0
Revises: 2b7c41f20b81
Create Date: 2026-07-01 19:40:00.000000

"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "3f6b8f91c2d0"
down_revision: str | Sequence[str] | None = "2b7c41f20b81"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "sms_verification_codes",
        sa.Column("phone", sa.String(length=32), nullable=False),
        sa.Column("code_hash", sa.String(length=255), nullable=False),
        sa.Column("purpose", sa.String(length=40), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("consumed", sa.Boolean(), nullable=False),
        sa.Column("consumed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("user_id", sa.Integer(), nullable=True),
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_sms_verification_codes_expires_at"), "sms_verification_codes", ["expires_at"], unique=False)
    op.create_index(op.f("ix_sms_verification_codes_phone"), "sms_verification_codes", ["phone"], unique=False)
    op.create_index(op.f("ix_sms_verification_codes_purpose"), "sms_verification_codes", ["purpose"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_sms_verification_codes_purpose"), table_name="sms_verification_codes")
    op.drop_index(op.f("ix_sms_verification_codes_phone"), table_name="sms_verification_codes")
    op.drop_index(op.f("ix_sms_verification_codes_expires_at"), table_name="sms_verification_codes")
    op.drop_table("sms_verification_codes")
