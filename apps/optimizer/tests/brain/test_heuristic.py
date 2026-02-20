"""Tests for the heuristic fallback scheduler."""

import pytest
from app.brain.heuristic import generate_options_heuristic
from app.brain.domain import OnboardingConfig, OptionProfile
from tests.brain.fixtures import (
    cooperative_planners,
    shift_work_parent,
    parallel_parenting,
    infeasible_case,
    single_parent_onboarding,
)


class TestHeuristicFeasibility:
    def test_cooperative_generates_options(self):
        result = generate_options_heuristic(cooperative_planners())
        assert len(result.options) >= 3
        assert result.solve_time_ms > 0

    def test_shift_work_generates_options(self):
        result = generate_options_heuristic(shift_work_parent())
        assert len(result.options) >= 1

    def test_parallel_generates_options(self):
        result = generate_options_heuristic(parallel_parenting())
        assert len(result.options) >= 3

    def test_single_parent_generates_options(self):
        result = generate_options_heuristic(single_parent_onboarding())
        assert len(result.options) >= 1
        assert result.is_partial is True

    def test_infeasible_returns_conflict(self):
        result = generate_options_heuristic(infeasible_case())
        # Should still detect conflicts via detect_conflicts
        assert result.conflict_report is not None
        assert len(result.conflict_report.conflicts) > 0


class TestHeuristicDeterminism:
    def test_same_input_same_output(self):
        """Heuristic is pattern-based — same input must produce same result."""
        inputs = cooperative_planners()
        r1 = generate_options_heuristic(inputs)
        r2 = generate_options_heuristic(inputs)
        assert len(r1.options) == len(r2.options)
        for o1, o2 in zip(r1.options, r2.options):
            assert o1.profile == o2.profile
            assert len(o1.schedule) == len(o2.schedule)
            for d1, d2 in zip(o1.schedule, o2.schedule):
                assert d1.assigned_to == d2.assigned_to


class TestHeuristicConstraintRespect:
    def test_locked_nights_respected(self):
        """Parent A locked on Tue (JS 2) → should never be assigned Parent A on Tue."""
        result = generate_options_heuristic(cooperative_planners())
        for option in result.options:
            for day in option.schedule:
                if day.day_of_week == 2:  # Tuesday
                    # Parent A is locked → child should NOT be with parent_a
                    # Actually: locked_nights means parent CANNOT have child,
                    # so parent_a locked Tue → child is with parent_b on Tue
                    assert day.assigned_to == "parent_b", (
                        f"Parent A locked on Tue but {day.date} assigned to {day.assigned_to}"
                    )

    def test_shift_work_locked_respected(self):
        """Parent B locked Wed/Thu/Fri → child should be with parent_a on those days."""
        result = generate_options_heuristic(shift_work_parent())
        for option in result.options:
            for day in option.schedule:
                if day.day_of_week in (3, 4, 5):  # Wed, Thu, Fri
                    assert day.assigned_to == "parent_a", (
                        f"Parent B locked on {day.day_of_week} but {day.date} "
                        f"assigned to {day.assigned_to}"
                    )


class TestHeuristicProfileSelection:
    def test_single_profile_filter(self):
        config = OnboardingConfig(profiles=[OptionProfile.STABILITY])
        result = generate_options_heuristic(cooperative_planners(), config)
        assert len(result.options) == 1
        assert result.options[0].profile == OptionProfile.STABILITY

    def test_all_profiles_distinct(self):
        result = generate_options_heuristic(cooperative_planners())
        profiles = [o.profile for o in result.options]
        assert len(profiles) == len(set(profiles)), "Duplicate profiles in output"


class TestHeuristicExplanations:
    def test_explanations_non_empty(self):
        result = generate_options_heuristic(cooperative_planners())
        for option in result.options:
            assert len(option.explanation.bullets) >= 1
            assert len(option.explanation.tradeoffs) >= 1

    def test_single_parent_has_assumptions(self):
        result = generate_options_heuristic(single_parent_onboarding())
        for option in result.options:
            assert len(option.explanation.assumptions) >= 1
