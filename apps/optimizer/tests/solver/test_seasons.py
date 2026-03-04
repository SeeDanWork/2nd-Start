"""Tests for seasonal weight multipliers."""

import pytest
from app.models.requests import SeasonMode, SolverWeights
from app.solver.seasons import SEASON_WEIGHT_MULTIPLIERS, apply_season_multipliers


class TestSeasonWeightMultipliers:
    """Verify seasonal multiplier definitions."""

    def test_all_modes_have_entries(self):
        for mode in SeasonMode:
            assert mode in SEASON_WEIGHT_MULTIPLIERS, f"Missing multipliers for {mode}"

    def test_all_multipliers_positive(self):
        for mode, multipliers in SEASON_WEIGHT_MULTIPLIERS.items():
            for key, value in multipliers.items():
                assert value > 0, f"{mode}.{key} multiplier is not positive: {value}"

    def test_school_year_is_baseline(self):
        """SCHOOL_YEAR should be close to 1.0 for most weights."""
        m = SEASON_WEIGHT_MULTIPLIERS[SeasonMode.SCHOOL_YEAR]
        assert m["fairness_deviation"] == 1.0
        assert m["total_transitions"] == 1.0
        assert m["non_daycare_handoffs"] == 1.0

    def test_all_weight_fields_covered(self):
        """Each season must have multipliers for all SolverWeights fields."""
        expected_fields = {
            "fairness_deviation",
            "total_transitions",
            "non_daycare_handoffs",
            "weekend_fragmentation",
            "school_night_disruption",
            "handoff_location_preference",
        }
        for mode in SeasonMode:
            actual = set(SEASON_WEIGHT_MULTIPLIERS[mode].keys())
            assert actual == expected_fields, f"{mode} missing fields: {expected_fields - actual}"


class TestApplySeasonMultipliers:
    """Verify multiplier application math."""

    def test_school_year_preserves_defaults(self):
        w = SolverWeights()
        result = apply_season_multipliers(w, SeasonMode.SCHOOL_YEAR)
        # School year multipliers should keep most weights the same
        assert result.fairness_deviation == 100
        assert result.total_transitions == 50
        assert result.non_daycare_handoffs == 30

    def test_summer_reduces_school_night(self):
        w = SolverWeights(school_night_disruption=60)
        result = apply_season_multipliers(w, SeasonMode.SUMMER)
        assert result.school_night_disruption == int(round(60 * 0.3))  # 18

    def test_summer_increases_fairness(self):
        w = SolverWeights(fairness_deviation=100)
        result = apply_season_multipliers(w, SeasonMode.SUMMER)
        assert result.fairness_deviation == int(round(100 * 1.3))  # 130

    def test_holiday_period_reduces_school_night(self):
        w = SolverWeights(school_night_disruption=60)
        result = apply_season_multipliers(w, SeasonMode.HOLIDAY_PERIOD)
        assert result.school_night_disruption == int(round(60 * 0.2))  # 12

    def test_holiday_period_increases_fairness(self):
        w = SolverWeights(fairness_deviation=100)
        result = apply_season_multipliers(w, SeasonMode.HOLIDAY_PERIOD)
        assert result.fairness_deviation == int(round(100 * 1.5))  # 150

    def test_returns_int_values(self):
        """All resulting weights must be integers (no floating point in solver)."""
        w = SolverWeights(
            fairness_deviation=73,
            total_transitions=37,
            non_daycare_handoffs=19,
            weekend_fragmentation=41,
            school_night_disruption=53,
            handoff_location_preference=11,
        )
        for mode in SeasonMode:
            result = apply_season_multipliers(w, mode)
            assert isinstance(result.fairness_deviation, int)
            assert isinstance(result.total_transitions, int)
            assert isinstance(result.non_daycare_handoffs, int)
            assert isinstance(result.weekend_fragmentation, int)
            assert isinstance(result.school_night_disruption, int)
            assert isinstance(result.handoff_location_preference, int)

    def test_does_not_mutate_original(self):
        w = SolverWeights(fairness_deviation=100)
        apply_season_multipliers(w, SeasonMode.SUMMER)
        assert w.fairness_deviation == 100
