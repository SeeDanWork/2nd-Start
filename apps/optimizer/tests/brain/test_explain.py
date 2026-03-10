"""Tests for explanation generation."""

import pytest
from app.brain.domain import (
    ScheduleOption,
    ScheduleDay,
    ScheduleStats,
    Explanation,
    OptionProfile,
    ConstraintApplied,
    DisruptionImpact,
)
from app.brain.explain import generate_explanation
from app.brain.heuristic import generate_options_heuristic
from tests.brain.fixtures import (
    cooperative_planners,
    single_parent_onboarding,
    shift_work_parent,
    parallel_parenting,
)


class TestExplanationGeneration:
    def test_bullets_non_empty(self):
        result = generate_options_heuristic(cooperative_planners())
        for option in result.options:
            assert len(option.explanation.bullets) >= 3

    def test_bullets_capped_at_6(self):
        result = generate_options_heuristic(cooperative_planners())
        for option in result.options:
            assert len(option.explanation.bullets) <= 6

    def test_tradeoffs_present(self):
        result = generate_options_heuristic(cooperative_planners())
        for option in result.options:
            assert len(option.explanation.tradeoffs) >= 1

    def test_respected_constraints_include_locked_nights(self):
        result = generate_options_heuristic(cooperative_planners())
        for option in result.options:
            locked = [c for c in option.explanation.respected_constraints
                      if "locked" in c.lower()]
            assert len(locked) >= 1, "Should mention Parent A's locked Tuesdays"

    def test_single_parent_assumptions(self):
        result = generate_options_heuristic(single_parent_onboarding())
        for option in result.options:
            assert len(option.explanation.assumptions) >= 1
            assert any("parent b" in a.lower() for a in option.explanation.assumptions)

    def test_handoff_count_in_bullets(self):
        result = generate_options_heuristic(cooperative_planners())
        for option in result.options:
            has_handoff_bullet = any("handoff" in b.lower() for b in option.explanation.bullets)
            assert has_handoff_bullet

    def test_split_percentage_in_bullets(self):
        result = generate_options_heuristic(cooperative_planners())
        for option in result.options:
            has_split_bullet = any("/" in b and "split" in b.lower() for b in option.explanation.bullets)
            assert has_split_bullet


class TestConstraintsAppliedPopulation:
    """Verify key_constraints_applied is populated when constraints exist."""

    def test_locked_nights_produces_constraint(self):
        result = generate_options_heuristic(cooperative_planners())
        for option in result.options:
            locked_constraints = [
                c for c in option.explanation.key_constraints_applied
                if c.name == "Locked Nights"
            ]
            assert len(locked_constraints) >= 1, (
                "Should have at least one Locked Nights constraint for cooperative_planners (Parent A locked Tue)"
            )

    def test_locked_nights_constraint_is_hard(self):
        result = generate_options_heuristic(cooperative_planners())
        for option in result.options:
            for c in option.explanation.key_constraints_applied:
                if c.name == "Locked Nights":
                    assert c.type == "hard"
                    assert c.satisfied is True

    def test_max_consecutive_constraint_present(self):
        result = generate_options_heuristic(cooperative_planners())
        for option in result.options:
            mc_constraints = [
                c for c in option.explanation.key_constraints_applied
                if c.name == "Max Consecutive"
            ]
            assert len(mc_constraints) >= 1

    def test_shift_work_has_locked_nights_constraint(self):
        result = generate_options_heuristic(shift_work_parent())
        for option in result.options:
            locked = [
                c for c in option.explanation.key_constraints_applied
                if c.name == "Locked Nights"
            ]
            # Parent B has locked nights (Wed/Thu/Fri)
            assert len(locked) >= 1

    def test_parallel_parenting_has_no_contact_constraint(self):
        result = generate_options_heuristic(parallel_parenting())
        for option in result.options:
            nc_constraints = [
                c for c in option.explanation.key_constraints_applied
                if c.name == "No Contact Preference"
            ]
            assert len(nc_constraints) == 1
            assert nc_constraints[0].type == "soft"

    def test_constraints_list_not_empty(self):
        result = generate_options_heuristic(cooperative_planners())
        for option in result.options:
            assert len(option.explanation.key_constraints_applied) >= 1, (
                "key_constraints_applied should not be empty when constraints exist"
            )


class TestDisruptionImpactsPopulation:
    """Verify disruption_impacts behavior."""

    def test_no_disruptions_means_empty_impacts(self):
        """When no disruption locks in input, impacts should be empty."""
        result = generate_options_heuristic(cooperative_planners())
        for option in result.options:
            # Heuristic brain doesn't have disruption locks, so impacts should be empty
            assert option.explanation.disruption_impacts == []
