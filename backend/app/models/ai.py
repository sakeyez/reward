from sqlalchemy import Boolean, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from backend.app.db.base import Base, IdMixin, TimestampMixin


class AiSetting(IdMixin, TimestampMixin, Base):
    __tablename__ = "ai_settings"

    enabled: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    base_url: Mapped[str] = mapped_column(String(500), default="https://api.openai.com/v1", nullable=False)
    model: Mapped[str] = mapped_column(String(120), default="gpt-4o-mini", nullable=False)
    api_type: Mapped[str] = mapped_column(String(40), default="chat_completions", nullable=False)
    encrypted_api_key: Mapped[str | None] = mapped_column(Text)
    last_test_status: Mapped[str | None] = mapped_column(String(40))
    last_test_message: Mapped[str | None] = mapped_column(Text)
