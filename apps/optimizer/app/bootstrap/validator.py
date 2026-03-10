"""Confidence filtering and consistency validation for bootstrap facts."""

from datetime import date, timedelta

from app.bootstrap.models import (
    BootstrapFacts,
    ClarificationPrompt,
    ConflictDescription,
    LockedRange,
    RecurringPattern,
)
from app.models.requests import ParentRole

CONFIDENCE_HIGH = 0.8
CONFIDENCE_MEDIUM = 0.5


def filter_by_confidence(
    facts: BootstrapFacts,
) -> tuple[BootstrapFacts, BootstrapFacts, list[ClarificationPrompt]]:
    """Partition facts by confidence threshold.

    Returns (high_facts, medium_facts, clarifications).
    LOW confidence facts (< 0.5) are dropped entirely.
    MEDIUM facts generate clarification prompts.
    """
    high_ranges: list[LockedRange] = []
    medium_ranges: list[LockedRange] = []
    high_patterns: list[RecurringPattern] = []
    medium_patterns: list[RecurringPattern] = []
    clarifications: list[ClarificationPrompt] = []

    for i, lr in enumerate(facts.locked_ranges):
        if lr.confidence >= CONFIDENCE_HIGH:
            high_ranges.append(lr)
        elif lr.confidence >= CONFIDENCE_MEDIUM:
            medium_ranges.append(lr)
            clarifications.append(
                ClarificationPrompt(
                    id=f"locked_range_{i}",
                    field="locked_ranges",
                    reason=f"Medium confidence ({lr.confidence:.2f}): {lr.source_phrase or 'locked range'}",
                    options=[lr.parent.value, _other_parent(lr.parent).value, "remove"],
                    priority=10,
                )
            )
        # LOW: dropped

    for i, rp in enumerate(facts.recurring_patterns):
        if rp.confidence >= CONFIDENCE_HIGH:
            high_patterns.append(rp)
        elif rp.confidence >= CONFIDENCE_MEDIUM:
            medium_patterns.append(rp)
            clarifications.append(
                ClarificationPrompt(
                    id=f"recurring_pattern_{i}",
                    field="recurring_patterns",
                    reason=f"Medium confidence ({rp.confidence:.2f}): {rp.source_phrase or 'recurring pattern'}",
                    options=[rp.parent.value, _other_parent(rp.parent).value, "remove"],
                    priority=20,
                )
            )

    # current_parent
    high_current = None
    medium_current = None
    if facts.current_parent is not None:
        if facts.current_parent_confidence >= CONFIDENCE_HIGH:
            high_current = facts.current_parent
        elif facts.current_parent_confidence >= CONFIDENCE_MEDIUM:
            medium_current = facts.current_parent
            clarifications.append(
                ClarificationPrompt(
                    id="current_parent_0",
                    field="current_parent",
                    reason=f"Medium confidence ({facts.current_parent_confidence:.2f}): {facts.current_parent_source or 'current parent'}",
                    options=[ParentRole.PARENT_A.value, ParentRole.PARENT_B.value],
                    priority=5,
                )
            )

    # target_split_pct
    high_split = None
    medium_split = None
    if facts.target_split_pct is not None:
        if facts.target_split_confidence >= CONFIDENCE_HIGH:
            high_split = facts.target_split_pct
        elif facts.target_split_confidence >= CONFIDENCE_MEDIUM:
            medium_split = facts.target_split_pct
            clarifications.append(
                ClarificationPrompt(
                    id="target_split_0",
                    field="target_split_pct",
                    reason=f"Medium confidence ({facts.target_split_confidence:.2f}): {facts.target_split_source or 'target split'}",
                    options=["50", "60", "70", "80"],
                    priority=30,
                )
            )

    # exchange_anchors pass through (always treated as soft)
    high_anchors = [a for a in facts.exchange_anchors if a.confidence >= CONFIDENCE_HIGH]
    medium_anchors = [a for a in facts.exchange_anchors if CONFIDENCE_MEDIUM <= a.confidence < CONFIDENCE_HIGH]
    for i, ea in enumerate(medium_anchors):
        clarifications.append(
            ClarificationPrompt(
                id=f"exchange_anchor_{i}",
                field="exchange_anchors",
                reason=f"Medium confidence ({ea.confidence:.2f}): exchange anchor",
                options=["keep", "remove"],
                priority=40,
            )
        )

    high_facts = BootstrapFacts(
        current_parent=high_current,
        current_parent_confidence=facts.current_parent_confidence if high_current else 0.0,
        current_parent_source=facts.current_parent_source if high_current else "",
        locked_ranges=high_ranges,
        recurring_patterns=high_patterns,
        exchange_anchors=high_anchors,
        target_split_pct=high_split,
        target_split_confidence=facts.target_split_confidence if high_split else 0.0,
        target_split_source=facts.target_split_source if high_split else "",
    )

    medium_facts = BootstrapFacts(
        current_parent=medium_current,
        current_parent_confidence=facts.current_parent_confidence if medium_current else 0.0,
        current_parent_source=facts.current_parent_source if medium_current else "",
        locked_ranges=medium_ranges,
        recurring_patterns=medium_patterns,
        exchange_anchors=medium_anchors,
        target_split_pct=medium_split,
        target_split_confidence=facts.target_split_confidence if medium_split else 0.0,
        target_split_source=facts.target_split_source if medium_split else "",
    )

    # Sort clarifications by priority
    clarifications.sort(key=lambda c: c.priority)
    return high_facts, medium_facts, clarifications


