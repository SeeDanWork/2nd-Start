"""Permutation Determinism Tests.

Verify that input ordering does not affect solver output.
Shuffles every list-type input across 100 permutations per scenario
and asserts identical schedule hashes.
"""

import hashlib
import random
from copy import deepcopy

import pytest

from app.bootstrap.models import (
    BootstrapFacts,
    BootstrapScheduleRequest,
    ExchangeAnchor,
    LockedRange,
    RecurringPattern,
    RecurringPatternType,
)
from app.bootstrap.orchestrator import process_bootstrap_request
from app.models.requests import (
    DisruptionLock,
    FrozenAssignment,
    LockedNight,
    MaxConsecutive,
    MinConsecutive,
    ParentRole,
    ScheduleRequest,
    SolverWeights,
    WeekendSplit,
)
from app.solver.base_schedule import generate_base_schedule

REFERENCE_DATE = "2026-03-04"
PERMUTATION_RUNS = 100
SEED = 42


# ── Helpers ──────────────────────────────────────────────────────────────


def hash_schedule(response) -> str:
    """Produce a stable SHA-256 hash from solver output assignments."""
    if not response.solutions:
        return "NO_SOLUTIONS"
    parts = []
    for sol in response.solutions:
        for a in sorted(sol.assignments, key=lambda x: x.date):
            parts.append(f"{a.date}:{a.parent}")
    return hashlib.sha256("|".join(parts).encode()).hexdigest()


def hash_bootstrap(response) -> str:
    """Produce a stable SHA-256 hash from bootstrap output."""
    if not response.schedule.solutions:
        return "NO_SOLUTIONS"
    parts = []
    for sol in response.schedule.solutions:
        for a in sorted(sol.assignments, key=lambda x: x.date):
            parts.append(f"{a.date}:{a.parent}")
    return hashlib.sha256("|".join(parts).encode()).hexdigest()


def shuffle_list(lst: list, rng: random.Random) -> list:
    """Return a shuffled copy of a list."""
    copy = list(lst)
    rng.shuffle(copy)
    return copy


# ── Base Schedule Permutation Tests ──────────────────────────────────────


class TestBaseSchedulePermutation:
    """Shuffle constraint lists in ScheduleRequest and verify identical output."""

    @pytest.fixture
    def rich_request(self) -> ScheduleRequest:
        """A request with multiple items in every list field."""
        return ScheduleRequest(
            horizon_start="2026-03-04",
            horizon_end="2026-03-17",
            locked_nights=[
                LockedNight(parent=ParentRole.PARENT_A, days_of_week=[1, 2, 3]),
                LockedNight(parent=ParentRole.PARENT_B, days_of_week=[0, 6]),
            ],
            max_consecutive=[
                MaxConsecutive(parent=ParentRole.PARENT_A, max_nights=5),
                MaxConsecutive(parent=ParentRole.PARENT_B, max_nights=5),
            ],
            min_consecutive=[
                MinConsecutive(parent=ParentRole.PARENT_A, min_nights=2),
                MinConsecutive(parent=ParentRole.PARENT_B, min_nights=2),
            ],
            max_transitions_per_week=3,
            weekend_split=WeekendSplit(target_pct_parent_a=50, tolerance_pct=10),
            daycare_exchange_days=[1, 2, 3, 4, 5],
            preferred_handoff_days=[1, 5],
            disruption_locks=[
                DisruptionLock(parent=ParentRole.PARENT_A, date="2026-03-04", source="test"),
                DisruptionLock(parent=ParentRole.PARENT_B, date="2026-03-10", source="test"),
                DisruptionLock(parent=ParentRole.PARENT_A, date="2026-03-12", source="test"),
            ],
            weights=SolverWeights(
                fairness_deviation=100,
                total_transitions=80,
                non_daycare_handoffs=30,
                weekend_fragmentation=60,
                school_night_disruption=60,
            ),
            max_solutions=5,
            timeout_seconds=30,
        )

    def _permute_request(self, request: ScheduleRequest, rng: random.Random) -> ScheduleRequest:
        """Return a copy with all list fields shuffled."""
        r = deepcopy(request)
        r.locked_nights = shuffle_list(r.locked_nights, rng)
        r.max_consecutive = shuffle_list(r.max_consecutive, rng)
        r.min_consecutive = shuffle_list(r.min_consecutive, rng)
        r.disruption_locks = shuffle_list(r.disruption_locks, rng)
        r.daycare_exchange_days = shuffle_list(r.daycare_exchange_days, rng)
        r.preferred_handoff_days = shuffle_list(r.preferred_handoff_days, rng)
        # Also shuffle DOW lists within locked_nights
        for ln in r.locked_nights:
            ln.days_of_week = shuffle_list(ln.days_of_week, rng)
        return r

    def test_constraint_order_does_not_affect_schedule(self, rich_request):
        """100 permutations of constraint ordering must produce identical schedules."""
        baseline = generate_base_schedule(rich_request)
        baseline_hash = hash_schedule(baseline)
        assert baseline_hash != "NO_SOLUTIONS", "Baseline must produce solutions"

        rng = random.Random(SEED)
        hashes = set()
        hashes.add(baseline_hash)

        for _ in range(PERMUTATION_RUNS):
            permuted = self._permute_request(rich_request, rng)
            result = generate_base_schedule(permuted)
            h = hash_schedule(result)
            hashes.add(h)

        assert len(hashes) == 1, (
            f"Permutation Determinism Test FAILED: "
            f"{len(hashes)} unique schedule hashes found (expected 1)"
        )

    def test_disruption_lock_order_independence(self, rich_request):
        """Disruption lock ordering must not affect output."""
        baseline = generate_base_schedule(rich_request)
        baseline_hash = hash_schedule(baseline)

        rng = random.Random(SEED + 1)
        for _ in range(50):
            r = deepcopy(rich_request)
            r.disruption_locks = shuffle_list(r.disruption_locks, rng)
            result = generate_base_schedule(r)
            assert hash_schedule(result) == baseline_hash

    def test_locked_night_dow_order_independence(self, rich_request):
        """Day-of-week ordering within locked_nights must not affect output."""
        baseline = generate_base_schedule(rich_request)
        baseline_hash = hash_schedule(baseline)

        rng = random.Random(SEED + 2)
        for _ in range(50):
            r = deepcopy(rich_request)
            for ln in r.locked_nights:
                ln.days_of_week = shuffle_list(ln.days_of_week, rng)
            result = generate_base_schedule(r)
            assert hash_schedule(result) == baseline_hash


