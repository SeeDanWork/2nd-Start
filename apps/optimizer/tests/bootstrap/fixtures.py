"""Reusable test data for bootstrap tests."""

from app.bootstrap.models import (
    BootstrapFacts,
    BootstrapScheduleRequest,
    ExchangeAnchor,
    LockedRange,
    RecurringPattern,
    RecurringPatternType,
)
from app.models.requests import ParentRole

REFERENCE_DATE = "2026-03-04"
HORIZON_START = "2026-03-04"
HORIZON_END = "2026-03-17"


def empty_facts() -> BootstrapFacts:
    return BootstrapFacts()


def simple_facts() -> BootstrapFacts:
    """Parent A has child today, Parent B gets weekends."""
    return BootstrapFacts(
        current_parent=ParentRole.PARENT_A,
        current_parent_confidence=0.95,
        current_parent_source="I have my child today",
        recurring_patterns=[
            RecurringPattern(
                parent=ParentRole.PARENT_B,
                pattern_type=RecurringPatternType.WEEKENDS,
                confidence=0.9,
                source_phrase="The father gets them on weekends",
            ),
        ],
    )


def locked_range_facts() -> BootstrapFacts:
    """Parent B has child from March 6-10."""
    return BootstrapFacts(
        current_parent=ParentRole.PARENT_A,
        current_parent_confidence=0.95,
        locked_ranges=[
            LockedRange(
                parent=ParentRole.PARENT_B,
                start_date="2026-03-06",
                end_date="2026-03-10",
                confidence=0.95,
                source_phrase="The father gets them this weekend until Wednesday",
            ),
        ],
    )


def conflicting_facts() -> BootstrapFacts:
    """Two locked ranges assign different parents to overlapping dates."""
    return BootstrapFacts(
        locked_ranges=[
            LockedRange(
                parent=ParentRole.PARENT_A,
                start_date="2026-03-06",
                end_date="2026-03-10",
                confidence=0.9,
            ),
            LockedRange(
                parent=ParentRole.PARENT_B,
                start_date="2026-03-08",
                end_date="2026-03-12",
                confidence=0.9,
            ),
        ],
    )


def mixed_confidence_facts() -> BootstrapFacts:
    """Facts with HIGH, MEDIUM, and LOW confidence."""
    return BootstrapFacts(
        current_parent=ParentRole.PARENT_A,
        current_parent_confidence=0.95,
        locked_ranges=[
            LockedRange(
                parent=ParentRole.PARENT_B,
                start_date="2026-03-06",
                end_date="2026-03-08",
                confidence=0.85,  # HIGH
                source_phrase="high confidence range",
            ),
            LockedRange(
                parent=ParentRole.PARENT_A,
                start_date="2026-03-10",
                end_date="2026-03-12",
                confidence=0.6,  # MEDIUM
                source_phrase="medium confidence range",
            ),
            LockedRange(
                parent=ParentRole.PARENT_B,
                start_date="2026-03-14",
                end_date="2026-03-16",
                confidence=0.3,  # LOW — should be dropped
                source_phrase="low confidence range",
            ),
        ],
    )


def recurring_conflict_facts() -> BootstrapFacts:
    """Two recurring patterns assign different parents to same DOW."""
    return BootstrapFacts(
        recurring_patterns=[
            RecurringPattern(
                parent=ParentRole.PARENT_A,
                pattern_type=RecurringPatternType.WEEKENDS,
                confidence=0.9,
            ),
            RecurringPattern(
                parent=ParentRole.PARENT_B,
                pattern_type=RecurringPatternType.WEEKENDS,
                confidence=0.85,
            ),
        ],
    )


def alternating_weeks_facts() -> BootstrapFacts:
    """Alternating weeks pattern."""
    return BootstrapFacts(
        recurring_patterns=[
            RecurringPattern(
                parent=ParentRole.PARENT_A,
                pattern_type=RecurringPatternType.ALTERNATING_WEEKS,
                confidence=0.9,
                source_phrase="We alternate weeks",
            ),
        ],
    )


def exchange_anchor_facts() -> BootstrapFacts:
    """Facts with exchange anchors."""
    return BootstrapFacts(
        current_parent=ParentRole.PARENT_A,
        current_parent_confidence=0.9,
        exchange_anchors=[
            ExchangeAnchor(
                day_of_week=5,  # Friday
                location="school",
                confidence=0.85,
            ),
        ],
    )


def target_split_facts() -> BootstrapFacts:
    """Facts with target split percentage."""
    return BootstrapFacts(
        target_split_pct=60,
        target_split_confidence=0.9,
        target_split_source="I want 60/40 split",
    )


def range_vs_recurring_conflict_facts() -> BootstrapFacts:
    """Locked range contradicts recurring pattern."""
    return BootstrapFacts(
        locked_ranges=[
            LockedRange(
                parent=ParentRole.PARENT_A,
                start_date="2026-03-07",  # Saturday
                end_date="2026-03-08",    # Sunday
                confidence=0.9,
            ),
        ],
        recurring_patterns=[
            RecurringPattern(
                parent=ParentRole.PARENT_B,
                pattern_type=RecurringPatternType.WEEKENDS,
                confidence=0.9,
            ),
        ],
    )


def current_parent_vs_range_conflict_facts() -> BootstrapFacts:
    """Current parent contradicts a locked range covering today."""
    return BootstrapFacts(
        current_parent=ParentRole.PARENT_A,
        current_parent_confidence=0.9,
        locked_ranges=[
            LockedRange(
                parent=ParentRole.PARENT_B,
                start_date="2026-03-03",
                end_date="2026-03-05",
                confidence=0.9,
            ),
        ],
    )


def full_facts() -> BootstrapFacts:
    """Comprehensive facts covering many fields."""
    return BootstrapFacts(
        current_parent=ParentRole.PARENT_A,
        current_parent_confidence=0.95,
        locked_ranges=[
            LockedRange(
                parent=ParentRole.PARENT_B,
                start_date="2026-03-06",
                end_date="2026-03-08",
                confidence=0.9,
            ),
        ],
        recurring_patterns=[
            RecurringPattern(
                parent=ParentRole.PARENT_B,
                pattern_type=RecurringPatternType.WEEKENDS,
                confidence=0.9,
            ),
        ],
        exchange_anchors=[
            ExchangeAnchor(day_of_week=5, location="school", confidence=0.9),
        ],
        target_split_pct=50,
        target_split_confidence=0.9,
    )


def simple_request() -> BootstrapScheduleRequest:
    return BootstrapScheduleRequest(
        reference_date=REFERENCE_DATE,
        facts=simple_facts(),
    )


def empty_request() -> BootstrapScheduleRequest:
    return BootstrapScheduleRequest(
        reference_date=REFERENCE_DATE,
        facts=empty_facts(),
    )


def conflicting_request() -> BootstrapScheduleRequest:
    return BootstrapScheduleRequest(
        reference_date=REFERENCE_DATE,
        facts=conflicting_facts(),
    )


def locked_range_request() -> BootstrapScheduleRequest:
    return BootstrapScheduleRequest(
        reference_date=REFERENCE_DATE,
        facts=locked_range_facts(),
    )
