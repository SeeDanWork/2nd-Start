"""
Multi-profile solver output tests.

Verifies that different brain profiles produce meaningfully different solver outputs.
These tests require the full brain + heuristic pipeline.

NOTE: These tests run in Docker only (Python + OR-Tools not available locally).
"""

import pytest
from app.brain.domain import OptionProfile
from app.brain.heuristic import generate_options_heuristic
from tests.brain.fixtures import (
    cooperative_planners,
    shift_work_parent,
    parallel_parenting,
)


class TestStabilityVsFairnessProfile:
    """STABILITY profile should produce fewer transitions than FAIRNESS profile."""

    def test_stability_fewer_transitions(self):
        result = generate_options_heuristic(cooperative_planners())
        stability = None
        fairness = None
        for opt in result.options:
            if opt.profile == OptionProfile.STABILITY or opt.profile == "stability_first":
                stability = opt
            elif opt.profile == OptionProfile.FAIRNESS or opt.profile == "fairness_first":
                fairness = opt

        assert stability is not None, "Should have a STABILITY option"
        assert fairness is not None, "Should have a FAIRNESS option"

        # Stability should have <= transitions than fairness
        assert stability.stats.transitions_count <= fairness.stats.transitions_count, (
            f"STABILITY ({stability.stats.transitions_count} transitions) should have "
            f"<= FAIRNESS ({fairness.stats.transitions_count} transitions)"
        )


class TestLogisticsProfile:
    """LOGISTICS profile should minimize non-school handoffs."""

    def test_logistics_fewer_non_school_handoffs(self):
        result = generate_options_heuristic(cooperative_planners())
        logistics = None
        other_profiles = []
        for opt in result.options:
            if opt.profile == OptionProfile.LOGISTICS or opt.profile == "logistics_first":
                logistics = opt
            else:
                other_profiles.append(opt)

        assert logistics is not None, "Should have a LOGISTICS option"
        assert len(other_profiles) > 0

        # Logistics should have <= non-school handoffs than average of others
        avg_non_school = sum(o.stats.non_school_handoffs for o in other_profiles) / len(other_profiles)
        assert logistics.stats.non_school_handoffs <= avg_non_school + 1, (
            f"LOGISTICS ({logistics.stats.non_school_handoffs} non-school handoffs) "
            f"should be near or below average ({avg_non_school:.1f})"
        )


class TestChildRoutineProfile:
    """CHILD_ROUTINE profile should have high school-night consistency."""

    def test_child_routine_school_consistency(self):
        result = generate_options_heuristic(cooperative_planners())
        child_routine = None
        for opt in result.options:
            if opt.profile == OptionProfile.CHILD_ROUTINE or opt.profile == "child_routine_first":
                child_routine = opt
                break

        assert child_routine is not None, "Should have a CHILD_ROUTINE option"

        # Child routine should prioritize school-week consistency
        # Transitions should be relatively low (school nights preserved)
        assert child_routine.stats.transitions_count <= 6, (
            f"CHILD_ROUTINE should have moderate transitions, got {child_routine.stats.transitions_count}"
        )


class TestAllProfilesGenerated:
    """Verify all 5 profiles are generated for standard inputs."""

    def test_all_five_profiles(self):
        result = generate_options_heuristic(cooperative_planners())
        profiles = {opt.profile for opt in result.options}
        # Should have all 5 profiles (as string values)
        expected = {
            "stability_first", "fairness_first", "logistics_first",
            "weekend_parity_first", "child_routine_first",
        }
        assert profiles == expected, f"Expected all 5 profiles, got {profiles}"

    def test_shift_work_produces_all_profiles(self):
        result = generate_options_heuristic(shift_work_parent())
        assert len(result.options) == 5


class TestProfileDiversity:
    """Different profiles should produce meaningfully different schedules."""

    def test_not_all_identical(self):
        result = generate_options_heuristic(cooperative_planners())
        # Extract assignment patterns as tuples
        patterns = []
        for opt in result.options:
            pattern = tuple(day.assigned_to for day in opt.schedule)
            patterns.append(pattern)

        unique_patterns = set(patterns)
        # At least 2 distinct patterns among 5 profiles
        assert len(unique_patterns) >= 2, (
            f"Expected at least 2 distinct patterns among 5 profiles, got {len(unique_patterns)}"
        )
