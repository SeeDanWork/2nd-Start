"""Convert validated bootstrap facts into a ScheduleRequest for the solver."""

from datetime import date, timedelta

from app.bootstrap.models import (
    BootstrapFacts,
    RecurringPatternType,
)
from app.models.requests import (
    DisruptionLock,
    LockedNight,
    ParentRole,
    ScheduleRequest,
    SeasonMode,
    SolverWeights,
    WeekendSplit,
)


def facts_to_schedule_request(
    facts: BootstrapFacts,
    horizon_start: date,
    horizon_end: date,
    reference_date: date,
    season_mode: str = "school_year",
    max_solutions: int = 3,
    timeout_seconds: int = 30,
) -> ScheduleRequest:
    """Convert validated high-confidence facts into a ScheduleRequest."""
    disruption_locks: list[DisruptionLock] = []
    locked_nights: list[LockedNight] = []
    preferred_handoff_days: list[int] = []
    template_id: str | None = None
    has_exchange_anchors = False

    # current_parent → DisruptionLock for reference_date
    if facts.current_parent is not None:
        disruption_locks.append(
            DisruptionLock(
                parent=facts.current_parent,
                date=reference_date.isoformat(),
                source="bootstrap",
            )
        )

    # locked_ranges → multiple DisruptionLocks
    for lr in facts.locked_ranges:
        start = date.fromisoformat(lr.start_date)
        end = date.fromisoformat(lr.end_date)
        d = start
        while d <= end:
            disruption_locks.append(
                DisruptionLock(
                    parent=lr.parent,
                    date=d.isoformat(),
                    source="bootstrap",
                )
            )
            d += timedelta(days=1)

    # recurring_patterns → LockedNight or DisruptionLock+template
    for rp in facts.recurring_patterns:
        if rp.pattern_type == RecurringPatternType.ALTERNATING_WEEKS:
            # Can't express in DOW; lock first week + set template
            template_id = "7on7off"
            d = horizon_start
            week_end = horizon_start + timedelta(days=6)
            while d <= min(week_end, horizon_end):
                disruption_locks.append(
                    DisruptionLock(
                        parent=rp.parent,
                        date=d.isoformat(),
                        source="bootstrap",
                    )
                )
                d += timedelta(days=1)
        elif rp.pattern_type == RecurringPatternType.WEEKENDS:
            if rp.confidence >= 0.8:
                locked_nights.append(
                    LockedNight(parent=rp.parent, days_of_week=[0, 6])  # Sun, Sat
                )
            # MEDIUM weekends handled as WeekendSplit (below)
        elif rp.pattern_type == RecurringPatternType.WEEKDAYS:
            if rp.confidence >= 0.8:
                locked_nights.append(
                    LockedNight(parent=rp.parent, days_of_week=[1, 2, 3, 4, 5])
                )
        elif rp.pattern_type == RecurringPatternType.SPECIFIC_DAYS:
            if rp.days_of_week and rp.confidence >= 0.8:
                locked_nights.append(
                    LockedNight(parent=rp.parent, days_of_week=rp.days_of_week)
                )

    # exchange_anchors → preferred_handoff_days + location weight
    for ea in facts.exchange_anchors:
        if ea.day_of_week not in preferred_handoff_days:
            preferred_handoff_days.append(ea.day_of_week)
        has_exchange_anchors = True

    # weekend_split from medium-confidence weekend patterns or target_split
    weekend_split = None
    for rp in facts.recurring_patterns:
        if rp.pattern_type == RecurringPatternType.WEEKENDS and rp.confidence < 0.8:
            target_pct = 50
            if rp.parent == ParentRole.PARENT_A:
                target_pct = 50
            else:
                target_pct = 50  # symmetric
            weekend_split = WeekendSplit(target_pct_parent_a=target_pct, tolerance_pct=20)
            break

    if facts.target_split_pct is not None and weekend_split is None:
        weekend_split = WeekendSplit(
            target_pct_parent_a=facts.target_split_pct,
            tolerance_pct=15,
        )

    # Deduplicate disruption locks (same date+parent)
    seen_locks: set[tuple[str, str]] = set()
    deduped_locks: list[DisruptionLock] = []
    for dl in disruption_locks:
        key = (dl.date, dl.parent.value)
        if key not in seen_locks:
            seen_locks.add(key)
            deduped_locks.append(dl)

    # Build weights
    weights = SolverWeights(
        fairness_deviation=100,
        total_transitions=80,
        non_daycare_handoffs=30,
        weekend_fragmentation=60,
        school_night_disruption=60,
        short_block_penalty=40,
        handoff_location_preference=20 if has_exchange_anchors else 0,
        template_alignment=50 if template_id else 0,
        routine_consistency_weight=0,
        weekly_rhythm_weight=0,
    )

    return ScheduleRequest(
        horizon_start=horizon_start.isoformat(),
        horizon_end=horizon_end.isoformat(),
        locked_nights=locked_nights,
        disruption_locks=deduped_locks,
        preferred_handoff_days=preferred_handoff_days,
        weekend_split=weekend_split,
        weights=weights,
        max_solutions=max_solutions,
        timeout_seconds=timeout_seconds,
        season_mode=SeasonMode(season_mode),
        template_id=template_id,
    )
