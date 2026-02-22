from datetime import datetime, timezone



def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()



def parse_iso(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        normalized = value.replace("Z", "+00:00")
        parsed = datetime.fromisoformat(normalized)
        if parsed.tzinfo is None:
            # Treat naive timestamps as UTC to avoid offset-naive/aware arithmetic errors.
            parsed = parsed.replace(tzinfo=timezone.utc)
        return parsed
    except Exception:
        return None



def days_until(iso_date: str | None) -> int:
    if not iso_date:
        return 999

    parsed = parse_iso(iso_date)
    if parsed is None:
        return 999

    now = datetime.now(timezone.utc)
    delta = parsed - now
    return int(delta.total_seconds() // 86400)
