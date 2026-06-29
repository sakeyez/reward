import enum
from typing import TYPE_CHECKING

from sqlalchemy import Enum, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.app.db.base import Base, IdMixin, TimestampMixin

if TYPE_CHECKING:
    from backend.app.models.user import User


class RewardStatus(str, enum.Enum):
    active = "active"
    inactive = "inactive"


class RedemptionStatus(str, enum.Enum):
    created = "created"
    fulfilled = "fulfilled"
    cancelled = "cancelled"
    refunded = "refunded"


class Reward(IdMixin, TimestampMixin, Base):
    __tablename__ = "rewards"

    name: Mapped[str] = mapped_column(String(120), nullable=False)
    category: Mapped[str] = mapped_column(String(40), index=True, nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    image_url: Mapped[str | None] = mapped_column(String(500))
    cost_points: Mapped[int] = mapped_column(nullable=False)
    stock: Mapped[int | None]
    status: Mapped[RewardStatus] = mapped_column(
        Enum(RewardStatus, name="reward_status"),
        default=RewardStatus.active,
        index=True,
        nullable=False,
    )

    redemptions: Mapped[list["Redemption"]] = relationship(back_populates="reward")


class Redemption(IdMixin, TimestampMixin, Base):
    __tablename__ = "redemptions"

    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True, nullable=False)
    reward_id: Mapped[int] = mapped_column(ForeignKey("rewards.id"), index=True, nullable=False)
    cost_points: Mapped[int] = mapped_column(nullable=False)
    status: Mapped[RedemptionStatus] = mapped_column(
        Enum(RedemptionStatus, name="redemption_status"),
        default=RedemptionStatus.created,
        index=True,
        nullable=False,
    )
    receiver_name: Mapped[str | None] = mapped_column(String(80))
    receiver_phone: Mapped[str | None] = mapped_column(String(32))
    receiver_address: Mapped[str | None] = mapped_column(String(500))

    user: Mapped["User"] = relationship(back_populates="redemptions")
    reward: Mapped["Reward"] = relationship(back_populates="redemptions")
