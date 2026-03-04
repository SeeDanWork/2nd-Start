"""Seasonal weight multipliers for the CP-SAT solver.

Composes with existing age-band and profile weights to adjust solver
behavior based on the current season (school year, summer, holiday).
"""

from app.models.requests import SeasonMode, SolverWeights


SEASON_WEIGHT_MULTIPLIERS: dict[SeasonMode, dict[str, float]] = {
    SeasonMode.SCHOOL_YEAR: {
        "fairness_deviation": 1.0,
        "total_transitions": 1.0,
        "non_daycare_handoffs": 1.0,
        "weekend_fragmentation": 0.8,
        "school_night_disruption": 1.3,
        "handoff_location_preference": 1.0,
    },
    SeasonMode.SUMMER: {
        "fairness_deviation": 1.3,
        "total_transitions": 0.8,
        "non_daycare_handoffs": 0.5,
        "weekend_fragmentation": 0.8,
        "school_night_disruption": 0.3,
        "handoff_location_preference": 1.0,
    },
    SeasonMode.HOLIDAY_PERIOD: {
        "fairness_deviation": 1.5,
        "total_transitions": 0.7,
        "non_daycare_handoffs": 0.7,
        "weekend_fragmentation": 0.5,
        "school_night_disruption": 0.2,
        "handoff_location_preference": 1.0,
    },
}


def apply_season_multipliers(weights: SolverWeights, mode: SeasonMode) -> SolverWeights:
    """Apply seasonal multipliers to solver weights.

    Returns a new SolverWeights with each field multiplied by the
    corresponding seasonal factor and rounded to int.
    """
    multipliers = SEASON_WEIGHT_MULTIPLIERS[mode]
    return SolverWeights(
        fairness_deviation=int(round(weights.fairness_deviation * multipliers["fairness_deviation"])),
        total_transitions=int(round(weights.total_transitions * multipliers["total_transitions"])),
        non_daycare_handoffs=int(round(weights.non_daycare_handoffs * multipliers["non_daycare_handoffs"])),
        weekend_fragmentation=int(round(weights.weekend_fragmentation * multipliers["weekend_fragmentation"])),
        school_night_disruption=int(round(weights.school_night_disruption * multipliers["school_night_disruption"])),
        handoff_location_preference=int(round(weights.handoff_location_preference * multipliers["handoff_location_preference"])),
    )
