"""Custody pattern template library.

Python-side mirror of the 13 TEMPLATES_V2 templates from
packages/shared/src/recommendations/templates.ts.

Each template defines a repeating overnight assignment pattern
(0=parentA, 1=parentB) along with metadata for scoring and selection.
"""

from dataclasses import dataclass


@dataclass(frozen=True)
class TemplateDefinition:
    id: str
    name: str
    pattern14: tuple[int, ...]  # 0=parentA, 1=parentB (variable length cycle)
    cycle_length: int
    handoffs_per_2weeks: int
    max_block: int
    nights_a: int
    nights_b: int
    split_ratio: str
    min_age_months: int
    school_aligned: bool


# Pattern shorthand
A, B = 0, 1

TEMPLATES: dict[str, TemplateDefinition] = {
    "223": TemplateDefinition(
        id="223",
        name="2-2-3 Rotation",
        pattern14=(A, A, B, B, A, A, A, B, B, A, A, B, B, B),
        cycle_length=14,
        handoffs_per_2weeks=6,
        max_block=3,
        nights_a=7,
        nights_b=7,
        split_ratio="50/50",
        min_age_months=18,
        school_aligned=False,
    ),
    "223_daytime": TemplateDefinition(
        id="223_daytime",
        name="Daytime Contact Only",
        pattern14=(A, A, B, B, A, A, A, B, B, A, A, B, B, B),
        cycle_length=14,
        handoffs_per_2weeks=6,
        max_block=3,
        nights_a=7,
        nights_b=7,
        split_ratio="daytime",
        min_age_months=0,
        school_aligned=False,
    ),
    "3443": TemplateDefinition(
        id="3443",
        name="3-4-4-3 Rotation",
        pattern14=(A, A, A, B, B, B, B, A, A, A, A, B, B, B),
        cycle_length=14,
        handoffs_per_2weeks=4,
        max_block=4,
        nights_a=7,
        nights_b=7,
        split_ratio="50/50",
        min_age_months=36,
        school_aligned=True,
    ),
    "43": TemplateDefinition(
        id="43",
        name="4-3 Rotation",
        pattern14=(A, A, A, A, B, B, B),
        cycle_length=7,
        handoffs_per_2weeks=2,
        max_block=4,
        nights_a=4,
        nights_b=3,
        split_ratio="57/43",
        min_age_months=36,
        school_aligned=True,
    ),
    "2255": TemplateDefinition(
        id="2255",
        name="2-2-5-5 Split",
        pattern14=(A, A, B, B, A, A, A, A, A, B, B, B, B, B),
        cycle_length=14,
        handoffs_per_2weeks=4,
        max_block=5,
        nights_a=7,
        nights_b=7,
        split_ratio="50/50",
        min_age_months=60,
        school_aligned=False,
    ),
    "7on7off": TemplateDefinition(
        id="7on7off",
        name="Alternating Weeks",
        pattern14=(A, A, A, A, A, A, A, B, B, B, B, B, B, B),
        cycle_length=14,
        handoffs_per_2weeks=2,
        max_block=7,
        nights_a=7,
        nights_b=7,
        split_ratio="50/50",
        min_age_months=72,
        school_aligned=False,
    ),
    "7on7off_midweek": TemplateDefinition(
        id="7on7off_midweek",
        name="Alternating Weeks + Midweek",
        pattern14=(A, A, B, A, A, A, A, B, B, A, B, B, B, B),
        cycle_length=14,
        handoffs_per_2weeks=6,
        max_block=4,
        nights_a=7,
        nights_b=7,
        split_ratio="50/50",
        min_age_months=60,
        school_aligned=True,
    ),
    "52_weekday_weekend": TemplateDefinition(
        id="52_weekday_weekend",
        name="5-2 Weekday/Weekend",
        pattern14=(A, A, A, A, A, B, B),
        cycle_length=7,
        handoffs_per_2weeks=2,
        max_block=5,
        nights_a=5,
        nights_b=2,
        split_ratio="71/29",
        min_age_months=60,
        school_aligned=True,
    ),
    "alt_weekends_midweek": TemplateDefinition(
        id="alt_weekends_midweek",
        name="Every Other Weekend + Midweek",
        pattern14=(A, A, B, A, A, A, A, A, A, B, A, B, B, A),
        cycle_length=14,
        handoffs_per_2weeks=6,
        max_block=6,
        nights_a=10,
        nights_b=4,
        split_ratio="71/29",
        min_age_months=36,
        school_aligned=True,
    ),
    "primary_plus_midweek": TemplateDefinition(
        id="primary_plus_midweek",
        name="Primary + Midweek Dinner",
        pattern14=(A, A, B, A, A, A, B, A, A, B, A, A, A, B),
        cycle_length=14,
        handoffs_per_2weeks=8,
        max_block=3,
        nights_a=10,
        nights_b=4,
        split_ratio="71/29",
        min_age_months=36,
        school_aligned=True,
    ),
    "every_other_weekend": TemplateDefinition(
        id="every_other_weekend",
        name="Every Other Weekend",
        pattern14=(A, A, A, A, A, A, A, A, A, A, A, B, B, A),
        cycle_length=14,
        handoffs_per_2weeks=2,
        max_block=11,
        nights_a=12,
        nights_b=2,
        split_ratio="86/14",
        min_age_months=36,
        school_aligned=False,
    ),
    "primary_weekends": TemplateDefinition(
        id="primary_weekends",
        name="Primary + Every Weekend",
        pattern14=(A, A, A, A, A, B, B, A, A, A, A, A, B, B),
        cycle_length=14,
        handoffs_per_2weeks=4,
        max_block=5,
        nights_a=10,
        nights_b=4,
        split_ratio="71/29",
        min_age_months=60,
        school_aligned=True,
    ),
    "2week_blocks": TemplateDefinition(
        id="2week_blocks",
        name="2-Week Blocks",
        pattern14=(A, A, A, A, A, A, A, A, A, A, A, A, A, A,
                   B, B, B, B, B, B, B, B, B, B, B, B, B, B),
        cycle_length=28,
        handoffs_per_2weeks=1,
        max_block=14,
        nights_a=14,
        nights_b=14,
        split_ratio="50/50",
        min_age_months=156,
        school_aligned=False,
    ),
}


def get_template(template_id: str) -> TemplateDefinition | None:
    """Look up a template by ID. Returns None if not found."""
    return TEMPLATES.get(template_id)


def get_eligible_templates(
    min_age_months: int,
    arrangement: str = "undecided",
) -> list[TemplateDefinition]:
    """Filter templates by child age and custody arrangement.

    Args:
        min_age_months: Minimum age of youngest child in months.
        arrangement: One of "shared", "primary_visits", "undecided".
            - "shared" → split_ratio in ("50/50", "57/43")
            - "primary_visits" → split_ratio in ("71/29", "86/14")
            - "undecided" → all (no ratio filter)

    Returns:
        Templates sorted by handoffs_per_2weeks ascending (most stable first).
    """
    eligible = []
    for t in TEMPLATES.values():
        if t.min_age_months > min_age_months:
            continue
        if t.split_ratio == "daytime":
            # Daytime-only pattern is special — only for "undecided"
            if arrangement != "undecided":
                continue
        elif arrangement == "shared":
            if t.split_ratio not in ("50/50", "57/43"):
                continue
        elif arrangement == "primary_visits":
            if t.split_ratio not in ("71/29", "86/14"):
                continue
        eligible.append(t)

    eligible.sort(key=lambda t: t.handoffs_per_2weeks)
    return eligible
