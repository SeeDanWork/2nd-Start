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
)
from app.brain.profiles import get_profile_name


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

    return Explanation(
        bullets=bullets[:6],  # Cap at 6
        respected_constraints=respected,
        tradeoffs=tradeoffs,
        assumptions=assumptions,
    )