def validate_consistency(
    facts: BootstrapFacts,
    reference_date: str,
    horizon_end: str,
) -> list[ConflictDescription]:
    """Detect contradictions in bootstrap facts.

    Checks:
    1. Date overlap: two locked_ranges assign different parents to overlapping dates
    2. Recurring conflict: two patterns assign different parents to same DOW
    3. Range vs. recurring: locked_range contradicts a recurring pattern
    4. Current parent vs. range: current_parent contradicts a range covering reference_date
    """
    conflicts: list[ConflictDescription] = []
    ref = date.fromisoformat(reference_date)
    h_end = date.fromisoformat(horizon_end)

    # 1. Date overlap between locked ranges
    for i, a in enumerate(facts.locked_ranges):
        for j, b in enumerate(facts.locked_ranges):
            if j <= i:
                continue
            if a.parent == b.parent:
                continue
            a_start = date.fromisoformat(a.start_date)
            a_end = date.fromisoformat(a.end_date)
            b_start = date.fromisoformat(b.start_date)
            b_end = date.fromisoformat(b.end_date)
            if a_start <= b_end and b_start <= a_end:
                overlap_start = max(a_start, b_start)
                overlap_end = min(a_end, b_end)
                conflicts.append(
                    ConflictDescription(
                        conflict_type="date_overlap",
                        description=(
                            f"Locked ranges overlap on {overlap_start.isoformat()} to {overlap_end.isoformat()}: "
                            f"{a.parent.value} vs {b.parent.value}"
                        ),
                        involved_facts=[f"locked_range_{i}", f"locked_range_{j}"],
                        clarification=ClarificationPrompt(
                            id=f"conflict_date_overlap_{i}_{j}",
                            field="locked_ranges",
                            reason=f"Which parent has the child from {overlap_start.isoformat()} to {overlap_end.isoformat()}?",
                            options=[a.parent.value, b.parent.value],
                            priority=1,
                        ),
                    )
                )

    # 2. Recurring conflict: same DOW, different parents
    for i, a in enumerate(facts.recurring_patterns):
        for j, b in enumerate(facts.recurring_patterns):
            if j <= i:
                continue
            if a.parent == b.parent:
                continue
            a_days = set(a.days_of_week) if a.days_of_week else _pattern_days(a.pattern_type)
            b_days = set(b.days_of_week) if b.days_of_week else _pattern_days(b.pattern_type)
            overlap = a_days & b_days
            if overlap:
                conflicts.append(
                    ConflictDescription(
                        conflict_type="pattern_conflict",
                        description=(
                            f"Recurring patterns conflict on days {sorted(overlap)}: "
                            f"{a.parent.value} ({a.pattern_type.value}) vs "
                            f"{b.parent.value} ({b.pattern_type.value})"
                        ),
                        involved_facts=[f"recurring_pattern_{i}", f"recurring_pattern_{j}"],
                        clarification=ClarificationPrompt(
                            id=f"conflict_pattern_{i}_{j}",
                            field="recurring_patterns",
                            reason=f"Which parent has the child on days {sorted(overlap)}?",
                            options=[a.parent.value, b.parent.value],
                            priority=2,
                        ),
                    )
                )

    # 3. Range vs. recurring: locked_range contradicts recurring pattern in horizon
    for ri, lr in enumerate(facts.locked_ranges):
        lr_start = date.fromisoformat(lr.start_date)
        lr_end = date.fromisoformat(lr.end_date)
        for pi, rp in enumerate(facts.recurring_patterns):
            if lr.parent == rp.parent:
                continue
            rp_days = set(rp.days_of_week) if rp.days_of_week else _pattern_days(rp.pattern_type)
            # Check if any date in the locked range falls on a recurring pattern day
            d = lr_start
            while d <= lr_end:
                js_dow = (d.weekday() + 1) % 7
                if js_dow in rp_days:
                    conflicts.append(
                        ConflictDescription(
                            conflict_type="range_inconsistency",
                            description=(
                                f"Locked range ({lr.parent.value}, {lr.start_date}–{lr.end_date}) "
                                f"conflicts with recurring pattern ({rp.parent.value}, {rp.pattern_type.value}) "
                                f"on {d.isoformat()}"
                            ),
                            involved_facts=[f"locked_range_{ri}", f"recurring_pattern_{pi}"],
                            clarification=ClarificationPrompt(
                                id=f"conflict_range_pattern_{ri}_{pi}",
                                field="locked_ranges",
                                reason=f"On {d.isoformat()}, is it {lr.parent.value} (locked) or {rp.parent.value} (recurring)?",
                                options=[lr.parent.value, rp.parent.value],
                                priority=3,
                            ),
                        )
                    )
                    break  # One conflict per range-pattern pair is enough
                d += timedelta(days=1)

    # 4. Current parent vs. range covering reference_date
    if facts.current_parent is not None:
        for ri, lr in enumerate(facts.locked_ranges):
            if lr.parent == facts.current_parent:
                continue
            lr_start = date.fromisoformat(lr.start_date)
            lr_end = date.fromisoformat(lr.end_date)
            if lr_start <= ref <= lr_end:
                conflicts.append(
                    ConflictDescription(
                        conflict_type="range_inconsistency",
                        description=(
                            f"Current parent ({facts.current_parent.value}) contradicts "
                            f"locked range ({lr.parent.value}) covering {reference_date}"
                        ),
                        involved_facts=["current_parent", f"locked_range_{ri}"],
                        clarification=ClarificationPrompt(
                            id=f"conflict_current_range_{ri}",
                            field="current_parent",
                            reason=f"Who has the child today ({reference_date})?",
                            options=[facts.current_parent.value, lr.parent.value],
                            priority=0,
                        ),
                    )
                )

    return conflicts


def _other_parent(parent: ParentRole) -> ParentRole:
    return ParentRole.PARENT_B if parent == ParentRole.PARENT_A else ParentRole.PARENT_A


def _pattern_days(pattern_type) -> set[int]:
    """Return JS-style DOW set for known pattern types."""
    from app.bootstrap.models import RecurringPatternType

    if pattern_type == RecurringPatternType.WEEKENDS:
        return {0, 6}  # Sun=0, Sat=6
    elif pattern_type == RecurringPatternType.WEEKDAYS:
        return {1, 2, 3, 4, 5}  # Mon-Fri
    return set()
