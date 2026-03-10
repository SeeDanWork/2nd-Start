"""
Scenario fixture builders for the base schedule solver.

20 scenarios covering: baseline, constraints, disruptions, tie-break,
horizon boundary, multi-child, and infeasibility.
"""

from app.models.requests import (
    ScheduleRequest,
    LockedNight,
    MaxConsecutive,
    WeekendSplit,
    BonusWeek,
    HolidayEntry,
    DisruptionLock,
    SolverWeights,
    ProposalRequest,
    FrozenAssignment,
    RequestConstraint,
    ParentRole,
)


def scenario_baseline_5050() -> ScheduleRequest:
    """S1: Baseline 50/50 — no constraints, just fairness."""
    return ScheduleRequest(
        horizon_start="2027-03-01",
        horizon_end="2027-03-14",
        weights=SolverWeights(fairness_deviation=200, total_transitions=50),
        max_solutions=3,
        timeout_seconds=10,
    )


def scenario_locked_nights() -> ScheduleRequest:
    """S2: Locked nights respected — Parent A locked Tue/Thu (JS 2, 4)."""
    return ScheduleRequest(
        horizon_start="2027-03-01",
        horizon_end="2027-03-14",
        locked_nights=[
            LockedNight(parent=ParentRole.PARENT_A, days_of_week=[2, 4]),
        ],
        max_solutions=3,
        timeout_seconds=10,
    )


def scenario_conflicting_constraints() -> ScheduleRequest:
    """S3: Infeasible — both parents lock Mon-Wed (JS 1, 2, 3)."""
    return ScheduleRequest(
        horizon_start="2027-03-01",
        horizon_end="2027-03-14",
        locked_nights=[
            LockedNight(parent=ParentRole.PARENT_A, days_of_week=[1, 2, 3]),
            LockedNight(parent=ParentRole.PARENT_B, days_of_week=[1, 2, 3]),
        ],
        max_solutions=3,
        timeout_seconds=10,
    )


def scenario_infant_stability() -> ScheduleRequest:
    """S4: Under-5 stability — max 2 consecutive per parent."""
    return ScheduleRequest(
        horizon_start="2027-03-01",
        horizon_end="2027-03-14",
        max_consecutive=[
            MaxConsecutive(parent=ParentRole.PARENT_A, max_nights=2),
            MaxConsecutive(parent=ParentRole.PARENT_B, max_nights=2),
        ],
        weights=SolverWeights(total_transitions=200),
        max_solutions=3,
        timeout_seconds=10,
    )


def scenario_tight_max_consecutive() -> ScheduleRequest:
    """S5: Tight max consecutive — 3 nights max per parent."""
    return ScheduleRequest(
        horizon_start="2027-03-01",
        horizon_end="2027-03-14",
        max_consecutive=[
            MaxConsecutive(parent=ParentRole.PARENT_A, max_nights=3),
            MaxConsecutive(parent=ParentRole.PARENT_B, max_nights=3),
        ],
        max_solutions=3,
        timeout_seconds=10,
    )


def scenario_low_transition_cap() -> ScheduleRequest:
    """S6: Low transition cap — max 1 transition per week."""
    return ScheduleRequest(
        horizon_start="2027-03-01",
        horizon_end="2027-03-14",
        max_transitions_per_week=1,
        max_solutions=3,
        timeout_seconds=10,
    )


def scenario_weekend_fri_sat() -> ScheduleRequest:
    """S7: Weekend definition fri_sat."""
    return ScheduleRequest(
        horizon_start="2027-03-01",
        horizon_end="2027-03-14",
        weekend_definition="fri_sat",
        weights=SolverWeights(weekend_fragmentation=200),
        max_solutions=3,
        timeout_seconds=10,
    )


