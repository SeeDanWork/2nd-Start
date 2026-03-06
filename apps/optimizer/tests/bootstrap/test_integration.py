"""Integration tests for bootstrap scheduling — end-to-end through solver."""

import pytest

from app.bootstrap.models import (
    BootstrapFacts,
    BootstrapScheduleRequest,
    LockedRange,
    RecurringPattern,
    RecurringPatternType,
)
from app.bootstrap.orchestrator import process_bootstrap_request
from app.models.requests import ParentRole
from tests.bootstrap.fixtures import (
    REFERENCE_DATE,
    conflicting_request,
    empty_request,
    locked_range_request,
    simple_request,
)


class TestSimpleFacts:
    def test_simple_facts_produce_schedule(self):
        response = process_bootstrap_request(simple_request())
        assert response.schedule.status in ("optimal", "feasible", "relaxed_solution")
        assert len(response.schedule.solutions) >= 1

    def test_simple_facts_have_discovery_questions(self):
        response = process_bootstrap_request(simple_request())
        assert len(response.discovery_questions) >= 1

    def test_simple_facts_applied_count(self):
        response = process_bootstrap_request(simple_request())
        # current_parent + 1 recurring pattern = 2 facts
        assert response.applied_facts_count == 2


class TestLockedRanges:
    def test_locked_ranges_respected(self):
        response = process_bootstrap_request(locked_range_request())
        assert response.schedule.status in ("optimal", "feasible", "relaxed_solution")
        if response.schedule.solutions:
            solution = response.schedule.solutions[0]
            # Check that March 6-10 assignments are parent_b
            for a in solution.assignments:
                if "2026-03-06" <= a.date <= "2026-03-10":
                    assert a.parent == "parent_b", (
                        f"Expected parent_b on {a.date}, got {a.parent}"
                    )


class TestConflicts:
    def test_conflicts_detected_but_schedule_still_produced(self):
        response = process_bootstrap_request(conflicting_request())
        assert len(response.conflicts) >= 1
        # Solver should still run (possibly on subset)
        assert response.schedule.status in ("optimal", "feasible", "relaxed_solution", "infeasible")

    def test_conflict_clarifications_present(self):
        response = process_bootstrap_request(conflicting_request())
        assert len(response.clarifications) >= 1


class TestEmptyFacts:
    def test_empty_facts_produce_unconstrained_schedule(self):
        response = process_bootstrap_request(empty_request())
        assert response.schedule.status in ("optimal", "feasible")
        assert len(response.schedule.solutions) >= 1

    def test_empty_facts_all_discovery_questions(self):
        response = process_bootstrap_request(empty_request())
        # With no facts, first discovery question should be returned
        assert len(response.discovery_questions) >= 1
        assert response.discovery_questions[0].id == "weekend_pattern"

    def test_empty_facts_zero_applied(self):
        response = process_bootstrap_request(empty_request())
        assert response.applied_facts_count == 0


class TestDeterminism:
    def test_same_request_produces_identical_response(self):
        """Run the same request 10 times and verify identical output."""
        results = [process_bootstrap_request(simple_request()) for _ in range(10)]

        first = results[0]
        for r in results[1:]:
            assert r.schedule.status == first.schedule.status
            assert r.applied_facts_count == first.applied_facts_count
            assert r.ignored_facts_count == first.ignored_facts_count
            assert len(r.schedule.solutions) == len(first.schedule.solutions)
            if r.schedule.solutions and first.schedule.solutions:
                for a1, a2 in zip(
                    r.schedule.solutions[0].assignments,
                    first.schedule.solutions[0].assignments,
                ):
                    assert a1.date == a2.date
                    assert a1.parent == a2.parent


class TestHorizonDefaults:
    def test_default_horizon_is_14_days(self):
        response = process_bootstrap_request(empty_request())
        if response.schedule.solutions:
            assignments = response.schedule.solutions[0].assignments
            assert len(assignments) == 14  # reference_date + 13 days

    def test_custom_horizon(self):
        request = BootstrapScheduleRequest(
            reference_date=REFERENCE_DATE,
            horizon_start="2026-03-04",
            horizon_end="2026-03-10",
            facts=BootstrapFacts(),
        )
        response = process_bootstrap_request(request)
        if response.schedule.solutions:
            assignments = response.schedule.solutions[0].assignments
            assert len(assignments) == 7


class TestStabilization:
    def test_alternating_weeks_suggests_template(self):
        """If schedule ends up as alternating weeks, stabilizer should detect it."""
        request = BootstrapScheduleRequest(
            reference_date=REFERENCE_DATE,
            facts=BootstrapFacts(
                recurring_patterns=[
                    RecurringPattern(
                        parent=ParentRole.PARENT_A,
                        pattern_type=RecurringPatternType.ALTERNATING_WEEKS,
                        confidence=0.95,
                    ),
                ],
            ),
        )
        response = process_bootstrap_request(request)
        # With alternating weeks template + disruption locks for first week,
        # the solver should produce a schedule close to 7on7off
        if response.stabilization:
            assert response.stabilization.adherence_score >= 0.85


class TestAlreadyAsked:
    def test_already_asked_skipped_in_discovery(self):
        request = BootstrapScheduleRequest(
            reference_date=REFERENCE_DATE,
            facts=BootstrapFacts(),
            already_asked=["weekend_pattern"],
        )
        response = process_bootstrap_request(request)
        for dq in response.discovery_questions:
            assert dq.id != "weekend_pattern"
