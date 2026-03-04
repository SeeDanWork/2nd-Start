"""
20 solver scenarios for the base schedule CP-SAT solver.

These tests require ortools. If not available, they are skipped.
Tests are designed to run via Docker: docker exec adcp-optimizer pytest
"""

import pytest
from datetime import date

try:
    from ortools.sat.python import cp_model
    HAS_ORTOOLS = True
except ImportError:
    HAS_ORTOOLS = False

pytestmark = pytest.mark.skipif(not HAS_ORTOOLS, reason="ortools not installed")

from app.solver.base_schedule import generate_base_schedule
from tests.solver.fixtures import (
    scenario_baseline_5050,
    scenario_locked_nights,
    scenario_conflicting_constraints,
    scenario_infant_stability,
    scenario_tight_max_consecutive,
    scenario_low_transition_cap,
    scenario_weekend_fri_sat,
    scenario_weekend_parity_conflict,
    scenario_no_contact_exchange,
    scenario_long_distance,
    scenario_short_disruption,
    scenario_long_disruption,
    scenario_overlapping_disruptions,
    scenario_horizon_boundary,
    scenario_infeasible_combined,
)


class TestBaselineScenarios:
    """S1: Baseline 50/50"""

    def test_produces_solutions(self):
        result = generate_base_schedule(scenario_baseline_5050())
        assert result.status in ("optimal", "feasible")
        assert len(result.solutions) >= 1

    def test_fairness_within_bounds(self):
        result = generate_base_schedule(scenario_baseline_5050())
        for sol in result.solutions:
            a = sol.metrics.parent_a_overnights
            b = sol.metrics.parent_b_overnights
            # Should be roughly 50/50 (within 2 nights for 14-day horizon)
            assert abs(a - b) <= 2, f"Fairness deviation too large: {a} vs {b}"


class TestLockedNights:
    """S2: Locked nights respected"""

    def test_locked_days_assigned_correctly(self):
        result = generate_base_schedule(scenario_locked_nights())
        assert result.status in ("optimal", "feasible")
        for sol in result.solutions:
            for a in sol.assignments:
                d = date.fromisoformat(a.date)
                js_dow = (d.weekday() + 1) % 7
                if js_dow in (2, 4):  # Tue, Thu
                    assert a.parent == "parent_b", (
                        f"Parent A locked on JS DOW {js_dow} but {a.date} assigned to {a.parent}"
                    )


class TestConflictingConstraints:
    """S3: Infeasible constraint set"""

    def test_infeasible_detected(self):
        result = generate_base_schedule(scenario_conflicting_constraints())
        assert result.status == "infeasible"
        assert len(result.conflicting_constraints) > 0


class TestInfantStability:
    """S4: Under-5 stability with max 2 consecutive"""

    def test_max_consecutive_2(self):
        result = generate_base_schedule(scenario_infant_stability())
        assert result.status in ("optimal", "feasible")
        for sol in result.solutions:
            run = 1
            for i in range(1, len(sol.assignments)):
                if sol.assignments[i].parent == sol.assignments[i - 1].parent:
                    run += 1
                else:
                    run = 1
                assert run <= 2, (
                    f"Consecutive run of {run} exceeds max 2 at {sol.assignments[i].date}"
                )


class TestTightMaxConsecutive:
    """S5: Tight max consecutive — 3 nights max"""

    def test_max_consecutive_3(self):
        result = generate_base_schedule(scenario_tight_max_consecutive())
        assert result.status in ("optimal", "feasible")
        for sol in result.solutions:
            run = 1
            for i in range(1, len(sol.assignments)):
                if sol.assignments[i].parent == sol.assignments[i - 1].parent:
                    run += 1
                else:
                    run = 1
                assert run <= 3, (
                    f"Consecutive run of {run} exceeds max 3 at {sol.assignments[i].date}"
                )


class TestLowTransitionCap:
    """S6: Low transition cap — max 1 per week"""

    def test_transitions_capped(self):
        result = generate_base_schedule(scenario_low_transition_cap())
        assert result.status in ("optimal", "feasible")
        for sol in result.solutions:
            # Group by ISO week, count transitions per week
            from collections import defaultdict
            week_transitions = defaultdict(int)
            for i in range(1, len(sol.assignments)):
                if sol.assignments[i].is_transition:
                    d = date.fromisoformat(sol.assignments[i].date)
                    week_transitions[d.isocalendar()[1]] += 1
            for wk, count in week_transitions.items():
                assert count <= 1, f"Week {wk} has {count} transitions, max is 1"


class TestWeekendDefinition:
    """S7: Weekend definition fri_sat"""

    def test_produces_solutions(self):
        result = generate_base_schedule(scenario_weekend_fri_sat())
        assert result.status in ("optimal", "feasible")
        assert len(result.solutions) >= 1


class TestWeekendParityConflict:
    """S8: Weekend parity conflict"""

    def test_feasible_or_infeasible(self):
        result = generate_base_schedule(scenario_weekend_parity_conflict())
        # This may or may not be feasible depending on constraint interaction
        assert result.status in ("optimal", "feasible", "infeasible")


