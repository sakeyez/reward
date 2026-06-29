import enum
from typing import TYPE_CHECKING

from sqlalchemy import Enum, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.app.db.base import Base, IdMixin, TimestampMixin

if TYPE_CHECKING:
    from backend.app.models.user import User


class PointTransactionType(str, enum.Enum):
    checkin_reward = "checkin_reward"
    redemption_cost = "redemption_cost"
    admin_adjustment = "admin_adjustment"
    refund = "refund"


class PointTransaction(IdMixin, TimestampMixin, Base):
    __tablename__ = "point_transactions"

    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True, nullable=False)
    type: Mapped[PointTransactionType] = mapped_column(
        Enum(PointTransactionType, name="point_transaction_type"),
        index=True,
        nullable=False,
    )
    amount: Mapped[int] = mapped_column(nullable=False)
    balance_after: Mapped[int] = mapped_column(nullable=False)
    related_type: Mapped[str | None] = mapped_column(String(40), index=True)
    related_id: Mapped[str | None] = mapped_column(String(64), index=True)
    reason: Mapped[str] = mapped_column(String(255), nullable=False)
    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), index=True)

    user: Mapped["User"] = relationship(
        back_populates="point_transactions",
        foreign_keys=[user_id],
    )
    creator: Mapped["User | None"] = relationship(foreign_keys=[created_by])
