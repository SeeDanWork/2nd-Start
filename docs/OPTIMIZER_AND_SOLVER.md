# Optimizer & Solver

The Python FastAPI service (`apps/optimizer/`) provides deterministic schedule generation using Google OR-Tools CP-SAT constraint solver with a heuristic fallback.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | /health | Health check |
| POST | /solve/base-schedule | Generate base schedule from constraints |
| POST | /solve/proposals | Generate proposal options for change requests |
| POST | /onboarding/validate | Validate onboarding inputs |
| POST | /onboarding/conflicts | Detect constraint conflicts |
| POST | /onboarding/options | Generate 3-5 schedule options |
| POST | /onboarding/explain | Explain a recommendation |

## Solver Architecture

### CP-SAT Constraint Solver (`app/brain/solver.py`)

The main `generate_options()` function:
1. Accepts `OnboardingInput` with both parents' constraints
2. Solves for 5 weight profiles in parallel
3. Filters by Hamming distance for diversity (min 2)
4. Returns `OnboardingOutput` with up to 5 `ScheduleOption` objects

Key internal functions:
- `_solve_single_profile(dates, profile, weights, inputs, ...)` — Runs CP-SAT for one profile
- `_build_handoffs(days, inputs)` — Constructs handoff events from assignments
- `_hamming_distance(a, b)` — Measures schedule diversity
- `_age_band_defaults(age_bands)` — Returns age-appropriate max consecutive / block preferences

### Day-of-Week Convention
- **JavaScript** (DB/API): 0=Sun, 1=Mon ... 6=Sat
- **Python**: 0=Mon, 1=Tue ... 6=Sun
- Conversion: `js_dow = (py_dow + 1) % 7`

### Heuristic Fallback (`app/brain/heuristic.py`)

When OR-Tools is unavailable, uses pattern-based generation:

**Base Patterns** (14-day cycles):
- `7-7`: Alternating full weeks
- `5-2-2-5`: Weekday/weekend split
- `2-2-5-5`: Short blocks with long weekend
- `3-4-4-3`: Balanced mid-week transition
- `2-2-3`: Classic 2-2-3 rotation

Each profile prefers certain patterns (e.g., STABILITY prefers 7-7, LOGISTICS prefers 2-2-3).

## Weight Profiles (`app/brain/profiles.py`)

Five solver weight profiles control optimization priorities:

| Profile | Fairness | Transitions | Non-School | Weekend Frag | School Night | Weekend Parity | Max Consecutive |
|---------|----------|-------------|------------|--------------|--------------|----------------|-----------------|
| STABILITY | 80 | 120 | 60 | 40 | 80 | 40 | 60 |
| FAIRNESS | 150 | 40 | 20 | 20 | 40 | 80 | 30 |
| LOGISTICS | 60 | 100 | 100 | 30 | 40 | 30 | 40 |
| WEEKEND_PARITY | 80 | 60 | 40 | 80 | 60 | 150 | 40 |
| CHILD_ROUTINE | 80 | 80 | 80 | 60 | 120 | 40 | 80 |

## Domain Models (`app/brain/domain.py`)

### Input Types
- `OnboardingInput` — Top-level input with children, parents, shared constraints
- `ParentProfile` — Availability (locked nights/mornings/evenings), preferences (target share, max handoffs), constraints
- `SharedConstraints` — Distance, no-contact, horizon, start date
- `SchoolSchedule` / `DaycareSchedule` — Daily schedules with times

### Output Types
- `ScheduleOption` — id, name, profile, schedule days[], handoffs[], stats, explanation
- `ScheduleDay` — date, day_of_week, assigned_to, is_transition
- `HandoffInfo` — date, time, location_type, from/to parent
- `ScheduleStats` — overnights, weekend nights, transitions, stability/fairness/parity scores
- `ConflictReport` — feasibility flag + conflict details with suggested relaxations

### Enums
- `AgeBand`: INFANT, SCHOOL_AGE, TEEN
- `ExchangeLocation`: SCHOOL, DAYCARE, HOME, OTHER
- `WeekendPreference`: ALTERNATE, FIXED, FLEXIBLE
- `OptionProfile`: STABILITY, FAIRNESS, LOGISTICS, WEEKEND_PARITY, CHILD_ROUTINE

## Statistics (`app/brain/stats.py`)

`compute_stats(days, school_days)` calculates:
- Parent A/B overnights and weekend nights
- Total transitions count
- Non-school handoffs
- Stability score (1.0 = no transitions)
- Fairness score (1.0 = perfect 50/50)
- Weekend parity score

## Explanation Engine (`app/brain/explain.py`)

`generate_explanation(option, inputs, stats)` produces human-readable bullets:
- Which constraints were respected
- Tradeoffs made (e.g., "more transitions for better fairness")
- Assumptions applied (e.g., "school days Mon-Fri assumed")

## Conflict Detection (`app/brain/conflicts.py`)

- `validate_inputs(inputs)` — Schema-level validation
- `detect_conflicts(inputs)` — Logical conflict detection (e.g., both parents locking the same night, impossible fairness targets with locked constraints)

## Base Schedule Solver (`app/solver/base_schedule.py`)

Used by `/solve/base-schedule` endpoint. Takes `ScheduleRequest` with:
- Horizon dates, locked nights, max consecutive, max transitions
- Weekend definition and split targets
- Daycare exchange days, school night consistency
- Bonus weeks, holidays
- Solver weights, timeout, max solutions

Returns `ScheduleResponse` with ranked solutions, each containing assignments, metrics (overnights, transitions, max consecutive, weekend split), and penalty breakdowns.

## Proposal Solver

Used by `/solve/proposals`. Takes current schedule + change request constraints. Returns ranked `ProposalOption` objects with:
- Calendar diff (which days change)
- Fairness impact (overnight/weekend deltas)
- Stability impact (transition changes)
- Handoff impact (new/removed handoffs)
- Auto-approvable flag (if within consent rules)

## Docker Deployment

```yaml
optimizer:
  build: apps/optimizer
  ports: ["8000:8000"]
  command: uvicorn app.main:app --host 0.0.0.0 --port 8000
  healthcheck: curl -f http://localhost:8000/health
```

Called from NestJS API via HTTP POST with configurable timeout (SOLVER_TIMEOUT_SECONDS: 30s default).
