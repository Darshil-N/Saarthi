from datetime import datetime, timedelta, timezone

from config import settings


def _business_tz() -> timezone:
    return timezone(timedelta(minutes=settings.BUSINESS_UTC_OFFSET_MINUTES))


def business_day_start_utc(now: datetime | None = None) -> datetime:
    """Start of the current business day (midnight local time) expressed in UTC.

    Database timestamps are UTC, so "today" filters must compare against this value
    rather than against the server's local date.
    """
    tz = _business_tz()
    local_now = (now or datetime.now(timezone.utc)).astimezone(tz)
    local_midnight = local_now.replace(hour=0, minute=0, second=0, microsecond=0)
    return local_midnight.astimezone(timezone.utc)
