"""Tests for infeasibility diagnostics module."""

import pytest
from app.models.requests import (
    ScheduleRequest,
    LockedNight,
    MaxConsecutive,
    WeekendSplit,
    ParentRole,
    SolverWeights,
)
from app.models.responses import (
    InfeasibilityDiagnostics,
    RelaxationStepResponse,
)
from app.solver.diagnostics import (
    generate_diagnostics,
    _detect_overlapping_locked_nights,
    _detect_tight_max_consecutive,
    _detect_zero_tolerance_weekend_split,
)
from app.solver.relaxation import RelaxationResult
from app.brain.explain import explain_relaxation


def _make_request(**overrides) -> ScheduleRequest:
    defaults = dict(
        horizon_start="2027-03-01",
        horizon_end="2027-03-14",
        max_solutions=3,
        timeout_seconds=10,
    )
    defaults.update(overrides)
    return ScheduleRequest(**defaults)


class TestOverlappingLockedNights:
    """Detect conflicting locked nights."""

    def test_detects_overlap(self):
        req = _make_request(locked_nights=[
            LockedNight(parent=ParentRole.PARENT_A, days_of_week=[1, 3]),
            LockedNight(parent=ParentRole.PARENT_B, days_of_week=[3, 5]),
        ])
        results = _detect_overlapping_locked_nights(req)
        assert len(results) == 1
        assert "LOCKED_NIGHTS" in results[0].constraint_name
        assert "Wed" in results[0].description

    def test_no_overlap(self):
        req = _make_request(locked_nights=[
            LockedNight(parent=ParentRole.PARENT_A, days_of_week=[1, 2]),
            LockedNight(parent=ParentRole.PARENT_B, days_of_week=[5, 6]),
        ])
        results = _detect_overlapping_locked_nights(req)
        assert len(results) == 0

    def test_single_parent_no_conflict(self):
        req = _make_request(locked_nights=[
            LockedNight(parent=ParentRole.PARENT_A, days_of_week=[1, 2, 3]),
        ])
        results = _detect_overlapping_locked_nights(req)
        assert len(results) == 0


class TestTightMaxConsecutive:
    """Detect max_consecutive <= 1."""

    def test_detects_tight(self):
        req = _make_request(max_consecutive=[
            MaxConsecutive(parent=ParentRole.PARENT_A, max_nights=1),
        ])
        results = _detect_tight_max_consecutive(req)
        assert len(results) == 1
        assert "MAX_CONSECUTIVE" in results[0].constraint_name
        assert "1" in results[0].description

    def test_normal_not_flagged(self):
        req = _make_request(max_consecutive=[
            MaxConsecutive(parent=ParentRole.PARENT_A, max_nights=3),
        ])
        results = _detect_tight_max_consecutive(req)
        assert len(results) == 0


class TestZeroToleranceWeekendSplit:
    """Detect weekend_split with 0% tolerance."""

    def test_detects_zero_tolerance(self):
        req = _make_request(weekend_split=WeekendSplit(
            target_pct_parent_a=50, tolerance_pct=0,
        ))
        results = _detect_zero_tolerance_weekend_split(req)
        assert len(results) == 1
        assert "WEEKEND_SPLIT" in results[0].constraint_name

    def test_normal_tolerance_not_flagged(self):
        req = _make_request(weekend_split=WeekendSplit(
            target_pct_parent_a=50, tolerance_pct=10,
        ))
        results = _detect_zero_tolerance_weekend_split(req)
        assert len(results) == 0

    def test_no_weekend_split(self):
        req = _make_request()
        results = _detect_zero_tolerance_weekend_split(req)
        assert len(results) == 0


