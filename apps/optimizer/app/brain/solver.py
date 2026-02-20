"""
CP-SAT solver for onboarding schedule generation.

Generates 3-5 distinct schedule options by running the OR-Tools CP-SAT
solver once per weight profile. Each profile emphasizes different tradeoffs
(stability, fairness, logistics, etc.).

Decision variables:
  x[d] ∈ {0, 1} for each day d in the horizon.
  0 = parent_a overnight, 1 = parent_b overnight.

Hard constraints:
  - Locked nights: if parent_a locks day d → x[d] = 1 (child with parent_b)
  - Locked nights: if parent_b locks day d → x[d] = 0 (child with parent_a)
  - Max consecutive: sliding window ensures no parent exceeds max nights in a row

Soft constraints (objective terms):
  - Fairness deviation: |sum(x) - target_b_overnights|
  - Total transitions: sum of day-to-day changes
  - Non-school handoffs: transitions on non-school days
  - Weekend fragmentation: weekends split across parents
  - School-night disruption: transitions on Sun-Thu
  - Weekend parity: |a_weekends - b_weekends|
  - Max consecutive penalty: exceeding soft max (when configured as soft)

Determinism:
  - No randomness. Solver uses fixed parameters and workers=1 for
    reproducible results. Inputs are sorted consistently.
"""

from __future__ import annotations

import time
import uuid
from datetime import date, timedelta
from typing import Optional

from ortools.sat.python import cp_model

from app.brain.domain import (
    OnboardingInput,
    OnboardingConfig,
    OnboardingOutput,
    ScheduleOption,
    ScheduleDay,
    HandoffInfo,
    Explanation,
    OptionProfile,
    AgeBand,
    ParentProfile,
    ParentAvailability,
    ParentPreferences,
    ParentConstraints,
)
from app.brain.profiles import get_profile_weights, get_profile_name, SolverWeights
from app.brain.stats import compute_stats
from app.brain.explain import generate_explanation
from app.brain.conflicts import detect_conflicts


def _js_to_python_dow(js_dow: int) -> int:
    """JS convention (0=Sun..6=Sat) → Python (0=Mon..6=Sun)."""
    return (js_dow + 6) % 7


def _python_to_js_dow(py_dow: int) -> int:
    """Python (0=Mon..6=Sun) → JS convention (0=Sun..6=Sat)."""
    return (py_dow + 1) % 7


def _date_range(start: str, days: int) -> list[date]:
    """Generate a list of dates from start for N days."""
    d = date.fromisoformat(start)
    return [d + timedelta(days=i) for i in range(days)]


def _default_parent_b(parent_a: ParentProfile) -> ParentProfile:
    """
    Create reasonable defaults for an unknown Parent B.
    Used in single-parent onboarding to produce invite-friendly schedules.
    """
    return ParentProfile(
        parent_id="unknown_parent_b",
        availability=ParentAvailability(locked_nights=[]),
        preferences=ParentPreferences(
            target_share_pct=100.0 - parent_a.preferences.target_share_pct,
            max_handoffs_per_week=3,
            max_consecutive_nights_away=5,
        ),
        constraints=ParentConstraints(),
        willingness_accept_non_school_handoffs=0.5,
    )


def _age_band_defaults(age_bands: list[str]) -> dict:
    """
    Derive solver hints from children's age bands.
    Uses the youngest child's band (most restrictive).
    """
    priority = {AgeBand.INFANT: 0, AgeBand.SCHOOL_AGE: 1, AgeBand.TEEN: 2}
    youngest = min(age_bands, key=lambda b: priority.get(b, 1))

    if youngest == AgeBand.INFANT:
        # 0-4: more frequent exchanges, shorter blocks
        return {"suggested_max_consecutive": 3, "prefer_short_blocks": True}
    elif youngest == AgeBand.TEEN:
        # 11-17: longer blocks, fewer transitions
        return {"suggested_max_consecutive": 7, "prefer_short_blocks": False}
    else:
        # 5-10: standard school-driven patterns
        return {"suggested_max_consecutive": 5, "prefer_short_blocks": False}


