from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field, model_validator

from backend.app.models.user import UserStatus


class UserCreate(BaseModel):
    username: str | None = Field(default=None, min_length=3, max_length=64)
    phone: str | None = Field(default=None, min_length=6, max_length=32)
    email: EmailStr | None = None
    password: str = Field(min_length=8, max_length=128)
    display_name: str = Field(min_length=1, max_length=80)

    @model_validator(mode="after")
    def require_login_identifier(self) -> "UserCreate":
        if not (self.username or self.phone or self.email):
            raise ValueError("username, phone, or email is required")
        return self


class UserRead(BaseModel):
    id: int
    username: str | None
    phone: str | None
    email: EmailStr | None
    display_name: str
    avatar_url: str | None
    current_points: int
    streak_days: int
    status: UserStatus
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
