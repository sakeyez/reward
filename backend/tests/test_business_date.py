from datetime import date, datetime, timedelta, timezone

from backend.app.core.business_date import current_business_date


def test_current_business_date_before_four_counts_previous_day() -> None:
    now = datetime(2026, 7, 2, 3, 59, tzinfo=timezone(timedelta(hours=8)))

    assert current_business_date(now) == date(2026, 7, 1)


def test_current_business_date_at_four_counts_current_day() -> None:
    now = datetime(2026, 7, 2, 4, 0, tzinfo=timezone(timedelta(hours=8)))

    assert current_business_date(now) == date(2026, 7, 2)
