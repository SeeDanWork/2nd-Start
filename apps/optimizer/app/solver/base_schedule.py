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
    template_pattern: tuple[int, ...] | None = None,
    template_cycle_length: int = 0,
    reference_schedule: dict[date, int] | None = None,
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

    # Template adherence: 1.0 - (deviations / total_days)
    tmpl_adherence = 0.0
    if template_pattern and template_cycle_length > 0:
        deviations = 0
        for i, d in enumerate(dates):
            cycle_pos = i % template_cycle_length
            expected = template_pattern[cycle_pos]
            if assignments[d] != expected:
                deviations += 1
        tmpl_adherence = round(1.0 - (deviations / max(len(dates), 1)), 4)

    # Routine similarity: compare against reference schedule
    routine_sim = 0.0
    if reference_schedule:
        comparable = [d for d in dates if d in reference_schedule]
        changed = sum(1 for d in comparable if assignments[d] != reference_schedule[d])
        routine_sim = round(1.0 - (changed / max(len(comparable), 1)), 4) if comparable else 0.0

    # Transition pattern preserved: check if solution transition DOWs match reference
    trans_preserved = True
    if reference_schedule:
        ref_trans_dows: set[int] = set()
        prev_ref = None
        for d in dates:
            if d in reference_schedule:
                if prev_ref is not None and reference_schedule[d] != prev_ref:
                    ref_trans_dows.add(d.weekday())
                prev_ref = reference_schedule[d]
        sol_trans_dows: set[int] = set()
        prev_sol = None
        for d in dates:
            if prev_sol is not None and assignments[d] != prev_sol:
                sol_trans_dows.add(d.weekday())
            prev_sol = assignments[d]
        trans_preserved = sol_trans_dows <= ref_trans_dows if ref_trans_dows else True

    # Short block count: interior days where both neighbors differ
    short_blocks = 0
    for i in range(1, len(dates) - 1):
        val = assignments[dates[i]]
        if assignments[dates[i - 1]] != val and assignments[dates[i + 1]] != val:
            short_blocks += 1

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
        template_adherence=tmpl_adherence,
        routine_similarity_pct=routine_sim,
        transition_pattern_preserved=trans_preserved,
        short_block_count=short_blocks,
    )


def _hamming_distance(s1: dict, s2: dict) -> int:
    """Count differing assignments between two solutions."""
    return sum(1 for d in s1 if s1[d] != s2[d])


