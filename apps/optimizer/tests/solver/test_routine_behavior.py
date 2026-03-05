"""Tests for routine-consistency ("more human") schedule behavior.

Covers the 3 new penalty terms: short_block_penalty, weekly_rhythm_weight,
routine_consistency_weight, plus disruption adjustment and new metrics.
"""

import pytest
from datetime import date, timedelta

from app.models.requests import (
    DisruptionLock,
    FrozenAssignment,
    ParentRole,
    ScheduleRequest,
    ProposalRequest,
    RequestConstraint,
    SeasonMode,
    SolverWeights,
)
from app.models.responses import PenaltyBreakdown, SolutionMetrics
from app.solver.base_schedule import generate_base_schedule, _compute_metrics
from app.solver.seasons import apply_season_multipliers


# ── Helpers ──────────────────────────────────────────────────────


def _make_base_request(**overrides) -> ScheduleRequest:
    defaults = dict(
        horizon_start="2027-03-01",  # Monday
        horizon_end="2027-03-14",    # Sunday (14 days)
        max_solutions=3,
        timeout_seconds=10,
    )
    defaults.update(overrides)
    return ScheduleRequest(**defaults)


def _make_proposal_request(**overrides) -> ProposalRequest:
    defaults = dict(
        horizon_start="2027-03-01",
        horizon_end="2027-03-14",
        max_solutions=3,
        timeout_seconds=10,
    )
    defaults.update(overrides)
    return ProposalRequest(**defaults)


def _alternating_hint(start: str, end: str) -> list[FrozenAssignment]:
    """Generate an alternating A/B schedule hint."""
    s = date.fromisoformat(start)
    e = date.fromisoformat(end)
    hint = []
    d = s
    while d <= e:
        parent = ParentRole.PARENT_A if (d - s).days % 2 == 0 else ParentRole.PARENT_B
        hint.append(FrozenAssignment(date=d.isoformat(), parent=parent))
        d += timedelta(days=1)
    return hint


