"""Base schedule generation using Google OR-Tools CP-SAT solver."""

import time
from datetime import date, timedelta
from typing import Optional

from ortools.sat.python import cp_model

from app.models.requests import ScheduleRequest
from app.models.responses import (
    AssignmentDay,
    ConflictingConstraint,
    PenaltyBreakdown,
    ScheduleResponse,
    Solution,
    SolutionMetrics,
)


def _date_range(start: date, end: date) -> list[date]:
    """Generate list of dates from start to end inclusive."""
    return [start + timedelta(days=i) for i in range((end - start).days + 1)]


def _is_weekend(d: date, definition: str) -> bool:
    """Check if a date is a weekend night based on family definition."""
    dow = d.weekday()  # 0=Mon, 6=Sun
    if definition == "fri_sat":
        return dow in (4, 5)  # Friday, Saturday nights
    else:  # sat_sun
        return dow in (5, 6)  # Saturday, Sunday nights


def _is_school_night(d: date) -> bool:
    """Sunday through Thursday nights (child has school next day)."""
    return d.weekday() in (0, 1, 2, 3, 6)  # Mon-Thu + Sun


def _is_in_bonus_week(d: date, bonus_weeks: list) -> Optional[str]:
    """Check if date falls in a bonus week. Returns parent or None."""
    for bw in bonus_weeks:
        bw_start = date.fromisoformat(bw.start_date)
        bw_end = date.fromisoformat(bw.end_date)
        if bw_start <= d <= bw_end:
            return bw.parent.value
    return None


class SolutionCollector(cp_model.CpSolverSolutionCallback):
    """Collects multiple solutions from CP-SAT solver."""

    def __init__(self, x_vars: dict, max_solutions: int):
        super().__init__()
        self._x = x_vars
        self._max = max_solutions
        self.solutions: list[dict[date, int]] = []

    def on_solution_callback(self):
        sol = {}
        for d, var in self._x.items():
            sol[d] = self.value(var)
        self.solutions.append(sol)
        if len(self.solutions) >= self._max:
            self.stop_search()


def _compute_metrics(
    assignments: dict[date, int],
    dates: list[date],
    weekend_def: str,
) -> SolutionMetrics:
    """Compute metrics for a solution."""
    a_nights = sum(1 for v in assignments.values() if v == 0)
    b_nights = sum(1 for v in assignments.values() if v == 1)
    a_weekends = sum(1 for d in dates if _is_weekend(d, weekend_def) and assignments[d] == 0)
    b_weekends = sum(1 for d in dates if _is_weekend(d, weekend_def) and assignments[d] == 1)

    transitions = 0
    max_consec_a = 0
    max_consec_b = 0
    cur_a = 0
    cur_b = 0
    school_same = 0
    school_total = 0

    # Weekend fragmentation: count weekends where both parents have exactly 1 night
    weekend_pairs = {}
    for d in dates:
        if _is_weekend(d, weekend_def):
            # Group by week number
            week_key = d.isocalendar()[1]
            if week_key not in weekend_pairs:
                weekend_pairs[week_key] = set()
            weekend_pairs[week_key].add(assignments[d])
    frag_count = sum(1 for parents in weekend_pairs.values() if len(parents) > 1)

    prev_val = None
    prev_school_val = None
    for d in dates:
        val = assignments[d]
        if prev_val is not None and val != prev_val:
            transitions += 1
        if val == 0:
            cur_a += 1
            cur_b = 0
            max_consec_a = max(max_consec_a, cur_a)
        else:
            cur_b += 1
            cur_a = 0
            max_consec_b = max(max_consec_b, cur_b)

        if _is_school_night(d):
            school_total += 1
            if prev_school_val is not None and val == prev_school_val:
                school_same += 1
            prev_school_val = val

        prev_val = val

    weeks = max(len(dates) / 7, 1)
    school_pct = (school_same / max(school_total - 1, 1)) * 100 if school_total > 1 else 100.0

    return SolutionMetrics(
        parent_a_overnights=a_nights,
        parent_b_overnights=b_nights,
        parent_a_weekend_nights=a_weekends,
        parent_b_weekend_nights=b_weekends,
        total_transitions=transitions,
        transitions_per_week=round(transitions / weeks, 2),
        max_consecutive_a=max_consec_a,
        max_consecutive_b=max_consec_b,
        school_night_consistency_pct=round(school_pct, 1),
        weekend_fragmentation_count=frag_count,
    )


def _hamming_distance(s1: dict, s2: dict) -> int:
    """Count differing assignments between two solutions."""
    return sum(1 for d in s1 if s1[d] != s2[d])


