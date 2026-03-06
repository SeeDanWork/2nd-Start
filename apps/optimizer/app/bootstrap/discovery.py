"""Adaptive constraint discovery — generates the next clarification question."""

from typing import Optional

from app.bootstrap.models import (
    BootstrapFacts,
    DiscoveryQuestion,
    RecurringPatternType,
)

# Fixed question catalog, ordered by priority
_QUESTION_CATALOG: list[dict] = [
    {
        "id": "weekend_pattern",
        "question_key": "weekend_pattern",
        "display_text": "What is the typical weekend arrangement? (e.g., alternating weekends, every weekend with one parent)",
        "options": ["Alternating weekends", "Parent A every weekend", "Parent B every weekend", "Split weekends"],
        "priority": 10,
    },
    {
        "id": "max_consecutive",
        "question_key": "max_consecutive",
        "display_text": "What is the maximum number of consecutive nights the child should stay with one parent?",
        "options": ["3 nights", "5 nights", "7 nights", "No limit"],
        "priority": 20,
    },
    {
        "id": "target_balance",
        "question_key": "target_balance",
        "display_text": "What is the target custody split between parents?",
        "options": ["50/50", "60/40", "70/30", "80/20"],
        "priority": 30,
    },
    {
        "id": "exchange_logistics",
        "question_key": "exchange_logistics",
        "display_text": "Where do custody exchanges typically happen?",
        "options": ["School/daycare", "Parent A's home", "Parent B's home", "Neutral location"],
        "priority": 40,
    },
    {
        "id": "distance",
        "question_key": "distance",
        "display_text": "How far apart are the two homes?",
        "options": ["Less than 15 minutes", "15-30 minutes", "30-60 minutes", "Over an hour"],
        "priority": 50,
    },
    {
        "id": "school_night_pref",
        "question_key": "school_night_pref",
        "display_text": "Should school nights (Sun-Thu) be kept consistent with one parent?",
        "options": ["Yes, Parent A", "Yes, Parent B", "No preference", "Alternate weekly"],
        "priority": 60,
    },
]


def get_next_discovery_question(
    facts: BootstrapFacts,
    already_asked: list[str],
) -> Optional[DiscoveryQuestion]:
    """Return the next highest-priority question not yet answered or covered by facts.

    Returns None if all questions have been asked or covered.
    """
    for q in _QUESTION_CATALOG:
        qid = q["id"]

        # Skip if already asked
        if qid in already_asked:
            continue

        # Skip if covered by existing facts
        if _is_covered(qid, facts):
            continue

        return DiscoveryQuestion(
            id=qid,
            question_key=q["question_key"],
            display_text=q["display_text"],
            options=q["options"],
            priority=q["priority"],
        )

    return None


def _is_covered(question_id: str, facts: BootstrapFacts) -> bool:
    """Check if a question is already answered by existing facts."""
    if question_id == "weekend_pattern":
        return any(
            rp.pattern_type == RecurringPatternType.WEEKENDS
            for rp in facts.recurring_patterns
        )
    elif question_id == "target_balance":
        return facts.target_split_pct is not None
    elif question_id == "exchange_logistics":
        return len(facts.exchange_anchors) > 0
    # max_consecutive, distance, school_night_pref are never auto-covered
    return False