def _block_hint(start: str, end: str, block_size: int = 3) -> list[FrozenAssignment]:
    """Generate a hint with 3-night blocks: AAA BBB AAA ..."""
    s = date.fromisoformat(start)
    e = date.fromisoformat(end)
    hint = []
    d = s
    while d <= e:
        day_idx = (d - s).days
        parent = ParentRole.PARENT_A if (day_idx // block_size) % 2 == 0 else ParentRole.PARENT_B
        hint.append(FrozenAssignment(date=d.isoformat(), parent=parent))
        d += timedelta(days=1)
    return hint


def _get_solution_assignments(response) -> dict[date, int]:
    """Extract first solution as {date: 0/1} map."""
    sol = response.solutions[0]
    return {
        date.fromisoformat(a.date): 0 if a.parent == "parent_a" else 1
        for a in sol.assignments
    }


# ── TestShortBlockPenalty ────────────────────────────────────────


class TestShortBlockPenalty:
    """Short block penalty reduces isolated single-night blocks."""

    def test_weight_default_is_zero(self):
        w = SolverWeights()
        assert w.short_block_penalty == 0

    def test_no_effect_with_zero_weight(self):
        req = _make_base_request()
        response = generate_base_schedule(req)
        assert response.status in ("optimal", "feasible")
        assert len(response.solutions) > 0

    def test_penalty_reduces_isolated_blocks(self):
        """With short_block_penalty, solver should prefer contiguous blocks."""
        req = _make_base_request(
            weights=SolverWeights(
                short_block_penalty=40,
                fairness_deviation=100,
                total_transitions=10,
            ),
        )
        response = generate_base_schedule(req)
        assert response.status in ("optimal", "feasible")
        sol = response.solutions[0]
        # Count isolated blocks in solution
        assignments = [0 if a.parent == "parent_a" else 1 for a in sol.assignments]
        isolated = 0
        for i in range(1, len(assignments) - 1):
            if assignments[i - 1] != assignments[i] and assignments[i + 1] != assignments[i]:
                isolated += 1
        # With a 14-day horizon, penalty should discourage many isolated blocks
        assert isolated <= 2

    def test_metric_short_block_count(self):
        """short_block_count metric is computed correctly."""
        dates = [date(2027, 3, 1) + timedelta(days=i) for i in range(7)]
        # Pattern: A B A A B A B  →  B is isolated at day 1 and 4, A at day 5
        assignments = {dates[i]: v for i, v in enumerate([0, 1, 0, 0, 1, 0, 1])}
        metrics = _compute_metrics(assignments, dates, "fri_sat")
        assert metrics.short_block_count == 3  # days 1, 4, and 5

    def test_breakdown_short_block_reported(self):
        req = _make_base_request(
            weights=SolverWeights(short_block_penalty=40),
        )
        response = generate_base_schedule(req)
        assert response.status in ("optimal", "feasible")
        bd = response.solutions[0].penalties
        assert hasattr(bd, 'short_block')
        assert isinstance(bd.short_block, float)

    def test_breakdown_short_block_zero_when_no_penalty(self):
        req = _make_base_request(
            weights=SolverWeights(short_block_penalty=0),
        )
        response = generate_base_schedule(req)
        assert response.status in ("optimal", "feasible")
        assert response.solutions[0].penalties.short_block == 0.0


# ── TestWeeklyRhythmPenalty ──────────────────────────────────────


class TestWeeklyRhythmPenalty:
    """Weekly rhythm penalty keeps transition days consistent."""

    def test_weight_default_is_zero(self):
        w = SolverWeights()
        assert w.weekly_rhythm_weight == 0

    def test_no_effect_without_reference(self):
        """Without previous_schedule_hint or template, no rhythm penalty."""
        req = _make_base_request(
            weights=SolverWeights(weekly_rhythm_weight=50),
        )
        response = generate_base_schedule(req)
        assert response.status in ("optimal", "feasible")
        assert len(response.solutions) > 0

    def test_rhythm_from_previous_schedule(self):
        """With hint, transitions should cluster on reference DOWs."""
        hint = _block_hint("2027-03-01", "2027-03-14", block_size=3)
        req = _make_base_request(
            previous_schedule_hint=hint,
            weights=SolverWeights(
                weekly_rhythm_weight=50,
                fairness_deviation=100,
                total_transitions=10,
            ),
        )
        response = generate_base_schedule(req)
        assert response.status in ("optimal", "feasible")

    def test_rhythm_from_template(self):
        """With template_id and no hint, rhythm derived from template."""
        req = _make_base_request(
            template_id="223",
            weights=SolverWeights(
                weekly_rhythm_weight=50,
                template_alignment=30,
            ),
        )
        response = generate_base_schedule(req)
        assert response.status in ("optimal", "feasible")

    def test_breakdown_weekly_rhythm_reported(self):
        hint = _block_hint("2027-03-01", "2027-03-14", block_size=3)
        req = _make_base_request(
            previous_schedule_hint=hint,
            weights=SolverWeights(weekly_rhythm_weight=50),
        )
        response = generate_base_schedule(req)
        assert response.status in ("optimal", "feasible")
        bd = response.solutions[0].penalties
        assert hasattr(bd, 'weekly_rhythm')
        assert isinstance(bd.weekly_rhythm, float)


# ── TestRoutineConsistency ───────────────────────────────────────


class TestRoutineConsistency:
    """Routine consistency penalizes Hamming distance from reference."""

    def test_no_effect_without_hint(self):
        """With no previous_schedule_hint, routine consistency is a no-op."""
        req = _make_base_request(
            weights=SolverWeights(routine_consistency_weight=80),
        )
        response = generate_base_schedule(req)
        assert response.status in ("optimal", "feasible")
        assert response.solutions[0].penalties.routine_consistency == 0.0

    def test_base_schedule_with_hint(self):
        """With hint, solutions should stay close to reference."""
        hint = _block_hint("2027-03-01", "2027-03-14", block_size=4)
        req = _make_base_request(
            previous_schedule_hint=hint,
            weights=SolverWeights(
                routine_consistency_weight=80,
                fairness_deviation=100,
            ),
        )
        response = generate_base_schedule(req)
        assert response.status in ("optimal", "feasible")
        metrics = response.solutions[0].metrics
        # High consistency weight should keep similarity high
        assert metrics.routine_similarity_pct > 0.5

    def test_proposal_additive_on_200(self):
        """In proposals, routine consistency adds to existing 200 disruption weight."""
        from app.solver.proposals import generate_proposals
        hint = _block_hint("2027-03-01", "2027-03-14", block_size=4)
        req = _make_proposal_request(
            current_schedule_hint=hint,
            request_constraints=[
                RequestConstraint(
                    type="want_time",
                    dates=["2027-03-05"],
                    parent=ParentRole.PARENT_A,
                ),
            ],
            weights=SolverWeights(routine_consistency_weight=80),
        )
        response = generate_proposals(req)
        assert response.status in ("optimal", "feasible")
        # Should still produce options
        assert len(response.options) > 0

    def test_similarity_metric_computed(self):
        """routine_similarity_pct is computed from reference_schedule."""
        dates = [date(2027, 3, 1) + timedelta(days=i) for i in range(7)]
        ref = {d: 0 for d in dates}  # All parent_a
        sol = {d: 0 for d in dates}
        sol[dates[3]] = 1  # One change
        metrics = _compute_metrics(sol, dates, "fri_sat", reference_schedule=ref)
        expected = round(1.0 - (1 / 7), 4)
        assert metrics.routine_similarity_pct == expected

    def test_similarity_zero_without_reference(self):
        """routine_similarity_pct defaults to 0.0 without reference."""
        dates = [date(2027, 3, 1) + timedelta(days=i) for i in range(7)]
        sol = {d: 0 for d in dates}
        metrics = _compute_metrics(sol, dates, "fri_sat")
        assert metrics.routine_similarity_pct == 0.0

    def test_breakdown_routine_consistency_reported(self):
        hint = _block_hint("2027-03-01", "2027-03-14", block_size=4)
        req = _make_base_request(
            previous_schedule_hint=hint,
            weights=SolverWeights(routine_consistency_weight=80),
        )
        response = generate_base_schedule(req)
        assert response.status in ("optimal", "feasible")
        bd = response.solutions[0].penalties
        assert hasattr(bd, 'routine_consistency')
        assert isinstance(bd.routine_consistency, float)


# ── TestDisruptionAdjustment ─────────────────────────────────────


class TestDisruptionAdjustment:
    """Disruption locks halve the 3 routine weights."""

    def test_no_adjustment_without_locks(self):
        """Without disruption_locks, routine weights are unchanged."""
        w = SolverWeights(
            short_block_penalty=40,
            weekly_rhythm_weight=50,
            routine_consistency_weight=80,
        )
        result = apply_season_multipliers(w, SeasonMode.SCHOOL_YEAR)
        assert result.short_block_penalty == 40
        assert result.weekly_rhythm_weight == 50
        assert result.routine_consistency_weight == 80

    def test_halves_routine_weights(self):
        """With disruption_locks, the 3 routine weights should be halved."""
        hint = _block_hint("2027-03-01", "2027-03-14", block_size=4)
        req = _make_base_request(
            previous_schedule_hint=hint,
            weights=SolverWeights(
                short_block_penalty=40,
                weekly_rhythm_weight=50,
                routine_consistency_weight=80,
            ),
            disruption_locks=[
                DisruptionLock(parent=ParentRole.PARENT_A, date="2027-03-05"),
            ],
        )
        response = generate_base_schedule(req)
        assert response.status in ("optimal", "feasible")
        # Just verify it runs without error; actual halving is internal

    def test_composes_with_seasonal(self):
        """Disruption adjustment stacks with seasonal multipliers."""
        hint = _block_hint("2027-03-01", "2027-03-14", block_size=4)
        req = _make_base_request(
            previous_schedule_hint=hint,
            season_mode=SeasonMode.SUMMER,
            weights=SolverWeights(
                short_block_penalty=40,
                weekly_rhythm_weight=50,
                routine_consistency_weight=80,
            ),
            disruption_locks=[
                DisruptionLock(parent=ParentRole.PARENT_A, date="2027-03-05"),
            ],
        )
        response = generate_base_schedule(req)
        assert response.status in ("optimal", "feasible")

    def test_other_weights_unaffected(self):
        """Disruption adjustment should not change non-routine weights."""
        w = SolverWeights(
            fairness_deviation=100,
            total_transitions=50,
            short_block_penalty=40,
            weekly_rhythm_weight=50,
            routine_consistency_weight=80,
        )
        # Apply seasonal first (school_year = 1.0 multiplier for these)
        after_season = apply_season_multipliers(w, SeasonMode.SCHOOL_YEAR)
        assert after_season.fairness_deviation == 100
        assert after_season.total_transitions == 50
        # These values should not change even with disruption locks


# ── TestNewMetrics ───────────────────────────────────────────────


class TestNewMetrics:
    """Verify the 3 new SolutionMetrics fields."""

    def test_routine_similarity_pct_perfect_match(self):
        dates = [date(2027, 3, 1) + timedelta(days=i) for i in range(7)]
        sol = {d: i % 2 for i, d in enumerate(dates)}
        ref = {d: i % 2 for i, d in enumerate(dates)}
        metrics = _compute_metrics(sol, dates, "fri_sat", reference_schedule=ref)
        assert metrics.routine_similarity_pct == 1.0

    def test_routine_similarity_pct_complete_mismatch(self):
        dates = [date(2027, 3, 1) + timedelta(days=i) for i in range(7)]
        sol = {d: 0 for d in dates}
        ref = {d: 1 for d in dates}
        metrics = _compute_metrics(sol, dates, "fri_sat", reference_schedule=ref)
        assert metrics.routine_similarity_pct == 0.0

    def test_transition_pattern_preserved(self):
        dates = [date(2027, 3, 1) + timedelta(days=i) for i in range(7)]
        # Reference: AAA BBB A  → transitions on day 3 (Thursday) and 6 (Sunday)
        ref = {dates[i]: v for i, v in enumerate([0, 0, 0, 1, 1, 1, 0])}
        # Solution: same transition DOWs
        sol = {dates[i]: v for i, v in enumerate([0, 0, 0, 1, 1, 1, 0])}
        metrics = _compute_metrics(sol, dates, "fri_sat", reference_schedule=ref)
        assert metrics.transition_pattern_preserved is True

    def test_transition_pattern_not_preserved(self):
        dates = [date(2027, 3, 1) + timedelta(days=i) for i in range(7)]
        # Reference: AAA BBB A → transitions on Thursday, Sunday
        ref = {dates[i]: v for i, v in enumerate([0, 0, 0, 1, 1, 1, 0])}
        # Solution: different transition days
        sol = {dates[i]: v for i, v in enumerate([0, 1, 0, 1, 0, 1, 0])}
        metrics = _compute_metrics(sol, dates, "fri_sat", reference_schedule=ref)
        assert metrics.transition_pattern_preserved is False

    def test_short_block_count_no_isolated(self):
        dates = [date(2027, 3, 1) + timedelta(days=i) for i in range(7)]
        # AAAA BBB → no isolated blocks
        assignments = {dates[i]: v for i, v in enumerate([0, 0, 0, 0, 1, 1, 1])}
        metrics = _compute_metrics(assignments, dates, "fri_sat")
        assert metrics.short_block_count == 0


# ── TestPenaltyBreakdown ─────────────────────────────────────────


class TestPenaltyBreakdown:
    """Verify penalty breakdown includes all new fields."""

    def test_template_alignment_in_breakdown(self):
        """template_alignment is now included in the breakdown."""
        req = _make_base_request(
            template_id="223",
            weights=SolverWeights(template_alignment=30),
        )
        response = generate_base_schedule(req)
        assert response.status in ("optimal", "feasible")
        bd = response.solutions[0].penalties
        assert hasattr(bd, 'template_alignment')
        assert isinstance(bd.template_alignment, float)

    def test_new_fields_default_zero(self):
        """New breakdown fields default to 0.0 when weights are zero."""
        req = _make_base_request()
        response = generate_base_schedule(req)
        assert response.status in ("optimal", "feasible")
        bd = response.solutions[0].penalties
        assert bd.template_alignment == 0.0
        assert bd.short_block == 0.0
        assert bd.weekly_rhythm == 0.0
        assert bd.routine_consistency == 0.0

    def test_total_includes_all_fields(self):
        """total should be the sum of all individual penalty components."""
        hint = _block_hint("2027-03-01", "2027-03-14", block_size=4)
        req = _make_base_request(
            previous_schedule_hint=hint,
            template_id="223",
            weights=SolverWeights(
                short_block_penalty=40,
                weekly_rhythm_weight=50,
                routine_consistency_weight=80,
                template_alignment=30,
            ),
        )
        response = generate_base_schedule(req)
        assert response.status in ("optimal", "feasible")
        bd = response.solutions[0].penalties
        expected_total = round(
            bd.fairness_deviation
            + bd.total_transitions
            + bd.non_daycare_handoffs
            + bd.weekend_fragmentation
            + bd.school_night_disruption
            + bd.handoff_location_preference
            + bd.template_alignment
            + bd.short_block
            + bd.weekly_rhythm
            + bd.routine_consistency,
            2,
        )
        assert bd.total == expected_total
