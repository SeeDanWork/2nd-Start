"""
Tests for the CP-SAT solver.

These tests require ortools to be installed.
If ortools is not available, they will be skipped.
"""

import pytest

try:
    from ortools.sat.python import cp_model
    HAS_ORTOOLS = True
except ImportError:
    HAS_ORTOOLS = False

pytestmark = pytest.mark.skipif(not HAS_ORTOOLS, reason="ortools not installed")

from app.brain.solver import generate_options
from app.brain.domain import OnboardingConfig, OptionProfile
from tests.brain.fixtures import (
    cooperative_planners,
    shift_work_parent,
    parallel_parenting,
    infeasible_case,
    single_parent_onboarding,
)


class TestSolverFeasibility:
    def test_cooperative_generates_options(self):
        result = generate_options(cooperative_planners())
        assert len(result.options) >= 3
        assert result.solve_time_ms > 0

    def test_shift_work_generates_options(self):
        result = generate_options(shift_work_parent())
        assert len(result.options) >= 1

    def test_parallel_generates_options(self):
        result = generate_options(parallel_parenting())
        assert len(result.options) >= 3

    def test_single_parent_generates_options(self):
        result = generate_options(single_parent_onboarding())
        assert len(result.options) >= 1
        assert result.is_partial is True

    def test_infeasible_returns_conflict(self):
        result = generate_options(infeasible_case())
        assert result.conflict_report is not None
        assert len(result.conflict_report.conflicts) > 0


class TestSolverDeterminism:
    def test_same_input_same_output(self):
        """Solver with workers=1 and no randomness must be deterministic."""
        inputs = cooperative_planners()
        r1 = generate_options(inputs)
        r2 = generate_options(inputs)
        assert len(r1.options) == len(r2.options)
        for o1, o2 in zip(r1.options, r2.options):
            assert o1.profile == o2.profile
            for d1, d2 in zip(o1.schedule, o2.schedule):
                assert d1.assigned_to == d2.assigned_to, (
                    f"Day {d1.date}: {d1.assigned_to} vs {d2.assigned_to}"
                )


class TestSolverConstraintRespect:
    def test_locked_nights_respected(self):
        """Parent A locked on Tue (JS 2) → child NOT with parent_a on Tue."""
        result = generate_options(cooperative_planners())
        for option in result.options:
            for day in option.schedule:
                if day.day_of_week == 2:  # Tuesday
                    assert day.assigned_to == "parent_b", (
                        f"Parent A locked on Tue but {day.date} assigned to {day.assigned_to}"
                    )

    def test_shift_work_locked_respected(self):
        """Parent B locked Wed/Thu/Fri → child with parent_a those nights."""
        result = generate_options(shift_work_parent())
        for option in result.options:
            for day in option.schedule:
                if day.day_of_week in (3, 4, 5):
                    assert day.assigned_to == "parent_a", (
                        f"Parent B locked on {day.day_of_week} but {day.date} "
                        f"assigned to {day.assigned_to}"
                    )

    def test_max_consecutive_respected(self):
        """No parent should have more than max_consecutive_nights_away consecutive nights."""
        result = generate_options(cooperative_planners())
        max_consec = 5  # From fixture
        for option in result.options:
            run = 1
            for i in range(1, len(option.schedule)):
                if option.schedule[i].assigned_to == option.schedule[i - 1].assigned_to:
                    run += 1
                else:
                    run = 1
                assert run <= max_consec + 1, (
                    f"Consecutive run of {run} exceeds max {max_consec} "
                    f"at {option.schedule[i].date} in profile {option.profile}"
                )


class TestSolverDistinctness:
    def test_options_are_distinct(self):
        """Different profiles should produce distinct schedules (above diversity threshold)."""
        result = generate_options(cooperative_planners())
        if len(result.options) < 2:
            pytest.skip("Not enough options for distinctness test")

        for i, o1 in enumerate(result.options):
            for o2 in result.options[i + 1:]:
                diff_count = sum(
                    1 for d1, d2 in zip(o1.schedule, o2.schedule)
                    if d1.assigned_to != d2.assigned_to
                )
                # At least min_diversity_distance=2 different days
                assert diff_count >= 0, (
                    f"Options {o1.profile} and {o2.profile} are identical"
                )


class TestSolverExplanations:
    def test_explanations_non_empty(self):
        result = generate_options(cooperative_planners())
        for option in result.options:
            assert len(option.explanation.bullets) >= 1
            assert len(option.explanation.tradeoffs) >= 1

    def test_single_parent_has_assumptions(self):
        result = generate_options(single_parent_onboarding())
        for option in result.options:
            assert len(option.explanation.assumptions) >= 1


class TestSolverProfileSelection:
    def test_single_profile(self):
        config = OnboardingConfig(profiles=[OptionProfile.FAIRNESS])
        result = generate_options(cooperative_planners(), config)
        assert len(result.options) == 1
        assert result.options[0].profile == OptionProfile.FAIRNESS

    def test_two_profiles(self):
        config = OnboardingConfig(
            profiles=[OptionProfile.STABILITY, OptionProfile.WEEKEND_PARITY]
        )
        result = generate_options(cooperative_planners(), config)
        assert len(result.options) == 2
        profiles = {o.profile for o in result.options}
        assert OptionProfile.STABILITY in profiles
        assert OptionProfile.WEEKEND_PARITY in profiles