def _build_handoffs(
    days: list[ScheduleDay],
    inputs: OnboardingInput,
) -> list[HandoffInfo]:
    """Derive handoff events from day-to-day assignment changes."""
    handoffs: list[HandoffInfo] = []
    school_days_set = set(inputs.school_schedule.school_days)
    daycare_days_set = set()
    if inputs.daycare_schedule:
        daycare_days_set = set(inputs.daycare_schedule.daycare_days)

    for i in range(1, len(days)):
        if days[i].assigned_to != days[i - 1].assigned_to:
            dt = date.fromisoformat(days[i].date)
            js_dow = _python_to_js_dow(dt.weekday())

            # Determine exchange location
            if js_dow in daycare_days_set:
                location = "daycare"
                t = inputs.daycare_schedule.daycare_start_time if inputs.daycare_schedule else "08:00"
            elif js_dow in school_days_set:
                location = "school"
                t = inputs.school_schedule.school_start_time
            else:
                location = str(inputs.preferred_exchange_location)
                t = "09:00"  # Default for non-school days

            handoffs.append(HandoffInfo(
                date=days[i].date,
                time=t,
                location_type=location,
                from_parent=days[i - 1].assigned_to,
                to_parent=days[i].assigned_to,
            ))

    return handoffs


def _solve_single_profile(
    dates: list[date],
    profile: str,
    weights: SolverWeights,
    inputs: OnboardingInput,
    parent_b: ParentProfile,
    age_hints: dict,
    timeout_seconds: int,
) -> Optional[ScheduleOption]:
    """
    Run CP-SAT solver for one weight profile.
    Returns a ScheduleOption or None if infeasible.
    """
    model = cp_model.CpModel()
    n = len(dates)

    # ── Decision variables ──
    # x[d] = 1 means parent_b has overnight on day d
    x = [model.new_bool_var(f"x_{i}") for i in range(n)]

    # ── Transition variables ──
    # t[d] = 1 if assignment changes from day d-1 to d
    t = [model.new_bool_var(f"t_{i}") for i in range(1, n)]
    for i in range(len(t)):
        # t[i] = x[i+1] XOR x[i]
        # Linearize: t >= x[i+1] - x[i], t >= x[i] - x[i+1], t <= x[i+1] + x[i], t <= 2 - x[i+1] - x[i]
        model.add(t[i] >= x[i + 1] - x[i])
        model.add(t[i] >= x[i] - x[i + 1])
        model.add(t[i] <= x[i + 1] + x[i])
        model.add(t[i] <= 2 - x[i + 1] - x[i])

    # ── Hard constraints ──

    # Locked nights for parent_a: parent_a cannot have child → x[d] = 1
    a_locked_py = {_js_to_python_dow(d) for d in inputs.parent_a.availability.locked_nights}
    for i, dt in enumerate(dates):
        if dt.weekday() in a_locked_py:
            model.add(x[i] == 1)

    # Locked nights for parent_b: parent_b cannot have child → x[d] = 0
    b_locked_py = {_js_to_python_dow(d) for d in parent_b.availability.locked_nights}
    for i, dt in enumerate(dates):
        if dt.weekday() in b_locked_py:
            model.add(x[i] == 0)

    # Max consecutive for parent_a (x=0): in any window of (max+1), at least one x=1
    max_consec_a = min(
        inputs.parent_a.preferences.max_consecutive_nights_away,
        age_hints.get("suggested_max_consecutive", 7),
    )
    # This is max consecutive for the OTHER parent being away,
    # meaning max consecutive nights WITH parent_a.
    # If parent_a max_consecutive_nights_away = 5, parent_b can have child
    # at most 5 consecutive nights (parent_a away for 5).
    # So: max consecutive x=1 (parent_b) <= max_consec_a
    for i in range(n - max_consec_a):
        window = [x[i + j] for j in range(max_consec_a + 1)]
        model.add(sum(window) >= 1)  # at least one parent_b night broken

    # Max consecutive for parent_b (x=1): in any window of (max+1), at least one x=0
    max_consec_b = min(
        parent_b.preferences.max_consecutive_nights_away,
        age_hints.get("suggested_max_consecutive", 7),
    )
    for i in range(n - max_consec_b):
        window = [x[i + j] for j in range(max_consec_b + 1)]
        model.add(sum(window) <= max_consec_b)  # at most max_consec_b parent_b nights

    # Minimum nights per 2 weeks
    if inputs.parent_a.constraints.minimum_nights_per_2_weeks is not None:
        min_a = inputs.parent_a.constraints.minimum_nights_per_2_weeks
        # parent_a nights = n - sum(x)
        model.add(n - sum(x) >= min_a)

    if parent_b.constraints.minimum_nights_per_2_weeks is not None:
        min_b = parent_b.constraints.minimum_nights_per_2_weeks
        model.add(sum(x) >= min_b)

    # ── Objective (weighted soft constraints) ──
    penalties = []

    # 1. Fairness deviation: |sum(x) - target_b_nights|
    target_b_nights = int(round(n * parent_b.preferences.target_share_pct / 100))
    sum_x = sum(x)
    fair_dev = model.new_int_var(0, n, "fair_dev")
    # |sum_x - target| using auxiliary variable
    diff = model.new_int_var(-n, n, "fair_diff")
    model.add(diff == sum_x - target_b_nights)
    model.add_abs_equality(fair_dev, diff)
    penalties.append(int(weights.fairness_deviation) * fair_dev)

    # 2. Total transitions
    total_trans = sum(t)
    penalties.append(int(weights.total_transitions) * total_trans)

    # 3. Non-school handoffs: transitions on days where next day is not school
    school_days_py = {_js_to_python_dow(d) for d in inputs.school_schedule.school_days}
    daycare_days_py = set()
    if inputs.daycare_schedule:
        daycare_days_py = {_js_to_python_dow(d) for d in inputs.daycare_schedule.daycare_days}
    exchange_days_py = school_days_py | daycare_days_py

    non_school_terms = []
    for i in range(len(t)):
        transition_date = dates[i + 1]
        if transition_date.weekday() not in exchange_days_py:
            non_school_terms.append(t[i])
    if non_school_terms:
        penalties.append(int(weights.non_school_handoffs) * sum(non_school_terms))

    # 4. Weekend fragmentation: penalize weekends split across parents
    # A weekend = Fri+Sat nights. Fragmented if exactly one of them is parent_b.
    weekend_frag_vars = []
    for i in range(n - 1):
        dt = dates[i]
        js_dow = _python_to_js_dow(dt.weekday())
        if js_dow == 5:  # Friday
            next_dt = dates[i + 1] if i + 1 < n else None
            if next_dt and _python_to_js_dow(next_dt.weekday()) == 6:  # Saturday
                # Fragmented if x[i] != x[i+1] (Fri != Sat)
                frag = model.new_bool_var(f"wfrag_{i}")
                model.add(frag >= x[i] - x[i + 1])
                model.add(frag >= x[i + 1] - x[i])
                model.add(frag <= x[i] + x[i + 1])
                model.add(frag <= 2 - x[i] - x[i + 1])
                weekend_frag_vars.append(frag)

    if weekend_frag_vars:
        penalties.append(int(weights.weekend_fragmentation) * sum(weekend_frag_vars))

    # 5. School-night disruption: transitions on Sun-Thu (before school days)
    school_night_terms = []
    for i in range(len(t)):
        dt = dates[i + 1]
        # A school night is the night before a school day
        next_day = dt + timedelta(days=1)
        if next_day.weekday() in school_days_py or dt.weekday() in school_days_py:
            # Transition on a day that is a school day or before a school day
            js_dow = _python_to_js_dow(dt.weekday())
            if js_dow in (0, 1, 2, 3, 4):  # Sun-Thu in JS
                school_night_terms.append(t[i])
    if school_night_terms:
        penalties.append(int(weights.school_night_disruption) * sum(school_night_terms))

    # 6. Weekend parity: |a_weekends - b_weekends|
    weekend_indices = []
    for i, dt in enumerate(dates):
        js_dow = _python_to_js_dow(dt.weekday())
        if js_dow in (5, 6):  # Fri, Sat
            weekend_indices.append(i)

    if weekend_indices:
        b_weekends = sum(x[i] for i in weekend_indices)
        total_weekends = len(weekend_indices)
        target_b_weekends = total_weekends // 2
        wp_dev = model.new_int_var(0, total_weekends, "wp_dev")
        wp_diff = model.new_int_var(-total_weekends, total_weekends, "wp_diff")
        model.add(wp_diff == b_weekends - target_b_weekends)
        model.add_abs_equality(wp_dev, wp_diff)
        penalties.append(int(weights.weekend_parity) * wp_dev)

    # ── Set objective ──
    model.minimize(sum(penalties))

    # ── Solve ──
    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = timeout_seconds
    # Use 1 worker for determinism
    solver.parameters.num_workers = 1

    status = solver.solve(model)

    if status not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        return None

    # ── Extract solution ──
    assignments: list[ScheduleDay] = []
    for i, dt in enumerate(dates):
        parent = "parent_b" if solver.value(x[i]) == 1 else "parent_a"
        is_trans = False
        if i > 0:
            prev_parent = "parent_b" if solver.value(x[i - 1]) == 1 else "parent_a"
            is_trans = parent != prev_parent

        assignments.append(ScheduleDay(
            date=dt.isoformat(),
            day_of_week=_python_to_js_dow(dt.weekday()),
            assigned_to=parent,
            is_transition=is_trans,
        ))

    # Build handoffs
    handoffs = _build_handoffs(assignments, inputs)

    # Compute stats
    stats = compute_stats(
        assignments,
        school_days=inputs.school_schedule.school_days,
    )

    option = ScheduleOption(
        id=str(uuid.uuid4()),
        name=get_profile_name(profile),
        profile=profile,
        schedule=assignments,
        handoffs=handoffs,
        stats=stats,
        explanation=Explanation(
            bullets=[], respected_constraints=[], tradeoffs=[], assumptions=[],
        ),
    )

    # Generate explanation (uses the option + inputs + stats)
    option.explanation = generate_explanation(option, inputs, stats)

    return option


