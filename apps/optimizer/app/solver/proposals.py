"""Proposal generation using CP-SAT solver.

Given an existing schedule and a change request, generates multiple
alternative schedule options that satisfy the request while minimizing
disruption to the current schedule.
"""

import time
from datetime import date, timedelta
from typing import Optional

from ortools.sat.python import cp_model

from app.models.requests import ProposalRequest
from app.models.responses import (
    AssignmentDay,
    CalendarDiff,
    ConflictingConstraint,
    FairnessImpact,
    HandoffImpact,
    ProposalOption,
    ProposalResponse,
    StabilityImpact,
)


def _date_range(start: date, end: date) -> list[date]:
    return [start + timedelta(days=i) for i in range((end - start).days + 1)]


def _is_school_night(d: date) -> bool:
    return d.weekday() in (0, 1, 2, 3, 6)


class ProposalCollector(cp_model.CpSolverSolutionCallback):
    def __init__(self, x_vars: dict, max_solutions: int):
        super().__init__()
        self._x = x_vars
        self._max = max_solutions
        self.solutions: list[dict[date, int]] = []

    def on_solution_callback(self):
        sol = {d: self.value(var) for d, var in self._x.items()}
        self.solutions.append(sol)
        if len(self.solutions) >= self._max:
            self.stop_search()


def _hamming_distance(s1: dict, s2: dict) -> int:
    return sum(1 for d in s1 if d in s2 and s1[d] != s2[d])


