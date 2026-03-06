"""Tests for bootstrap stabilizer — template pattern matching."""

import pytest

from app.bootstrap.stabilizer import ADHERENCE_THRESHOLD, detect_template_match
from app.models.responses import (
    AssignmentDay,
    PenaltyBreakdown,
    ScheduleResponse,
    Solution,
    SolutionMetrics,
)


def _make_metrics() -> SolutionMetrics:
    return SolutionMetrics(
        parent_a_overnights=7,
        parent_b_overnights=7,
        parent_a_weekend_nights=2,
        parent_b_weekend_nights=2,
        total_transitions=2,
        transitions_per_week=1.0,
        max_consecutive_a=7,
        max_consecutive_b=7,
        school_night_consistency_pct=100.0,
        weekend_fragmentation_count=0,
    )


def _make_penalties() -> PenaltyBreakdown:
    return PenaltyBreakdown(
        fairness_deviation=0.0,
        total_transitions=0.0,
        non_daycare_handoffs=0.0,
        weekend_fragmentation=0.0,
        school_night_disruption=0.0,
        total=0.0,
    )


def _make_schedule(pattern: list[str]) -> ScheduleResponse:
    """Create a ScheduleResponse with assignments matching the given parent pattern."""
    assignments = []
    for i, parent in enumerate(pattern):
        d = f"2026-03-{4 + i:02d}"
        is_transition = i > 0 and pattern[i] != pattern[i - 1]
        assignments.append(AssignmentDay(date=d, parent=parent, is_transition=is_transition))

    return ScheduleResponse(
        status="optimal",
        solutions=[
            Solution(
                rank=1,
                assignments=assignments,
                metrics=_make_metrics(),
                penalties=_make_penalties(),
            )
        ],
        solve_time_ms=10.0,
    )


class TestExactMatch:
    def test_7on7off_exact_match(self):
        # 7 parent_a then 7 parent_b = perfect 7on7off
        pattern = ["parent_a"] * 7 + ["parent_b"] * 7
        schedule = _make_schedule(pattern)
        result = detect_template_match(schedule, "2026-03-04")
        assert result is not None
        assert result.template_id == "7on7off"
        assert result.adherence_score == 1.0

    def test_223_exact_match(self):
        # 2-2-3 pattern: A,A,B,B,A,A,A,B,B,A,A,B,B,B
        pattern = ["parent_a", "parent_a", "parent_b", "parent_b",
                    "parent_a", "parent_a", "parent_a", "parent_b",
                    "parent_b", "parent_a", "parent_a", "parent_b",
                    "parent_b", "parent_b"]
        schedule = _make_schedule(pattern)
        result = detect_template_match(schedule, "2026-03-04")
        assert result is not None
        assert result.adherence_score == 1.0


class TestNearMatch:
    def test_near_match_above_threshold(self):
        # 7on7off with 1 deviation out of 14 = ~93% adherence
        pattern = ["parent_a"] * 7 + ["parent_b"] * 7
        pattern[3] = "parent_b"  # one deviation
        schedule = _make_schedule(pattern)
        result = detect_template_match(schedule, "2026-03-04")
        assert result is not None
        assert result.adherence_score >= ADHERENCE_THRESHOLD


class TestBelowThreshold:
    def test_random_pattern_below_threshold(self):
        # Alternating every day — doesn't match any template well
        pattern = ["parent_a" if i % 2 == 0 else "parent_b" for i in range(14)]
        schedule = _make_schedule(pattern)
        result = detect_template_match(schedule, "2026-03-04")
        assert result is None


class TestOffsetSearch:
    def test_offset_match(self):
        # 7on7off but starting at day 3 of the cycle
        # Offset 3: should still match with offset search
        pattern = (["parent_a"] * 4 + ["parent_b"] * 7 + ["parent_a"] * 3)
        schedule = _make_schedule(pattern)
        result = detect_template_match(schedule, "2026-03-04")
        assert result is not None
        assert result.template_id == "7on7off"
        assert result.adherence_score == 1.0


class TestNoSolutions:
    def test_empty_solutions(self):
        schedule = ScheduleResponse(
            status="infeasible",
            solutions=[],
            solve_time_ms=10.0,
        )
        result = detect_template_match(schedule, "2026-03-04")
        assert result is None

    def test_empty_assignments(self):
        schedule = ScheduleResponse(
            status="optimal",
            solutions=[
                Solution(
                    rank=1,
                    assignments=[],
                    metrics=_make_metrics(),
                    penalties=_make_penalties(),
                )
            ],
            solve_time_ms=10.0,
        )
        result = detect_template_match(schedule, "2026-03-04")
        assert result is None


class TestDeterminism:
    def test_same_input_same_output(self):
        pattern = ["parent_a"] * 7 + ["parent_b"] * 7
        schedule = _make_schedule(pattern)
        results = [detect_template_match(schedule, "2026-03-04") for _ in range(10)]
        assert all(r.template_id == results[0].template_id for r in results)
        assert all(r.adherence_score == results[0].adherence_score for r in results)
