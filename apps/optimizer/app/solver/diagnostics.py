"""Infeasibility diagnostics module.

Analyzes the original request to identify likely constraint conflicts
and produces structured diagnostics when the solver returns infeasible
or relaxed_solution.
"""

from app.models.requests import ScheduleRequest, ProposalRequest
from app.models.responses import (
    DiagnosticDetail,
    InfeasibilityDiagnostics,
    RelaxationStepResponse,
)
from app.solver.relaxation import RelaxationResult


def _detect_overlapping_locked_nights(request) -> list[DiagnosticDetail]:
    """Detect if both parents have locked nights on the same day of week."""
    diagnostics = []
    locked_nights = getattr(request, 'locked_nights', [])
    if len(locked_nights) < 2:
        return diagnostics

    parent_a_days = set()
    parent_b_days = set()
    for ln in locked_nights:
        if ln.parent.value == "parent_a":
            parent_a_days.update(ln.days_of_week)
        else:
            parent_b_days.update(ln.days_of_week)

    overlap = parent_a_days & parent_b_days
    if overlap:
        day_names = {0: "Sun", 1: "Mon", 2: "Tue", 3: "Wed", 4: "Thu", 5: "Fri", 6: "Sat"}
        overlap_names = [day_names.get(d, str(d)) for d in sorted(overlap)]
        diagnostics.append(DiagnosticDetail(
            constraint_name="LOCKED_NIGHTS",
            description=f"Both parents have locked nights on the same days: {', '.join(overlap_names)}. "
                        f"This means no parent can have the child on those nights.",
            suggestion="Remove one parent's locked night for the overlapping days, "
                       "or designate a preferred parent for each conflicting day.",
        ))

    return diagnostics


def _detect_tight_max_consecutive(request) -> list[DiagnosticDetail]:
    """Detect max_consecutive constraints that are <=1."""
    diagnostics = []
    max_consecutive = getattr(request, 'max_consecutive', [])
    for mc in max_consecutive:
        if mc.max_nights <= 1:
            diagnostics.append(DiagnosticDetail(
                constraint_name="MAX_CONSECUTIVE",
                description=f"{mc.parent.value} has max_consecutive={mc.max_nights}, "
                            f"requiring handoffs every {mc.max_nights} night(s). "
                            f"This is extremely restrictive.",
                suggestion=f"Increase max_consecutive for {mc.parent.value} to at least 2-3 nights.",
            ))
    return diagnostics


def _detect_zero_tolerance_weekend_split(request) -> list[DiagnosticDetail]:
    """Detect weekend_split with 0% tolerance."""
    diagnostics = []
    weekend_split = getattr(request, 'weekend_split', None)
    if weekend_split and weekend_split.tolerance_pct == 0:
        diagnostics.append(DiagnosticDetail(
            constraint_name="WEEKEND_SPLIT",
            description="Weekend split has 0% tolerance — requires exact split every window. "
                        "This is very hard to satisfy with other constraints.",
            suggestion="Increase tolerance_pct to at least 10% to allow some flexibility.",
        ))
    return diagnostics


def generate_diagnostics(
    original_request,
    relaxation_result: RelaxationResult | None = None,
) -> InfeasibilityDiagnostics:
    """Generate structured diagnostics for infeasible or relaxed solutions.

    Args:
        original_request: The original ScheduleRequest or ProposalRequest
        relaxation_result: Optional result from the relaxation engine

    Returns:
        InfeasibilityDiagnostics with constraint analysis and suggestions
    """
    diagnostics_list: list[DiagnosticDetail] = []

    # Run detectors
    diagnostics_list.extend(_detect_overlapping_locked_nights(original_request))
    diagnostics_list.extend(_detect_tight_max_consecutive(original_request))
    diagnostics_list.extend(_detect_zero_tolerance_weekend_split(original_request))

    # Extract infeasible constraint names from diagnostics
    infeasible_constraints = list(dict.fromkeys(d.constraint_name for d in diagnostics_list))

    # Relaxation metadata
    relaxation_attempted: list[RelaxationStepResponse] = []
    relaxation_result_str = "not_attempted"
    if relaxation_result is not None:
        relaxation_attempted = relaxation_result.steps
        if relaxation_result.was_relaxed:
            relaxation_result_str = "succeeded"
        else:
            relaxation_result_str = "exhausted"

    return InfeasibilityDiagnostics(
        infeasible_constraints=infeasible_constraints,
        relaxation_attempted=relaxation_attempted,
        relaxation_result=relaxation_result_str,
        diagnostics=diagnostics_list,
    )