def _solve_proposals_core(request: ProposalRequest) -> ProposalResponse:
    """Core proposal solving logic — no relaxation fallback."""
    t0 = time.time()

    start = date.fromisoformat(request.horizon_start)
    end = date.fromisoformat(request.horizon_end)
    dates = _date_range(start, end)
    n_days = len(dates)

    # Build current schedule map from hint
    current_map: dict[date, int] = {}
    for fa in request.current_schedule_hint:
        d = date.fromisoformat(fa.date)
        current_map[d] = 0 if fa.parent.value == "parent_a" else 1

    # Build frozen assignments map (dates not being changed)
    frozen_map: dict[date, int] = {}
    for fa in request.frozen_assignments:
        d = date.fromisoformat(fa.date)
        frozen_map[d] = 0 if fa.parent.value == "parent_a" else 1

    model = cp_model.CpModel()

    # Decision variables
    x = {d: model.new_bool_var(f"x_{d.isoformat()}") for d in dates}

    # Fix frozen assignments
    for d, val in frozen_map.items():
        if d in x:
            model.add(x[d] == val)

    # Apply request constraints
    for rc in request.request_constraints:
        parent_val = 0 if rc.parent.value == "parent_a" else 1
        for d_str in rc.dates:
            d = date.fromisoformat(d_str)
            if d in x:
                if rc.type in ("need_coverage", "want_time"):
                    model.add(x[d] == parent_val)
                elif rc.type == "swap_date":
                    model.add(x[d] == parent_val)
                    for td_str in rc.swap_target_dates:
                        td = date.fromisoformat(td_str)
                        if td in x:
                            model.add(x[td] == (1 - parent_val))

    # Transition indicators
    t = {}
    for i in range(1, n_days):
        d = dates[i]
        d_prev = dates[i - 1]
        t[d] = model.new_bool_var(f"t_{d.isoformat()}")
        model.add(t[d] >= x[d] - x[d_prev])
        model.add(t[d] >= x[d_prev] - x[d])
        model.add(t[d] <= x[d] + x[d_prev])
        model.add(t[d] <= 2 - x[d] - x[d_prev])

    # Disruption locks (override everything — from overlay engine)
    for dl in request.disruption_locks:
        dl_date = date.fromisoformat(dl.date)
        if dl_date in x:
            parent_val = 0 if dl.parent.value == "parent_a" else 1
            model.add(x[dl_date] == parent_val)

    # Hard constraints: locked nights
    for lock in request.locked_nights:
        parent_val = 0 if lock.parent.value == "parent_a" else 1
        for d in dates:
            js_dow = (d.weekday() + 1) % 7
            if js_dow in lock.days_of_week and d not in frozen_map:
                # Don't override request constraint dates
                request_dates = set()
                for rc in request.request_constraints:
                    for d_str in rc.dates:
                        request_dates.add(date.fromisoformat(d_str))
                if d not in request_dates:
                    model.add(x[d] == parent_val)

    # Hard constraints: max consecutive
    for mc in request.max_consecutive:
        parent_val = 0 if mc.parent.value == "parent_a" else 1
        max_n = mc.max_nights
        for i in range(n_days - max_n):
            window = [dates[i + j] for j in range(max_n + 1)]
            if parent_val == 0:
                model.add(sum(1 - x[d] for d in window) <= max_n)
            else:
                model.add(sum(x[d] for d in window) <= max_n)

    # Hard constraints: min consecutive
    # Build exempt dates from disruption locks and bonus weeks
    disruption_locked_dates: set[date] = set()
    for dl in request.disruption_locks:
        disruption_locked_dates.add(date.fromisoformat(dl.date))
    bonus_week_dates: set[date] = set()
    for bw in getattr(request, 'bonus_weeks', []):
        bw_start = date.fromisoformat(bw.start_date)
        bw_end = date.fromisoformat(bw.end_date)
        d_iter = bw_start
        while d_iter <= bw_end:
            bonus_week_dates.add(d_iter)
            d_iter += timedelta(days=1)
    exempt_dates = disruption_locked_dates | bonus_week_dates

    for mc in getattr(request, 'min_consecutive', []):
        p_idx = 0 if mc.parent.value == "parent_a" else 1
        min_n = mc.min_nights
        for i in range(n_days - min_n + 1):
            block_dates = [dates[i + j] for j in range(min_n)]
            if any(bd in exempt_dates for bd in block_dates):
                continue
            is_p = model.new_bool_var(f"min_c_is_{mc.parent.value}_{i}")
            if p_idx == 0:
                model.add(is_p == 1).only_enforce_if(x[dates[i]].negated())
                model.add(is_p == 0).only_enforce_if(x[dates[i]])
            else:
                model.add(is_p == 1).only_enforce_if(x[dates[i]])
                model.add(is_p == 0).only_enforce_if(x[dates[i]].negated())

            if i == 0:
                for k in range(1, min_n):
                    if p_idx == 0:
                        model.add(x[dates[i + k]] == 0).only_enforce_if(is_p)
                    else:
                        model.add(x[dates[i + k]] == 1).only_enforce_if(is_p)
            else:
                was_not_p = model.new_bool_var(f"min_c_was_not_{mc.parent.value}_{i}")
                if p_idx == 0:
                    model.add(was_not_p == 1).only_enforce_if(x[dates[i - 1]])
                    model.add(was_not_p == 0).only_enforce_if(x[dates[i - 1]].negated())
                else:
                    model.add(was_not_p == 1).only_enforce_if(x[dates[i - 1]].negated())
                    model.add(was_not_p == 0).only_enforce_if(x[dates[i - 1]])

                trans = model.new_bool_var(f"min_c_trans_{mc.parent.value}_{i}")
                model.add_bool_and([is_p, was_not_p]).only_enforce_if(trans)
                model.add_bool_or([is_p.negated(), was_not_p.negated()]).only_enforce_if(trans.negated())

                for k in range(1, min_n):
                    if p_idx == 0:
                        model.add(x[dates[i + k]] == 0).only_enforce_if(trans)
                    else:
                        model.add(x[dates[i + k]] == 1).only_enforce_if(trans)

    # Hard constraints: max transitions per week
    if request.max_transitions_per_week > 0:
        weeks: dict[int, list[date]] = {}
        for d in dates:
            wk = d.isocalendar()[1]
            if wk not in weeks:
                weeks[wk] = []
            weeks[wk].append(d)
        for wk_dates in weeks.values():
            trans_in_week = [t[d] for d in wk_dates if d in t]
            if trans_in_week:
                model.add(sum(trans_in_week) <= request.max_transitions_per_week)

    # Objective: minimize disruption from current schedule
    penalties = []
    from app.solver.seasons import apply_season_multipliers
    w = apply_season_multipliers(request.weights, request.season_mode)

    # 1. Minimize changes from current schedule (Hamming distance)
    diff_vars = []
    for d in dates:
        if d in current_map:
            diff = model.new_bool_var(f"diff_{d.isoformat()}")
            if current_map[d] == 0:
                model.add(diff >= x[d])
                model.add(diff <= x[d])
            else:
                model.add(diff >= 1 - x[d])
                model.add(diff <= 1 - x[d])
            diff_vars.append(diff)
    # Weight disruption heavily
    if diff_vars:
        penalties.append(200 * sum(diff_vars))

    # 2. Fairness deviation
    target_b = n_days // 2
    total_b = sum(x[d] for d in dates)
    fair_pos = model.new_int_var(0, n_days, "fair_pos")
    fair_neg = model.new_int_var(0, n_days, "fair_neg")
    model.add(total_b - target_b == fair_pos - fair_neg)
    penalties.append(w.fairness_deviation * (fair_pos + fair_neg))

    # 3. Total transitions
    if t:
        penalties.append(w.total_transitions * sum(t[d] for d in t))

    # 4. School night disruption
    school_trans = [t[d] for d in t if _is_school_night(d)]
    if school_trans:
        penalties.append(w.school_night_disruption * sum(school_trans))

    # 5. Handoff location preference: penalize transitions on non-preferred days
    preferred_days_set = set(getattr(request, 'preferred_handoff_days', []))
    if preferred_days_set and w.handoff_location_preference > 0:
        non_pref_trans = []
        for d in t:
            js_dow = (d.weekday() + 1) % 7
            if js_dow not in preferred_days_set:
                non_pref_trans.append(t[d])
        if non_pref_trans:
            penalties.append(w.handoff_location_preference * sum(non_pref_trans))

    model.minimize(sum(penalties))

    # Solve
    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = request.timeout_seconds
    solver.parameters.num_workers = 1

    collector = ProposalCollector(x, request.max_solutions)
    status = solver.solve(model, collector)

    solve_time = (time.time() - t0) * 1000

    if status == cp_model.INFEASIBLE:
        return ProposalResponse(
            status="infeasible",
            options=[],
            solve_time_ms=round(solve_time, 1),
            conflicting_constraints=[
                ConflictingConstraint(
                    description="Cannot satisfy this request with current constraints",
                    suggestion="Try different dates or relax constraints",
                )
            ],
            message="No feasible proposals for this request",
        )

    raw_solutions = collector.solutions
    if not raw_solutions and status in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        best = {d: solver.value(x[d]) for d in dates}
        raw_solutions = [best]

    # Filter for diversity
    diverse: list[dict[date, int]] = []
    for sol in raw_solutions:
        if all(_hamming_distance(sol, existing) >= 2 for existing in diverse):
            diverse.append(sol)

    # Build proposal options
    options: list[ProposalOption] = []
    for rank, sol in enumerate(diverse[:request.max_solutions], start=1):
        # Build assignments
        assignments = []
        prev_parent = None
        for d in dates:
            parent = "parent_a" if sol[d] == 0 else "parent_b"
            is_trans = prev_parent is not None and parent != prev_parent
            assignments.append(
                AssignmentDay(date=d.isoformat(), parent=parent, is_transition=is_trans)
            )
            prev_parent = parent

        # Build calendar diff against current schedule
        diffs = []
        for d in dates:
            if d in current_map and sol[d] != current_map[d]:
                old_p = "parent_a" if current_map[d] == 0 else "parent_b"
                new_p = "parent_a" if sol[d] == 0 else "parent_b"
                diffs.append(CalendarDiff(
                    date=d.isoformat(),
                    old_parent=old_p,
                    new_parent=new_p,
                ))

        # Compute similarity score
        total_comparable = sum(1 for d in dates if d in current_map)
        similarity_score = round(1.0 - (len(diffs) / max(total_comparable, 1)), 4)

        # Compute impacts
        old_a = sum(1 for v in current_map.values() if v == 0)
        old_b = sum(1 for v in current_map.values() if v == 1)
        new_a = sum(1 for d in dates if sol[d] == 0)
        new_b = sum(1 for d in dates if sol[d] == 1)

        old_transitions = 0
        prev_v = None
        for d in sorted(current_map.keys()):
            if prev_v is not None and current_map[d] != prev_v:
                old_transitions += 1
            prev_v = current_map[d]

        new_transitions = 0
        prev_v = None
        for d in dates:
            if prev_v is not None and sol[d] != prev_v:
                new_transitions += 1
            prev_v = sol[d]

        # Count new/removed handoffs
        old_handoff_dates = set()
        prev_v = None
        for d in sorted(current_map.keys()):
            if prev_v is not None and current_map[d] != prev_v:
                old_handoff_dates.add(d)
            prev_v = current_map[d]

        new_handoff_dates = set()
        prev_v = None
        for d in dates:
            if prev_v is not None and sol[d] != prev_v:
                new_handoff_dates.add(d)
            prev_v = sol[d]

        added_handoffs = new_handoff_dates - old_handoff_dates
        removed_handoffs = old_handoff_dates - new_handoff_dates

        # School night changes
        school_changes = sum(
            1 for d in dates
            if d in current_map
            and sol[d] != current_map[d]
            and _is_school_night(d)
        )

        fairness_impact = FairnessImpact(
            overnight_delta=(new_a - new_b) - (old_a - old_b) if current_map else 0,
            weekend_delta=0,
            window_weeks=8,
        )

        stability_impact = StabilityImpact(
            transitions_delta=new_transitions - old_transitions,
            max_streak_change=0,
            school_night_changes=school_changes,
        )

        handoff_impact = HandoffImpact(
            new_handoffs=len(added_handoffs),
            removed_handoffs=len(removed_handoffs),
            non_daycare_handoffs=0,
        )

        penalty_score = round(len(diffs) * 10.0 + abs(fairness_impact.overnight_delta) * 5.0, 2)

        label = "Minimal disruption" if rank == 1 else f"Option {rank}"

        options.append(ProposalOption(
            rank=rank,
            label=label,
            assignments=assignments,
            calendar_diff=diffs,
            fairness_impact=fairness_impact,
            stability_impact=stability_impact,
            handoff_impact=handoff_impact,
            penalty_score=penalty_score,
            similarity_score=similarity_score,
            is_auto_approvable=False,
        ))

    # Sort by penalty + tie-break key for determinism
    from app.solver.tie_break import compute_tie_break_key
    current_sched = current_map if current_map else None
    for o in options:
        sol_map = {}
        for a in o.assignments:
            d = date.fromisoformat(a.date)
            sol_map[d] = 0 if a.parent == "parent_a" else 1
        o._tie_break = compute_tie_break_key(
            sol_map, dates, "sat_sun", current_sched,
            long_distance_dates=getattr(request, 'long_distance_dates', []),
        )
    options.sort(key=lambda o: (o.penalty_score, o._tie_break))
    for i, o in enumerate(options):
        o.rank = i + 1
        if hasattr(o, '_tie_break'):
            del o._tie_break

    status_str = {
        cp_model.OPTIMAL: "optimal",
        cp_model.FEASIBLE: "feasible",
    }.get(status, "timeout")

    return ProposalResponse(
        status=status_str,
        options=options,
        solve_time_ms=round(solve_time, 1),
    )


def generate_proposals(request: ProposalRequest) -> ProposalResponse:
    """Generate proposals with relaxation fallback on infeasibility."""
    response = _solve_proposals_core(request)

    if response.status == "infeasible":
        from app.solver.relaxation import try_relaxation
        from app.solver.diagnostics import generate_diagnostics
        relaxed_response, relaxation_result = try_relaxation(request, _solve_proposals_core)

        if relaxed_response is not None and relaxed_response.status != "infeasible":
            relaxed_response.status = "relaxed_solution"
            relaxed_response.relaxation_info = relaxation_result.to_info()
            relaxed_response.diagnostics = generate_diagnostics(request, relaxation_result)
            return relaxed_response

        # All relaxation attempts exhausted
        response.relaxation_info = relaxation_result.to_info()
        response.diagnostics = generate_diagnostics(request, relaxation_result)

    return response
