"""Tests for bootstrap discovery — adaptive question generation."""

import pytest

from app.bootstrap.discovery import get_next_discovery_question
from app.bootstrap.models import (
    BootstrapFacts,
    ExchangeAnchor,
    RecurringPattern,
    RecurringPatternType,
)
from app.models.requests import ParentRole
from tests.bootstrap.fixtures import empty_facts, simple_facts, full_facts


class TestDiscoveryPriority:
    def test_first_question_is_weekend_pattern(self):
        facts = empty_facts()
        q = get_next_discovery_question(facts, [])
        assert q is not None
        assert q.id == "weekend_pattern"
        assert q.priority == 10

    def test_questions_ordered_by_priority(self):
        facts = empty_facts()
        asked = []
        priorities = []
        for _ in range(6):
            q = get_next_discovery_question(facts, asked)
            if q is None:
                break
            priorities.append(q.priority)
            asked.append(q.id)
        assert priorities == sorted(priorities)

    def test_all_questions_exhausted(self):
        facts = empty_facts()
        asked = []
        for _ in range(10):
            q = get_next_discovery_question(facts, asked)
            if q is None:
                break
            asked.append(q.id)
        # After all questions asked, should return None
        assert get_next_discovery_question(facts, asked) is None
        assert len(asked) == 6  # exactly 6 questions in catalog


class TestFactCoveredSkipping:
    def test_weekend_pattern_skipped_if_weekends_fact_exists(self):
        facts = simple_facts()  # has weekends recurring pattern
        q = get_next_discovery_question(facts, [])
        assert q is not None
        assert q.id != "weekend_pattern"

    def test_target_balance_skipped_if_split_exists(self):
        facts = BootstrapFacts(target_split_pct=50, target_split_confidence=0.9)
        q = get_next_discovery_question(facts, [])
        assert q is not None
        # Should skip target_balance (priority 30), get weekend_pattern first
        asked = []
        for _ in range(6):
            q = get_next_discovery_question(facts, asked)
            if q is None:
                break
            assert q.id != "target_balance"
            asked.append(q.id)

    def test_exchange_logistics_skipped_if_anchors_exist(self):
        facts = BootstrapFacts(
            exchange_anchors=[
                ExchangeAnchor(day_of_week=5, confidence=0.9),
            ],
        )
        asked = []
        for _ in range(6):
            q = get_next_discovery_question(facts, asked)
            if q is None:
                break
            assert q.id != "exchange_logistics"
            asked.append(q.id)


class TestAlreadyAsked:
    def test_already_asked_skipped(self):
        facts = empty_facts()
        q = get_next_discovery_question(facts, ["weekend_pattern"])
        assert q is not None
        assert q.id == "max_consecutive"

    def test_multiple_already_asked(self):
        facts = empty_facts()
        q = get_next_discovery_question(facts, ["weekend_pattern", "max_consecutive"])
        assert q is not None
        assert q.id == "target_balance"


class TestDeterminism:
    def test_same_input_same_output(self):
        facts = empty_facts()
        results = [get_next_discovery_question(facts, []) for _ in range(10)]
        assert all(r.id == results[0].id for r in results)
        assert all(r.priority == results[0].priority for r in results)
