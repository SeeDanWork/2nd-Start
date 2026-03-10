"""Deterministic constraint relaxation engine.

When CP-SAT returns INFEASIBLE, systematically relax constraints in a
fixed priority order (lowest priority first) using graduated steps.

Relaxation order (first relaxed = lowest priority):
1. TARGET_FAIRNESS — reduce weight by 50% → set to 0
2. WEEKEND_SPLIT — widen tolerance +10% → +20% → remove
3. MAX_TRANSITIONS_PER_WEEK — cap += 1 → remove cap
4. MAX_CONSECUTIVE — each parent += 1 → += 2 → remove all
5. MIN_CONSECUTIVE — each parent -= 1 (min 1) → remove all
6. LOCKED_NIGHTS — remove all locks
7. DISRUPTION_LOCK — NEVER relaxed

Total graduated steps: 2+3+2+3+2+1 = 13
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


# ─── Individual relaxation step functions ────────────────────────────
# Each takes (request) and returns (modified_request, action_description).
# Step functions modify the field they own; chained via deepcopy internally.

# TARGET_FAIRNESS steps (2)
def _relax_target_fairness_step1(request):
    """Reduce fairness_deviation weight by 50%."""
    r = deepcopy(request)
    new_weight = int(round(r.weights.fairness_deviation * 0.5))
    r.weights = r.weights.model_copy(update={"fairness_deviation": new_weight})
    return r, f"Reduced fairness_deviation weight by 50% (to {new_weight})"


def _relax_target_fairness(request):
    """Set fairness_deviation weight to 0."""
    r = deepcopy(request)
    r.weights = r.weights.model_copy(update={"fairness_deviation": 0})
    return r, "Set fairness_deviation weight to 0"


# WEEKEND_SPLIT steps (3)
def _relax_weekend_split_step1(request):
    """Widen weekend_split tolerance by +10%."""
    r = deepcopy(request)
    if r.weekend_split is not None:
        r.weekend_split = r.weekend_split.model_copy(
            update={"tolerance_pct": r.weekend_split.tolerance_pct + 10}
        )
    return r, "Widened weekend_split tolerance by +10%"


def _relax_weekend_split_step2(request):
    """Widen weekend_split tolerance by +20%."""
    r = deepcopy(request)
    if r.weekend_split is not None:
        r.weekend_split = r.weekend_split.model_copy(
            update={"tolerance_pct": r.weekend_split.tolerance_pct + 20}
        )
    return r, "Widened weekend_split tolerance by +20%"


def _relax_weekend_split(request):
    """Remove weekend_split constraint."""
    r = deepcopy(request)
    r.weekend_split = None
    return r, "Removed weekend_split constraint"


# MAX_TRANSITIONS_PER_WEEK steps (2)
def _relax_max_transitions_step1(request):
    """Increase max transitions per week cap by 1."""
    r = deepcopy(request)
    r.max_transitions_per_week = r.max_transitions_per_week + 1
    return r, f"Increased max_transitions_per_week by 1 (to {r.max_transitions_per_week})"


def _relax_max_transitions_per_week(request):
    """Remove max transitions per week cap."""
    r = deepcopy(request)
    r.max_transitions_per_week = 0
    return r, "Removed max_transitions_per_week cap"


# MAX_CONSECUTIVE steps (3)
def _relax_max_consecutive_step1(request):
    """Increase each parent's max consecutive by 1."""
    r = deepcopy(request)
    r.max_consecutive = [
        mc.model_copy(update={"max_nights": mc.max_nights + 1})
        for mc in r.max_consecutive
    ]
    descs = [f"{mc.parent.value}: {mc.max_nights}" for mc in r.max_consecutive]
    return r, f"Increased max_consecutive by +1 ({', '.join(descs)})"


def _relax_max_consecutive_step2(request):
    """Increase each parent's max consecutive by 2."""
    r = deepcopy(request)
    r.max_consecutive = [
        mc.model_copy(update={"max_nights": mc.max_nights + 2})
        for mc in r.max_consecutive
    ]
    descs = [f"{mc.parent.value}: {mc.max_nights}" for mc in r.max_consecutive]
    return r, f"Increased max_consecutive by +2 ({', '.join(descs)})"


