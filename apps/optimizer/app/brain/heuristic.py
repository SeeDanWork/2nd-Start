"""
Fallback heuristic scheduler.

Generates valid schedules using common custody patterns when OR-Tools
is unavailable. Produces multiple options by selecting different base
patterns and filtering by constraints.

Patterns (2-week, 14-day):
  - 7-7:     AAAAAAABBBBBBB  (alternating weeks)
  - 5-2-2-5: AAAAABBAAABBBB  (school-week blocks)
  - 2-2-5-5: AABBAAAAABBBBB  (mid-week exchange, week blocks)
  - 3-4-4-3: AAABBBBAAAAABB  (balanced mid-week)
  - 2-2-3:   AABBAAABBAAABB  (frequent short blocks, for younger children)
"""

from __future__ import annotations

import uuid
import time
from datetime import date, timedelta

from app.brain.domain import (
    OnboardingInput,
    OnboardingConfig,
    OnboardingOutput,
    ScheduleOption,
    ScheduleDay,
    Explanation,
    OptionProfile,
    AgeBand,
    ParentProfile,
    ParentAvailability,
    ParentPreferences,
    ParentConstraints,
)
from app.brain.profiles import get_profile_name
from app.brain.stats import compute_stats
from app.brain.explain import generate_explanation
from app.brain.conflicts import detect_conflicts


def _python_to_js_dow(py_dow: int) -> int:
    return (py_dow + 1) % 7


def _js_to_python_dow(js_dow: int) -> int:
    return (js_dow + 6) % 7


# ── Base patterns (14-day, 0=parent_a, 1=parent_b) ────────────────────

PATTERNS: dict[str, list[int]] = {
    # Alternating weeks: maximum stability, 7 consecutive each
    "7-7":     [0,0,0,0,0,0,0, 1,1,1,1,1,1,1],
    # School blocks: 5 with A, 2 weekend with B, 2 with A, 5 with B
    "5-2-2-5": [0,0,0,0,0,1,1, 0,0,1,1,1,1,1],
    # 2-2-5-5 split: short blocks then week blocks
    "2-2-5-5": [0,0,1,1,0,0,0, 0,0,1,1,1,1,1],
    # Balanced mid-week: 3-4-4-3
    "3-4-4-3": [0,0,0,1,1,1,1, 0,0,0,0,1,1,1],
    # Frequent short blocks: 2-2-3 repeating (good for young children)
    "2-2-3":   [0,0,1,1,0,0,0, 1,1,0,0,1,1,1],
    # Primary home patterns (asymmetric, parent_a = primary)
    # B gets weekends only: 10A, 4B
    "primary-weekends": [0,0,0,0,0,1,1, 0,0,0,0,0,1,1],
    # B gets 1 midweek night per week: 12A, 2B
    "primary-midweek":  [0,0,1,0,0,0,0, 0,0,1,0,0,0,0],
}

# Map profiles to preferred patterns
PROFILE_PATTERN_PREFS: dict[str, list[str]] = {
    OptionProfile.STABILITY:      ["7-7", "5-2-2-5", "3-4-4-3"],
    OptionProfile.FAIRNESS:       ["3-4-4-3", "2-2-5-5", "2-2-3"],
    OptionProfile.LOGISTICS:      ["5-2-2-5", "7-7", "3-4-4-3"],
    OptionProfile.WEEKEND_PARITY: ["3-4-4-3", "2-2-3", "5-2-2-5"],
    OptionProfile.CHILD_ROUTINE:  ["7-7", "5-2-2-5", "3-4-4-3"],
}

# When living_arrangement == 'primary_visits', override STABILITY and CHILD_ROUTINE
# to prefer primary-home patterns (fewer transitions, anchored to primary parent).
PRIMARY_PROFILE_PATTERN_PREFS: dict[str, list[str]] = {
    OptionProfile.STABILITY:      ["primary-weekends", "7-7", "5-2-2-5"],
    OptionProfile.FAIRNESS:       ["3-4-4-3", "2-2-5-5", "2-2-3"],
    OptionProfile.LOGISTICS:      ["5-2-2-5", "primary-weekends", "7-7"],
    OptionProfile.WEEKEND_PARITY: ["primary-weekends", "3-4-4-3", "2-2-3"],
    OptionProfile.CHILD_ROUTINE:  ["primary-weekends", "primary-midweek", "7-7"],
}


