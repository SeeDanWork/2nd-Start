"""
Deterministic 6-level tie-break rules for solution ranking.

When two solutions have the same total penalty, this module provides
a lexicographic ordering to ensure deterministic output.
"""

from datetime import date


def compute_tie_break_key(
    assignments: dict[date, int],
    dates: list[date],
    weekend_def: str,
    current_schedule: dict[date, int] | None = None,
    long_distance_dates: list[str] | None = None,
) -> tuple:
    """
    Compute a 6-level lexicographic tie-break key.

    Levels (all minimize):
    1. Total transitions
    2. Weekend fragmentation (split weekends)
    3. Deviation from existing schedule (Hamming distance)
    4. Long-distance exchanges (transitions on long-distance dates)
    5. Stability block start index (first transition index)
    6. Binary vector ordering (tuple of assignments)
    """
    # 1. Total transitions
    transitions = 0
    prev = None
    for d in dates:
        if d in assignments:
            val = assignments[d]
            if prev is not None and val != prev:
                transitions += 1
            prev = val

    # 2. Weekend fragmentation
    def is_weekend(d: date) -> bool:
        dow = d.weekday()
        if weekend_def == "fri_sat":
            return dow in (4, 5)
        return dow in (5, 6)

    weekend_groups: dict[int, set[int]] = {}
    for d in dates:
        if d in assignments and is_weekend(d):
            wk = d.isocalendar()[1]
            if wk not in weekend_groups:
                weekend_groups[wk] = set()
            weekend_groups[wk].add(assignments[d])
    fragmentation = sum(1 for parents in weekend_groups.values() if len(parents) > 1)

    # 3. Deviation from existing schedule
    deviation = 0
    if current_schedule:
        for d in dates:
            if d in assignments and d in current_schedule:
                if assignments[d] != current_schedule[d]:
                    deviation += 1

    # 4. Long-distance exchanges (transitions on long-distance dates)
    long_distance = 0
    if long_distance_dates:
        ld_date_set = {date.fromisoformat(d) if isinstance(d, str) else d for d in long_distance_dates}
        prev_ld = None
        for d in dates:
            if d in assignments:
                val = assignments[d]
                if prev_ld is not None and val != prev_ld and d in ld_date_set:
                    long_distance += 1
                prev_ld = val

    # 5. Stability block start index (index of first transition)
    first_transition_idx = len(dates)  # default: no transition
    prev = None
    for i, d in enumerate(dates):
        if d in assignments:
            val = assignments[d]
            if prev is not None and val != prev:
                first_transition_idx = i
                break
            prev = val

    # 6. Binary vector ordering (lexicographic)
    binary_vector = tuple(assignments.get(d, 0) for d in dates)

    return (transitions, fragmentation, deviation, long_distance, first_transition_idx, binary_vector)
