"""Tests for schedule statistics computation."""

import pytest
from datetime import date, timedelta
from app.brain.domain import ScheduleDay
from app.brain.stats import compute_stats


def _make_days(assignments: list[str], start: str = "2026-03-02") -> list[ScheduleDay]:
    """Helper: build ScheduleDay list from ['parent_a', 'parent_b', ...] strings."""
    d = date.fromisoformat(start)
    days = []
    for i, parent in enumerate(assignments):
        dt = d + timedelta(days=i)
        js_dow = (dt.weekday() + 1) % 7
        is_trans = i > 0 and parent != assignments[i - 1]
        days.append(ScheduleDay(
            date=dt.isoformat(),
            day_of_week=js_dow,
            assigned_to=parent,
            is_transition=is_trans,
        ))
    return days


class TestComputeStats:
    def test_empty_schedule(self):
        stats = compute_stats([])
        assert stats.parent_a_overnights == 0
        assert stats.stability_score == 1.0
        assert stats.fairness_score == 1.0

    def test_all_parent_a(self):
        # 14 days all parent_a, starting Mon 2026-03-02
        days = _make_days(["parent_a"] * 14)
        stats = compute_stats(days)
        assert stats.parent_a_overnights == 14
        assert stats.parent_b_overnights == 0
        assert stats.transitions_count == 0
        assert stats.stability_score == 1.0
        assert stats.fairness_score == 0.0  # totally unfair

    def test_perfect_5050(self):
        # 7 parent_a then 7 parent_b
        days = _make_days(["parent_a"] * 7 + ["parent_b"] * 7)
        stats = compute_stats(days)
        assert stats.parent_a_overnights == 7
        assert stats.parent_b_overnights == 7
        assert stats.transitions_count == 1
        assert stats.fairness_score == 1.0

    def test_alternating_high_transitions(self):
        # Alternating: A B A B A B ...
        pattern = ["parent_a", "parent_b"] * 7
        days = _make_days(pattern)
        stats = compute_stats(days)
        assert stats.parent_a_overnights == 7
        assert stats.parent_b_overnights == 7
        assert stats.transitions_count == 13  # every day is a transition
        assert stats.fairness_score == 1.0  # still fair
        assert stats.stability_score < 0.5  # very unstable

    def test_weekend_counting(self):
        # 2026-03-02 is a Monday. Fri=Mar 6 (day 4), Sat=Mar 7 (day 5)
        # Week 1 weekend (Fri+Sat): days 4,5 → parent_a
        # Week 2 weekend (Fri+Sat): days 11,12 → parent_b
        assignments = ["parent_a"] * 7 + ["parent_b"] * 7
        days = _make_days(assignments)
        stats = compute_stats(days)
        # Week 1: Fri Mar 6 (parent_a), Sat Mar 7 (parent_a)
        # Week 2: Fri Mar 13 (parent_b), Sat Mar 14 (parent_b)
        assert stats.parent_a_weekend_nights == 2
        assert stats.parent_b_weekend_nights == 2
        assert stats.weekend_parity_score == 1.0

    def test_non_school_handoffs(self):
        # Transition on Saturday (non-school night before Sunday)
        # 5 A, transition on Sat, then 2 B, then 7 A
        assignments = (["parent_a"] * 5 + ["parent_b"] * 2 +
                       ["parent_a"] * 7)
        days = _make_days(assignments)
        stats = compute_stats(days, school_days=[1, 2, 3, 4, 5])
        assert stats.transitions_count == 2
        # At least one non-school handoff (Saturday transition)
        assert stats.non_school_handoffs >= 1