def _apply_locked_nights(
    pattern: list[int],
    dates: list[date],
    a_locked_py: set[int],
    b_locked_py: set[int],
) -> list[int] | None:
    """
    Adjust pattern to respect locked nights.
    Returns None if the pattern cannot satisfy the constraints.
    """
    result = list(pattern)
    for i, dt in enumerate(dates):
        dow = dt.weekday()
        if dow in a_locked_py and dow in b_locked_py:
            return None  # Conflict: both locked
        if dow in a_locked_py:
            result[i % len(result)] = 1  # Must be parent_b
        if dow in b_locked_py:
            result[i % len(result)] = 0  # Must be parent_a

    # Tile the pattern to cover all dates
    full = []
    for i in range(len(dates)):
        full.append(result[i % len(result)])
    return full


def _pattern_to_option(
    pattern_assignments: list[int],
    dates: list[date],
    profile: str,
    inputs: OnboardingInput,
) -> ScheduleOption:
    """Convert a raw pattern into a ScheduleOption with stats and explanation."""
    days: list[ScheduleDay] = []
    for i, dt in enumerate(dates):
        parent = "parent_b" if pattern_assignments[i] == 1 else "parent_a"
        is_trans = i > 0 and pattern_assignments[i] != pattern_assignments[i - 1]
        days.append(ScheduleDay(
            date=dt.isoformat(),
            day_of_week=_python_to_js_dow(dt.weekday()),
            assigned_to=parent,
            is_transition=is_trans,
        ))

    from app.brain.solver import _build_handoffs
    handoffs = _build_handoffs(days, inputs)
    stats = compute_stats(days, school_days=inputs.school_schedule.school_days)

    option = ScheduleOption(
        id=str(uuid.uuid4()),
        name=get_profile_name(profile),
        profile=profile,
        schedule=days,
        handoffs=handoffs,
        stats=stats,
        explanation=generate_explanation(
            ScheduleOption(
                id="", name="", profile=profile,
                schedule=days, handoffs=handoffs, stats=stats,
                explanation=Explanation(
                    bullets=[], respected_constraints=[], tradeoffs=[], assumptions=[],
                ),
            ),
            inputs,
            stats,
        ),
    )
    return option


def generate_options_heuristic(
    inputs: OnboardingInput,
    config: OnboardingConfig | None = None,
) -> OnboardingOutput:
    """
    Fallback heuristic: generate options from predefined patterns.
    Used when OR-Tools is not available.
    """
    start_time = time.monotonic()

    if config is None:
        config = OnboardingConfig()

    conflict_report = detect_conflicts(inputs)
    if not conflict_report.feasible:
        return OnboardingOutput(
            options=[],
            conflict_report=conflict_report,
            solve_time_ms=round((time.monotonic() - start_time) * 1000, 1),
            is_partial=inputs.parent_b is None,
        )

    # Resolve parent B
    parent_b = inputs.parent_b
    if parent_b is None:
        parent_b = ParentProfile(
            parent_id="unknown_parent_b",
            availability=ParentAvailability(locked_nights=[]),
            preferences=ParentPreferences(
                target_share_pct=100.0 - inputs.parent_a.preferences.target_share_pct,
            ),
            constraints=ParentConstraints(),
        )

    # Build date list
    start = date.fromisoformat(inputs.shared.start_date)
    dates = [start + timedelta(days=i) for i in range(inputs.shared.horizon_days)]

    a_locked_py = {_js_to_python_dow(d) for d in inputs.parent_a.availability.locked_nights}
    b_locked_py = {_js_to_python_dow(d) for d in parent_b.availability.locked_nights}

    arrangement = inputs.living_arrangement
    if isinstance(arrangement, str):
        arrangement_value = arrangement
    else:
        arrangement_value = arrangement.value if hasattr(arrangement, 'value') else str(arrangement)
    is_primary = arrangement_value == "primary_visits"
    prefs_map = PRIMARY_PROFILE_PATTERN_PREFS if is_primary else PROFILE_PATTERN_PREFS

    profiles = config.profiles or list(OptionProfile)
    options: list[ScheduleOption] = []

    for profile in profiles:
        pattern_names = prefs_map.get(profile, ["3-4-4-3"])
        for pname in pattern_names:
            base = PATTERNS[pname]
            adjusted = _apply_locked_nights(base, dates, a_locked_py, b_locked_py)
            if adjusted is not None:
                option = _pattern_to_option(adjusted, dates, profile, inputs)
                options.append(option)
                break  # Use first valid pattern for this profile

    elapsed = round((time.monotonic() - start_time) * 1000, 1)

    return OnboardingOutput(
        options=options,
        conflict_report=conflict_report if conflict_report.conflicts else None,
        solve_time_ms=elapsed,
        is_partial=inputs.parent_b is None,
    )