def _relax_max_consecutive(request):
    """Remove all max consecutive constraints."""
    r = deepcopy(request)
    r.max_consecutive = []
    return r, "Removed all max_consecutive constraints"


# MIN_CONSECUTIVE steps (2)
def _relax_min_consecutive_step1(request):
    """Decrease each parent's min consecutive by 1 (min 1)."""
    r = deepcopy(request)
    r.min_consecutive = [
        mc.model_copy(update={"min_nights": max(1, mc.min_nights - 1)})
        for mc in r.min_consecutive
    ]
    descs = [f"{mc.parent.value}: {mc.min_nights}" for mc in r.min_consecutive]
    return r, f"Decreased min_consecutive by -1 ({', '.join(descs)})"


def _relax_min_consecutive(request):
    """Remove all min consecutive constraints."""
    r = deepcopy(request)
    r.min_consecutive = []
    return r, "Removed all min_consecutive constraints"


# LOCKED_NIGHTS steps (1)
def _relax_locked_nights(request):
    """Remove all locked nights."""
    r = deepcopy(request)
    r.locked_nights = []
    return r, "Removed all locked_nights constraints"


# ─── Graduated relaxation steps ─────────────────────────────────────

RELAXATION_ORDER = [
    "TARGET_FAIRNESS",
    "WEEKEND_SPLIT",
    "MAX_TRANSITIONS_PER_WEEK",
    "MAX_CONSECUTIVE",
    "MIN_CONSECUTIVE",
    "LOCKED_NIGHTS",
]

RELAXATION_STEPS: list[tuple[str, list[Callable]]] = [
    ("TARGET_FAIRNESS", [_relax_target_fairness_step1, _relax_target_fairness]),
    ("WEEKEND_SPLIT", [_relax_weekend_split_step1, _relax_weekend_split_step2, _relax_weekend_split]),
    ("MAX_TRANSITIONS_PER_WEEK", [_relax_max_transitions_step1, _relax_max_transitions_per_week]),
    ("MAX_CONSECUTIVE", [_relax_max_consecutive_step1, _relax_max_consecutive_step2, _relax_max_consecutive]),
    ("MIN_CONSECUTIVE", [_relax_min_consecutive_step1, _relax_min_consecutive]),
    ("LOCKED_NIGHTS", [_relax_locked_nights]),
]

TOTAL_RELAXATION_STEPS = sum(len(steps) for _, steps in RELAXATION_STEPS)  # 13


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
    max_attempts: int = 13,
):
    """Progressive graduated relaxation: try increasingly aggressive
    relaxation steps in a fixed order.

    Cumulative: each attempt composes the most aggressive step tried
    for each constraint group so far, plus the current step.

    Args:
        original_request: The original ScheduleRequest or ProposalRequest
        solve_fn: The core solver function (e.g., _solve_core)
        max_attempts: Maximum total relaxation step attempts

    Returns:
        (response, RelaxationResult) — response is from the solver,
        result contains metadata about what was relaxed.
    """
    result = RelaxationResult()
    attempts_used = 0

    # Track the latest step function for each constraint group.
    # These are applied cumulatively: all prior groups' latest steps
    # plus the current step being attempted.
    committed_steps: dict[str, Callable] = {}

    for group_idx, (constraint_name, step_fns) in enumerate(RELAXATION_STEPS):
        for step_fn in step_fns:
            if attempts_used >= max_attempts:
                result.was_relaxed = False
                return None, result

            # Build the cumulative request:
            # 1. Start from original
            # 2. Apply latest step for each previously-committed constraint group
            # 3. Apply current step
            current = original_request

            # Apply all committed steps from prior constraint groups
            for prev_name, prev_fn in committed_steps.items():
                if prev_name != constraint_name:
                    current, _ = prev_fn(current)

            # Apply current step
            current, action = step_fn(current)

            response = solve_fn(current)
            succeeded = response.status != "infeasible"
            attempts_used += 1

            result.steps.append(RelaxationStepResponse(
                constraint_name=constraint_name,
                action=action,
                succeeded=succeeded,
            ))

            if succeeded:
                result.was_relaxed = True
                result.final_request = current
                return response, result

        # All steps for this constraint group exhausted without success.
        # Commit the most aggressive step (last one) for cumulative composition.
        committed_steps[constraint_name] = step_fns[-1]

    # All attempts exhausted
    result.was_relaxed = False
    return None, result