def scenario_weekend_parity_conflict() -> ScheduleRequest:
    """S8: Weekend parity conflict — tight weekend split with locks."""
    return ScheduleRequest(
        horizon_start="2027-03-01",
        horizon_end="2027-03-14",
        weekend_definition="sat_sun",
        weekend_split=WeekendSplit(target_pct_parent_a=50, tolerance_pct=5),
        locked_nights=[
            LockedNight(parent=ParentRole.PARENT_A, days_of_week=[6]),  # Sat
        ],
        max_solutions=3,
        timeout_seconds=10,
    )


def scenario_no_contact_exchange() -> ScheduleRequest:
    """S9: No-contact exchange — all handoffs at school."""
    return ScheduleRequest(
        horizon_start="2027-03-01",
        horizon_end="2027-03-14",
        daycare_exchange_days=[1, 2, 3, 4, 5],  # Mon-Fri
        weights=SolverWeights(non_daycare_handoffs=500),
        max_solutions=3,
        timeout_seconds=10,
    )


def scenario_long_distance() -> ScheduleRequest:
    """S10: Long distance — minimize transitions heavily."""
    return ScheduleRequest(
        horizon_start="2027-03-01",
        horizon_end="2027-03-14",
        weights=SolverWeights(total_transitions=500),
        max_solutions=3,
        timeout_seconds=10,
    )


def scenario_short_disruption() -> ScheduleRequest:
    """S11: Short disruption <=72h — 2-day disruption lock."""
    return ScheduleRequest(
        horizon_start="2027-03-01",
        horizon_end="2027-03-14",
        disruption_locks=[
            DisruptionLock(parent=ParentRole.PARENT_B, date="2027-03-05"),
            DisruptionLock(parent=ParentRole.PARENT_B, date="2027-03-06"),
        ],
        max_solutions=3,
        timeout_seconds=10,
    )


def scenario_long_disruption() -> ScheduleRequest:
    """S12: Long disruption >72h — 5-day disruption lock."""
    return ScheduleRequest(
        horizon_start="2027-03-01",
        horizon_end="2027-03-14",
        disruption_locks=[
            DisruptionLock(parent=ParentRole.PARENT_B, date="2027-03-03"),
            DisruptionLock(parent=ParentRole.PARENT_B, date="2027-03-04"),
            DisruptionLock(parent=ParentRole.PARENT_B, date="2027-03-05"),
            DisruptionLock(parent=ParentRole.PARENT_B, date="2027-03-06"),
            DisruptionLock(parent=ParentRole.PARENT_B, date="2027-03-07"),
        ],
        max_solutions=3,
        timeout_seconds=10,
    )


def scenario_overlapping_disruptions() -> ScheduleRequest:
    """S13: Overlapping disruptions — both parents have locks on different dates."""
    return ScheduleRequest(
        horizon_start="2027-03-01",
        horizon_end="2027-03-14",
        disruption_locks=[
            DisruptionLock(parent=ParentRole.PARENT_B, date="2027-03-03"),
            DisruptionLock(parent=ParentRole.PARENT_B, date="2027-03-04"),
            DisruptionLock(parent=ParentRole.PARENT_A, date="2027-03-10"),
            DisruptionLock(parent=ParentRole.PARENT_A, date="2027-03-11"),
        ],
        max_solutions=3,
        timeout_seconds=10,
    )


def scenario_horizon_boundary() -> ScheduleRequest:
    """S18: Horizon boundary — very short 7-day horizon."""
    return ScheduleRequest(
        horizon_start="2027-03-01",
        horizon_end="2027-03-07",
        max_solutions=3,
        timeout_seconds=10,
    )


def scenario_infeasible_combined() -> ScheduleRequest:
    """S20: Infeasible combined — max 1 consecutive + locked nights = impossible."""
    return ScheduleRequest(
        horizon_start="2027-03-01",
        horizon_end="2027-03-14",
        locked_nights=[
            LockedNight(parent=ParentRole.PARENT_A, days_of_week=[1, 2, 3]),
        ],
        max_consecutive=[
            MaxConsecutive(parent=ParentRole.PARENT_B, max_nights=1),
        ],
        max_solutions=3,
        timeout_seconds=10,
    )
