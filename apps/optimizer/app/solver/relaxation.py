"""Deterministic constraint relaxation engine.

When CP-SAT returns INFEASIBLE, systematically relax constraints in a
fixed priority order (lowest priority first) and re-solve.

Relaxation order (first relaxed = lowest priority):
1. TARGET_FAIRNESS — set fairness_deviation weight to 0
2. WEEKEND_SPLIT — remove weekend_split constraint
3. MAX_TRANSITIONS_PER_WEEK — remove cap (set to 0 = unlimited)
4. MAX_CONSECUTIVE — remove all constraints
5. MIN_CONSECUTIVE — remove all constraints
6. LOCKED_NIGHTS — remove all locks
7. DISRUPTION_LOCK — NEVER relaxed
"""

from copy import deepcopy
from typing import Callable, Optional

from app.models.requests import ScheduleRequest, ProposalRequest, SolverWeights
from app.models.responses import (
    RelaxationInfo,
    RelaxationStepResponse,
    ScheduleResponse,
    ProposalResponse,
)


RELAXATION_ORDER = [
    "TARGET_FAIRNESS",
    "WEEKEND_SPLIT",
    "MAX_TRANSITIONS_PER_WEEK",
    "MAX_CONSECUTIVE",
    "MIN_CONSECUTIVE",
    "LOCKED_NIGHTS",
]


def _relax_target_fairness(request):
    """Set fairness_deviation weight to 0."""
    r = deepcopy(request)
    r.weights = SolverWeights(
        fairness_deviation=0,
        total_transitions=r.weights.total_transitions,
        non_daycare_handoffs=r.weights.non_daycare_handoffs,
        weekend_fragmentation=r.weights.weekend_fragmentation,
        school_night_disruption=r.weights.school_night_disruption,
        handoff_location_preference=r.weights.handoff_location_preference,
    )
    return r, "Set fairness_deviation weight to 0"


def _relax_weekend_split(request):
    """Remove weekend_split constraint."""
    r = deepcopy(request)
    r.weekend_split = None
    return r, "Removed weekend_split constraint"


def _relax_max_transitions_per_week(request):
    """Remove max transitions per week cap."""
    r = deepcopy(request)
    r.max_transitions_per_week = 0
    return r, "Removed max_transitions_per_week cap"


def _relax_max_consecutive(request):
    """Remove all max consecutive constraints."""
    r = deepcopy(request)
    r.max_consecutive = []
    return r, "Removed all max_consecutive constraints"


def _relax_min_consecutive(request):
    """Remove all min consecutive constraints."""
    r = deepcopy(request)
    r.min_consecutive = []
    return r, "Removed all min_consecutive constraints"


def _relax_locked_nights(request):
    """Remove all locked nights."""
    r = deepcopy(request)
    r.locked_nights = []
    return r, "Removed all locked_nights constraints"


_RELAX_FUNCTIONS = {
    "TARGET_FAIRNESS": _relax_target_fairness,
    "WEEKEND_SPLIT": _relax_weekend_split,
    "MAX_TRANSITIONS_PER_WEEK": _relax_max_transitions_per_week,
    "MAX_CONSECUTIVE": _relax_max_consecutive,
    "MIN_CONSECUTIVE": _relax_min_consecutive,
    "LOCKED_NIGHTS": _relax_locked_nights,
}


class RelaxationResult:
    """Result of the relaxation process."""

    def __init__(self):
        self.steps: list[RelaxationStepResponse] = []
        self.was_relaxed: bool = False
        self.final_request = None

    def to_info(self) -> RelaxationInfo:
        return RelaxationInfo(
            was_relaxed=self.was_relaxed,
            steps=self.steps,
        )


def try_relaxation(
    original_request,
    solve_fn: Callable,
    max_attempts: int = 6,
):
    """Progressive relaxation: relax one more constraint each attempt.

    Args:
        original_request: The original ScheduleRequest or ProposalRequest
        solve_fn: The core solver function (e.g., _solve_core or _solve_proposals_core)
        max_attempts: Maximum relaxation attempts (bounded by RELAXATION_ORDER length)

    Returns:
        (response, RelaxationResult) — response is from the solver,
        result contains metadata about what was relaxed.
    """
    result = RelaxationResult()
    current_request = deepcopy(original_request)
    attempts = min(max_attempts, len(RELAXATION_ORDER))

    for i in range(attempts):
        constraint_name = RELAXATION_ORDER[i]
        relax_fn = _RELAX_FUNCTIONS[constraint_name]
        current_request, action = relax_fn(current_request)

        response = solve_fn(current_request)

        succeeded = response.status != "infeasible"
        result.steps.append(RelaxationStepResponse(
            constraint_name=constraint_name,
            action=action,
            succeeded=succeeded,
        ))

        if succeeded:
            result.was_relaxed = True
            result.final_request = current_request
            return response, result

    # All attempts exhausted
    result.was_relaxed = False
    return None, result
