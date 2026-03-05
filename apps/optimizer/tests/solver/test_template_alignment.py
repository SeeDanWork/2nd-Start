"""Tests for template alignment objective term in the CP-SAT solver."""

import pytest
from datetime import date

from app.models.requests import (
    ScheduleRequest,
    SolverWeights,
    ParentRole,
    LockedNight,
    MaxConsecutive,
)
from app.models.responses import SolutionMetrics
from app.solver.base_schedule import generate_base_schedule, _compute_metrics
from app.solver.seasons import apply_season_multipliers, SEASON_WEIGHT_MULTIPLIERS
from app.models.requests import SeasonMode


def _make_request(**overrides) -> ScheduleRequest:
    defaults = dict(
        horizon_start="2027-03-01",  # Monday
        horizon_end="2027-03-14",    # Sunday (14 days)
        max_solutions=3,
        timeout_seconds=10,
    )
    defaults.update(overrides)
    return ScheduleRequest(**defaults)


class TestDefaultBehavior:
    """Template alignment has no effect unless explicitly enabled."""

    def test_weight_default_is_zero(self):
        w = SolverWeights()
        assert w.template_alignment == 0

    def test_no_template_id_by_default(self):
        req = _make_request()
        assert req.template_id is None

    def test_no_effect_without_template_id(self):
        """Without template_id, solutions are generated normally."""
        req = _make_request()
        response = generate_base_schedule(req)
        assert response.status in ("optimal", "feasible")
        assert len(response.solutions) > 0

    def test_no_effect_with_zero_weight(self):
        """Even with template_id, weight=0 means no alignment penalty."""
        req = _make_request(
            template_id="223",
            weights=SolverWeights(template_alignment=0),
        )
        response = generate_base_schedule(req)
        assert response.status in ("optimal", "feasible")
        assert len(response.solutions) > 0


class TestTemplateAdherenceMetric:
    """template_adherence is computed correctly on SolutionMetrics."""

    def test_adherence_zero_without_template(self):
        req = _make_request()
        response = generate_base_schedule(req)
        for sol in response.solutions:
            assert sol.metrics.template_adherence == 0.0

    def test_adherence_computed_with_template(self):
        """When template is set, adherence should be between 0 and 1."""
        req = _make_request(
            template_id="223",
            weights=SolverWeights(template_alignment=50),
        )
        response = generate_base_schedule(req)
        assert response.status in ("optimal", "feasible")
        for sol in response.solutions:
            assert 0.0 <= sol.metrics.template_adherence <= 1.0

    def test_perfect_adherence_equals_1(self):
        """A solution that matches the template perfectly has adherence 1.0."""
        # 223 pattern for 14 days: A,A,B,B,A,A,A,B,B,A,A,B,B,B
        from app.solver.templates import get_template
        tmpl = get_template("223")
        dates = [date(2027, 3, 1) + __import__("datetime").timedelta(days=i) for i in range(14)]
        assignments = {d: tmpl.pattern14[i] for i, d in enumerate(dates)}

        metrics = _compute_metrics(
            assignments, dates, "fri_sat",
            template_pattern=tmpl.pattern14,
            template_cycle_length=tmpl.cycle_length,
        )
        assert metrics.template_adherence == 1.0

    def test_full_deviation_near_zero(self):
        """A solution that is fully opposite the template has low adherence."""
        from app.solver.templates import get_template
        tmpl = get_template("223")
        dates = [date(2027, 3, 1) + __import__("datetime").timedelta(days=i) for i in range(14)]
        # Opposite of template
        assignments = {d: 1 - tmpl.pattern14[i] for i, d in enumerate(dates)}

        metrics = _compute_metrics(
            assignments, dates, "fri_sat",
            template_pattern=tmpl.pattern14,
            template_cycle_length=tmpl.cycle_length,
        )
        assert metrics.template_adherence == 0.0


class TestAlignmentInfluence:
    """Template alignment actually biases the solver when weight is set."""

    def test_223_alignment_with_high_weight(self):
        """With template_id='223' and high alignment weight, the top solution
        should follow the 2-2-3 pattern closely (adherence > 0.5)."""
        req = _make_request(
            template_id="223",
            weights=SolverWeights(
                fairness_deviation=100,
                total_transitions=10,
                template_alignment=200,
            ),
        )
        response = generate_base_schedule(req)
        assert response.status in ("optimal", "feasible")
        top = response.solutions[0]
        # With high alignment weight, adherence should be high
        assert top.metrics.template_adherence > 0.5

    def test_7on7off_alignment(self):
        """7on7off template with high weight should produce week-on/week-off-like pattern."""
        req = _make_request(
            template_id="7on7off",
            weights=SolverWeights(
                fairness_deviation=50,
                total_transitions=10,
                template_alignment=200,
            ),
        )
        response = generate_base_schedule(req)
        assert response.status in ("optimal", "feasible")
        top = response.solutions[0]
        assert top.metrics.template_adherence > 0.5


class TestHardConstraintsOverrideTemplate:
    """Hard constraints take precedence over template alignment."""

    def test_locked_nights_override_template(self):
        """Locked nights on specific days override template preferences."""
        # 223 template: day 0,1 = A (Mon, Tue)
        # Lock B on Mon, Tue — this conflicts with template
        req = _make_request(
            template_id="223",
            weights=SolverWeights(template_alignment=100),
            locked_nights=[
                LockedNight(parent=ParentRole.PARENT_B, days_of_week=[1, 2]),  # Mon, Tue (JS)
            ],
        )
        response = generate_base_schedule(req)
        assert response.status in ("optimal", "feasible", "relaxed_solution")
        if response.solutions:
            top = response.solutions[0]
            # Monday and Tuesday should be parent_b despite template wanting parent_a
            for a in top.assignments:
                d = date.fromisoformat(a.date)
                js_dow = (d.weekday() + 1) % 7
                if js_dow in (1, 2):  # Mon, Tue
                    assert a.parent == "parent_b"


class TestSeasonalMultipliers:
    """Template alignment composes with seasonal weight multipliers."""

    def test_school_year_multiplier(self):
        assert SEASON_WEIGHT_MULTIPLIERS[SeasonMode.SCHOOL_YEAR]["template_alignment"] == 1.0

    def test_summer_multiplier_reduced(self):
        assert SEASON_WEIGHT_MULTIPLIERS[SeasonMode.SUMMER]["template_alignment"] == 0.5

    def test_holiday_multiplier_reduced(self):
        assert SEASON_WEIGHT_MULTIPLIERS[SeasonMode.HOLIDAY_PERIOD]["template_alignment"] == 0.3

    def test_apply_season_multipliers_template(self):
        w = SolverWeights(template_alignment=100)
        result = apply_season_multipliers(w, SeasonMode.SUMMER)
        assert result.template_alignment == 50  # 100 * 0.5

    def test_apply_season_multipliers_holiday(self):
        w = SolverWeights(template_alignment=100)
        result = apply_season_multipliers(w, SeasonMode.HOLIDAY_PERIOD)
        assert result.template_alignment == 30  # 100 * 0.3

    def test_seasonal_composition_with_solver(self):
        """Solver with summer mode applies reduced template alignment."""
        req = _make_request(
            template_id="223",
            weights=SolverWeights(template_alignment=100),
            season_mode=SeasonMode.SUMMER,
        )
        response = generate_base_schedule(req)
        assert response.status in ("optimal", "feasible")
