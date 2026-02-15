"""Proposal generation using CP-SAT solver. Stub for Phase 0."""

from app.models.requests import ProposalRequest
from app.models.responses import (
    FairnessImpact,
    HandoffImpact,
    ProposalOption,
    ProposalResponse,
    StabilityImpact,
)


def generate_proposals(request: ProposalRequest) -> ProposalResponse:
    """
    Stub: returns a single mock proposal option.
    Full CP-SAT implementation in Step 5.2.
    """
    option = ProposalOption(
        rank=1,
        label="Minimal disruption",
        assignments=[],
        calendar_diff=[],
        fairness_impact=FairnessImpact(overnight_delta=0, weekend_delta=0, window_weeks=8),
        stability_impact=StabilityImpact(
            transitions_delta=0, max_streak_change=0, school_night_changes=0
        ),
        handoff_impact=HandoffImpact(
            new_handoffs=0, removed_handoffs=0, non_daycare_handoffs=0
        ),
        penalty_score=0.0,
        is_auto_approvable=False,
    )

    return ProposalResponse(
        status="feasible",
        options=[option],
        solve_time_ms=0.0,
    )
