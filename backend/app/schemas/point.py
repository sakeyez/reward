from datetime import datetime

from pydantic import BaseModel, ConfigDict

from backend.app.models.point import PointTransactionType


class PointTransactionRead(BaseModel):
    id: int
    type: PointTransactionType
    amount: int
    balance_after: int
    related_type: str | None
    related_id: str | None
    reason: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class PointAccountRead(BaseModel):
    current_points: int
    streak_days: int
    transactions: list[PointTransactionRead]
