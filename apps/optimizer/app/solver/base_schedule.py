"""Base schedule generation using CP-SAT solver. Stub for Phase 0."""

from datetime import date, timedelta

from app.models.requests import ScheduleRequest
from app.models.responses import (
    AssignmentDay,
    PenaltyBreakdown,
    ScheduleResponse,
    Solution,
    SolutionMetrics,
)


def generate_base_schedule(request: ScheduleRequest) -> ScheduleResponse:
    """
    Stub: returns a simple alternating pattern.
    Full CP-SAT implementation in Step 3.3.
    """
    start = date.fromisoformat(request.horizon_start)
    end = date.fromisoformat(request.horizon_end)
    days = (end - start).days + 1

    assignments = []
    prev_parent = None
    for i in range(days):
        d = start + timedelta(days=i)
        parent = "parent_a" if i % 2 == 0 else "parent_b"
        is_transition = prev_parent is not None and parent != prev_parent
        assignments.append(
            AssignmentDay(date=d.isoformat(), parent=parent, is_transition=is_transition)
        )
        prev_parent = parent

    a_count = sum(1 for a in assignments if a.parent == "parent_a")
    b_count = days - a_count
    transitions = sum(1 for a in assignments if a.is_transition)

    solution = Solution(
        rank=1,
        assignments=assignments,
        metrics=SolutionMetrics(
            parent_a_overnights=a_count,
            parent_b_overnights=b_count,
            parent_a_weekend_nights=0,
            parent_b_weekend_nights=0,
            total_transitions=transitions,
            transitions_per_week=transitions / max(days / 7, 1),
            max_consecutive_a=1,
            max_consecutive_b=1,
            school_night_consistency_pct=0.0,
            weekend_fragmentation_count=0,
        ),
        penalties=PenaltyBreakdown(
            fairness_deviation=0.0,
            total_transitions=float(transitions),
            non_daycare_handoffs=0.0,
            weekend_fragmentation=0.0,
            school_night_disruption=0.0,
            total=float(transitions),
        ),
    )

    return ScheduleResponse(
        status="feasible",
        solutions=[solution],
        solve_time_ms=0.0,
    )
