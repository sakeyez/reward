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
    note_image_url: str | None
    exercise_image_url: str | None
    study_time_minutes: int
    question_count: int
    note_words: int
    neatness_score: int | None
    accuracy_score: int | None
    note_quality_score: int | None
    risk_factor: float
    time_component: float
    note_component: float
    exercise_component: float
    neatness_coefficient: float
    accuracy_coefficient: float
    note_quality_coefficient: float
    streak_coefficient: float
    ai_error: str | None
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
