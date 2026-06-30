from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from backend.app.models.reward import RedemptionStatus, RewardStatus


class RewardRead(BaseModel):
    id: int
    name: str
    category: str
    description: str | None
    image_url: str | None
    cost_points: int
    stock: int | None
    status: RewardStatus
    can_redeem: bool
    points_shortfall: int

    model_config = ConfigDict(from_attributes=True)


class RedemptionCreate(BaseModel):
    reward_id: int
    receiver_name: str | None = Field(default=None, max_length=80)
    receiver_phone: str | None = Field(default=None, max_length=32)
    receiver_address: str | None = Field(default=None, max_length=500)


class RedemptionRead(BaseModel):
    id: int
    reward_id: int
    reward_name: str
    cost_points: int
    status: RedemptionStatus
    receiver_name: str | None
    receiver_phone: str | None
    receiver_address: str | None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
