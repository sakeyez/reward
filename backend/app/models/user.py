import enum
from typing import TYPE_CHECKING

from sqlalchemy import Enum, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.app.db.base import Base, IdMixin, TimestampMixin

if TYPE_CHECKING:
    from backend.app.models.checkin import Checkin
    from backend.app.models.point import PointTransaction
    from backend.app.models.reward import Redemption


class UserStatus(str, enum.Enum):
    active = "active"
    disabled = "disabled"


class User(IdMixin, TimestampMixin, Base):
    __tablename__ = "users"

    username: Mapped[str | None] = mapped_column(String(64), unique=True, index=True)
    phone: Mapped[str | None] = mapped_column(String(32), unique=True, index=True)
    email: Mapped[str | None] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    display_name: Mapped[str] = mapped_column(String(80), nullable=False)
    avatar_url: Mapped[str | None] = mapped_column(String(500))
    current_points: Mapped[int] = mapped_column(default=0, nullable=False)
    streak_days: Mapped[int] = mapped_column(default=0, nullable=False)
    status: Mapped[UserStatus] = mapped_column(
        Enum(UserStatus, name="user_status"),
        default=UserStatus.active,
        nullable=False,
    )

    roles: Mapped[list["UserRole"]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
    )
    checkins: Mapped[list["Checkin"]] = relationship(back_populates="user")
    point_transactions: Mapped[list["PointTransaction"]] = relationship(
        back_populates="user",
        foreign_keys="PointTransaction.user_id",
    )
    redemptions: Mapped[list["Redemption"]] = relationship(back_populates="user")


class Role(IdMixin, TimestampMixin, Base):
    __tablename__ = "roles"

    code: Mapped[str] = mapped_column(String(40), unique=True, index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(80), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)

    users: Mapped[list["UserRole"]] = relationship(
        back_populates="role",
        cascade="all, delete-orphan",
    )


class UserRole(TimestampMixin, Base):
    __tablename__ = "user_roles"
    __table_args__ = (UniqueConstraint("user_id", "role_id", name="uq_user_roles_user_role"),)

    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        primary_key=True,
    )
    role_id: Mapped[int] = mapped_column(
        ForeignKey("roles.id", ondelete="CASCADE"),
        primary_key=True,
    )

    user: Mapped["User"] = relationship(back_populates="roles")
    role: Mapped["Role"] = relationship(back_populates="users")
