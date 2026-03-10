"""Orchestrator — ties all bootstrap steps together."""

from app.bootstrap.converter import facts_to_schedule_request
from app.bootstrap.discovery import get_next_discovery_question
from app.bootstrap.fact_resolver import resolve_dates, resolve_horizon
from app.bootstrap.models import (
    BootstrapScheduleRequest,
    BootstrapScheduleResponse,
    ClarificationPrompt,
    ConflictDescription,
)
from app.bootstrap.stabilizer import detect_template_match
from app.bootstrap.validator import filter_by_confidence, validate_consistency
from app.solver.base_schedule import generate_base_schedule


def process_bootstrap_request(
    request: BootstrapScheduleRequest,
) -> BootstrapScheduleResponse:
    """Process a bootstrap scheduling request end-to-end.

    Steps:
    1. Parse reference_date, resolve horizon defaults
    2. Resolve relative dates in facts
    3. Validate consistency → collect conflicts
    4. Filter by confidence → high_facts (apply), medium_facts (clarify), low (ignore)
    5. Convert high_facts → ScheduleRequest
    6. Call generate_base_schedule() (existing solver)
    7. If solutions: run stabilizer + get next discovery question
    8. Return BootstrapScheduleResponse
    """
    # 1. Resolve horizon
    horizon_start, horizon_end = resolve_horizon(
        request.reference_date,
        request.horizon_start,
        request.horizon_end,
    )

    # 2. Resolve dates in facts
    resolved_facts = resolve_dates(
        request.facts,
        request.reference_date,
        horizon_start,
        horizon_end,
    )

    # 3. Validate consistency
    conflicts: list[ConflictDescription] = validate_consistency(
        resolved_facts,
        request.reference_date,
        horizon_end.isoformat(),
    )

    # 4. Filter by confidence
    high_facts, medium_facts, clarifications = filter_by_confidence(resolved_facts)

    # Count applied/ignored facts
    applied_count = _count_facts(high_facts)
    ignored_count = _count_facts(request.facts) - applied_count - _count_facts(medium_facts)
    if ignored_count < 0:
        ignored_count = 0

    # 5. Convert to ScheduleRequest
    schedule_request = facts_to_schedule_request(
        high_facts,
        horizon_start,
        horizon_end,
        horizon_start,  # reference_date as date for converter
        season_mode=request.season_mode,
        max_solutions=request.max_solutions,
        timeout_seconds=request.timeout_seconds,
    )

    # 6. Call existing solver
    schedule_response = generate_base_schedule(schedule_request)

    # 7. Post-processing
    stabilization = None
    discovery_questions = []

    if schedule_response.solutions:
        stabilization = detect_template_match(
            schedule_response,
            horizon_start.isoformat(),
        )

        next_q = get_next_discovery_question(
            request.facts,  # Use original facts for coverage check
            request.already_asked,
        )
        if next_q:
            discovery_questions = [next_q]

    # Merge conflict clarifications into main clarifications
    all_clarifications: list[ClarificationPrompt] = list(clarifications)
    for conflict in conflicts:
        all_clarifications.append(conflict.clarification)
    all_clarifications.sort(key=lambda c: c.priority)

    return BootstrapScheduleResponse(
        schedule=schedule_response,
        clarifications=all_clarifications,
        conflicts=conflicts,
        discovery_questions=discovery_questions,
        stabilization=stabilization,
        applied_facts_count=applied_count,
        ignored_facts_count=ignored_count,
    )


def _count_facts(facts) -> int:
    """Count the number of individual facts in a BootstrapFacts object."""
    count = 0
    if facts.current_parent is not None:
        count += 1
    count += len(facts.locked_ranges)
    count += len(facts.recurring_patterns)
    count += len(facts.exchange_anchors)
    if facts.target_split_pct is not None:
        count += 1
    return count
