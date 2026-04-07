from __future__ import annotations

from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo
import os

from models import db, AttendanceSession


def _local_today() -> date:
    tz_name = (os.environ.get("APP_TIMEZONE") or "Asia/Kolkata").strip() or "Asia/Kolkata"
    try:
        tz = ZoneInfo(tz_name)
    except Exception:
        tz = ZoneInfo("Asia/Kolkata")
    return datetime.now(tz).date()


def ensure_finalized_sessions() -> None:
    """
    Create AttendanceSession rows for days that have passed (up to yesterday).

    This enables reports to show "absent" even when nobody marked attendance that day.
    It runs lazily on read endpoints so it works on free hosting without cron jobs.
    """
    today = _local_today()
    target_end = today - timedelta(days=1)
    if target_end.year < 2000:
        return

    last = db.session.query(db.func.max(AttendanceSession.date)).scalar()
    if not last:
        # No sessions yet: only create yesterday.
        start = target_end
    else:
        start = last + timedelta(days=1)

    if start > target_end:
        return

    d = start
    while d <= target_end:
        # Safe with unique(date) constraint; merge avoids duplicates.
        db.session.add(AttendanceSession(date=d))
        d += timedelta(days=1)

    try:
        db.session.commit()
    except Exception:
        db.session.rollback()
        # If concurrent requests race, unique violations may happen; ignore safely.
        # We'll be consistent on the next call.
        return

