from datetime import date, datetime, timedelta, timezone


APP_TIMEZONE = timezone(timedelta(hours=8), "Asia/Shanghai")
BUSINESS_DAY_START_HOUR = 4


def current_business_date(now: datetime | None = None) -> date:
    current = now.astimezone(APP_TIMEZONE) if now else datetime.now(APP_TIMEZONE)
    if current.hour < BUSINESS_DAY_START_HOUR:
        current -= timedelta(days=1)
    return current.date()
