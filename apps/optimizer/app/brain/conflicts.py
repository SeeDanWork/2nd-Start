"""
Conflict detection for onboarding inputs.

Detects mutually incompatible hard constraints and suggests relaxations.
"""

from __future__ import annotations

from app.brain.domain import (
    OnboardingInput,
    ConflictReport,
    ConflictDetail,
    ValidationResult,
    ValidationError,
)


def validate_inputs(inputs: OnboardingInput) -> ValidationResult:
    """Validate onboarding inputs for structural correctness."""
    errors: list[ValidationError] = []

    # Start date required
    if not inputs.shared.start_date:
        errors.append(ValidationError(
            field="shared.start_date",
            message="Start date is required.",
        ))

    # Parent A required
    if not inputs.parent_a or not inputs.parent_a.parent_id:
        errors.append(ValidationError(
            field="parent_a.parent_id",
            message="Parent A ID is required.",
        ))

    # Locked nights must be valid JS day numbers (0-6)
    for night in inputs.parent_a.availability.locked_nights:
        if night < 0 or night > 6:
            errors.append(ValidationError(
                field="parent_a.availability.locked_nights",
                message=f"Invalid day number: {night}. Must be 0-6 (Sun-Sat).",
            ))

    if inputs.parent_b:
        for night in inputs.parent_b.availability.locked_nights:
            if night < 0 or night > 6:
                errors.append(ValidationError(
                    field="parent_b.availability.locked_nights",
                    message=f"Invalid day number: {night}. Must be 0-6 (Sun-Sat).",
                ))

    # Target shares should be complementary
    if inputs.parent_b:
        total = inputs.parent_a.preferences.target_share_pct + \
                inputs.parent_b.preferences.target_share_pct
        if abs(total - 100.0) > 5.0:
            errors.append(ValidationError(
                field="preferences.target_share_pct",
                message=f"Target shares sum to {total}%, expected ~100%.",
            ))

    # Age bands should match number of children
    if len(inputs.children_age_bands) != inputs.number_of_children:
        errors.append(ValidationError(
            field="children_age_bands",
            message="Number of age bands must match number_of_children.",
        ))

    return ValidationResult(valid=len(errors) == 0, errors=errors)


def detect_conflicts(inputs: OnboardingInput) -> ConflictReport:
    """Detect infeasible constraint combinations."""
    conflicts: list[ConflictDetail] = []
    a_locked = set(inputs.parent_a.availability.locked_nights)

    b_locked: set[int] = set()
    if inputs.parent_b:
        b_locked = set(inputs.parent_b.availability.locked_nights)

    # ── Overlapping locked nights ──
    # If both parents lock the same night, no one can have the child.
    overlap = a_locked & b_locked
    if overlap:
        day_names = {0: "Sun", 1: "Mon", 2: "Tue", 3: "Wed",
                     4: "Thu", 5: "Fri", 6: "Sat"}
        overlap_names = [day_names.get(d, str(d)) for d in sorted(overlap)]
        conflicts.append(ConflictDetail(
            description=(
                f"Both parents have locked nights on {', '.join(overlap_names)}. "
                "No parent is available for overnight custody."
            ),
            involved_constraints=[
                "parent_a.locked_nights",
                "parent_b.locked_nights",
            ],
            suggested_relaxation=(
                f"Remove one parent's lock on {overlap_names[0]} "
                "to allow at least one parent to be available."
            ),
        ))

    # ── All nights locked ──
    # If between both parents, every night of the week is locked
    all_days = set(range(7))
    if a_locked == all_days:
        conflicts.append(ConflictDetail(
            description="Parent A has locked every night of the week.",
            involved_constraints=["parent_a.locked_nights"],
            suggested_relaxation="Remove at least 3-4 locked nights for Parent A.",
        ))
    if inputs.parent_b and b_locked == all_days:
        conflicts.append(ConflictDetail(
            description="Parent B has locked every night of the week.",
            involved_constraints=["parent_b.locked_nights"],
            suggested_relaxation="Remove at least 3-4 locked nights for Parent B.",
        ))

    # ── Insufficient nights for target share ──
    if inputs.parent_b:
        horizon = inputs.shared.horizon_days
        weeks = horizon / 7.0

        a_available_per_week = 7 - len(a_locked)
        b_available_per_week = 7 - len(b_locked)

        a_target_per_week = 7 * (inputs.parent_a.preferences.target_share_pct / 100)
        b_target_per_week = 7 * (inputs.parent_b.preferences.target_share_pct / 100)

        if a_available_per_week < a_target_per_week * 0.7:
            conflicts.append(ConflictDetail(
                description=(
                    f"Parent A wants {inputs.parent_a.preferences.target_share_pct}% "
                    f"time but is only available {a_available_per_week}/7 nights/week."
                ),
                involved_constraints=[
                    "parent_a.locked_nights",
                    "parent_a.preferences.target_share_pct",
                ],
                suggested_relaxation=(
                    "Reduce Parent A's target share or remove some locked nights."
                ),
            ))

        if b_available_per_week < b_target_per_week * 0.7:
            conflicts.append(ConflictDetail(
                description=(
                    f"Parent B wants {inputs.parent_b.preferences.target_share_pct}% "
                    f"time but is only available {b_available_per_week}/7 nights/week."
                ),
                involved_constraints=[
                    "parent_b.locked_nights",
                    "parent_b.preferences.target_share_pct",
                ],
                suggested_relaxation=(
                    "Reduce Parent B's target share or remove some locked nights."
                ),
            ))

    # ── No-contact + no school/daycare days ──
    if inputs.shared.no_contact_preference:
        exchange_days = set(inputs.school_schedule.school_days)
        if inputs.daycare_schedule:
            exchange_days |= set(inputs.daycare_schedule.daycare_days)
        if len(exchange_days) == 0:
            conflicts.append(ConflictDetail(
                description=(
                    "No-contact exchange is preferred but no school or "
                    "daycare days are configured for handoffs."
                ),
                involved_constraints=[
                    "shared.no_contact_preference",
                    "school_schedule.school_days",
                ],
                suggested_relaxation=(
                    "Add school or daycare days, or disable no-contact preference."
                ),
            ))

    feasible = len(conflicts) == 0 or not any(
        "Both parents have locked nights" in c.description and
        len(set(inputs.parent_a.availability.locked_nights) &
            set(inputs.parent_b.availability.locked_nights if inputs.parent_b else []))
        == 7
        for c in conflicts
    )

    return ConflictReport(feasible=feasible, conflicts=conflicts)
