"""
Schedule statistics computation.

Computes summary metrics from a list of daily assignments.
"""

from __future__ import annotations

from datetime import date, timedelta
from app.brain.domain import ScheduleDay, ScheduleStats


def _js_dow(d: date) -> int:
    """Python weekday (0=Mon..6=Sun) → JS convention (0=Sun..6=Sat)."""
    return (d.weekday() + 1) % 7


def _is_weekend_day(d: date) -> bool:
    """Friday or Saturday night (JS 5=Fri, 6=Sat)."""
    return _js_dow(d) in (5, 6)


def _is_school_day(d: date, school_days: list[int]) -> bool:
    """Is the NEXT day a school day? (Relevant for overnight assignment.)"""
    next_day = d + timedelta(days=1)
    return _js_dow(next_day) in school_days


def compute_stats(
    days: list[ScheduleDay],
    school_days: list[int] | None = None,
) -> ScheduleStats:
    """Compute summary statistics for a schedule option."""
    if school_days is None:
        school_days = [1, 2, 3, 4, 5]  # Mon-Fri

    total = len(days)
    if total == 0:
        return ScheduleStats(
            parent_a_overnights=0,
            parent_b_overnights=0,
            parent_a_weekend_nights=0,
            parent_b_weekend_nights=0,
            transitions_count=0,
            non_school_handoffs=0,
            stability_score=1.0,
            fairness_score=1.0,
            weekend_parity_score=1.0,
        )

    a_nights = sum(1 for d in days if d.assigned_to == "parent_a")
    b_nights = total - a_nights

    a_weekend = 0
    b_weekend = 0
    transitions = 0
    non_school_handoffs = 0

    for i, day in enumerate(days):
        dt = date.fromisoformat(day.date)

        # Weekend counting
        if _is_weekend_day(dt):
            if day.assigned_to == "parent_a":
                a_weekend += 1
            else:
                b_weekend += 1

        # Transition counting
        if i > 0 and day.assigned_to != days[i - 1].assigned_to:
            transitions += 1
            # Non-school handoff: transition happens on a day where
            # next day is NOT a school day (no school/daycare drop-off)
            if not _is_school_day(dt, school_days):
                non_school_handoffs += 1

    # ── Derived Scores ──

    # Stability: inverse of transitions, normalized.
    # 0 transitions = 1.0, each transition drops score.
    # Max reasonable transitions in 14 days ≈ 7.
    max_transitions = total // 2
    stability_score = max(0.0, 1.0 - (transitions / max(max_transitions, 1)))

    # Fairness: 1.0 when perfectly at target split.
    # Each overnight deviation from 50/50 (or target) drops score.
    target_b = total / 2  # default 50/50
    deviation = abs(b_nights - target_b)
    max_deviation = total / 2
    fairness_score = max(0.0, 1.0 - (deviation / max(max_deviation, 1)))

    # Weekend parity: 1.0 when weekend nights are equal.
    total_weekend = a_weekend + b_weekend
    if total_weekend > 0:
        weekend_dev = abs(a_weekend - b_weekend)
        weekend_parity_score = max(0.0, 1.0 - (weekend_dev / max(total_weekend, 1)))
    else:
        weekend_parity_score = 1.0

    return ScheduleStats(
        parent_a_overnights=a_nights,
        parent_b_overnights=b_nights,
        parent_a_weekend_nights=a_weekend,
        parent_b_weekend_nights=b_weekend,
        transitions_count=transitions,
        non_school_handoffs=non_school_handoffs,
        stability_score=round(stability_score, 3),
        fairness_score=round(fairness_score, 3),
        weekend_parity_score=round(weekend_parity_score, 3),
    )
