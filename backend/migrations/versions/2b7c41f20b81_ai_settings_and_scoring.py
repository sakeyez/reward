"""ai settings and scoring fields

Revision ID: 2b7c41f20b81
Revises: 14a1a9249750
Create Date: 2026-07-01 00:00:00.000000

"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "2b7c41f20b81"
down_revision: str | Sequence[str] | None = "14a1a9249750"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "ai_settings",
        sa.Column("enabled", sa.Boolean(), nullable=False),
        sa.Column("base_url", sa.String(length=500), nullable=False),
        sa.Column("model", sa.String(length=120), nullable=False),
        sa.Column("api_type", sa.String(length=40), nullable=False),
        sa.Column("encrypted_api_key", sa.Text(), nullable=True),
        sa.Column("last_test_status", sa.String(length=40), nullable=True),
        sa.Column("last_test_message", sa.Text(), nullable=True),
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    with op.batch_alter_table("checkins") as batch_op:
        batch_op.add_column(sa.Column("note_image_url", sa.String(length=500), nullable=True))
        batch_op.add_column(sa.Column("exercise_image_url", sa.String(length=500), nullable=True))
        batch_op.add_column(sa.Column("study_time_minutes", sa.Integer(), server_default="0", nullable=False))
        batch_op.add_column(sa.Column("question_count", sa.Integer(), server_default="0", nullable=False))
        batch_op.add_column(sa.Column("note_words", sa.Integer(), server_default="0", nullable=False))
        batch_op.add_column(sa.Column("neatness_score", sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column("accuracy_score", sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column("note_quality_score", sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column("risk_factor", sa.Float(), server_default="1.0", nullable=False))
        batch_op.add_column(sa.Column("time_component", sa.Float(), server_default="0.0", nullable=False))
        batch_op.add_column(sa.Column("note_component", sa.Float(), server_default="0.0", nullable=False))
        batch_op.add_column(sa.Column("exercise_component", sa.Float(), server_default="0.0", nullable=False))
        batch_op.add_column(sa.Column("neatness_coefficient", sa.Float(), server_default="1.0", nullable=False))
        batch_op.add_column(sa.Column("accuracy_coefficient", sa.Float(), server_default="1.0", nullable=False))
        batch_op.add_column(sa.Column("note_quality_coefficient", sa.Float(), server_default="1.0", nullable=False))
        batch_op.add_column(sa.Column("streak_coefficient", sa.Float(), server_default="1.0", nullable=False))
        batch_op.add_column(sa.Column("ai_raw_result", sa.Text(), nullable=True))
        batch_op.add_column(sa.Column("ai_error", sa.Text(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("checkins") as batch_op:
        batch_op.drop_column("ai_error")
        batch_op.drop_column("ai_raw_result")
        batch_op.drop_column("streak_coefficient")
        batch_op.drop_column("note_quality_coefficient")
        batch_op.drop_column("accuracy_coefficient")
        batch_op.drop_column("neatness_coefficient")
        batch_op.drop_column("exercise_component")
        batch_op.drop_column("note_component")
        batch_op.drop_column("time_component")
        batch_op.drop_column("risk_factor")
        batch_op.drop_column("note_quality_score")
        batch_op.drop_column("accuracy_score")
        batch_op.drop_column("neatness_score")
        batch_op.drop_column("note_words")
        batch_op.drop_column("question_count")
        batch_op.drop_column("study_time_minutes")
        batch_op.drop_column("exercise_image_url")
        batch_op.drop_column("note_image_url")
    op.drop_table("ai_settings")