# ── Bootstrap Permutation Tests ──────────────────────────────────────────


class TestBootstrapPermutation:
    """Shuffle bootstrap fact lists and verify identical output."""

    @pytest.fixture
    def rich_facts(self) -> BootstrapScheduleRequest:
        return BootstrapScheduleRequest(
            reference_date=REFERENCE_DATE,
            facts=BootstrapFacts(
                current_parent=ParentRole.PARENT_A,
                current_parent_confidence=0.95,
                locked_ranges=[
                    LockedRange(
                        parent=ParentRole.PARENT_B,
                        start_date="2026-03-06",
                        end_date="2026-03-08",
                        confidence=0.9,
                    ),
                    LockedRange(
                        parent=ParentRole.PARENT_A,
                        start_date="2026-03-11",
                        end_date="2026-03-12",
                        confidence=0.85,
                    ),
                ],
                recurring_patterns=[
                    RecurringPattern(
                        parent=ParentRole.PARENT_B,
                        pattern_type=RecurringPatternType.WEEKENDS,
                        confidence=0.9,
                    ),
                    RecurringPattern(
                        parent=ParentRole.PARENT_A,
                        pattern_type=RecurringPatternType.WEEKDAYS,
                        confidence=0.85,
                    ),
                ],
                exchange_anchors=[
                    ExchangeAnchor(day_of_week=5, location="school", confidence=0.9),
                    ExchangeAnchor(day_of_week=1, location="home", confidence=0.85),
                ],
                target_split_pct=50,
                target_split_confidence=0.9,
            ),
        )

    def _permute_facts(self, request: BootstrapScheduleRequest, rng: random.Random) -> BootstrapScheduleRequest:
        """Return a copy with all fact lists shuffled."""
        r = deepcopy(request)
        r.facts.locked_ranges = shuffle_list(r.facts.locked_ranges, rng)
        r.facts.recurring_patterns = shuffle_list(r.facts.recurring_patterns, rng)
        r.facts.exchange_anchors = shuffle_list(r.facts.exchange_anchors, rng)
        return r

    def test_fact_order_does_not_affect_schedule(self, rich_facts):
        """100 permutations of fact ordering must produce identical bootstrap output."""
        baseline = process_bootstrap_request(rich_facts)
        baseline_hash = hash_bootstrap(baseline)
        assert baseline_hash != "NO_SOLUTIONS", "Baseline must produce solutions"

        rng = random.Random(SEED)
        hashes = set()
        hashes.add(baseline_hash)

        for _ in range(PERMUTATION_RUNS):
            permuted = self._permute_facts(rich_facts, rng)
            result = process_bootstrap_request(permuted)
            h = hash_bootstrap(result)
            hashes.add(h)

        assert len(hashes) == 1, (
            f"Bootstrap Permutation Determinism Test FAILED: "
            f"{len(hashes)} unique hashes found (expected 1)"
        )

    def test_locked_range_order_independence(self, rich_facts):
        """Locked range ordering must not affect bootstrap output."""
        baseline = process_bootstrap_request(rich_facts)
        baseline_hash = hash_bootstrap(baseline)

        rng = random.Random(SEED + 3)
        for _ in range(50):
            r = deepcopy(rich_facts)
            r.facts.locked_ranges = shuffle_list(r.facts.locked_ranges, rng)
            result = process_bootstrap_request(r)
            assert hash_bootstrap(result) == baseline_hash

    def test_recurring_pattern_order_independence(self, rich_facts):
        """Recurring pattern ordering must not affect bootstrap output."""
        baseline = process_bootstrap_request(rich_facts)
        baseline_hash = hash_bootstrap(baseline)

        rng = random.Random(SEED + 4)
        for _ in range(50):
            r = deepcopy(rich_facts)
            r.facts.recurring_patterns = shuffle_list(r.facts.recurring_patterns, rng)
            result = process_bootstrap_request(r)
            assert hash_bootstrap(result) == baseline_hash

    def test_exchange_anchor_order_independence(self, rich_facts):
        """Exchange anchor ordering must not affect bootstrap output."""
        baseline = process_bootstrap_request(rich_facts)
        baseline_hash = hash_bootstrap(baseline)

        rng = random.Random(SEED + 5)
        for _ in range(50):
            r = deepcopy(rich_facts)
            r.facts.exchange_anchors = shuffle_list(r.facts.exchange_anchors, rng)
            result = process_bootstrap_request(r)
            assert hash_bootstrap(result) == baseline_hash
