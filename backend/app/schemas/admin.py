from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field

from backend.app.models.checkin import CheckinStatus
from backend.app.models.point import PointTransactionType
from backend.app.models.reward import RedemptionStatus, RewardStatus
from backend.app.models.user import UserStatus


class AdminSummary(BaseModel):
    users_total: int
    active_users: int
    today_checkins: int
    points_earned: int
    points_spent: int
    pending_redemptions: int
    rewards_total: int


class AdminUserRead(BaseModel):
    id: int
    username: str | None
    phone: str | None
    email: str | None
    display_name: str
    current_points: int
    streak_days: int
    status: UserStatus
    roles: list[str]
    created_at: datetime


class AdminUserList(BaseModel):
    items: list[AdminUserRead]
    total: int
    limit: int
    offset: int


class AdminUserUpdate(BaseModel):
    status: UserStatus


class AdminPointAdjustmentCreate(BaseModel):
    amount: int = Field(ge=-100000, le=100000)
    reason: str = Field(min_length=1, max_length=255)


class AdminCheckinRead(BaseModel):
    id: int
    user_id: int
    user_display_name: str
    checkin_date: date
    content_text: str | None
    image_url: str | None
    status: CheckinStatus
    total_score: int | None
    awarded_points: int
    ai_comment: str | None
    created_at: datetime


class AdminCheckinList(BaseModel):
    items: list[AdminCheckinRead]
    total: int
    limit: int
    offset: int


class AdminPointTransactionRead(BaseModel):
    id: int
    user_id: int
    user_display_name: str
    type: PointTransactionType
    amount: int
    balance_after: int
    related_type: str | None
    related_id: str | None
    reason: str
    created_by: int | None
    created_at: datetime


class AdminPointTransactionList(BaseModel):
    items: list[AdminPointTransactionRead]
    total: int
    limit: int
    offset: int


class AdminRewardCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    category: str = Field(min_length=1, max_length=40)
    description: str | None = None
    image_url: str | None = Field(default=None, max_length=500)
    cost_points: int = Field(ge=0)
    stock: int | None = Field(default=None, ge=0)
    status: RewardStatus = RewardStatus.active


class AdminRewardUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    category: str | None = Field(default=None, min_length=1, max_length=40)
    description: str | None = None
    image_url: str | None = Field(default=None, max_length=500)
    cost_points: int | None = Field(default=None, ge=0)
    stock: int | None = Field(default=None, ge=0)
    status: RewardStatus | None = None


class AdminRewardRead(BaseModel):
    id: int
    name: str
    category: str
    description: str | None
    image_url: str | None
    cost_points: int
    stock: int | None
    status: RewardStatus
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AdminRewardList(BaseModel):
    items: list[AdminRewardRead]
    total: int


class AdminRedemptionRead(BaseModel):
    id: int
    user_id: int
    user_display_name: str
    reward_id: int
    reward_name: str
    cost_points: int
    status: RedemptionStatus
    receiver_name: str | None
    receiver_phone: str | None
    receiver_address: str | None
    created_at: datetime


class AdminRedemptionList(BaseModel):
    items: list[AdminRedemptionRead]
    total: int
    limit: int
    offset: int


class AdminRedemptionUpdate(BaseModel):
    status: RedemptionStatus
