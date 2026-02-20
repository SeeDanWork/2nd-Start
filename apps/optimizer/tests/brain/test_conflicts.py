"""Tests for conflict detection and input validation."""

import pytest
from app.brain.conflicts import validate_inputs, detect_conflicts
from tests.brain.fixtures import (
    cooperative_planners,
    shift_work_parent,
    parallel_parenting,
    infeasible_case,
    single_parent_onboarding,
)


class TestValidateInputs:
    def test_cooperative_valid(self):
        result = validate_inputs(cooperative_planners())
        assert result.valid is True
        assert len(result.errors) == 0

    def test_shift_work_valid(self):
        result = validate_inputs(shift_work_parent())
        assert result.valid is True

    def test_parallel_valid(self):
        result = validate_inputs(parallel_parenting())
        assert result.valid is True

    def test_single_parent_valid(self):
        result = validate_inputs(single_parent_onboarding())
        assert result.valid is True

    def test_infeasible_valid_structurally(self):
        """Infeasible inputs are structurally valid — conflict detection catches them."""
        result = validate_inputs(infeasible_case())
        assert result.valid is True

    def test_mismatched_age_bands(self):
        inputs = cooperative_planners()
        inputs.number_of_children = 3  # mismatch: 1 age band, 3 children
        result = validate_inputs(inputs)
        assert result.valid is False
        assert any("age bands" in e.message.lower() for e in result.errors)

    def test_invalid_locked_night(self):
        inputs = cooperative_planners()
        inputs.parent_a.availability.locked_nights = [7]  # invalid day
        result = validate_inputs(inputs)
        assert result.valid is False
        assert any("Invalid day" in e.message for e in result.errors)

    def test_shares_not_100(self):
        inputs = cooperative_planners()
        inputs.parent_a.preferences.target_share_pct = 70.0
        inputs.parent_b.preferences.target_share_pct = 70.0  # 140 total
        result = validate_inputs(inputs)
        assert result.valid is False
        assert any("sum" in e.message.lower() for e in result.errors)


class TestDetectConflicts:
    def test_cooperative_feasible(self):
        report = detect_conflicts(cooperative_planners())
        assert report.feasible is True

    def test_shift_work_feasible(self):
        report = detect_conflicts(shift_work_parent())
        assert report.feasible is True

    def test_parallel_feasible(self):
        report = detect_conflicts(parallel_parenting())
        assert report.feasible is True

    def test_single_parent_feasible(self):
        report = detect_conflicts(single_parent_onboarding())
        assert report.feasible is True

    def test_infeasible_overlap_detected(self):
        report = detect_conflicts(infeasible_case())
        assert len(report.conflicts) > 0
        overlap_conflict = [c for c in report.conflicts if "locked nights" in c.description.lower()]
        assert len(overlap_conflict) > 0

    def test_no_contact_no_school_conflict(self):
        inputs = parallel_parenting()
        inputs.school_schedule.school_days = []
        inputs.daycare_schedule = None
        report = detect_conflicts(inputs)
        assert any("no-contact" in c.description.lower() or "no school" in c.description.lower()
                    for c in report.conflicts)
