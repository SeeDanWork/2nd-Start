"""Tests for the constraint relaxation engine (graduated steps)."""

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
    RELAXATION_STEPS,
    TOTAL_RELAXATION_STEPS,
    _relax_target_fairness_step1,
    _relax_target_fairness,
    _relax_weekend_split_step1,
    _relax_weekend_split_step2,
    _relax_weekend_split,
    _relax_max_transitions_step1,
    _relax_max_transitions_per_week,
    _relax_max_consecutive_step1,
    _relax_max_consecutive_step2,
    _relax_max_consecutive,
    _relax_min_consecutive_step1,
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

    def test_total_graduated_steps(self):
        assert TOTAL_RELAXATION_STEPS == 13

    def test_steps_match_order(self):
        """RELAXATION_STEPS constraint names match RELAXATION_ORDER."""
        step_names = [name for name, _ in RELAXATION_STEPS]
        assert step_names == RELAXATION_ORDER

    def test_step_counts_per_constraint(self):
        """Each constraint has the expected number of graduated steps."""
        step_counts = {name: len(fns) for name, fns in RELAXATION_STEPS}
        assert step_counts == {
            "TARGET_FAIRNESS": 2,
            "WEEKEND_SPLIT": 3,
            "MAX_TRANSITIONS_PER_WEEK": 2,
            "MAX_CONSECUTIVE": 3,
            "MIN_CONSECUTIVE": 2,
            "LOCKED_NIGHTS": 1,
        }


class TestGraduatedTargetFairness:
    """TARGET_FAIRNESS graduated: reduce 50% → remove."""

    def test_step1_halves_weight(self):
        req = _make_request(weights=SolverWeights(fairness_deviation=100))
        relaxed, action = _relax_target_fairness_step1(req)
        assert relaxed.weights.fairness_deviation == 50
        assert "50%" in action
        assert req.weights.fairness_deviation == 100  # original unchanged

    def test_step1_rounds_odd_weight(self):
        req = _make_request(weights=SolverWeights(fairness_deviation=75))
        relaxed, _ = _relax_target_fairness_step1(req)
        assert relaxed.weights.fairness_deviation == 38  # int(round(37.5))

    def test_step2_sets_zero(self):
        req = _make_request(weights=SolverWeights(fairness_deviation=100))
        relaxed, action = _relax_target_fairness(req)
        assert relaxed.weights.fairness_deviation == 0
        assert "0" in action

    def test_other_weights_preserved(self):
        req = _make_request(weights=SolverWeights(
            fairness_deviation=100,
            total_transitions=50,
            weekend_fragmentation=40,
        ))
        relaxed, _ = _relax_target_fairness_step1(req)
        assert relaxed.weights.total_transitions == 50
        assert relaxed.weights.weekend_fragmentation == 40


class TestGraduatedWeekendSplit:
    """WEEKEND_SPLIT graduated: +10% → +20% → remove."""

    def test_step1_widens_tolerance(self):
        req = _make_request(weekend_split=WeekendSplit(tolerance_pct=10))
        relaxed, action = _relax_weekend_split_step1(req)
        assert relaxed.weekend_split is not None
        assert relaxed.weekend_split.tolerance_pct == 20
        assert "+10%" in action

    def test_step2_widens_more(self):
        req = _make_request(weekend_split=WeekendSplit(tolerance_pct=10))
        relaxed, action = _relax_weekend_split_step2(req)
        assert relaxed.weekend_split is not None
        assert relaxed.weekend_split.tolerance_pct == 30
        assert "+20%" in action

    def test_step3_removes(self):
        req = _make_request(weekend_split=WeekendSplit(tolerance_pct=10))
        relaxed, action = _relax_weekend_split(req)
        assert relaxed.weekend_split is None
        assert "removed" in action.lower()

    def test_step1_noop_when_no_split(self):
        req = _make_request(weekend_split=None)
        relaxed, _ = _relax_weekend_split_step1(req)
        assert relaxed.weekend_split is None

    def test_graduated_sequence(self):
        """Tolerance: 10 → 20 → 30 → None through graduated steps."""
        req = _make_request(weekend_split=WeekendSplit(tolerance_pct=10))
        r1, _ = _relax_weekend_split_step1(req)
        assert r1.weekend_split.tolerance_pct == 20
        r2, _ = _relax_weekend_split_step2(req)
        assert r2.weekend_split.tolerance_pct == 30
        r3, _ = _relax_weekend_split(req)
        assert r3.weekend_split is None


