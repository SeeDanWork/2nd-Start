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


# ── Arrangement Multipliers ─────────────────────────────────────────────

ARRANGEMENT_MULTIPLIERS: dict[str, dict[str, float]] = {
    "shared": {
        "fairness_deviation": 1.0, "total_transitions": 1.0,
        "non_school_handoffs": 1.0, "weekend_fragmentation": 1.0,
        "school_night_disruption": 1.0, "weekend_parity": 1.0,
        "max_consecutive_penalty": 1.0,
    },
    "primary_visits": {
        "fairness_deviation": 0.5, "total_transitions": 1.5,
        "non_school_handoffs": 1.0, "weekend_fragmentation": 0.7,
        "school_night_disruption": 1.2, "weekend_parity": 0.5,
        "max_consecutive_penalty": 1.0,
    },
    "undecided": {
        "fairness_deviation": 1.0, "total_transitions": 1.0,
        "non_school_handoffs": 1.0, "weekend_fragmentation": 1.0,
        "school_night_disruption": 1.0, "weekend_parity": 1.0,
        "max_consecutive_penalty": 1.0,
    },
}


def apply_arrangement_multipliers(weights: SolverWeights, arrangement: str) -> SolverWeights:
    """Scale profile weights by living-arrangement multipliers."""
    m = ARRANGEMENT_MULTIPLIERS.get(arrangement, ARRANGEMENT_MULTIPLIERS["shared"])
    return SolverWeights(
        fairness_deviation=weights.fairness_deviation * m["fairness_deviation"],
        total_transitions=weights.total_transitions * m["total_transitions"],
        non_school_handoffs=weights.non_school_handoffs * m["non_school_handoffs"],
        weekend_fragmentation=weights.weekend_fragmentation * m["weekend_fragmentation"],
        school_night_disruption=weights.school_night_disruption * m["school_night_disruption"],
        weekend_parity=weights.weekend_parity * m["weekend_parity"],
        max_consecutive_penalty=weights.max_consecutive_penalty * m["max_consecutive_penalty"],
    )


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


# ── Multi-Child Weight Aggregation ─────────────────────────────────────

# Age band priority: lower = younger = more restrictive
AGE_BAND_PRIORITY = {"0-4": 0, "5-10": 1, "11-17": 2}

# Stability keys: MAX across children (most sensitive child)
STABILITY_FIELDS = ("total_transitions", "school_night_disruption", "weekend_fragmentation")

# Fairness keys: weighted average
FAIRNESS_FIELDS = ("fairness_deviation",)

# Young/teen fairness contribution factors
FAIRNESS_YOUNG_FACTOR = 0.5  # under-5
FAIRNESS_TEEN_FACTOR = 1.5   # 11+


def _fairness_factor(age_band: str) -> float:
    """Weight factor for fairness contribution by age band."""
    p = AGE_BAND_PRIORITY.get(age_band, 1)
    if p == 0:
        return FAIRNESS_YOUNG_FACTOR
    if p == 2:
        return FAIRNESS_TEEN_FACTOR
    return 1.0


def aggregate_multi_child_weights(
    base_weights: SolverWeights,
    age_bands: list[str],
) -> SolverWeights:
    """
    Aggregate solver weights across multiple children's age bands.

    Mirrors the shared TypeScript logic:
    - Stability categories: MAX across children
    - Fairness categories: weighted average (young 0.5×, teen 1.5×)
    - Stability > fairness cap when any child is young (0-4)

    For single-child families, returns base_weights unchanged.
    """
    if len(age_bands) <= 1:
        return base_weights

    # Age multiplier tables matching constants.ts AGE_WEIGHT_MULTIPLIERS
    age_multipliers = {
        "0-4": {
            "fairness_deviation": 0.7, "total_transitions": 2.0,
            "non_school_handoffs": 1.0, "weekend_fragmentation": 1.0,
            "school_night_disruption": 0.5,
        },
        "5-10": {
            "fairness_deviation": 1.0, "total_transitions": 1.0,
            "non_school_handoffs": 1.0, "weekend_fragmentation": 1.0,
            "school_night_disruption": 1.0,
        },
        "11-17": {
            "fairness_deviation": 1.5, "total_transitions": 0.7,
            "non_school_handoffs": 1.0, "weekend_fragmentation": 1.0,
            "school_night_disruption": 1.0,
        },
    }

    base_dict = {
        "fairness_deviation": base_weights.fairness_deviation,
        "total_transitions": base_weights.total_transitions,
        "non_school_handoffs": base_weights.non_school_handoffs,
        "weekend_fragmentation": base_weights.weekend_fragmentation,
        "school_night_disruption": base_weights.school_night_disruption,
        "weekend_parity": base_weights.weekend_parity,
        "max_consecutive_penalty": base_weights.max_consecutive_penalty,
    }

    # Per-child computed weights
    per_child = []
    for band in age_bands:
        m = age_multipliers.get(band, age_multipliers["5-10"])
        computed = {}
        for key, val in base_dict.items():
            computed[key] = round(val * m.get(key, 1.0))
        per_child.append({"band": band, "computed": computed})

    result = {}

    # Stability: MAX
    for key in STABILITY_FIELDS:
        result[key] = max(cw["computed"].get(key, 0) for cw in per_child)

    # Other: MAX
    for key in ("non_school_handoffs", "weekend_parity", "max_consecutive_penalty"):
        result[key] = max(cw["computed"].get(key, 0) for cw in per_child)

    # Fairness: weighted average
    for key in FAIRNESS_FIELDS:
        weighted_sum = 0.0
        total_weight = 0.0
        for cw in per_child:
            fw = _fairness_factor(cw["band"])
            weighted_sum += cw["computed"].get(key, 0) * fw
            total_weight += fw
        result[key] = round(weighted_sum / total_weight) if total_weight > 0 else 0

    # Stability > fairness cap when any child is young
    has_young = any(AGE_BAND_PRIORITY.get(b, 1) == 0 for b in age_bands)
    if has_young:
        max_stability = max(
            result.get("total_transitions", 0),
            result.get("school_night_disruption", 0),
            result.get("weekend_fragmentation", 0),
        )
        for key in FAIRNESS_FIELDS:
            if result[key] > max_stability:
                result[key] = max_stability

    return SolverWeights(
        fairness_deviation=result.get("fairness_deviation", base_weights.fairness_deviation),
        total_transitions=result.get("total_transitions", base_weights.total_transitions),
        non_school_handoffs=result.get("non_school_handoffs", base_weights.non_school_handoffs),
        weekend_fragmentation=result.get("weekend_fragmentation", base_weights.weekend_fragmentation),
        school_night_disruption=result.get("school_night_disruption", base_weights.school_night_disruption),
        weekend_parity=result.get("weekend_parity", base_weights.weekend_parity),
        max_consecutive_penalty=result.get("max_consecutive_penalty", base_weights.max_consecutive_penalty),
    )