def _solve_core(request: ScheduleRequest) -> ScheduleResponse:
    """Core solving logic — builds model, solves, returns response.

    Does NOT perform relaxation. Called by generate_base_schedule
    and by the relaxation engine.
    """
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

    # 2b. Min consecutive nights (outside bonus weeks and disruption locks)
    bonus_week_dates: set[date] = set()
    for bw in request.bonus_weeks:
        bw_start = date.fromisoformat(bw.start_date)
        bw_end = date.fromisoformat(bw.end_date)
        d_iter = bw_start
        while d_iter <= bw_end:
            bonus_week_dates.add(d_iter)
            d_iter += timedelta(days=1)
    exempt_dates = disruption_locked_dates | bonus_week_dates

    for mc in request.min_consecutive:
        p_idx = 0 if mc.parent.value == "parent_a" else 1
        min_n = mc.min_nights
        for i in range(n_days - min_n + 1):
            block_dates = [dates[i + j] for j in range(min_n)]
            # Skip if any date in the block is exempt
            if any(bd in exempt_dates for bd in block_dates):
                continue
            # trans_to_p[i]: day i is assigned to parent AND (i==0 OR day i-1 is NOT parent)
            is_p = model.new_bool_var(f"min_c_is_{mc.parent.value}_{i}")
            if p_idx == 0:
                model.add(is_p == 1).only_enforce_if(x[dates[i]].negated())
                model.add(is_p == 0).only_enforce_if(x[dates[i]])
            else:
                model.add(is_p == 1).only_enforce_if(x[dates[i]])
                model.add(is_p == 0).only_enforce_if(x[dates[i]].negated())

            if i == 0:
                # First day: if assigned to parent, enforce block
                for k in range(1, min_n):
                    if p_idx == 0:
                        model.add(x[dates[i + k]] == 0).only_enforce_if(is_p)
                    else:
                        model.add(x[dates[i + k]] == 1).only_enforce_if(is_p)
            else:
                # Transition: day i is parent AND day i-1 is NOT parent
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
    from app.solver.seasons import apply_season_multipliers
    w = apply_season_multipliers(request.weights, request.season_mode)

    # Build reference map from previous_schedule_hint
    reference_map: dict[date, int] = {}
    for fa in request.previous_schedule_hint:
        d_ref = date.fromisoformat(fa.date)
        if d_ref in x:
            reference_map[d_ref] = 0 if fa.parent.value == "parent_a" else 1

    # Disruption adjustment: halve routine weights when disruption locks present
    if request.disruption_locks:
        w = w.model_copy(update={
            "routine_consistency_weight": int(round(w.routine_consistency_weight * 0.5)),
            "weekly_rhythm_weight": int(round(w.weekly_rhythm_weight * 0.5)),
            "short_block_penalty": int(round(w.short_block_penalty * 0.5)),
        })

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

    # Handoff location preference: penalize transitions on non-preferred days
    preferred_days_set = set(request.preferred_handoff_days)
    if preferred_days_set and w.handoff_location_preference > 0:
        non_pref_trans = []
        for d in t:
            js_dow = (d.weekday() + 1) % 7
            if js_dow not in preferred_days_set:
                non_pref_trans.append(t[d])
        if non_pref_trans:
            penalties.append(w.handoff_location_preference * sum(non_pref_trans))

    # Template alignment soft penalty
    template_deviation_vars = []
    if request.template_id and w.template_alignment > 0:
        from app.solver.templates import get_template
        template = get_template(request.template_id)
        if template:
            pattern = template.pattern14
            cycle_len = template.cycle_length
            for i, d in enumerate(dates):
                cycle_pos = i % cycle_len
                expected_parent = pattern[cycle_pos]
                is_deviation = model.new_bool_var(f"tmpl_dev_{d.isoformat()}")
                if expected_parent == 0:  # expect parent_a
                    model.add(x[d] != 0).only_enforce_if(is_deviation)
                    model.add(x[d] == 0).only_enforce_if(is_deviation.negated())
                else:  # expect parent_b
                    model.add(x[d] != 1).only_enforce_if(is_deviation)
                    model.add(x[d] == 1).only_enforce_if(is_deviation.negated())
                template_deviation_vars.append(is_deviation)
            penalties.append(w.template_alignment * sum(template_deviation_vars))

    # Short block penalty: penalize isolated single-night stays
    short_block_vars = []
    if w.short_block_penalty > 0 and n_days >= 3:
        for i in range(1, n_days - 1):
            d_prev = dates[i - 1]
            d_cur = dates[i]
            d_next = dates[i + 1]
            # isolated if both neighbors differ: t[d_cur]=1 AND t[d_next]=1
            isolated = model.new_bool_var(f"isolated_{d_cur.isoformat()}")
            model.add_bool_and([t[d_cur], t[d_next]]).only_enforce_if(isolated)
            model.add_bool_or([t[d_cur].negated(), t[d_next].negated()]).only_enforce_if(isolated.negated())
            short_block_vars.append(isolated)
        penalties.append(w.short_block_penalty * sum(short_block_vars))

    # Weekly rhythm penalty: penalize transitions on non-reference DOWs
    weekly_rhythm_vars = []
    if w.weekly_rhythm_weight > 0:
        # Extract reference transition DOWs from previous_schedule_hint (priority) or template
        ref_trans_dows: set[int] = set()
        if reference_map:
            prev_ref_val = None
            for d in dates:
                if d in reference_map:
                    if prev_ref_val is not None and reference_map[d] != prev_ref_val:
                        ref_trans_dows.add(d.weekday())
                    prev_ref_val = reference_map[d]
        elif request.template_id:
            from app.solver.templates import get_template as _get_tmpl_rhythm
            _tmpl_r = _get_tmpl_rhythm(request.template_id)
            if _tmpl_r:
                p = _tmpl_r.pattern14
                cl = _tmpl_r.cycle_length
                for i in range(1, cl):
                    if p[i] != p[i - 1]:
                        # Map cycle position to a synthetic DOW
                        ref_trans_dows.add(i % 7)
        if ref_trans_dows:
            for d in t:
                if d.weekday() not in ref_trans_dows:
                    weekly_rhythm_vars.append(t[d])
            if weekly_rhythm_vars:
                penalties.append(w.weekly_rhythm_weight * sum(weekly_rhythm_vars))

    # Routine consistency: Hamming distance from previous_schedule_hint
    routine_diff_vars = []
    if w.routine_consistency_weight > 0 and reference_map:
        for d in dates:
            if d in reference_map:
                rdiff = model.new_bool_var(f"routine_diff_{d.isoformat()}")
                if reference_map[d] == 0:
                    model.add(rdiff >= x[d])
                    model.add(rdiff <= x[d])
                else:
                    model.add(rdiff >= 1 - x[d])
                    model.add(rdiff <= 1 - x[d])
                routine_diff_vars.append(rdiff)
        if routine_diff_vars:
            penalties.append(w.routine_consistency_weight * sum(routine_diff_vars))

    model.minimize(sum(penalties))

    # ─── Solve ───────────────────────────────────────────────

    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = request.timeout_seconds
    solver.parameters.num_workers = 1

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

        # Resolve template for metrics
        tmpl_pattern = None
        tmpl_cycle = 0
        if request.template_id:
            from app.solver.templates import get_template as _get_tmpl
            _tmpl = _get_tmpl(request.template_id)
            if _tmpl:
                tmpl_pattern = _tmpl.pattern14
                tmpl_cycle = _tmpl.cycle_length

        metrics = _compute_metrics(
            sol, dates, request.weekend_definition,
            template_pattern=tmpl_pattern,
            template_cycle_length=tmpl_cycle,
            reference_schedule=reference_map if reference_map else None,
        )

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

        school_night_trans = sum(
            1 for a in assignments
            if a.is_transition and _is_school_night(date.fromisoformat(a.date))
        )

        handoff_loc_pref = 0
        if preferred_days_set and w.handoff_location_preference > 0:
            handoff_loc_pref = sum(
                1 for a in assignments
                if a.is_transition
                and (date.fromisoformat(a.date).weekday() + 1) % 7 not in preferred_days_set
            )

        # Compute template alignment breakdown (post-hoc count of deviations)
        tmpl_align_count = 0
        if tmpl_pattern and tmpl_cycle > 0:
            for i_d, d in enumerate(dates):
                cycle_pos = i_d % tmpl_cycle
                if sol[d] != tmpl_pattern[cycle_pos]:
                    tmpl_align_count += 1

        # Compute short block count for breakdown
        short_block_count_bd = 0
        for i_d in range(1, n_days - 1):
            val = sol[dates[i_d]]
            if sol[dates[i_d - 1]] != val and sol[dates[i_d + 1]] != val:
                short_block_count_bd += 1

        # Compute weekly rhythm breakdown (transitions on non-reference DOWs)
        weekly_rhythm_count = 0
        bd_ref_dows: set[int] = set()
        if reference_map:
            prev_rv = None
            for d in dates:
                if d in reference_map:
                    if prev_rv is not None and reference_map[d] != prev_rv:
                        bd_ref_dows.add(d.weekday())
                    prev_rv = reference_map[d]
        if bd_ref_dows:
            sol_prev = None
            for d in dates:
                if sol_prev is not None and sol[d] != sol_prev:
                    if d.weekday() not in bd_ref_dows:
                        weekly_rhythm_count += 1
                sol_prev = sol[d]

        # Compute routine consistency breakdown
        routine_diff_count = 0
        if reference_map:
            for d in dates:
                if d in reference_map and sol[d] != reference_map[d]:
                    routine_diff_count += 1

        penalties_bd = PenaltyBreakdown(
            fairness_deviation=float(w.fairness_deviation * fair_dev),
            total_transitions=float(w.total_transitions * total_tr),
            non_daycare_handoffs=float(w.non_daycare_handoffs * non_dc),
            weekend_fragmentation=float(w.weekend_fragmentation * metrics.weekend_fragmentation_count),
            school_night_disruption=float(w.school_night_disruption * school_night_trans),
            handoff_location_preference=float(w.handoff_location_preference * handoff_loc_pref),
            template_alignment=float(w.template_alignment * tmpl_align_count),
            short_block=float(w.short_block_penalty * short_block_count_bd),
            weekly_rhythm=float(w.weekly_rhythm_weight * weekly_rhythm_count),
            routine_consistency=float(w.routine_consistency_weight * routine_diff_count),
            total=0.0,
        )
        penalties_bd.total = round(
            penalties_bd.fairness_deviation
            + penalties_bd.total_transitions
            + penalties_bd.non_daycare_handoffs
            + penalties_bd.weekend_fragmentation
            + penalties_bd.school_night_disruption
            + penalties_bd.handoff_location_preference
            + penalties_bd.template_alignment
            + penalties_bd.short_block
            + penalties_bd.weekly_rhythm
            + penalties_bd.routine_consistency,
            2,
        )

        solutions.append(Solution(
            rank=rank,
            assignments=assignments,
            metrics=metrics,
            penalties=penalties_bd,
        ))

    # Sort by total penalty + tie-break key for determinism
    from app.solver.tie_break import compute_tie_break_key
    for s in solutions:
        sol_map = {}
        for a in s.assignments:
            d = date.fromisoformat(a.date)
            sol_map[d] = 0 if a.parent == "parent_a" else 1
        s._tie_break = compute_tie_break_key(
            sol_map, dates, request.weekend_definition,
            long_distance_dates=request.long_distance_dates,
        )
    solutions.sort(key=lambda s: (s.penalties.total, s._tie_break))
    for i, s in enumerate(solutions):
        s.rank = i + 1
        if hasattr(s, '_tie_break'):
            del s._tie_break

    return ScheduleResponse(
        status=status_str,
        solutions=solutions,
        solve_time_ms=round(solve_time, 1),
    )


def generate_base_schedule(request: ScheduleRequest) -> ScheduleResponse:
    """Generate base schedule with relaxation fallback on infeasibility."""
    response = _solve_core(request)

    if response.status == "infeasible":
        from app.solver.relaxation import try_relaxation
        from app.solver.diagnostics import generate_diagnostics
        relaxed_response, relaxation_result = try_relaxation(request, _solve_core)

        if relaxed_response is not None and relaxed_response.status != "infeasible":
            relaxed_response.status = "relaxed_solution"
            relaxed_response.relaxation_info = relaxation_result.to_info()
            relaxed_response.diagnostics = generate_diagnostics(request, relaxation_result)
            return relaxed_response

        # All relaxation attempts exhausted
        response.relaxation_info = relaxation_result.to_info()
        response.diagnostics = generate_diagnostics(request, relaxation_result)

    return response
