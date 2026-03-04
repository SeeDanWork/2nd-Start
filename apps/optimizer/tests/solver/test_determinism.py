"""
Determinism stress tests for the CP-SAT solver.

Verifies: same inputs → same outputs across N runs.
Covers: base schedule, proposals, tie-break, and multi-profile outputs.

NOTE: These tests run in Docker only (Python + OR-Tools required).
"""

import hashlib
import json
import pytest
from datetime import date, timedelta

from app.solver.base_schedule import generate_base_schedule
from app.solver.proposals import generate_proposals
from app.solver.tie_break import compute_tie_break_key
from app.models.requests import (
    ScheduleRequest,
    ProposalRequest,
    LockedNight,
    MaxConsecutive,
    WeekendSplit,
    BonusWeek,
    DisruptionLock,
    SolverWeights,
    FrozenAssignment,
    RequestConstraint,
    ParentRole,
    MinConsecutive,
)


def _hash_response(resp) -> str:
    """Hash the deterministic fields of a solver response."""
    deterministic = {
        "status": resp.status,
        "solutions": [
            {
                "rank": s.rank,
                "assignments": [(a.date, a.parent, a.is_transition) for a in s.assignments],
                "penalties_total": s.penalties.total,
            }
            for s in (resp.solutions if hasattr(resp, "solutions") else resp.options)
        ],
    }
    raw = json.dumps(deterministic, sort_keys=True)
    return hashlib.sha256(raw.encode()).hexdigest()[:12]


def _hash_proposal(resp) -> str:
    deterministic = {
        "status": resp.status,
        "options": [
            {
                "rank": o.rank,
                "assignments": [(a.date, a.parent, a.is_transition) for a in o.assignments],
                "penalty_score": o.penalty_score,
                "calendar_diff": [(d.date, d.old_parent, d.new_parent) for d in o.calendar_diff],
            }
            for o in resp.options
        ],
    }
    raw = json.dumps(deterministic, sort_keys=True)
    return hashlib.sha256(raw.encode()).hexdigest()[:12]


# ─── Solver Scenarios ────────────────────────────────────────────────

SOLVER_SCENARIOS = {
    "baseline_5050": ScheduleRequest(
        horizon_start="2027-03-01",
        horizon_end="2027-03-14",
        weights=SolverWeights(fairness_deviation=200, total_transitions=50),
        max_solutions=5,
        timeout_seconds=10,
    ),
    "locked_nights": ScheduleRequest(
        horizon_start="2027-03-01",
        horizon_end="2027-03-14",
        locked_nights=[
            LockedNight(parent=ParentRole.PARENT_A, days_of_week=[2, 4]),
        ],
        max_solutions=5,
        timeout_seconds=10,
    ),
    "disruption_overlay": ScheduleRequest(
        horizon_start="2027-03-01",
        horizon_end="2027-03-14",
        disruption_locks=[
            DisruptionLock(parent=ParentRole.PARENT_A, date="2027-03-05"),
            DisruptionLock(parent=ParentRole.PARENT_A, date="2027-03-06"),
            DisruptionLock(parent=ParentRole.PARENT_A, date="2027-03-07"),
        ],
        max_solutions=5,
        timeout_seconds=10,
    ),
    "max_consecutive": ScheduleRequest(
        horizon_start="2027-03-01",
        horizon_end="2027-03-14",
        max_consecutive=[
            MaxConsecutive(parent=ParentRole.PARENT_A, max_nights=3),
            MaxConsecutive(parent=ParentRole.PARENT_B, max_nights=3),
        ],
        max_solutions=5,
        timeout_seconds=10,
    ),
    "weekend_parity": ScheduleRequest(
        horizon_start="2027-03-01",
        horizon_end="2027-03-14",
        weekend_split=WeekendSplit(target_pct_parent_a=50, tolerance_pct=10),
        weights=SolverWeights(
            fairness_deviation=100,
            weekend_fragmentation=80,
            total_transitions=50,
        ),
        max_solutions=5,
        timeout_seconds=10,
    ),
}


class TestSolverDeterminism:
    """Section 1: Solver determinism stress test — 20 runs per scenario."""

    @pytest.mark.parametrize("scenario_name", list(SOLVER_SCENARIOS.keys()))
    def test_solver_20_runs(self, scenario_name):
        request = SOLVER_SCENARIOS[scenario_name]
        hashes = []
        for _ in range(20):
            resp = generate_base_schedule(request)
            hashes.append(_hash_response(resp))
        unique = set(hashes)
        assert len(unique) == 1, (
            f"Scenario {scenario_name}: {len(unique)} distinct outputs in 20 runs. "
            f"Hashes: {hashes[:5]}..."
        )


