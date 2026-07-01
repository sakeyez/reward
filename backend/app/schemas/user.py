from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field, computed_field, model_validator

from backend.app.models.user import UserStatus
from backend.app.services.level_service import calculate_level


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


class LevelRead(BaseModel):
    code: str
    name: str
    label: str
    current_level_points: int
    next_level_points: int | None
    progress_percent: int
    points_to_next_level: int
    is_max_level: bool


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

    @computed_field
    @property
    def level(self) -> LevelRead:
        return LevelRead.model_validate(calculate_level(self.current_points).__dict__)

    model_config = ConfigDict(from_attributes=True)
