"""
Tests for the 6-level lexicographic tie-break rules.

These tests do NOT require ortools — they test the pure function directly.
"""

import pytest
from datetime import date, timedelta

from app.solver.tie_break import compute_tie_break_key


def _date_range(start_str: str, days: int) -> list[date]:
    start = date.fromisoformat(start_str)
    return [start + timedelta(days=i) for i in range(days)]


class TestTieBreakTransitions:
    """Level 1: Total transitions (minimize)."""

    def test_fewer_transitions_sorts_first(self):
        dates = _date_range("2027-03-01", 7)

        # 0 transitions: all parent_a
        sol_a = {d: 0 for d in dates}
        # 2 transitions: a,a,b,b,a,a,a
        sol_b = {d: v for d, v in zip(dates, [0, 0, 1, 1, 0, 0, 0])}

        key_a = compute_tie_break_key(sol_a, dates, "sat_sun")
        key_b = compute_tie_break_key(sol_b, dates, "sat_sun")

        assert key_a[0] < key_b[0]  # fewer transitions
        assert key_a < key_b  # overall sort


class TestTieBreakWeekendFragmentation:
    """Level 2: Weekend fragmentation (minimize split weekends)."""

    def test_fragmented_weekend_sorts_later(self):
        dates = _date_range("2027-03-01", 7)  # Mon-Sun

        # No fragmentation: weekend days (Sat=5, Sun=6) same parent
        sol_no_frag = {d: v for d, v in zip(dates, [0, 1, 0, 1, 0, 0, 0])}
        # Fragmentation: weekend days split
        sol_frag = {d: v for d, v in zip(dates, [0, 1, 0, 1, 0, 0, 1])}

        # Both have same transitions (4)
        key_no_frag = compute_tie_break_key(sol_no_frag, dates, "sat_sun")
        key_frag = compute_tie_break_key(sol_frag, dates, "sat_sun")

        # Same transitions → compare fragmentation
        assert key_no_frag[0] == key_frag[0]  # same transitions
        assert key_no_frag[1] <= key_frag[1]  # less fragmentation


class TestTieBreakDeviation:
    """Level 3: Deviation from existing schedule (minimize changes)."""

    def test_less_deviation_sorts_first(self):
        dates = _date_range("2027-03-01", 7)
        current = {d: 0 for d in dates}  # all parent_a

        # No deviation
        sol_same = {d: 0 for d in dates}
        # 3 changes
        sol_diff = {d: v for d, v in zip(dates, [0, 0, 0, 0, 1, 1, 1])}

        key_same = compute_tie_break_key(sol_same, dates, "sat_sun", current)
        key_diff = compute_tie_break_key(sol_diff, dates, "sat_sun", current)

        assert key_same[2] < key_diff[2]  # less deviation


class TestTieBreakBinaryVector:
    """Level 6: Binary vector ordering (lexicographic)."""

    def test_parent_a_first_sorts_before_parent_b_first(self):
        dates = _date_range("2027-03-01", 3)

        sol_a_first = {d: v for d, v in zip(dates, [0, 0, 1])}
        sol_b_first = {d: v for d, v in zip(dates, [1, 0, 0])}

        key_a = compute_tie_break_key(sol_a_first, dates, "sat_sun")
        key_b = compute_tie_break_key(sol_b_first, dates, "sat_sun")

        # Both have 1 transition, but binary vector (0,0,1) < (1,0,0)
        assert key_a[5] < key_b[5]


class TestTieBreakDeterminism:
    """Determinism: same input → same key, 100 times."""

    def test_deterministic_100_runs(self):
        dates = _date_range("2027-03-01", 14)
        sol = {d: v for d, v in zip(dates, [0, 0, 1, 1, 0, 0, 1, 0, 1, 1, 0, 0, 1, 1])}

        keys = [compute_tie_break_key(sol, dates, "sat_sun") for _ in range(100)]
        assert all(k == keys[0] for k in keys)


class TestTieBreakLongDistance:
    """Level 4: Long-distance exchanges (minimize transitions on LD dates)."""

    def test_transition_on_ld_date_sorts_later(self):
        dates = _date_range("2027-03-01", 7)

        # Both have 1 transition at index 3
        sol_a = {d: v for d, v in zip(dates, [0, 0, 0, 1, 1, 1, 1])}
        sol_b = {d: v for d, v in zip(dates, [0, 0, 0, 1, 1, 1, 1])}

        # Mark day index 3 as long-distance date
        ld_dates = [dates[3].isoformat()]

        key_no_ld = compute_tie_break_key(sol_a, dates, "sat_sun", long_distance_dates=[])
        key_with_ld = compute_tie_break_key(sol_b, dates, "sat_sun", long_distance_dates=ld_dates)

        assert key_no_ld[3] == 0  # no LD transitions
        assert key_with_ld[3] == 1  # 1 LD transition
        assert key_no_ld < key_with_ld

    def test_no_ld_dates_stays_zero(self):
        dates = _date_range("2027-03-01", 7)
        sol = {d: v for d, v in zip(dates, [0, 0, 1, 1, 0, 0, 0])}

        key = compute_tie_break_key(sol, dates, "sat_sun")
        assert key[3] == 0

    def test_transition_not_on_ld_date_stays_zero(self):
        dates = _date_range("2027-03-01", 7)
        sol = {d: v for d, v in zip(dates, [0, 0, 0, 1, 1, 1, 1])}
        # Mark a non-transition day as LD
        ld_dates = [dates[0].isoformat()]

        key = compute_tie_break_key(sol, dates, "sat_sun", long_distance_dates=ld_dates)
        assert key[3] == 0


class TestTieBreakStabilityIndex:
    """Level 5: Stability block start index (prefer earlier first transition)."""

    def test_earlier_first_transition_sorts_first(self):
        dates = _date_range("2027-03-01", 7)

        # First transition at index 1
        sol_early = {d: v for d, v in zip(dates, [0, 1, 1, 1, 1, 1, 1])}
        # First transition at index 5
        sol_late = {d: v for d, v in zip(dates, [0, 0, 0, 0, 0, 1, 1])}

        key_early = compute_tie_break_key(sol_early, dates, "sat_sun")
        key_late = compute_tie_break_key(sol_late, dates, "sat_sun")

        assert key_early[4] < key_late[4]  # earlier first transition index
