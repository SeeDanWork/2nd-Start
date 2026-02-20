"""Tests for weight profiles and profile utilities."""

import pytest
from app.brain.profiles import (
    get_profile_weights,
    get_profile_name,
    PROFILES,
    SolverWeights,
)
from app.brain.domain import OptionProfile


class TestProfileWeights:
    def test_all_profiles_defined(self):
        """All OptionProfile enum values have a weight configuration."""
        for profile in OptionProfile:
            weights = get_profile_weights(profile)
            assert isinstance(weights, SolverWeights)

    def test_stability_emphasizes_transitions(self):
        w = get_profile_weights(OptionProfile.STABILITY)
        assert w.total_transitions >= w.fairness_deviation

    def test_fairness_emphasizes_deviation(self):
        w = get_profile_weights(OptionProfile.FAIRNESS)
        assert w.fairness_deviation >= w.total_transitions

    def test_logistics_emphasizes_non_school(self):
        w = get_profile_weights(OptionProfile.LOGISTICS)
        assert w.non_school_handoffs >= w.total_transitions

    def test_weekend_parity_emphasizes_weekends(self):
        w = get_profile_weights(OptionProfile.WEEKEND_PARITY)
        assert w.weekend_parity >= w.fairness_deviation

    def test_child_routine_emphasizes_school_nights(self):
        w = get_profile_weights(OptionProfile.CHILD_ROUTINE)
        assert w.school_night_disruption >= w.total_transitions

    def test_unknown_profile_returns_stability(self):
        w = get_profile_weights("nonexistent_profile")
        expected = get_profile_weights(OptionProfile.STABILITY)
        assert w == expected

    def test_all_weights_positive(self):
        for profile in OptionProfile:
            w = get_profile_weights(profile)
            for field_name in SolverWeights.__dataclass_fields__:
                assert getattr(w, field_name) > 0


class TestProfileNames:
    def test_all_profiles_have_names(self):
        for profile in OptionProfile:
            name = get_profile_name(profile)
            assert len(name) > 0
            assert name != profile  # Should be human-readable, not raw enum

    def test_unknown_profile_name(self):
        name = get_profile_name("some_unknown")
        assert name == "Some Unknown"