def generate_base_schedule(request: ScheduleRequest) -> ScheduleResponse:
    """Generate base schedule using CP-SAT constraint programming."""
    t0 = time.time()

    start = date.fromisoformat(request.horizon_start)
    end = date.fromisoformat(request.horizon_end)
    dates = _date_range(start, end)
    n_days = len(dates)

    model = cp_model.CpModel()

    # Decision variables: x[d] = 0 for parent_a, 1 for parent_b
    x = {d: model.new_bool_var(f"x_{d.isoformat()}") for d in dates}

    # Transition indicators: t[d] = 1 if assignment changes from previous day
    t = {}
    for i in range(1, n_days):
        d = dates[i]
        d_prev = dates[i - 1]
        t[d] = model.new_bool_var(f"t_{d.isoformat()}")
        # t[d] = x[d] XOR x[d-1]
        model.add(t[d] >= x[d] - x[d_prev])
        model.add(t[d] >= x[d_prev] - x[d])
        model.add(t[d] <= x[d] + x[d_prev])
        model.add(t[d] <= 2 - x[d] - x[d_prev])

    # ─── Hard Constraints ────────────────────────────────────

    # 0. Disruption locks (override everything — from overlay engine)
    disruption_locked_dates: set[date] = set()
    for dl in request.disruption_locks:
        dl_date = date.fromisoformat(dl.date)
        if dl_date in x:
            parent_val = 0 if dl.parent.value == "parent_a" else 1
            model.add(x[dl_date] == parent_val)
            disruption_locked_dates.add(dl_date)

    # 1. Locked nights
    for lock in request.locked_nights:
        parent_val = 0 if lock.parent.value == "parent_a" else 1
        for d in dates:
            py_dow = d.weekday()  # 0=Mon ... 6=Sun
            # Convert to JS-style: 0=Sun, 1=Mon ... 6=Sat
            js_dow = (py_dow + 1) % 7
            if js_dow in lock.days_of_week:
                # Check if in bonus week (suspends lock)
                bonus_parent = _is_in_bonus_week(d, request.bonus_weeks)
                if bonus_parent is None:
                    model.add(x[d] == parent_val)

    # 2. Max consecutive nights (outside bonus weeks)
    for mc in request.max_consecutive:
        parent_val = 0 if mc.parent.value == "parent_a" else 1
        max_n = mc.max_nights
        for i in range(n_days - max_n):
            window = [dates[i + j] for j in range(max_n + 1)]
            # Check none are in bonus week
            all_non_bonus = all(
                _is_in_bonus_week(d, request.bonus_weeks) is None for d in window
            )
            if all_non_bonus:
                if parent_val == 0:
                    model.add(sum(1 - x[d] for d in window) <= max_n)
                else:
                    model.add(sum(x[d] for d in window) <= max_n)

    # 3. Max transitions per week
    if request.max_transitions_per_week > 0:
        # Group by ISO week
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

    # 4. Weekend split bounds (over rolling windows)
    if request.weekend_split:
        ws = request.weekend_split
        window_days = request.weekend_split_window_weeks * 7
        for i in range(0, n_days - window_days + 1, 7):
            window = dates[i : i + window_days]
            weekend_dates = [d for d in window if _is_weekend(d, request.weekend_definition)]
            if len(weekend_dates) > 0:
                n_we = len(weekend_dates)
                target_a = round(n_we * ws.target_pct_parent_a / 100)
                tol = max(1, round(n_we * ws.tolerance_pct / 100))
                a_weekends = sum(1 - x[d] for d in weekend_dates)
                model.add(a_weekends >= target_a - tol)
                model.add(a_weekends <= target_a + tol)

    # ─── Soft Constraints (Objective) ────────────────────────

    penalties = []
    w = request.weights

    # Fairness deviation: |sum(x) - target|
    target_b = n_days // 2
    total_b = sum(x[d] for d in dates)
    fairness_pos = model.new_int_var(0, n_days, "fair_pos")
    fairness_neg = model.new_int_var(0, n_days, "fair_neg")
    model.add(total_b - target_b == fairness_pos - fairness_neg)
    penalties.append(w.fairness_deviation * (fairness_pos + fairness_neg))

    # Total transitions
    if t:
        total_trans = sum(t[d] for d in t)
        penalties.append(w.total_transitions * total_trans)

    # Non-daycare handoffs (transitions on non-daycare days)
    daycare_days_set = set(request.daycare_exchange_days)
    holiday_dates = {date.fromisoformat(h.date) for h in request.holidays if h.daycare_closed}
    non_dc_trans = []
    for d in t:
        js_dow = (d.weekday() + 1) % 7
        if js_dow not in daycare_days_set or d in holiday_dates:
            non_dc_trans.append(t[d])
    if non_dc_trans:
        penalties.append(w.non_daycare_handoffs * sum(non_dc_trans))

    # Weekend fragmentation
    we_frag_vars = []
    week_groups: dict[int, list[date]] = {}
    for d in dates:
        if _is_weekend(d, request.weekend_definition):
            wk = d.isocalendar()[1]
            if wk not in week_groups:
                week_groups[wk] = []
            week_groups[wk].append(d)
    for wk_dates in week_groups.values():
        if len(wk_dates) == 2:
            d1, d2 = wk_dates[0], wk_dates[1]
            frag = model.new_bool_var(f"frag_{d1}")
            model.add(frag >= x[d1] - x[d2])
            model.add(frag >= x[d2] - x[d1])
            model.add(frag <= x[d1] + x[d2])
            model.add(frag <= 2 - x[d1] - x[d2])
            we_frag_vars.append(frag)
    if we_frag_vars:
        penalties.append(w.weekend_fragmentation * sum(we_frag_vars))

    # School-night disruption
    school_trans = [t[d] for d in t if _is_school_night(d)]
    if school_trans:
        penalties.append(w.school_night_disruption * sum(school_trans))

    model.minimize(sum(penalties))

    # ─── Solve ───────────────────────────────────────────────

    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = request.timeout_seconds
    solver.parameters.num_workers = 4

    collector = SolutionCollector(x, request.max_solutions)
    status = solver.solve(model, collector)

    solve_time = (time.time() - t0) * 1000

    if status == cp_model.INFEASIBLE:
        return ScheduleResponse(
            status="infeasible",
            solutions=[],
            solve_time_ms=round(solve_time, 1),
            conflicting_constraints=[
                ConflictingConstraint(
                    description="The constraint set is infeasible",
                    suggestion="Try relaxing locked nights or increasing max consecutive",
                )
            ],
            message="No feasible schedule exists with current constraints",
        )

    status_str = {
        cp_model.OPTIMAL: "optimal",
        cp_model.FEASIBLE: "feasible",
    }.get(status, "timeout")

    # If collector got solutions, use them; otherwise use the solver's best
    raw_solutions = collector.solutions
    if not raw_solutions and status in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        best = {}
        for d in dates:
            best[d] = solver.value(x[d])
        raw_solutions = [best]

    # Filter for diversity (min Hamming distance)
    diverse: list[dict[date, int]] = []
    for sol in raw_solutions:
        if all(_hamming_distance(sol, existing) >= 2 for existing in diverse):
            diverse.append(sol)

    # Build response solutions
    solutions: list[Solution] = []
    for rank, sol in enumerate(diverse[:request.max_solutions], start=1):
        assignments = []
        prev = None
        for d in dates:
            parent = "parent_a" if sol[d] == 0 else "parent_b"
            is_trans = prev is not None and parent != prev
            assignments.append(AssignmentDay(date=d.isoformat(), parent=parent, is_transition=is_trans))
            prev = parent

        metrics = _compute_metrics(sol, dates, request.weekend_definition)

        # Compute penalty breakdown
        fair_dev = abs(metrics.parent_b_overnights - n_days // 2)
        total_tr = metrics.total_transitions
        non_dc = sum(
            1 for a in assignments
            if a.is_transition
            and (
                (date.fromisoformat(a.date).weekday() + 1) % 7 not in daycare_days_set
                or date.fromisoformat(a.date) in holiday_dates
            )
        )

        penalties_bd = PenaltyBreakdown(
            fairness_deviation=float(w.fairness_deviation * fair_dev),
            total_transitions=float(w.total_transitions * total_tr),
            non_daycare_handoffs=float(w.non_daycare_handoffs * non_dc),
            weekend_fragmentation=float(w.weekend_fragmentation * metrics.weekend_fragmentation_count),
            school_night_disruption=0.0,  # simplified
            total=0.0,
        )
        penalties_bd.total = (
            penalties_bd.fairness_deviation
            + penalties_bd.total_transitions
            + penalties_bd.non_daycare_handoffs
            + penalties_bd.weekend_fragmentation
            + penalties_bd.school_night_disruption
        )

        solutions.append(Solution(
            rank=rank,
            assignments=assignments,
            metrics=metrics,
            penalties=penalties_bd,
        ))

    # Sort by total penalty
    solutions.sort(key=lambda s: s.penalties.total)
    for i, s in enumerate(solutions):
        s.rank = i + 1

    return ScheduleResponse(
        status=status_str,
        solutions=solutions,
        solve_time_ms=round(solve_time, 1),
    )