class TestGenerateDiagnostics:
    """Integration tests for full diagnostics generation."""

    def test_with_relaxation_succeeded(self):
        req = _make_request(locked_nights=[
            LockedNight(parent=ParentRole.PARENT_A, days_of_week=[1]),
            LockedNight(parent=ParentRole.PARENT_B, days_of_week=[1]),
        ])
        result = RelaxationResult()
        result.was_relaxed = True
        result.steps = [
            RelaxationStepResponse(
                constraint_name="TARGET_FAIRNESS",
                action="Set fairness_deviation weight to 0",
                succeeded=True,
            ),
        ]
        diag = generate_diagnostics(req, result)
        assert isinstance(diag, InfeasibilityDiagnostics)
        assert diag.relaxation_result == "succeeded"
        assert len(diag.relaxation_attempted) == 1
        assert "LOCKED_NIGHTS" in diag.infeasible_constraints

    def test_with_relaxation_exhausted(self):
        req = _make_request()
        result = RelaxationResult()
        result.was_relaxed = False
        result.steps = [
            RelaxationStepResponse(constraint_name="TARGET_FAIRNESS", action="x", succeeded=False),
            RelaxationStepResponse(constraint_name="WEEKEND_SPLIT", action="x", succeeded=False),
        ]
        diag = generate_diagnostics(req, result)
        assert diag.relaxation_result == "exhausted"
        assert len(diag.relaxation_attempted) == 2

    def test_without_relaxation(self):
        req = _make_request()
        diag = generate_diagnostics(req)
        assert diag.relaxation_result == "not_attempted"
        assert len(diag.relaxation_attempted) == 0

    def test_multiple_detectors(self):
        req = _make_request(
            locked_nights=[
                LockedNight(parent=ParentRole.PARENT_A, days_of_week=[1]),
                LockedNight(parent=ParentRole.PARENT_B, days_of_week=[1]),
            ],
            max_consecutive=[
                MaxConsecutive(parent=ParentRole.PARENT_A, max_nights=1),
            ],
            weekend_split=WeekendSplit(target_pct_parent_a=50, tolerance_pct=0),
        )
        diag = generate_diagnostics(req)
        assert len(diag.diagnostics) == 3
        names = [d.constraint_name for d in diag.diagnostics]
        assert "LOCKED_NIGHTS" in names
        assert "MAX_CONSECUTIVE" in names
        assert "WEEKEND_SPLIT" in names


class TestExplainRelaxation:
    """Test explain_relaxation human-readable output."""

    def test_succeeded_output(self):
        diag = InfeasibilityDiagnostics(
            relaxation_result="succeeded",
            relaxation_attempted=[
                RelaxationStepResponse(
                    constraint_name="TARGET_FAIRNESS",
                    action="Set fairness_deviation weight to 0",
                    succeeded=True,
                ),
            ],
            diagnostics=[],
        )
        bullets = explain_relaxation(diag)
        assert any("relaxed" in b.lower() for b in bullets)

    def test_exhausted_output(self):
        diag = InfeasibilityDiagnostics(
            relaxation_result="exhausted",
            relaxation_attempted=[],
            diagnostics=[],
        )
        bullets = explain_relaxation(diag)
        assert any("restrictive" in b.lower() for b in bullets)

    def test_includes_diagnostics(self):
        from app.models.responses import DiagnosticDetail
        diag = InfeasibilityDiagnostics(
            relaxation_result="not_attempted",
            diagnostics=[
                DiagnosticDetail(
                    constraint_name="LOCKED_NIGHTS",
                    description="Both parents locked on Mon.",
                    suggestion="Remove one lock.",
                ),
            ],
        )
        bullets = explain_relaxation(diag)
        assert any("Mon" in b for b in bullets)
        assert any("Remove" in b for b in bullets)

    def test_output_format_is_strings(self):
        diag = InfeasibilityDiagnostics(
            relaxation_result="succeeded",
            relaxation_attempted=[
                RelaxationStepResponse(
                    constraint_name="TARGET_FAIRNESS",
                    action="zeroed fairness",
                    succeeded=True,
                ),
            ],
            diagnostics=[],
        )
        bullets = explain_relaxation(diag)
        assert isinstance(bullets, list)
        for b in bullets:
            assert isinstance(b, str)
