from datetime import date, datetime

from pydantic import BaseModel, ConfigDict

from backend.app.models.checkin import CheckinStatus


class CheckinScoreDimensionRead(BaseModel):
    id: int
    dimension_code: str
    dimension_name: str
    score: int
    sort_order: int

    model_config = ConfigDict(from_attributes=True)


class CheckinRead(BaseModel):
    id: int
    checkin_date: date
    content_text: str | None
    image_url: str | None
    status: CheckinStatus
    total_score: int | None
    awarded_points: int
    ai_comment: str | None
    ai_advice: str | None
    created_at: datetime
    updated_at: datetime
    score_dimensions: list[CheckinScoreDimensionRead] = []

    model_config = ConfigDict(from_attributes=True)


class CheckinCalendarItem(BaseModel):
    id: int
    checkin_date: date
    day: int
    status: CheckinStatus
    total_score: int | None
    awarded_points: int


class CheckinCalendarResponse(BaseModel):
    year: int
    month: int
    days: list[CheckinCalendarItem]