class TestGraduatedMaxTransitions:
    """MAX_TRANSITIONS graduated: +1 → remove."""

    def test_step1_increases_by_1(self):
        req = _make_request(max_transitions_per_week=3)
        relaxed, action = _relax_max_transitions_step1(req)
        assert relaxed.max_transitions_per_week == 4
        assert "+1" in action or "4" in action

    def test_step2_removes(self):
        req = _make_request(max_transitions_per_week=3)
        relaxed, action = _relax_max_transitions_per_week(req)
        assert relaxed.max_transitions_per_week == 0
        assert "removed" in action.lower()


class TestGraduatedMaxConsecutive:
    """MAX_CONSECUTIVE graduated: +1 → +2 → remove."""

    def test_step1_increases_by_1(self):
        req = _make_request(max_consecutive=[
            MaxConsecutive(parent=ParentRole.PARENT_A, max_nights=3),
            MaxConsecutive(parent=ParentRole.PARENT_B, max_nights=4),
        ])
        relaxed, action = _relax_max_consecutive_step1(req)
        assert len(relaxed.max_consecutive) == 2
        assert relaxed.max_consecutive[0].max_nights == 4
        assert relaxed.max_consecutive[1].max_nights == 5
        assert "+1" in action

    def test_step2_increases_by_2(self):
        req = _make_request(max_consecutive=[
            MaxConsecutive(parent=ParentRole.PARENT_A, max_nights=3),
        ])
        relaxed, action = _relax_max_consecutive_step2(req)
        assert relaxed.max_consecutive[0].max_nights == 5
        assert "+2" in action

    def test_step3_removes_all(self):
        req = _make_request(max_consecutive=[
            MaxConsecutive(parent=ParentRole.PARENT_A, max_nights=3),
        ])
        relaxed, action = _relax_max_consecutive(req)
        assert relaxed.max_consecutive == []

    def test_does_not_mutate_original(self):
        req = _make_request(max_consecutive=[
            MaxConsecutive(parent=ParentRole.PARENT_A, max_nights=3),
        ])
        _relax_max_consecutive_step1(req)
        assert req.max_consecutive[0].max_nights == 3


class TestGraduatedMinConsecutive:
    """MIN_CONSECUTIVE graduated: -1 (min 1) → remove."""

    def test_step1_decreases_by_1(self):
        req = _make_request(min_consecutive=[
            MinConsecutive(parent=ParentRole.PARENT_A, min_nights=3),
        ])
        relaxed, action = _relax_min_consecutive_step1(req)
        assert relaxed.min_consecutive[0].min_nights == 2
        assert "-1" in action

    def test_step1_floors_at_1(self):
        req = _make_request(min_consecutive=[
            MinConsecutive(parent=ParentRole.PARENT_A, min_nights=1),
        ])
        relaxed, _ = _relax_min_consecutive_step1(req)
        assert relaxed.min_consecutive[0].min_nights == 1

    def test_step2_removes_all(self):
        req = _make_request(min_consecutive=[
            MinConsecutive(parent=ParentRole.PARENT_A, min_nights=2),
        ])
        relaxed, action = _relax_min_consecutive(req)
        assert relaxed.min_consecutive == []

    def test_does_not_mutate_original(self):
        req = _make_request(min_consecutive=[
            MinConsecutive(parent=ParentRole.PARENT_A, min_nights=3),
        ])
        _relax_min_consecutive_step1(req)
        assert req.min_consecutive[0].min_nights == 3


class TestLockedNights:
    """LOCKED_NIGHTS: single step, remove all."""

    def test_removes_all(self):
        req = _make_request(locked_nights=[
            LockedNight(parent=ParentRole.PARENT_A, days_of_week=[1, 3]),
        ])
        relaxed, action = _relax_locked_nights(req)
        assert relaxed.locked_nights == []
        assert "locked" in action.lower()


