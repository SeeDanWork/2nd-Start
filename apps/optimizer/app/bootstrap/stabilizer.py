"""Template pattern matching for schedule stabilization."""

from datetime import date
from typing import Optional

from app.bootstrap.models import StabilizationSuggestion
from app.models.responses import ScheduleResponse
from app.solver.templates import TEMPLATES

ADHERENCE_THRESHOLD = 0.85


def detect_template_match(
    schedule_response: ScheduleResponse,
    horizon_start: str,
) -> Optional[StabilizationSuggestion]:
    """Check if the top-ranked solution matches a known template pattern.

    For each of the 13 templates, tries all cycle offsets and computes
    adherence = 1 - (deviations / total_days).

    Returns a StabilizationSuggestion if best adherence >= 0.85.
    Deterministic: templates iterated in insertion order, ties broken by template_id.
    """
    if not schedule_response.solutions:
        return None

    top_solution = schedule_response.solutions[0]
    if not top_solution.assignments:
        return None

    # Build assignment vector: list of 0 (parent_a) or 1 (parent_b)
    assignments: list[int] = []
    for a in top_solution.assignments:
        assignments.append(0 if a.parent == "parent_a" else 1)

    total_days = len(assignments)
    if total_days == 0:
        return None

    best_adherence = 0.0
    best_cycle_length = float("inf")
    best_template_id = ""
    best_template_name = ""

    for tid, template in TEMPLATES.items():
        pattern = template.pattern14
        cycle = template.cycle_length

        # Try all cycle offsets
        for offset in range(cycle):
            deviations = 0
            for i in range(total_days):
                pattern_idx = (i + offset) % cycle
                if assignments[i] != pattern[pattern_idx]:
                    deviations += 1

            adherence = 1.0 - (deviations / total_days)

            # Prefer: higher adherence, then shorter cycle (more specific), then lower template_id
            is_better = (
                adherence > best_adherence
                or (adherence == best_adherence and cycle < best_cycle_length)
                or (adherence == best_adherence and cycle == best_cycle_length and tid < best_template_id)
            )
            if is_better:
                best_adherence = adherence
                best_cycle_length = cycle
                best_template_id = tid
                best_template_name = template.name

    if best_adherence >= ADHERENCE_THRESHOLD:
        return StabilizationSuggestion(
            template_id=best_template_id,
            template_name=best_template_name,
            adherence_score=round(best_adherence, 4),
            recommendation=(
                f"This schedule closely matches the '{best_template_name}' template "
                f"({best_adherence:.0%} adherence). Consider adopting this template "
                f"for long-term consistency."
            ),
        )

    return None
