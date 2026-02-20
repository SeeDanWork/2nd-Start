"""
Named weight profiles for multi-option schedule generation.

Each profile emphasizes different tradeoffs in the objective function.
Weights are applied to penalty terms; higher weight = more important to minimize.

Cost function terms:
  fairness_deviation   — |parent_b_nights - target| imbalance
  total_transitions    — number of custody handoffs (transitions)
  non_school_handoffs  — transitions on non-school/daycare days
  weekend_fragmentation — weekends split across parents (single-night weekends)
  school_night_disruption — transitions on Sun-Thu (before school days)
  weekend_parity       — |parent_a_weekend - parent_b_weekend| imbalance
  max_consecutive_penalty — exceeding soft max consecutive nights
"""

from __future__ import annotations

from dataclasses import dataclass
from app.brain.domain import OptionProfile


@dataclass(frozen=True)
class SolverWeights:
    fairness_deviation: float
    total_transitions: float
    non_school_handoffs: float
    weekend_fragmentation: float
    school_night_disruption: float
    weekend_parity: float
    max_consecutive_penalty: float


# ── Profile Definitions ────────────────────────────────────────────────

PROFILES: dict[str, SolverWeights] = {
    # Option A: Minimize transitions, allow longer blocks with one parent.
    # Accept slight fairness drift over 2 weeks for fewer handoffs.
    OptionProfile.STABILITY: SolverWeights(
        fairness_deviation=40,
        total_transitions=200,
        non_school_handoffs=80,
        weekend_fragmentation=60,
        school_night_disruption=100,
        weekend_parity=30,
        max_consecutive_penalty=20,
    ),

    # Option B: Tight overnight parity. Every 2-week block should be as
    # close to 50/50 (or the configured split) as possible.
    OptionProfile.FAIRNESS: SolverWeights(
        fairness_deviation=200,
        total_transitions=40,
        non_school_handoffs=30,
        weekend_fragmentation=50,
        school_night_disruption=40,
        weekend_parity=150,
        max_consecutive_penalty=60,
    ),

    # Option C: Maximize school/daycare exchanges. Heavy penalty for
    # transitions that require direct parent-to-parent contact.
    OptionProfile.LOGISTICS: SolverWeights(
        fairness_deviation=60,
        total_transitions=60,
        non_school_handoffs=200,
        weekend_fragmentation=40,
        school_night_disruption=80,
        weekend_parity=40,
        max_consecutive_penalty=40,
    ),

    # Option D: Balance Fri/Sat/Sun overnights as evenly as possible.
    # Ensures neither parent monopolizes weekends.
    OptionProfile.WEEKEND_PARITY: SolverWeights(
        fairness_deviation=80,
        total_transitions=50,
        non_school_handoffs=40,
        weekend_fragmentation=200,
        school_night_disruption=40,
        weekend_parity=200,
        max_consecutive_penalty=40,
    ),

    # Option E: Minimize school-night disruption. Prefer transitions on
    # Fri/Sat so the child's weekday routine is consistent.
    OptionProfile.CHILD_ROUTINE: SolverWeights(
        fairness_deviation=60,
        total_transitions=80,
        non_school_handoffs=60,
        weekend_fragmentation=40,
        school_night_disruption=200,
        weekend_parity=50,
        max_consecutive_penalty=80,
    ),
}


PROFILE_DISPLAY_NAMES: dict[str, str] = {
    OptionProfile.STABILITY: "Stability-First",
    OptionProfile.FAIRNESS: "Fairness-First",
    OptionProfile.LOGISTICS: "Logistics-First",
    OptionProfile.WEEKEND_PARITY: "Weekend-Parity-First",
    OptionProfile.CHILD_ROUTINE: "Child-Routine-First",
}


def get_profile_weights(profile: str) -> SolverWeights:
    """Return weights for a named profile, or stability as default."""
    return PROFILES.get(profile, PROFILES[OptionProfile.STABILITY])


def get_profile_name(profile: str) -> str:
    """Human-readable name for a profile."""
    return PROFILE_DISPLAY_NAMES.get(profile, profile.replace("_", " ").title())
