"""Timezone-aware "current date/time" helpers.

The server OS often runs in UTC, which makes date.today()/datetime.now()
roll over at the wrong moment for US users. These helpers anchor "today"
and "now" to settings.app_timezone (IANA name, e.g. America/New_York),
falling back to system local time if the timezone database is unavailable.
"""
from datetime import date, datetime

from backend.core.config import settings

try:
    from zoneinfo import ZoneInfo
except ImportError:  # pragma: no cover - Python < 3.9
    ZoneInfo = None  # type: ignore[assignment]


def _tz():
    if ZoneInfo is None:
        return None
    try:
        return ZoneInfo(settings.app_timezone)
    except Exception:
        return None


def local_now() -> datetime:
    """Current wall-clock time in the configured timezone (naive)."""
    tz = _tz()
    return datetime.now(tz).replace(tzinfo=None) if tz else datetime.now()


def local_today() -> date:
    """Current date in the configured timezone."""
    tz = _tz()
    return datetime.now(tz).date() if tz else date.today()