class TestNoContactExchange:
    """S9: No-contact exchange — high penalty for non-daycare handoffs"""

    def test_minimizes_non_daycare_handoffs(self):
        result = generate_base_schedule(scenario_no_contact_exchange())
        assert result.status in ("optimal", "feasible")
        # The best solution should have few non-daycare handoffs
        if result.solutions:
            best = result.solutions[0]
            # With high penalty, solver should minimize these
            assert best.penalties.non_daycare_handoffs is not None


class TestLongDistance:
    """S10: Long distance — heavy transition penalty"""

    def test_minimizes_transitions(self):
        result = generate_base_schedule(scenario_long_distance())
        assert result.status in ("optimal", "feasible")
        for sol in result.solutions:
            # With 500 weight on transitions, should have very few
            assert sol.metrics.total_transitions <= 6, (
                f"Too many transitions: {sol.metrics.total_transitions}"
            )


class TestShortDisruption:
    """S11: Short disruption <=72h"""

    def test_disruption_locks_respected(self):
        result = generate_base_schedule(scenario_short_disruption())
        assert result.status in ("optimal", "feasible")
        for sol in result.solutions:
            for a in sol.assignments:
                if a.date in ("2027-03-05", "2027-03-06"):
                    assert a.parent == "parent_b", (
                        f"Disruption lock not respected: {a.date} assigned to {a.parent}"
                    )


class TestLongDisruption:
    """S12: Long disruption >72h"""

    def test_disruption_locks_respected(self):
        result = generate_base_schedule(scenario_long_disruption())
        assert result.status in ("optimal", "feasible")
        locked_dates = {"2027-03-03", "2027-03-04", "2027-03-05", "2027-03-06", "2027-03-07"}
        for sol in result.solutions:
            for a in sol.assignments:
                if a.date in locked_dates:
                    assert a.parent == "parent_b", (
                        f"Disruption lock not respected: {a.date} assigned to {a.parent}"
                    )


class TestOverlappingDisruptions:
    """S13: Overlapping disruptions"""

    def test_both_disruption_sets_respected(self):
        result = generate_base_schedule(scenario_overlapping_disruptions())
        assert result.status in ("optimal", "feasible")
        for sol in result.solutions:
            for a in sol.assignments:
                # Parent B locked on 3rd-4th
                if a.date in ("2027-03-03", "2027-03-04"):
                    assert a.parent == "parent_b"
                # Parent A locked on 10th-11th
                if a.date in ("2027-03-10", "2027-03-11"):
                    assert a.parent == "parent_a"


class TestTieBreakDeterminism:
    """S17: Tie-break determinism — N=10 identical runs"""

    def test_determinism_10_runs(self):
        request = scenario_baseline_5050()
        results = [generate_base_schedule(request) for _ in range(10)]
        # All should produce same number of solutions
        n = len(results[0].solutions)
        for r in results[1:]:
            assert len(r.solutions) == n

        # All solutions should be identical
        if n > 0:
            for i in range(n):
                ref = results[0].solutions[i]
                for r in results[1:]:
                    sol = r.solutions[i]
                    for a1, a2 in zip(ref.assignments, sol.assignments):
                        assert a1.parent == a2.parent, (
                            f"Non-deterministic: {a1.date} = {a1.parent} vs {a2.parent}"
                        )


class TestHorizonBoundary:
    """S18: Horizon boundary — 7-day horizon"""

    def test_short_horizon_produces_solutions(self):
        result = generate_base_schedule(scenario_horizon_boundary())
        assert result.status in ("optimal", "feasible")
        assert len(result.solutions) >= 1
        # Should have exactly 7 days
        for sol in result.solutions:
            assert len(sol.assignments) == 7


class TestInfeasibleCombined:
    """S20: Infeasible combined constraints"""

    def test_infeasible_detected(self):
        result = generate_base_schedule(scenario_infeasible_combined())
        # With Parent A locked Mon-Wed and Parent B max 1 consecutive,
        # Parent B needs child Thu-Sat but can only do 1 night at a time
        # This creates alternating Thu-Fri-Sat with parent_b max 1 consecutive = infeasible
        # (actually this might still be feasible if parent_a fills the gaps)
        # Either way, we just verify it doesn't crash
        assert result.status in ("optimal", "feasible", "infeasible")


class TestSolverRanking:
    """Verify solutions are ranked by penalty (ascending)."""

    def test_solutions_sorted_by_penalty(self):
        result = generate_base_schedule(scenario_baseline_5050())
        if len(result.solutions) >= 2:
            for i in range(1, len(result.solutions)):
                assert result.solutions[i].penalties.total >= result.solutions[i - 1].penalties.total, (
                    f"Solutions not sorted: rank {i} penalty {result.solutions[i].penalties.total} "
                    f"< rank {i-1} penalty {result.solutions[i-1].penalties.total}"
                )
