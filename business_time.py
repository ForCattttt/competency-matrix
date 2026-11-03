"""Use UTC for exported timestamps; browser display follows the viewer timezone."""
from datetime import datetime, timezone


def business_time(value: datetime) -> datetime:
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value.astimezone(timezone.utc)
