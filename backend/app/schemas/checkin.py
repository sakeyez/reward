from datetime import date, datetime

import json

from pydantic import BaseModel, ConfigDict, computed_field

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
    note_image_urls: str | None = None
    exercise_image_urls: str | None = None
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

    @computed_field
    @property
    def note_images(self) -> list[str]:
        return parse_image_urls(self.note_image_urls, self.note_image_url or self.image_url)

    @computed_field
    @property
    def exercise_images(self) -> list[str]:
        return parse_image_urls(self.exercise_image_urls, self.exercise_image_url)


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


def parse_image_urls(raw_urls: str | None, fallback_url: str | None) -> list[str]:
    urls: list[str] = []
    if raw_urls:
        try:
            parsed = json.loads(raw_urls)
            if isinstance(parsed, list):
                urls.extend(item for item in parsed if isinstance(item, str) and item)
        except json.JSONDecodeError:
            pass
    if fallback_url and fallback_url not in urls:
        urls.insert(0, fallback_url)
    return urls
