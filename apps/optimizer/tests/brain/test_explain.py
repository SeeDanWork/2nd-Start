"""Tests for explanation generation."""

import pytest
from app.brain.domain import (
    ScheduleOption,
    ScheduleDay,
    ScheduleStats,
    Explanation,
    OptionProfile,
)
from app.brain.explain import generate_explanation
from app.brain.heuristic import generate_options_heuristic
from tests.brain.fixtures import (
    cooperative_planners,
    single_parent_onboarding,
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