class TestTieBreakDeterminism:
    """Section 3: Tie-break 100-run stress test."""

    def test_tie_break_100_runs(self):
        dates = [date(2027, 3, 1) + timedelta(days=i) for i in range(14)]
        sol = {d: v for d, v in zip(dates, [0, 0, 1, 1, 0, 0, 1, 0, 1, 1, 0, 0, 1, 1])}
        current = {d: 0 for d in dates}

        keys = [
            compute_tie_break_key(sol, dates, "sat_sun", current)
            for _ in range(100)
        ]
        unique = set(keys)
        assert len(unique) == 1, f"Tie-break produced {len(unique)} distinct keys in 100 runs"

    def test_tie_break_with_long_distance_100_runs(self):
        dates = [date(2027, 3, 1) + timedelta(days=i) for i in range(14)]
        sol = {d: v for d, v in zip(dates, [0, 0, 1, 1, 0, 0, 1, 0, 1, 1, 0, 0, 1, 1])}
        ld_dates = ["2027-03-03", "2027-03-10"]

        keys = [
            compute_tie_break_key(sol, dates, "sat_sun", long_distance_dates=ld_dates)
            for _ in range(100)
        ]
        unique = set(keys)
        assert len(unique) == 1


class TestProposalDeterminism:
    """Proposal solver determinism — 20 runs."""

    def test_proposal_20_runs(self):
        hint = [
            FrozenAssignment(
                date=(date(2027, 3, 1) + timedelta(days=i)).isoformat(),
                parent=ParentRole.PARENT_A if i % 2 == 0 else ParentRole.PARENT_B,
            )
            for i in range(14)
        ]
        request = ProposalRequest(
            horizon_start="2027-03-01",
            horizon_end="2027-03-14",
            current_schedule_hint=hint,
            request_constraints=[
                RequestConstraint(
                    type="need_coverage",
                    dates=["2027-03-05", "2027-03-06"],
                    parent=ParentRole.PARENT_A,
                ),
            ],
            max_solutions=5,
            timeout_seconds=10,
        )
        hashes = []
        for _ in range(20):
            resp = generate_proposals(request)
            hashes.append(_hash_proposal(resp))
        unique = set(hashes)
        assert len(unique) == 1, f"Proposals produced {len(unique)} distinct outputs in 20 runs"


class TestProposalSimilarityScore:
    """Verify similarity_score is present and in [0,1]."""

    def test_similarity_score_range(self):
        hint = [
            FrozenAssignment(
                date=(date(2027, 3, 1) + timedelta(days=i)).isoformat(),
                parent=ParentRole.PARENT_A if i % 2 == 0 else ParentRole.PARENT_B,
            )
            for i in range(14)
        ]
        request = ProposalRequest(
            horizon_start="2027-03-01",
            horizon_end="2027-03-14",
            current_schedule_hint=hint,
            request_constraints=[
                RequestConstraint(
                    type="need_coverage",
                    dates=["2027-03-05", "2027-03-06"],
                    parent=ParentRole.PARENT_A,
                ),
            ],
            max_solutions=5,
            timeout_seconds=10,
        )
        resp = generate_proposals(request)
        assert resp.status in ("optimal", "feasible")
        for opt in resp.options:
            assert 0.0 <= opt.similarity_score <= 1.0, (
                f"similarity_score {opt.similarity_score} out of [0,1] range"
            )

    def test_similarity_score_determinism(self):
        hint = [
            FrozenAssignment(
                date=(date(2027, 3, 1) + timedelta(days=i)).isoformat(),
                parent=ParentRole.PARENT_A if i % 2 == 0 else ParentRole.PARENT_B,
            )
            for i in range(14)
        ]
        request = ProposalRequest(
            horizon_start="2027-03-01",
            horizon_end="2027-03-14",
            current_schedule_hint=hint,
            request_constraints=[
                RequestConstraint(
                    type="need_coverage",
                    dates=["2027-03-05"],
                    parent=ParentRole.PARENT_A,
                ),
            ],
            max_solutions=3,
            timeout_seconds=10,
        )
        scores_per_run = []
        for _ in range(10):
            resp = generate_proposals(request)
            scores = [o.similarity_score for o in resp.options]
            scores_per_run.append(tuple(scores))
        assert len(set(scores_per_run)) == 1, "similarity_score not deterministic"


class TestMinConsecutiveDeterminism:
    """Min consecutive constraint determinism — 20 runs."""

    def test_min_consecutive_20_runs(self):
        request = ScheduleRequest(
            horizon_start="2027-03-01",
            horizon_end="2027-03-14",
            min_consecutive=[
                MinConsecutive(parent=ParentRole.PARENT_A, min_nights=3),
                MinConsecutive(parent=ParentRole.PARENT_B, min_nights=2),
            ],
            max_solutions=5,
            timeout_seconds=10,
        )
        hashes = []
        for _ in range(20):
            resp = generate_base_schedule(request)
            hashes.append(_hash_response(resp))
        unique = set(hashes)
        assert len(unique) == 1
