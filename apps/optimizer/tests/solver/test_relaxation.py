"""Tests for the constraint relaxation engine."""

import pytest
from copy import deepcopy
from unittest.mock import MagicMock

from app.models.requests import (
    ScheduleRequest,
    SolverWeights,
    LockedNight,
    MaxConsecutive,
    MinConsecutive,
    WeekendSplit,
    ParentRole,
)
from app.models.responses import ScheduleResponse, RelaxationInfo
from app.solver.relaxation import (
    RELAXATION_ORDER,
    _relax_target_fairness,
    _relax_weekend_split,
    _relax_max_transitions_per_week,
    _relax_max_consecutive,
    _relax_min_consecutive,
    _relax_locked_nights,
    try_relaxation,
)


def _make_request(**overrides) -> ScheduleRequest:
    defaults = dict(
        horizon_start="2027-03-01",
        horizon_end="2027-03-14",
        weights=SolverWeights(fairness_deviation=100, total_transitions=50),
        max_solutions=3,
        timeout_seconds=10,
    )
    defaults.update(overrides)
    return ScheduleRequest(**defaults)


class TestRelaxationOrder:
    """Verify the relaxation order is deterministic and complete."""

    def test_order_is_fixed(self):
        assert RELAXATION_ORDER == [
            "TARGET_FAIRNESS",
            "WEEKEND_SPLIT",
            "MAX_TRANSITIONS_PER_WEEK",
            "MAX_CONSECUTIVE",
            "MIN_CONSECUTIVE",
            "LOCKED_NIGHTS",
        ]

    def test_disruption_lock_never_in_order(self):
        assert "DISRUPTION_LOCK" not in RELAXATION_ORDER

    def test_order_length(self):
        assert len(RELAXATION_ORDER) == 6


class TestIndividualRelaxFunctions:
    """Each relax function produces correct modified request."""

    def test_relax_target_fairness(self):
        req = _make_request(weights=SolverWeights(fairness_deviation=100))
        relaxed, action = _relax_target_fairness(req)
        assert relaxed.weights.fairness_deviation == 0
        assert "fairness" in action.lower()
        # Original unchanged
        assert req.weights.fairness_deviation == 100

    def test_relax_weekend_split(self):
        req = _make_request(weekend_split=WeekendSplit(target_pct_parent_a=50))
        relaxed, action = _relax_weekend_split(req)
        assert relaxed.weekend_split is None
        assert "weekend" in action.lower()

    def test_relax_max_transitions_per_week(self):
        req = _make_request(max_transitions_per_week=2)
        relaxed, action = _relax_max_transitions_per_week(req)
        assert relaxed.max_transitions_per_week == 0
        assert "transitions" in action.lower()

    def test_relax_max_consecutive(self):
        req = _make_request(max_consecutive=[
            MaxConsecutive(parent=ParentRole.PARENT_A, max_nights=3),
        ])
        relaxed, action = _relax_max_consecutive(req)
        assert relaxed.max_consecutive == []
        assert "max_consecutive" in action.lower()

    def test_relax_min_consecutive(self):
        req = _make_request(min_consecutive=[
            MinConsecutive(parent=ParentRole.PARENT_A, min_nights=2),
        ])
        relaxed, action = _relax_min_consecutive(req)
        assert relaxed.min_consecutive == []
        assert "min_consecutive" in action.lower()

    def test_relax_locked_nights(self):
        req = _make_request(locked_nights=[
            LockedNight(parent=ParentRole.PARENT_A, days_of_week=[1, 3]),
        ])
        relaxed, action = _relax_locked_nights(req)
        assert relaxed.locked_nights == []
        assert "locked" in action.lower()

    def test_relax_does_not_mutate_original(self):
        req = _make_request(
            locked_nights=[LockedNight(parent=ParentRole.PARENT_A, days_of_week=[1])],
            max_consecutive=[MaxConsecutive(parent=ParentRole.PARENT_A, max_nights=3)],
        )
        _relax_locked_nights(req)
        assert len(req.locked_nights) == 1
        _relax_max_consecutive(req)
        assert len(req.max_consecutive) == 1


class TestTryRelaxation:
    """Integration tests for the progressive relaxation loop."""

    def test_succeeds_after_two_steps(self):
        """Mock solver becomes feasible after 2 relaxations."""
        req = _make_request()
        call_count = [0]

        def mock_solve(request):
            call_count[0] += 1
            if call_count[0] <= 2:
                return ScheduleResponse(
                    status="infeasible", solutions=[], solve_time_ms=1.0
                )
            return ScheduleResponse(
                status="optimal", solutions=[], solve_time_ms=1.0
            )

        response, result = try_relaxation(req, mock_solve)
        assert response is not None
        assert response.status == "optimal"
        assert result.was_relaxed is True
        assert len(result.steps) == 3
        assert result.steps[0].succeeded is False
        assert result.steps[1].succeeded is False
        assert result.steps[2].succeeded is True

    def test_exhausts_all_attempts(self):
        """Mock solver always returns infeasible."""
        req = _make_request()

        def mock_solve(request):
            return ScheduleResponse(
                status="infeasible", solutions=[], solve_time_ms=1.0
            )

        response, result = try_relaxation(req, mock_solve)
        assert response is None
        assert result.was_relaxed is False
        assert len(result.steps) == 6  # All 6 relaxation types attempted

    def test_succeeds_immediately(self):
        """Mock solver succeeds on first relaxation."""
        req = _make_request()

        def mock_solve(request):
            return ScheduleResponse(
                status="feasible", solutions=[], solve_time_ms=1.0
            )

        response, result = try_relaxation(req, mock_solve)
        assert response is not None
        assert result.was_relaxed is True
        assert len(result.steps) == 1
        assert result.steps[0].constraint_name == "TARGET_FAIRNESS"
        assert result.steps[0].succeeded is True

    def test_relaxation_order_deterministic(self):
        """Relaxation order is the same regardless of input content."""
        req1 = _make_request(
            locked_nights=[LockedNight(parent=ParentRole.PARENT_A, days_of_week=[1])],
        )
        req2 = _make_request(
            max_consecutive=[MaxConsecutive(parent=ParentRole.PARENT_A, max_nights=2)],
        )

        def mock_solve(request):
            return ScheduleResponse(
                status="infeasible", solutions=[], solve_time_ms=1.0
            )

        _, result1 = try_relaxation(req1, mock_solve)
        _, result2 = try_relaxation(req2, mock_solve)

        names1 = [s.constraint_name for s in result1.steps]
        names2 = [s.constraint_name for s in result2.steps]
        assert names1 == names2 == RELAXATION_ORDER

    def test_to_info_produces_valid_model(self):
        """RelaxationResult.to_info() returns proper RelaxationInfo."""
        req = _make_request()

        def mock_solve(request):
            return ScheduleResponse(
                status="feasible", solutions=[], solve_time_ms=1.0
            )

        _, result = try_relaxation(req, mock_solve)
        info = result.to_info()
        assert isinstance(info, RelaxationInfo)
        assert info.was_relaxed is True
        assert len(info.steps) == 1

    def test_max_attempts_respected(self):
        """max_attempts parameter limits iterations."""
        req = _make_request()

        def mock_solve(request):
            return ScheduleResponse(
                status="infeasible", solutions=[], solve_time_ms=1.0
            )

        _, result = try_relaxation(req, mock_solve, max_attempts=2)
        assert len(result.steps) == 2