def _hamming_distance(a: list[ScheduleDay], b: list[ScheduleDay]) -> int:
    """Count days where assignments differ between two options."""
    return sum(
        1 for x, y in zip(a, b)
        if x.assigned_to != y.assigned_to
    )


def generate_options(
    inputs: OnboardingInput,
    config: OnboardingConfig | None = None,
) -> OnboardingOutput:
    """
    Main entry point: generate 3-5 schedule options for onboarding.

    Runs the CP-SAT solver once per requested profile, filters for
    diversity, and attaches explanations.
    """
    start_time = time.monotonic()

    if config is None:
        config = OnboardingConfig()

    # ── Conflict check ──
    conflict_report = detect_conflicts(inputs)
    if not conflict_report.feasible:
        return OnboardingOutput(
            options=[],
            conflict_report=conflict_report,
            solve_time_ms=round((time.monotonic() - start_time) * 1000, 1),
            is_partial=inputs.parent_b is None,
        )

    # ── Resolve parent B ──
    parent_b = inputs.parent_b or _default_parent_b(inputs.parent_a)
    is_partial = inputs.parent_b is None

    # ── Age-band hints ──
    age_hints = _age_band_defaults(inputs.children_age_bands)

    # ── Generate dates ──
    dates = _date_range(inputs.shared.start_date, inputs.shared.horizon_days)

    # ── Solve each profile ──
    profiles = config.profiles or list(OptionProfile)
    options: list[ScheduleOption] = []

    for profile in profiles:
        weights = get_profile_weights(profile)
        option = _solve_single_profile(
            dates=dates,
            profile=profile,
            weights=weights,
            inputs=inputs,
            parent_b=parent_b,
            age_hints=age_hints,
            timeout_seconds=max(config.timeout_seconds // len(profiles), 5),
        )
        if option is not None:
            options.append(option)

    # ── Diversity filter ──
    # Remove options that are too similar (same assignment pattern)
    if config.min_diversity_distance > 0 and len(options) > 1:
        filtered = [options[0]]
        for opt in options[1:]:
            is_diverse = all(
                _hamming_distance(opt.schedule, kept.schedule)
                >= config.min_diversity_distance
                for kept in filtered
            )
            if is_diverse:
                filtered.append(opt)
            # If not diverse, still keep if we have fewer than 3 options
            elif len(filtered) < 3:
                filtered.append(opt)
        options = filtered

    elapsed = round((time.monotonic() - start_time) * 1000, 1)

    return OnboardingOutput(
        options=options,
        conflict_report=conflict_report if conflict_report.conflicts else None,
        solve_time_ms=elapsed,
        is_partial=is_partial,
    )