class TestTryRelaxation:
    """Integration tests for the progressive graduated relaxation loop."""

    def test_succeeds_after_three_steps(self):
        """Mock solver becomes feasible after 3 graduated steps."""
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
        """Mock solver always returns infeasible — all 13 steps tried."""
        req = _make_request()

        def mock_solve(request):
            return ScheduleResponse(
                status="infeasible", solutions=[], solve_time_ms=1.0
            )

        response, result = try_relaxation(req, mock_solve)
        assert response is None
        assert result.was_relaxed is False
        assert len(result.steps) == 13  # All graduated steps attempted

    def test_succeeds_immediately(self):
        """Mock solver succeeds on first graduated step."""
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

    def test_relaxation_constraint_order_deterministic(self):
        """Constraint groups appear in correct order through all 13 steps."""
        req = _make_request()

        def mock_solve(request):
            return ScheduleResponse(
                status="infeasible", solutions=[], solve_time_ms=1.0
            )

        _, result = try_relaxation(req, mock_solve)

        expected_constraint_names = []
        for name, fns in RELAXATION_STEPS:
            expected_constraint_names.extend([name] * len(fns))

        actual_names = [s.constraint_name for s in result.steps]
        assert actual_names == expected_constraint_names

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

        _, result = try_relaxation(req, mock_solve, max_attempts=4)
        assert len(result.steps) == 4

    def test_cumulative_composition(self):
        """When solver succeeds on step 5 (first WEEKEND_SPLIT step after
        TARGET_FAIRNESS exhausted), the final request has both TARGET_FAIRNESS
        fully relaxed AND WEEKEND_SPLIT partially relaxed."""
        req = _make_request(
            weights=SolverWeights(fairness_deviation=100),
            weekend_split=WeekendSplit(tolerance_pct=10),
        )
        call_count = [0]
        captured_requests = []

        def mock_solve(request):
            call_count[0] += 1
            captured_requests.append(deepcopy(request))
            # Succeed on attempt 3 (first WEEKEND_SPLIT step)
            if call_count[0] >= 3:
                return ScheduleResponse(
                    status="optimal", solutions=[], solve_time_ms=1.0
                )
            return ScheduleResponse(
                status="infeasible", solutions=[], solve_time_ms=1.0
            )

        response, result = try_relaxation(req, mock_solve)
        assert response is not None
        assert len(result.steps) == 3

        # Step 3 should be WEEKEND_SPLIT step1
        assert result.steps[2].constraint_name == "WEEKEND_SPLIT"

        # The final request should have fairness=0 (committed from TARGET_FAIRNESS)
        # and weekend_split.tolerance_pct=20 (step1 of WEEKEND_SPLIT)
        final = result.final_request
        assert final.weights.fairness_deviation == 0
        assert final.weekend_split is not None
        assert final.weekend_split.tolerance_pct == 20

    def test_graduated_weekend_split_full_sequence(self):
        """Weekend split goes through: +10% → +20% → removed."""
        req = _make_request(weekend_split=WeekendSplit(tolerance_pct=10))
        steps_seen = []

        def mock_solve(request):
            steps_seen.append({
                "weekend_split": deepcopy(request.weekend_split),
            })
            return ScheduleResponse(
                status="infeasible", solutions=[], solve_time_ms=1.0
            )

        try_relaxation(req, mock_solve)

        # Find the WEEKEND_SPLIT steps (indices 2, 3, 4 — after 2 TARGET_FAIRNESS steps)
        ws_steps = steps_seen[2:5]
        assert ws_steps[0]["weekend_split"].tolerance_pct == 20   # +10%
        assert ws_steps[1]["weekend_split"].tolerance_pct == 30   # +20%
        assert ws_steps[2]["weekend_split"] is None                # removed

    def test_graduated_max_consecutive_full_sequence(self):
        """Max consecutive goes through: +1 → +2 → removed."""
        req = _make_request(max_consecutive=[
            MaxConsecutive(parent=ParentRole.PARENT_A, max_nights=3),
        ])
        steps_seen = []

        def mock_solve(request):
            steps_seen.append({
                "max_consecutive": deepcopy(request.max_consecutive),
            })
            return ScheduleResponse(
                status="infeasible", solutions=[], solve_time_ms=1.0
            )

        try_relaxation(req, mock_solve)

        # MAX_CONSECUTIVE steps are at indices 7, 8, 9
        # (2 TARGET_FAIRNESS + 3 WEEKEND_SPLIT + 2 MAX_TRANSITIONS = 7)
        mc_steps = steps_seen[7:10]
        assert mc_steps[0]["max_consecutive"][0].max_nights == 4   # +1
        assert mc_steps[1]["max_consecutive"][0].max_nights == 5   # +2
        assert mc_steps[2]["max_consecutive"] == []                 # removed
