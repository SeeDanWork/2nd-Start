"""Tests for bootstrap converter — facts to ScheduleRequest mapping."""

import pytest
from datetime import date

from app.bootstrap.converter import facts_to_schedule_request
from app.bootstrap.models import (
    BootstrapFacts,
    ExchangeAnchor,
    LockedRange,
    RecurringPattern,
    RecurringPatternType,
)
from app.models.requests import ParentRole
from tests.bootstrap.fixtures import (
    alternating_weeks_facts,
    empty_facts,
    exchange_anchor_facts,
    locked_range_facts,
    simple_facts,
    target_split_facts,
)

HORIZON_START = date(2026, 3, 4)
HORIZON_END = date(2026, 3, 17)
REFERENCE_DATE = date(2026, 3, 4)


class TestCurrentParentMapping:
    def test_current_parent_creates_disruption_lock(self):
        facts = simple_facts()
        req = facts_to_schedule_request(facts, HORIZON_START, HORIZON_END, REFERENCE_DATE)
        bootstrap_locks = [dl for dl in req.disruption_locks if dl.source == "bootstrap"]
        today_locks = [dl for dl in bootstrap_locks if dl.date == "2026-03-04"]
        assert len(today_locks) >= 1
        assert today_locks[0].parent == ParentRole.PARENT_A

    def test_no_current_parent_no_today_lock(self):
        facts = empty_facts()
        req = facts_to_schedule_request(facts, HORIZON_START, HORIZON_END, REFERENCE_DATE)
        today_locks = [dl for dl in req.disruption_locks if dl.date == "2026-03-04"]
        assert len(today_locks) == 0


class TestLockedRangeMapping:
    def test_locked_range_creates_disruption_locks(self):
        facts = locked_range_facts()
        req = facts_to_schedule_request(facts, HORIZON_START, HORIZON_END, REFERENCE_DATE)
        # Range is March 6-10 = 5 days
        range_locks = [
            dl for dl in req.disruption_locks
            if dl.parent == ParentRole.PARENT_B and dl.date >= "2026-03-06" and dl.date <= "2026-03-10"
        ]
        assert len(range_locks) == 5

    def test_disruption_locks_are_deduped(self):
        """If current_parent and locked_range cover same date, no duplicates."""
        facts = BootstrapFacts(
            current_parent=ParentRole.PARENT_A,
            current_parent_confidence=0.95,
            locked_ranges=[
                LockedRange(
                    parent=ParentRole.PARENT_A,
                    start_date="2026-03-04",
                    end_date="2026-03-04",
                    confidence=0.9,
                ),
            ],
        )
        req = facts_to_schedule_request(facts, HORIZON_START, HORIZON_END, REFERENCE_DATE)
        today_locks = [dl for dl in req.disruption_locks if dl.date == "2026-03-04"]
        assert len(today_locks) == 1


class TestRecurringPatternMapping:
    def test_weekends_creates_locked_night(self):
        facts = simple_facts()
        req = facts_to_schedule_request(facts, HORIZON_START, HORIZON_END, REFERENCE_DATE)
        assert len(req.locked_nights) >= 1
        weekend_lock = req.locked_nights[0]
        assert weekend_lock.parent == ParentRole.PARENT_B
        assert set(weekend_lock.days_of_week) == {0, 6}  # Sun, Sat

    def test_weekdays_creates_locked_night(self):
        facts = BootstrapFacts(
            recurring_patterns=[
                RecurringPattern(
                    parent=ParentRole.PARENT_A,
                    pattern_type=RecurringPatternType.WEEKDAYS,
                    confidence=0.9,
                ),
            ],
        )
        req = facts_to_schedule_request(facts, HORIZON_START, HORIZON_END, REFERENCE_DATE)
        assert len(req.locked_nights) >= 1
        assert set(req.locked_nights[0].days_of_week) == {1, 2, 3, 4, 5}

    def test_specific_days_creates_locked_night(self):
        facts = BootstrapFacts(
            recurring_patterns=[
                RecurringPattern(
                    parent=ParentRole.PARENT_A,
                    pattern_type=RecurringPatternType.SPECIFIC_DAYS,
                    days_of_week=[1, 3],  # Mon, Wed
                    confidence=0.9,
                ),
            ],
        )
        req = facts_to_schedule_request(facts, HORIZON_START, HORIZON_END, REFERENCE_DATE)
        assert len(req.locked_nights) >= 1
        assert set(req.locked_nights[0].days_of_week) == {1, 3}

    def test_alternating_weeks_sets_template(self):
        facts = alternating_weeks_facts()
        req = facts_to_schedule_request(facts, HORIZON_START, HORIZON_END, REFERENCE_DATE)
        assert req.template_id == "7on7off"
        # Should also have disruption locks for first week
        assert len(req.disruption_locks) >= 7

    def test_alternating_weeks_locks_correct_parent(self):
        facts = alternating_weeks_facts()
        req = facts_to_schedule_request(facts, HORIZON_START, HORIZON_END, REFERENCE_DATE)
        for dl in req.disruption_locks:
            assert dl.parent == ParentRole.PARENT_A


class TestExchangeAnchorMapping:
    def test_exchange_anchors_set_preferred_handoff_days(self):
        facts = exchange_anchor_facts()
        req = facts_to_schedule_request(facts, HORIZON_START, HORIZON_END, REFERENCE_DATE)
        assert 5 in req.preferred_handoff_days

    def test_exchange_anchors_enable_location_weight(self):
        facts = exchange_anchor_facts()
        req = facts_to_schedule_request(facts, HORIZON_START, HORIZON_END, REFERENCE_DATE)
        assert req.weights.handoff_location_preference == 20

    def test_no_anchors_zero_location_weight(self):
        facts = empty_facts()
        req = facts_to_schedule_request(facts, HORIZON_START, HORIZON_END, REFERENCE_DATE)
        assert req.weights.handoff_location_preference == 0


class TestTargetSplitMapping:
    def test_target_split_creates_weekend_split(self):
        facts = target_split_facts()
        req = facts_to_schedule_request(facts, HORIZON_START, HORIZON_END, REFERENCE_DATE)
        assert req.weekend_split is not None
        assert req.weekend_split.target_pct_parent_a == 60

    def test_no_split_no_weekend_split(self):
        facts = empty_facts()
        req = facts_to_schedule_request(facts, HORIZON_START, HORIZON_END, REFERENCE_DATE)
        assert req.weekend_split is None


class TestBootstrapDefaults:
    def test_default_weights(self):
        facts = empty_facts()
        req = facts_to_schedule_request(facts, HORIZON_START, HORIZON_END, REFERENCE_DATE)
        assert req.weights.fairness_deviation == 100
        assert req.weights.total_transitions == 80
        assert req.weights.weekend_fragmentation == 60
        assert req.weights.short_block_penalty == 40
        assert req.weights.routine_consistency_weight == 0
        assert req.weights.weekly_rhythm_weight == 0

    def test_horizon_dates_passed_through(self):
        facts = empty_facts()
        req = facts_to_schedule_request(facts, HORIZON_START, HORIZON_END, REFERENCE_DATE)
        assert req.horizon_start == "2026-03-04"
        assert req.horizon_end == "2026-03-17"
