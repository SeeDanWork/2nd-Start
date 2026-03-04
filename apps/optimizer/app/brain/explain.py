"""
Explanation generation for schedule options.

Produces human-readable bullets, tradeoff callouts, and assumption notes.
"""

from __future__ import annotations

from app.brain.domain import (
    OnboardingInput,
    ScheduleOption,
    ScheduleStats,
    Explanation,
    OptionProfile,
    ConstraintApplied,
    DisruptionImpact,
    StabilityMetricsExplanation,
    FairnessMetricsExplanation,
)
from app.brain.profiles import get_profile_name
from app.models.responses import InfeasibilityDiagnostics


DAY_NAMES = {0: "Sun", 1: "Mon", 2: "Tue", 3: "Wed",
             4: "Thu", 5: "Fri", 6: "Sat"}


def generate_explanation(
    option: ScheduleOption,
    inputs: OnboardingInput,
    stats: ScheduleStats,
) -> Explanation:
    """Build a human-readable explanation for one schedule option."""
    bullets: list[str] = []
    respected: list[str] = []
    tradeoffs: list[str] = []
    assumptions: list[str] = []

    profile = option.profile
    profile_name = get_profile_name(profile)
    total = stats.parent_a_overnights + stats.parent_b_overnights

    # ── Summary bullets ──

    pct_a = round(100 * stats.parent_a_overnights / max(total, 1))
    pct_b = 100 - pct_a
    bullets.append(
        f"{profile_name} schedule: {pct_a}/{pct_b} split over {total} nights."
    )

    bullets.append(
        f"{stats.transitions_count} handoffs in {total} days "
        f"({round(stats.transitions_count / max(total / 7, 1), 1)}/week)."
    )

    if stats.non_school_handoffs == 0:
        bullets.append("All handoffs happen at school or daycare drop-off.")
    elif stats.non_school_handoffs == 1:
        bullets.append(
            "1 handoff requires direct parent exchange (non-school day)."
        )
    else:
        bullets.append(
            f"{stats.non_school_handoffs} handoffs require direct parent exchange."
        )

    if stats.parent_a_weekend_nights == stats.parent_b_weekend_nights:
        bullets.append("Weekend nights are split evenly between parents.")
    else:
        more_parent = "Parent A" if stats.parent_a_weekend_nights > stats.parent_b_weekend_nights else "Parent B"
        diff = abs(stats.parent_a_weekend_nights - stats.parent_b_weekend_nights)
        bullets.append(
            f"{more_parent} has {diff} more weekend night(s) in this period."
        )

    # ── Respected constraints ──

    a_locked = inputs.parent_a.availability.locked_nights
    if a_locked:
        locked_names = [DAY_NAMES.get(d, str(d)) for d in sorted(a_locked)]
        respected.append(
            f"Parent A's locked nights ({', '.join(locked_names)}) are respected."
        )

    if inputs.parent_b:
        b_locked = inputs.parent_b.availability.locked_nights
        if b_locked:
            locked_names = [DAY_NAMES.get(d, str(d)) for d in sorted(b_locked)]
            respected.append(
                f"Parent B's locked nights ({', '.join(locked_names)}) are respected."
            )

    if inputs.shared.no_contact_preference and stats.non_school_handoffs == 0:
        respected.append("No direct parent-to-parent exchanges needed.")

    # ── Tradeoff callouts based on profile ──

    if profile == OptionProfile.STABILITY:
        if stats.fairness_score < 0.9:
            tradeoffs.append(
                "Prioritizes fewer handoffs over perfect night-count parity. "
                "Slightly less fair over 2 weeks but more stable for the child."
            )
        else:
            tradeoffs.append(
                "Achieves both low transitions and good fairness."
            )

    elif profile == OptionProfile.FAIRNESS:
        if stats.transitions_count > 4:
            tradeoffs.append(
                "Tight fairness requires more frequent handoffs. "
                "More transitions but each parent gets near-equal time."
            )
        else:
            tradeoffs.append(
                "Fair split achieved without excessive transitions."
            )

    elif profile == OptionProfile.LOGISTICS:
        if stats.fairness_score < 0.85:
            tradeoffs.append(
                "Minimizes direct-contact handoffs at cost of some fairness. "
                "All exchanges happen at school/daycare when possible."
            )
        else:
            tradeoffs.append(
                "School/daycare exchanges with good fairness balance."
            )

    elif profile == OptionProfile.WEEKEND_PARITY:
        if stats.transitions_count > 4:
            tradeoffs.append(
                "Balanced weekends may require mid-week transitions. "
                "Both parents get quality weekend time."
            )
        else:
            tradeoffs.append(
                "Weekend balance achieved with minimal extra transitions."
            )

    elif profile == OptionProfile.CHILD_ROUTINE:
        tradeoffs.append(
            "Transitions happen on Fridays/weekends to preserve "
            "school-week routine. Weekday consistency is prioritized."
        )

    # ── Single-parent assumptions ──

    if inputs.parent_b is None:
        assumptions.append(
            "Parent B preferences are estimated with reasonable defaults "
            "(no locked nights, 50% target share, flexible weekends)."
        )
        assumptions.append(
            "This schedule is designed to be invite-friendly — "
            "it avoids aggressive time demands and includes flexibility."
        )
        assumptions.append(
            "When Parent B joins, the schedule can be re-optimized "
            "with their actual preferences."
        )

    # ── Enhanced fields (Phase 5) ──
    profile_used = profile if isinstance(profile, str) else str(profile)
    primary_objective = {
        OptionProfile.STABILITY: "Minimize transitions and maximize routine consistency",
        OptionProfile.FAIRNESS: "Achieve near-equal overnight split",
        OptionProfile.LOGISTICS: "Minimize non-school handoffs",
        OptionProfile.WEEKEND_PARITY: "Balance weekend nights equally",
        OptionProfile.CHILD_ROUTINE: "Preserve school-week consistency",
    }.get(profile, "Balanced optimization")

    stability_metrics_data = StabilityMetricsExplanation(
        transitions_per_week=round(stats.transitions_count / max(total / 7, 1), 2),
        max_consecutive_nights=max(
            getattr(stats, 'max_consecutive_a', 0) if hasattr(stats, 'max_consecutive_a') else 0,
            getattr(stats, 'max_consecutive_b', 0) if hasattr(stats, 'max_consecutive_b') else 0,
            0
        ),
        school_night_consistency_pct=getattr(stats, 'school_night_consistency_pct', 0.0)
            if hasattr(stats, 'school_night_consistency_pct') else 0.0,
    )

    fairness_metrics_data = FairnessMetricsExplanation(
        overnight_split_pct=pct_a,
        weekend_split_pct=round(
            100 * stats.parent_a_weekend_nights / max(stats.parent_a_weekend_nights + stats.parent_b_weekend_nights, 1)
        ),
        deviation_from_target=abs(pct_a - 50.0),
    )

    # ── Key constraints applied ──
    key_constraints: list[ConstraintApplied] = []

    # Locked nights
    a_locked = inputs.parent_a.availability.locked_nights
    if a_locked:
        locked_names = [DAY_NAMES.get(d, str(d)) for d in sorted(a_locked)]
        key_constraints.append(ConstraintApplied(
            name="Locked Nights",
            type="hard",
            satisfied=True,
            detail=f"Parent A cannot have child on {', '.join(locked_names)}",
        ))
    if inputs.parent_b:
        b_locked = inputs.parent_b.availability.locked_nights
        if b_locked:
            locked_names = [DAY_NAMES.get(d, str(d)) for d in sorted(b_locked)]
            key_constraints.append(ConstraintApplied(
                name="Locked Nights",
                type="hard",
                satisfied=True,
                detail=f"Parent B cannot have child on {', '.join(locked_names)}",
            ))

    # Max consecutive
    max_consec_a = inputs.parent_a.preferences.max_consecutive_nights_away
    if max_consec_a:
        max_actual = max(
            getattr(stats, 'max_consecutive_a', 0) if hasattr(stats, 'max_consecutive_a') else 0,
            getattr(stats, 'max_consecutive_b', 0) if hasattr(stats, 'max_consecutive_b') else 0,
            0
        )
        key_constraints.append(ConstraintApplied(
            name="Max Consecutive",
            type="hard",
            satisfied=max_actual <= max_consec_a,
            detail=f"Max {max_consec_a} consecutive nights (actual max: {max_actual})",
        ))

    # Max transitions per week
    max_handoffs = inputs.parent_a.preferences.max_handoffs_per_week
    if max_handoffs:
        actual_per_week = round(stats.transitions_count / max(total / 7, 1), 1)
        key_constraints.append(ConstraintApplied(
            name="Max Transitions Per Week",
            type="hard",
            satisfied=actual_per_week <= max_handoffs,
            detail=f"Max {max_handoffs}/week (actual: {actual_per_week}/week)",
        ))

    # Weekend split
    if inputs.parent_a.preferences.weekend_preference != "flexible":
        we_a = stats.parent_a_weekend_nights
        we_b = stats.parent_b_weekend_nights
        we_total = we_a + we_b
        if we_total > 0:
            pct_diff = abs(we_a - we_b) / we_total * 100
            key_constraints.append(ConstraintApplied(
                name="Weekend Split",
                type="soft",
                satisfied=pct_diff <= 30,
                detail=f"Weekend split: {we_a}/{we_b} nights",
            ))

    # No-contact preference
    if inputs.shared.no_contact_preference:
        key_constraints.append(ConstraintApplied(
            name="No Contact Preference",
            type="soft",
            satisfied=stats.non_school_handoffs == 0,
            detail=f"Non-school handoffs: {stats.non_school_handoffs}",
        ))

    # ── Disruption impacts ──
    disruption_impacts: list[DisruptionImpact] = []
    # Note: disruption data comes from the solver request, not OnboardingInput.
    # When called from the heuristic brain, there are no disruption locks.
    # This is populated for completeness when the data is available.

    return Explanation(
        bullets=bullets[:6],  # Cap at 6
        respected_constraints=respected,
        tradeoffs=tradeoffs,
        assumptions=assumptions,
        profile_used=profile_used,
        primary_objective=primary_objective,
        key_constraints_applied=key_constraints,
        disruption_impacts=disruption_impacts,
        stability_metrics=stability_metrics_data,
        fairness_metrics=fairness_metrics_data,
    )


def explain_relaxation(diagnostics: InfeasibilityDiagnostics) -> list[str]:
    """Generate human-readable explanation bullets from diagnostics.

    Returns a list of plain-language strings describing what was
    detected and what was relaxed.
    """
    bullets: list[str] = []

    if diagnostics.relaxation_result == "succeeded":
        bullets.append(
            "The original constraints were infeasible. "
            "Some constraints were relaxed to find a workable schedule."
        )
    elif diagnostics.relaxation_result == "exhausted":
        bullets.append(
            "The constraints are too restrictive. "
            "Even after relaxing all non-essential constraints, no schedule could be found."
        )

    for detail in diagnostics.diagnostics:
        bullets.append(f"{detail.description} Suggestion: {detail.suggestion}")

    for step in diagnostics.relaxation_attempted:
        status = "successfully" if step.succeeded else "unsuccessfully"
        bullets.append(f"Relaxed {step.constraint_name}: {step.action} ({status})")

    return bullets
