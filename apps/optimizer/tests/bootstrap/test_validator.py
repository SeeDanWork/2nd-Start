"""Tests for bootstrap validator — confidence filtering and consistency checks."""

import pytest

from app.bootstrap.models import (
    BootstrapFacts,
    LockedRange,
    RecurringPattern,
    RecurringPatternType,
)
from app.bootstrap.validator import (
    CONFIDENCE_HIGH,
    CONFIDENCE_MEDIUM,
    filter_by_confidence,
    validate_consistency,
)
from app.models.requests import ParentRole
from tests.bootstrap.fixtures import (
    HORIZON_END,
    REFERENCE_DATE,
    conflicting_facts,
    current_parent_vs_range_conflict_facts,
    empty_facts,
    mixed_confidence_facts,
    range_vs_recurring_conflict_facts,
    recurring_conflict_facts,
    simple_facts,
)


class TestFilterByConfidence:
    def test_high_confidence_passes_through(self):
        facts = simple_facts()
        high, medium, clarifications = filter_by_confidence(facts)
        assert high.current_parent == ParentRole.PARENT_A
        assert len(high.recurring_patterns) == 1

    def test_medium_confidence_generates_clarification(self):
        facts = mixed_confidence_facts()
        high, medium, clarifications = filter_by_confidence(facts)
        # High: 1 locked range (0.85)
        assert len(high.locked_ranges) == 1
        # Medium: 1 locked range (0.6)
        assert len(medium.locked_ranges) == 1
        # Should have clarification for medium range
        range_clarifications = [c for c in clarifications if c.field == "locked_ranges"]
        assert len(range_clarifications) >= 1

    def test_low_confidence_dropped(self):
        facts = mixed_confidence_facts()
        high, medium, clarifications = filter_by_confidence(facts)
        # LOW (0.3) range should not appear in either
        all_ranges = high.locked_ranges + medium.locked_ranges
        assert len(all_ranges) == 2  # only HIGH + MEDIUM

    def test_empty_facts_no_clarifications(self):
        facts = empty_facts()
        high, medium, clarifications = filter_by_confidence(facts)
        assert len(clarifications) == 0
        assert high.current_parent is None
        assert len(high.locked_ranges) == 0

    def test_boundary_at_high_threshold(self):
        """Confidence exactly at 0.8 should be HIGH."""
        facts = BootstrapFacts(
            locked_ranges=[
                LockedRange(
                    parent=ParentRole.PARENT_A,
                    start_date="2026-03-06",
                    end_date="2026-03-08",
                    confidence=0.8,
                )
            ]
        )
        high, medium, clarifications = filter_by_confidence(facts)
        assert len(high.locked_ranges) == 1
        assert len(medium.locked_ranges) == 0

    def test_boundary_at_medium_threshold(self):
        """Confidence exactly at 0.5 should be MEDIUM."""
        facts = BootstrapFacts(
            locked_ranges=[
                LockedRange(
                    parent=ParentRole.PARENT_A,
                    start_date="2026-03-06",
                    end_date="2026-03-08",
                    confidence=0.5,
                )
            ]
        )
        high, medium, clarifications = filter_by_confidence(facts)
        assert len(high.locked_ranges) == 0
        assert len(medium.locked_ranges) == 1
        assert len(clarifications) == 1

    def test_below_medium_threshold_dropped(self):
        """Confidence at 0.49 should be dropped entirely."""
        facts = BootstrapFacts(
            locked_ranges=[
                LockedRange(
                    parent=ParentRole.PARENT_A,
                    start_date="2026-03-06",
                    end_date="2026-03-08",
                    confidence=0.49,
                )
            ]
        )
        high, medium, clarifications = filter_by_confidence(facts)
        assert len(high.locked_ranges) == 0
        assert len(medium.locked_ranges) == 0
        assert len(clarifications) == 0

    def test_clarification_ids_are_deterministic(self):
        facts = mixed_confidence_facts()
        _, _, c1 = filter_by_confidence(facts)
        _, _, c2 = filter_by_confidence(facts)
        assert [c.id for c in c1] == [c.id for c in c2]

    def test_clarifications_sorted_by_priority(self):
        facts = mixed_confidence_facts()
        _, _, clarifications = filter_by_confidence(facts)
        priorities = [c.priority for c in clarifications]
        assert priorities == sorted(priorities)


class TestValidateConsistency:
    def test_date_overlap_detected(self):
        facts = conflicting_facts()
        conflicts = validate_consistency(facts, REFERENCE_DATE, HORIZON_END)
        assert len(conflicts) >= 1
        assert any(c.conflict_type == "date_overlap" for c in conflicts)

    def test_recurring_conflict_detected(self):
        facts = recurring_conflict_facts()
        conflicts = validate_consistency(facts, REFERENCE_DATE, HORIZON_END)
        assert any(c.conflict_type == "pattern_conflict" for c in conflicts)

    def test_range_vs_recurring_detected(self):
        facts = range_vs_recurring_conflict_facts()
        conflicts = validate_consistency(facts, REFERENCE_DATE, HORIZON_END)
        assert any(c.conflict_type == "range_inconsistency" for c in conflicts)

    def test_current_parent_vs_range_detected(self):
        facts = current_parent_vs_range_conflict_facts()
        conflicts = validate_consistency(facts, REFERENCE_DATE, HORIZON_END)
        assert any(c.conflict_type == "range_inconsistency" for c in conflicts)

    def test_no_conflicts_in_simple_facts(self):
        facts = simple_facts()
        conflicts = validate_consistency(facts, REFERENCE_DATE, HORIZON_END)
        assert len(conflicts) == 0

    def test_no_conflicts_in_empty_facts(self):
        facts = empty_facts()
        conflicts = validate_consistency(facts, REFERENCE_DATE, HORIZON_END)
        assert len(conflicts) == 0

    def test_conflict_clarification_has_options(self):
        facts = conflicting_facts()
        conflicts = validate_consistency(facts, REFERENCE_DATE, HORIZON_END)
        for conflict in conflicts:
            assert len(conflict.clarification.options) >= 2
            assert conflict.clarification.id.startswith("conflict_")
