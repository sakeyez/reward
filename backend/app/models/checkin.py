import enum
from datetime import date
from typing import TYPE_CHECKING

from sqlalchemy import Date, Enum, Float, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.app.db.base import Base, IdMixin, TimestampMixin

if TYPE_CHECKING:
    from backend.app.models.user import User


class CheckinStatus(str, enum.Enum):
    draft = "draft"
    submitted = "submitted"
    analyzing = "analyzing"
    scored = "scored"
    rejected = "rejected"


class Checkin(IdMixin, TimestampMixin, Base):
    __tablename__ = "checkins"
    __table_args__ = (UniqueConstraint("user_id", "checkin_date", name="uq_checkins_user_date"),)

    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True, nullable=False)
    checkin_date: Mapped[date] = mapped_column(Date, index=True, nullable=False)
    content_text: Mapped[str | None] = mapped_column(Text)
    image_url: Mapped[str | None] = mapped_column(String(500))
    note_image_url: Mapped[str | None] = mapped_column(String(500))
    exercise_image_url: Mapped[str | None] = mapped_column(String(500))
    study_time_minutes: Mapped[int] = mapped_column(default=0, nullable=False)
    question_count: Mapped[int] = mapped_column(default=0, nullable=False)
    note_words: Mapped[int] = mapped_column(default=0, nullable=False)
    neatness_score: Mapped[int | None]
    accuracy_score: Mapped[int | None]
    note_quality_score: Mapped[int | None]
    risk_factor: Mapped[float] = mapped_column(Float, default=1.0, nullable=False)
    time_component: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    note_component: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    exercise_component: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    neatness_coefficient: Mapped[float] = mapped_column(Float, default=1.0, nullable=False)
    accuracy_coefficient: Mapped[float] = mapped_column(Float, default=1.0, nullable=False)
    note_quality_coefficient: Mapped[float] = mapped_column(Float, default=1.0, nullable=False)
    streak_coefficient: Mapped[float] = mapped_column(Float, default=1.0, nullable=False)
    ai_raw_result: Mapped[str | None] = mapped_column(Text)
    ai_error: Mapped[str | None] = mapped_column(Text)
    status: Mapped[CheckinStatus] = mapped_column(
        Enum(CheckinStatus, name="checkin_status"),
        default=CheckinStatus.submitted,
        index=True,
        nullable=False,
    )
    total_score: Mapped[int | None]
    awarded_points: Mapped[int] = mapped_column(default=0, nullable=False)
    ai_comment: Mapped[str | None] = mapped_column(Text)
    ai_advice: Mapped[str | None] = mapped_column(Text)

    user: Mapped["User"] = relationship(back_populates="checkins")
    score_dimensions: Mapped[list["CheckinScoreDimension"]] = relationship(
        back_populates="checkin",
        cascade="all, delete-orphan",
    )


class CheckinScoreDimension(IdMixin, Base):
    __tablename__ = "checkin_score_dimensions"

    checkin_id: Mapped[int] = mapped_column(
        ForeignKey("checkins.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    dimension_code: Mapped[str] = mapped_column(String(40), nullable=False)
    dimension_name: Mapped[str] = mapped_column(String(80), nullable=False)
    score: Mapped[int] = mapped_column(nullable=False)
    sort_order: Mapped[int] = mapped_column(default=0, nullable=False)

    checkin: Mapped["Checkin"] = relationship(back_populates="score_dimensions")
