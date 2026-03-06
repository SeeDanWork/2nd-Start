"""Resolve relative dates in bootstrap facts to absolute ISO dates."""

from datetime import date, timedelta

from app.bootstrap.models import BootstrapFacts, LockedRange

DEFAULT_HORIZON_DAYS = 13


def resolve_horizon(
    reference_date: str,
    horizon_start: str | None,
    horizon_end: str | None,
) -> tuple[date, date]:
    """Resolve horizon boundaries with defaults.

    Returns (start_date, end_date) as date objects.
    Defaults: start = reference_date, end = reference_date + 13 days.
    """
    ref = date.fromisoformat(reference_date)
    start = date.fromisoformat(horizon_start) if horizon_start else ref
    end = date.fromisoformat(horizon_end) if horizon_end else ref + timedelta(days=DEFAULT_HORIZON_DAYS)
    return start, end


def resolve_dates(
    facts: BootstrapFacts,
    reference_date: str,
    horizon_start: date,
    horizon_end: date,
) -> BootstrapFacts:
    """Clamp locked_range dates to the horizon window.

    - Ranges entirely outside the horizon are dropped.
    - Ranges partially overlapping are clamped to horizon boundaries.
    - All date strings are validated as ISO format.
    """
    clamped_ranges: list[LockedRange] = []
    for lr in facts.locked_ranges:
        start = date.fromisoformat(lr.start_date)
        end = date.fromisoformat(lr.end_date)

        # Drop ranges entirely outside horizon
        if end < horizon_start or start > horizon_end:
            continue

        # Clamp to horizon
        clamped_start = max(start, horizon_start)
        clamped_end = min(end, horizon_end)

        clamped_ranges.append(
            lr.model_copy(
                update={
                    "start_date": clamped_start.isoformat(),
                    "end_date": clamped_end.isoformat(),
                }
            )
        )

    return facts.model_copy(update={"locked_ranges": clamped_ranges})
