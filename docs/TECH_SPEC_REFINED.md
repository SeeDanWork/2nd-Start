# Anti-Drama Co-Parenting — Refined Tech Spec

> Revision: 1.0 — Refined from original product vision + suggestive tech spec.
> All gaps, missing entities, edge cases, and optimizations have been addressed.

---

## 1) Guiding Constraints

* **Deterministic scheduling** via constraint solver (CP-SAT). No generative AI in the scheduling path.
* **Auditability**: immutable schedule versions + append-only change history.
* **Calendar-first UX**: fast month view, clear handoff events, single-query data loading.
* **Low operating overhead**: monorepo, minimal services, small-team friendly.
* **Offline-tolerant**: mobile app must display cached schedule without connectivity.

---

## 2) Stack Decisions

| Layer | Choice | Rationale |
|---|---|---|
| Mobile client | React Native (Expo) | iOS + Android from one codebase; Expo simplifies builds and OTA updates |
| API backend | TypeScript — NestJS | Type safety shared with RN; strong ecosystem; NestJS provides structure for modules, guards, versioning |
| Optimizer service | Python — FastAPI + OR-Tools CP-SAT | OR-Tools has first-class Python bindings; FastAPI is lightweight; isolated service avoids coupling |
| Database | PostgreSQL 16 | JSONB for flexible constraint storage; strong indexing; row-level security possible |
| Job queue | BullMQ (Redis-backed) | Aligns with TypeScript backend; handles proposal generation, notifications, snapshot recomputation |
| Cache / ephemeral | Redis | Session tokens, rate limits, job queues, real-time pub/sub |
| Auth | Magic link (email) | Low friction for co-parents; OAuth (Google/Apple) as optional addition later |
| Notifications | Email (Resend/Postmark) → Push (FCM/APNs) later | Email is sufficient for MVP; push added in Phase D |
| File exports | Generate on-the-fly | ICS feeds are cheap to generate; PDF exports rendered server-side on request (no storage needed at MVP scale) |
| Real-time | WebSocket gateway (NestJS) | Parent A accepts → Parent B sees immediately; also powers live proposal status |
| Deployment | Docker Compose (dev) → single cloud provider (prod) | Containers for API + optimizer + Redis + Postgres; CI/CD via GitHub Actions |
| Monorepo | Turborepo or Nx | Shared types between API and RN client; shared validation schemas |

---

## 3) Data Model (Complete)

### 3.1 Core Entities

#### User
```
id              UUID PK
email           TEXT UNIQUE NOT NULL
display_name    TEXT NOT NULL
timezone        TEXT NOT NULL DEFAULT 'America/New_York'
notification_preferences  JSONB DEFAULT '{}'
  — { email: bool, push: bool, reminder_hours_before: int }
device_tokens   TEXT[]            -- FCM/APNs tokens
onboarding_completed  BOOL DEFAULT false
created_at      TIMESTAMPTZ
updated_at      TIMESTAMPTZ
```

#### Family (Dyad)
```
id              UUID PK
name            TEXT              -- optional friendly name
timezone        TEXT NOT NULL     -- canonical timezone for this family
weekend_definition  TEXT NOT NULL DEFAULT 'fri_sat'
  — enum: 'fri_sat' | 'sat_sun'
fairness_band   JSONB NOT NULL DEFAULT '{"overnights": 1, "window_weeks": 8}'
  — { overnights: int (max deviation), window_weeks: int }
change_budget   JSONB NOT NULL DEFAULT '{"max_per_month": 4}'
status          TEXT NOT NULL DEFAULT 'onboarding'
  — enum: 'onboarding' | 'active' | 'paused' | 'archived'
created_at      TIMESTAMPTZ
updated_at      TIMESTAMPTZ
```

#### FamilyMembership
```
id              UUID PK
family_id       UUID FK → Family
user_id         UUID FK → User
role            TEXT NOT NULL
  — enum: 'parent_a' | 'parent_b' | 'caregiver' | 'viewer'
label           TEXT NOT NULL     -- display label: "Mom", "Dad", "Grandma", custom
invite_status   TEXT NOT NULL DEFAULT 'pending'
  — enum: 'pending' | 'accepted' | 'declined'
invited_at      TIMESTAMPTZ
accepted_at     TIMESTAMPTZ
```

#### Child
```
id              UUID PK
family_id       UUID FK → Family
first_name      TEXT NOT NULL
date_of_birth   DATE              -- optional; used for age-appropriate defaults
school_name     TEXT              -- informational
created_at      TIMESTAMPTZ
```

#### HandoffLocation
```
id              UUID PK
family_id       UUID FK → Family
name            TEXT NOT NULL     -- "Daycare", "School", "Neutral parking lot"
type            TEXT NOT NULL
  — enum: 'daycare' | 'school' | 'neutral' | 'home_parent_a' | 'home_parent_b'
address         TEXT
is_default      BOOL DEFAULT false
available_windows  JSONB          -- [{ day_of_week: int, start: "08:00", end: "18:00" }]
created_at      TIMESTAMPTZ
```

### 3.2 Constraints

#### ConstraintSet
```
id              UUID PK
family_id       UUID FK → Family
version         INT NOT NULL      -- incremented on any constraint change
is_active       BOOL DEFAULT true
created_by      UUID FK → User
created_at      TIMESTAMPTZ
```

#### Constraint
```
id              UUID PK
constraint_set_id  UUID FK → ConstraintSet
type            TEXT NOT NULL
  — enum: 'locked_night' | 'max_consecutive' | 'min_consecutive'
       | 'weekend_split' | 'max_transitions_per_week'
       | 'daycare_exchange_only' | 'no_school_night_transition'
       | 'handoff_location_preference'
hardness        TEXT NOT NULL DEFAULT 'hard'
  — enum: 'hard' | 'soft'
weight          INT DEFAULT 100   -- penalty weight for soft constraints (1-1000)
owner           TEXT NOT NULL
  — enum: 'parent_a' | 'parent_b' | 'shared'
recurrence      JSONB             -- for recurring: { days_of_week: [0,1], parent: 'parent_a' }
date_range      JSONB             -- for one-off: { start: date, end: date }
parameters      JSONB NOT NULL    -- type-specific config
  — locked_night:    { parent: 'parent_a', days_of_week: [0, 1] }
  — max_consecutive: { parent: 'parent_a', max_nights: 5 }
  — weekend_split:   { target_pct_parent_a: 50, tolerance_pct: 10 }
  — max_transitions: { per_week: 3 }
  — etc.
created_at      TIMESTAMPTZ
```

#### HolidayCalendar
```
id              UUID PK
family_id       UUID FK → Family
name            TEXT NOT NULL     -- "Daycare closures 2026", "School holidays"
entries         JSONB NOT NULL    -- [{ date: "2026-03-15", label: "Spring break", daycare_closed: true }]
created_at      TIMESTAMPTZ
updated_at      TIMESTAMPTZ
```

### 3.3 Schedules

#### BaseScheduleVersion
```
id              UUID PK
family_id       UUID FK → Family
version         INT NOT NULL      -- monotonically increasing per family
constraint_set_version  INT NOT NULL  -- snapshot of which constraints produced this
horizon_start   DATE NOT NULL
horizon_end     DATE NOT NULL
solver_status   TEXT NOT NULL
  — enum: 'optimal' | 'feasible' | 'infeasible' | 'timeout'
solver_metadata JSONB             -- { solve_time_ms, gap, solutions_found, objective_value }
created_by      TEXT NOT NULL
  — enum: 'generation' | 'proposal_acceptance' | 'manual_override'
source_proposal_option_id  UUID   -- FK → ProposalOption (null if initial generation)
is_active       BOOL DEFAULT true -- only one active version per family
created_at      TIMESTAMPTZ
```

#### OvernightAssignment
```
id              UUID PK
schedule_version_id  UUID FK → BaseScheduleVersion
family_id       UUID FK → Family  -- denormalized for query performance
date            DATE NOT NULL
assigned_to     TEXT NOT NULL
  — enum: 'parent_a' | 'parent_b'
is_transition   BOOL NOT NULL     -- true if assigned_to differs from previous day
source          TEXT NOT NULL DEFAULT 'generated'
  — enum: 'generated' | 'proposal' | 'manual'
UNIQUE(schedule_version_id, date)
```
**Index:** `(family_id, date)` composite for calendar queries.

#### HandoffEvent
```
id              UUID PK
schedule_version_id  UUID FK → BaseScheduleVersion
family_id       UUID FK → Family
date            DATE NOT NULL
type            TEXT NOT NULL
  — enum: 'daycare_dropoff' | 'daycare_pickup' | 'school_dropoff' | 'school_pickup'
       | 'neutral_exchange' | 'home_exchange'
time_window_start  TIME
time_window_end    TIME
location_id     UUID FK → HandoffLocation
from_parent     TEXT NOT NULL     -- 'parent_a' | 'parent_b'
to_parent       TEXT NOT NULL
notes           TEXT
```
**Index:** `(family_id, date)` composite.

### 3.4 Requests and Proposals

#### Request
```
id              UUID PK
family_id       UUID FK → Family
requested_by    UUID FK → User
type            TEXT NOT NULL
  — enum: 'need_coverage' | 'want_time' | 'bonus_week' | 'swap_date'
status          TEXT NOT NULL DEFAULT 'draft'
  — enum: 'draft' | 'pending' | 'proposals_generated' | 'accepted' | 'declined' | 'expired' | 'cancelled'
dates           DATE[] NOT NULL   -- affected dates
reason_tag      TEXT              -- 'work_travel' | 'medical' | 'family_event' | 'other'
reason_note     TEXT              -- optional short note (max 200 chars, no essays)
urgency         TEXT DEFAULT 'normal'
  — enum: 'normal' | 'urgent'
change_budget_debit  INT DEFAULT 1
expires_at      TIMESTAMPTZ       -- auto-set based on family config (24-48h)
created_at      TIMESTAMPTZ
updated_at      TIMESTAMPTZ
```

#### ProposalBundle
```
id              UUID PK
request_id      UUID FK → Request
family_id       UUID FK → Family
solver_run_id   TEXT              -- correlation ID for optimizer call
generation_params  JSONB          -- { horizon_weeks, max_solutions, timeout_ms }
expires_at      TIMESTAMPTZ
created_at      TIMESTAMPTZ
```

#### ProposalOption
```
id              UUID PK
bundle_id       UUID FK → ProposalBundle
rank            INT NOT NULL      -- 1 = best
label           TEXT              -- auto-generated: "Minimal disruption", "Best fairness"
calendar_diff   JSONB NOT NULL    -- [{ date, old_parent, new_parent }]
fairness_impact JSONB NOT NULL
  — { overnight_delta: +1, weekend_delta: 0, window_weeks: 8 }
stability_impact JSONB NOT NULL
  — { transitions_delta: +1, max_streak_change: 0, school_night_changes: 0 }
handoff_impact  JSONB NOT NULL
  — { new_handoffs: 1, removed_handoffs: 0, non_daycare_handoffs: 1 }
penalty_score   FLOAT NOT NULL    -- aggregate penalty from solver
is_auto_approvable  BOOL DEFAULT false  -- within pre-consent thresholds
```

#### Acceptance
```
id              UUID PK
proposal_option_id  UUID FK → ProposalOption
accepted_by     UUID FK → User
acceptance_type TEXT NOT NULL
  — enum: 'manual' | 'auto_approved' | 'counter'
resulting_version_id  UUID FK → BaseScheduleVersion
counter_bundle_id  UUID FK → ProposalBundle  -- if type = 'counter'
created_at      TIMESTAMPTZ
```

### 3.5 Guardrails

#### PreConsentRule
```
id              UUID PK
family_id       UUID FK → Family
created_by      UUID FK → User
rule_type       TEXT NOT NULL
  — enum: 'fairness_band' | 'max_transitions' | 'max_streak' | 'request_type'
threshold       JSONB NOT NULL
  — fairness_band:   { max_overnight_delta: 1 }
  — max_transitions: { max_additional: 1 }
  — request_type:    { auto_approve_types: ['swap_date'] }
is_active       BOOL DEFAULT true
created_at      TIMESTAMPTZ
```

#### ChangeBudgetLedger
```
id              UUID PK
family_id       UUID FK → Family
user_id         UUID FK → User
month           DATE NOT NULL     -- first of month
budget_limit    INT NOT NULL
used            INT NOT NULL DEFAULT 0
```

#### EmergencyMode
```
id              UUID PK
family_id       UUID FK → Family
activated_by    UUID FK → User
activated_at    TIMESTAMPTZ NOT NULL
return_to_baseline_at  DATE NOT NULL  -- auto-restore date
relaxed_constraints  JSONB NOT NULL   -- which constraints are temporarily suspended
  — [{ constraint_id: UUID, original_value: JSONB }]
status          TEXT NOT NULL DEFAULT 'active'
  — enum: 'active' | 'returned' | 'cancelled'
returned_at     TIMESTAMPTZ
```

### 3.6 Metrics and Audit

#### LedgerSnapshot
```
id              UUID PK
family_id       UUID FK → Family
schedule_version_id  UUID FK → BaseScheduleVersion
window_type     TEXT NOT NULL
  — enum: '2_week' | '4_week' | '8_week' | '12_week'
window_start    DATE NOT NULL
window_end      DATE NOT NULL
parent_a_overnights     INT NOT NULL
parent_b_overnights     INT NOT NULL
parent_a_weekend_nights INT NOT NULL
parent_b_weekend_nights INT NOT NULL
within_fairness_band    BOOL NOT NULL
computed_at     TIMESTAMPTZ NOT NULL
```
**Index:** `(family_id, window_type, window_end DESC)`.

#### StabilitySnapshot
```
id              UUID PK
family_id       UUID FK → Family
schedule_version_id  UUID FK → BaseScheduleVersion
window_start    DATE NOT NULL
window_end      DATE NOT NULL
transitions_per_week    FLOAT NOT NULL
max_consecutive_a       INT NOT NULL
max_consecutive_b       INT NOT NULL
school_night_consistency_pct  FLOAT NOT NULL  -- % of school nights with same parent as previous week
weekend_fragmentation_count   INT NOT NULL    -- number of split weekends in window
computed_at     TIMESTAMPTZ NOT NULL
```

#### AuditLog
```
id              BIGSERIAL PK
family_id       UUID FK → Family
actor_id        UUID FK → User (nullable for system actions)
action          TEXT NOT NULL
  — enum: 'schedule_generated' | 'schedule_activated' | 'request_created'
       | 'proposal_generated' | 'proposal_accepted' | 'proposal_declined'
       | 'proposal_expired' | 'proposal_countered'
       | 'constraint_added' | 'constraint_removed' | 'constraint_updated'
       | 'consent_rule_changed' | 'emergency_activated' | 'emergency_returned'
       | 'member_invited' | 'member_accepted' | 'share_link_created'
entity_type     TEXT NOT NULL     -- 'schedule' | 'request' | 'constraint' | etc.
entity_id       UUID NOT NULL
metadata        JSONB             -- action-specific details
created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
```
**Index:** `(family_id, created_at DESC)`.
**Policy:** Append-only. No UPDATE or DELETE.

### 3.7 Sharing

#### ShareLink
```
id              UUID PK
family_id       UUID FK → Family
created_by      UUID FK → User
token           TEXT UNIQUE NOT NULL  -- cryptographic random token
scope           TEXT NOT NULL
  — enum: 'calendar_readonly' | 'ics_feed' | 'handoff_schedule'
label           TEXT              -- "Daycare calendar", "Grandma's view"
format          TEXT NOT NULL DEFAULT 'web'
  — enum: 'web' | 'ics'
expires_at      TIMESTAMPTZ       -- null = no expiry (but revocable)
revoked_at      TIMESTAMPTZ
created_at      TIMESTAMPTZ
```

### 3.8 Notifications

#### NotificationRecord
```
id              UUID PK
family_id       UUID FK → Family
user_id         UUID FK → User
channel         TEXT NOT NULL     -- 'email' | 'push'
type            TEXT NOT NULL
  — 'handoff_reminder' | 'proposal_received' | 'proposal_expiring'
  | 'proposal_accepted' | 'proposal_expired' | 'emergency_activated'
  | 'budget_low' | 'fairness_drift'
reference_id    UUID              -- entity that triggered it
sent_at         TIMESTAMPTZ
delivered_at    TIMESTAMPTZ       -- from delivery provider webhook
```

---

## 4) Scheduling Algorithm (Complete)

### 4.1 Problem Representation

**Decision variables:**
```
x[d] ∈ {0, 1}  for each date d in horizon
  — 0 = parent_a overnight, 1 = parent_b overnight
```

**Derived variables:**
```
transition[d] = 1  if x[d] ≠ x[d-1]  (d > horizon_start)
streak_a[d]   = consecutive days where x[d..d+k] = 0
streak_b[d]   = consecutive days where x[d..d+k] = 1
is_weekend[d] = 1  if d falls on family.weekend_definition days
```

### 4.2 Hard Constraints

1. **Locked nights:**
   `x[d] = locked_parent` for all d matching recurring pattern (day_of_week ∈ locked_days).
   Exception: if d falls within an active bonus_week range, the lock is suspended.

2. **Max consecutive (outside bonus week):**
   For all windows of length `max_consecutive + 1` not overlapping a bonus_week range:
   `sum(x[d..d+max+1]) ≤ max` AND `sum(1-x[d..d+max+1]) ≤ max`.

3. **Max consecutive (inside bonus week):**
   Separate, relaxed limit (e.g., 7) applies during declared bonus_week ranges.

4. **Max transitions per week:**
   For each ISO week: `sum(transition[d] for d in week) ≤ max_transitions_per_week`.

5. **Weekend split bounds:**
   Over every rolling N-week window: parent_a weekend nights are within
   `[target - tolerance, target + tolerance]`.

6. **Handoff feasibility — daycare-first:**
   If `transition[d] = 1` and `d` is not a holiday/closure: prefer daycare exchange.
   If `transition[d] = 1` and `d` IS a holiday/closure: must use neutral/home exchange
   (daycare handoff forbidden on closed days — hard constraint).

7. **School-night consistency:**
   Configurable: e.g., "Sun-Thu nights should not change parent more than once per week."

### 4.3 Soft Constraints (Objective Penalties)

Minimize weighted sum of:

| Penalty | Weight (configurable) | Formula |
|---|---|---|
| Fairness deviation | w1 = 100 | `abs(sum(x) - target_split * horizon_length)` |
| Total transitions | w2 = 50 | `sum(transition[d])` |
| Non-daycare handoffs | w3 = 30 | count of transitions on non-school/daycare days |
| Weekend fragmentation | w4 = 40 | count of weekends where both parents have exactly 1 night |
| School-night disruption | w5 = 60 | transitions on Sun-Thu nights |

### 4.4 Solver Configuration

```python
solver = cp_model.CpSolver()
solver.parameters.max_time_in_seconds = 30        # hard timeout
solver.parameters.num_workers = 4                  # parallel search
solver.parameters.enumerate_all_solutions = False  # use solution pool callback
```

**Solution pool strategy:**
- Use `CpSolverSolutionCallback` to collect up to K=10 solutions.
- After collecting, filter for diversity: minimum Hamming distance of 2 days between any pair.
- Rank by penalty score ascending.
- Return top 3-5 to the user (configurable).

### 4.5 Infeasibility Handling

If solver returns `INFEASIBLE`:
1. Log the constraint set and parameters.
2. Run a **diagnosis pass**: iteratively relax soft constraints, then hard constraints by priority, to identify the minimal conflicting subset (MUS — minimal unsatisfiable subset).
3. Return structured error to API: `{ status: "infeasible", conflicting_constraints: [ids], suggestion: "Relaxing Mon lock or reducing max_consecutive to 4 would resolve this." }`

### 4.6 Proposal Generation

1. **Freeze history:** All assignments before today are immutable.
2. **Apply request:** Convert request dates to additional constraints:
   - `need_coverage`: `x[d] ≠ requesting_parent` for request dates.
   - `want_time`: `x[d] = requesting_parent` (soft, high weight).
   - `bonus_week`: relax max_consecutive for the date range; assign to requesting parent.
   - `swap_date`: `x[d_old] ≠ parent` AND `x[d_new] = parent`.
3. **Solve forward horizon:** Re-solve next 4-12 weeks (configurable). Use current active schedule as **warm-start hint** via `solver.AddSolutionHint()`.
4. **Generate solution pool** (K candidates).
5. **Score each** against fairness and stability metrics.
6. **Check auto-approvability:** Compare each option's impacts against PreConsentRules.
7. **Return ProposalBundle** with ranked ProposalOptions.

### 4.7 Bonus Week Model

A bonus week is a declared date range (typically 5-7 nights) where:
- One parent has continuous custody (e.g., grandparents week).
- Max consecutive constraint is relaxed to the bonus_week limit (e.g., 7).
- Locked nights within the bonus range are suspended.
- Fairness ledger marks these nights with a `bonus_week` flag.
- The solver is allowed to schedule compensating time for the other parent in the surrounding weeks.
- A bonus week counts as 1 change budget debit (not per-night).

### 4.8 Transition Counting Rule

A **transition** is defined as: the child sleeps at a different parent's home than the previous night.
- Daycare/school is a **handoff location**, not a residence. Dad → daycare → Mom = **1 transition** (on the night Mom has the child).
- This keeps the metric intuitive: transitions = number of times the child switches "home base."

---

## 5) API Surface (Complete)

### 5.1 Auth and Invitations

| Method | Path | Description |
|---|---|---|
| POST | `/auth/magic-link` | Send magic link email |
| POST | `/auth/verify` | Verify magic link token, return JWT |
| POST | `/auth/refresh` | Refresh JWT |
| GET | `/auth/me` | Current user profile |
| PATCH | `/auth/me` | Update profile (name, timezone, notification prefs) |
| DELETE | `/auth/me` | Delete account (cascade rules below) |

### 5.2 Family Management

| Method | Path | Description |
|---|---|---|
| POST | `/families` | Create family (creator = parent_a) |
| GET | `/families/:familyId` | Get family details |
| PATCH | `/families/:familyId` | Update family settings (timezone, weekend def, fairness band, budget) |
| POST | `/families/:familyId/invite` | Invite parent_b or caregiver (sends email + deep link) |
| POST | `/families/:familyId/accept-invite` | Accept invitation |
| GET | `/families/:familyId/members` | List family members |

### 5.3 Children

| Method | Path | Description |
|---|---|---|
| POST | `/families/:familyId/children` | Add child |
| PATCH | `/families/:familyId/children/:childId` | Update child info |

### 5.4 Constraints

| Method | Path | Description |
|---|---|---|
| GET | `/families/:familyId/constraints` | Get active constraint set |
| POST | `/families/:familyId/constraints` | Add a constraint (validates against existing; detects conflicts) |
| PATCH | `/families/:familyId/constraints/:id` | Update constraint |
| DELETE | `/families/:familyId/constraints/:id` | Remove constraint |
| POST | `/families/:familyId/constraints/validate` | Dry-run: check for conflicts without saving |

**Constraint conflict detection:**
When adding/updating, the API runs a fast feasibility check (solver with 5s timeout). If INFEASIBLE, returns the conflicting constraint IDs and a suggestion. Both parents can set constraints; conflicts are surfaced, not silently resolved.

### 5.5 Holiday Calendars

| Method | Path | Description |
|---|---|---|
| GET | `/families/:familyId/holidays` | List holiday calendars |
| POST | `/families/:familyId/holidays` | Create calendar (manual entry or import) |
| PATCH | `/families/:familyId/holidays/:id` | Update entries |
| DELETE | `/families/:familyId/holidays/:id` | Delete calendar |

### 5.6 Handoff Locations

| Method | Path | Description |
|---|---|---|
| GET | `/families/:familyId/locations` | List handoff locations |
| POST | `/families/:familyId/locations` | Add location |
| PATCH | `/families/:familyId/locations/:id` | Update location |
| DELETE | `/families/:familyId/locations/:id` | Delete location |

### 5.7 Schedules

| Method | Path | Description |
|---|---|---|
| POST | `/families/:familyId/schedules/generate` | Generate base schedule from constraints (async — returns job ID) |
| GET | `/families/:familyId/schedules/generate/:jobId` | Poll generation status + result |
| GET | `/families/:familyId/schedules/active` | Get active schedule version |
| GET | `/families/:familyId/schedules/:version` | Get specific version |
| GET | `/families/:familyId/schedules/:version/assignments?start=&end=` | Get overnight assignments for date range |
| GET | `/families/:familyId/schedules/:version/handoffs?start=&end=` | Get handoff events for date range |
| GET | `/families/:familyId/schedules/history` | List all versions with metadata |

**Calendar endpoint (optimized composite):**
| GET | `/families/:familyId/calendar?start=&end=` | Returns assignments + handoffs + holidays for range in one response |

### 5.8 Requests and Proposals

| Method | Path | Description |
|---|---|---|
| POST | `/families/:familyId/requests` | Create request (validates change budget) |
| GET | `/families/:familyId/requests` | List requests (filterable by status) |
| GET | `/families/:familyId/requests/:id` | Get request details |
| PATCH | `/families/:familyId/requests/:id` | Update draft request |
| DELETE | `/families/:familyId/requests/:id` | Cancel request |
| POST | `/families/:familyId/requests/:id/generate-proposals` | Generate proposal bundle (async) |
| GET | `/families/:familyId/requests/:id/proposals` | Get proposal bundle with options |
| POST | `/families/:familyId/proposals/:optionId/accept` | Accept option → creates new schedule version |
| POST | `/families/:familyId/proposals/:optionId/decline` | Decline option |
| POST | `/families/:familyId/proposals/:optionId/counter` | Counter → generates new bundle with modified constraints |
| GET | `/families/:familyId/requests/:id/impact-preview` | Preview fairness + stability impact before generating proposals |

### 5.9 Guardrails

| Method | Path | Description |
|---|---|---|
| GET | `/families/:familyId/consent-rules` | List pre-consent rules |
| POST | `/families/:familyId/consent-rules` | Add rule |
| PATCH | `/families/:familyId/consent-rules/:id` | Update rule |
| DELETE | `/families/:familyId/consent-rules/:id` | Delete rule |
| GET | `/families/:familyId/budgets` | Get change budget status (used/remaining per parent) |
| POST | `/families/:familyId/emergency` | Activate emergency mode |
| PATCH | `/families/:familyId/emergency` | Update return date |
| DELETE | `/families/:familyId/emergency` | Cancel emergency mode early |
| GET | `/families/:familyId/emergency` | Get emergency mode status |

### 5.10 Metrics

| Method | Path | Description |
|---|---|---|
| GET | `/families/:familyId/ledger?windows=2,4,8,12` | Get fairness ledger for specified windows |
| GET | `/families/:familyId/stability?start=&end=` | Get stability metrics for range |
| GET | `/families/:familyId/audit?limit=&offset=` | Get audit log (paginated) |
| GET | `/families/:familyId/summary?month=` | Get monthly summary (data for PDF/export) |

### 5.11 Sharing

| Method | Path | Description |
|---|---|---|
| POST | `/families/:familyId/share-links` | Create share link |
| GET | `/families/:familyId/share-links` | List share links |
| DELETE | `/families/:familyId/share-links/:id` | Revoke share link |
| GET | `/share/:token` | Public: render read-only calendar (web) |
| GET | `/share/:token/feed.ics` | Public: ICS feed |

### 5.12 Onboarding

| Method | Path | Description |
|---|---|---|
| GET | `/onboarding/templates` | List schedule archetypes ("Daycare week split", "Alternating weeks", etc.) |
| POST | `/onboarding/from-template` | Create family + constraint set + initial schedule from template |

### 5.13 Home Screen

| Method | Path | Description |
|---|---|---|
| GET | `/families/:familyId/today` | Composite: tonight's assignment, next handoff, reminders, fairness bar, stability bar, pending requests |

---

## 6) Concurrency and Conflict Resolution

### 6.1 Optimistic Locking

Every schedule mutation checks the current `active_version` number:
```
POST /proposals/:optionId/accept
Body: { expected_version: 5 }
```
If active version is now 6 (another acceptance happened), return `409 Conflict` with the current version. Client must refresh and re-evaluate.

### 6.2 Request Mutual Exclusion

Only one active (non-expired, non-resolved) request per family at a time. Prevents overlapping proposal windows. If a new request is needed, the existing one must be cancelled or resolved first.

### 6.3 Proposal Expiry

A background job runs every 15 minutes:
- Finds proposal bundles past `expires_at`.
- Marks associated request as `expired`.
- Sends notification to both parents.
- No schedule change occurs (base schedule persists).

---

## 7) Offline and Sync Strategy

### 7.1 Local Cache (React Native)

- On login and on each schedule change, cache to device:
  - Active schedule assignments (next 12 weeks)
  - Handoff events (next 12 weeks)
  - Family settings and constraint summary
  - Today card data
- Storage: SQLite via `expo-sqlite` or AsyncStorage for small payloads.

### 7.2 Outbound Queue

- If offline, queue actions (request creation, proposal acceptance) locally.
- On reconnect, replay queue in order.
- If version conflict on replay, surface to user for resolution.

### 7.3 Real-Time Sync

- WebSocket connection when app is foregrounded.
- Server pushes events: `schedule_updated`, `proposal_received`, `proposal_accepted`, `proposal_expired`.
- Client refreshes affected data on event receipt.

---

## 8) Notification Strategy

### 8.1 Notification Types

| Event | Channel | Timing |
|---|---|---|
| Handoff reminder | Email + Push | Configurable: 2h / 12h / 24h before |
| New proposal received | Email + Push | Immediate |
| Proposal expiring | Email + Push | 4h before expiry |
| Proposal accepted | Email + Push | Immediate |
| Proposal expired | Email | At expiry |
| Emergency mode activated | Email + Push | Immediate |
| Emergency mode returning | Email | 24h before return date |
| Fairness drift warning | Email | Weekly digest if outside band |
| Change budget running low | Email | When 1 remaining |

### 8.2 Implementation

- BullMQ delayed jobs for timed notifications (reminders, expiry warnings).
- Immediate jobs for event-triggered notifications.
- Batch digest: weekly fairness summary email (single email, not per-metric).

---

## 9) Security and Privacy

### 9.1 Access Control

- Every API endpoint validates `user.id ∈ family.members`.
- Row-level checks: a user can only access their own family's data.
- Caregiver/viewer roles: read-only access to schedules and handoffs. No request creation, no constraint changes.
- Share links: scoped to specific data (calendar only), no PII exposure.

### 9.2 Rate Limiting

| Resource | Limit |
|---|---|
| Magic link sends | 5 per email per hour |
| Auth verify attempts | 10 per token |
| Schedule generation | 3 per family per hour |
| Proposal generation | 5 per family per hour |
| General API | 100 req/min per user |

### 9.3 Data Minimization

- No location tracking.
- No message content storage (no chat feature).
- Reason notes are optional and length-limited (200 chars).
- Audit log stores actions, not free-text.

### 9.4 Account Deletion

- User requests deletion → soft delete (30-day grace period).
- After 30 days: remove User record, anonymize their FamilyMembership to "Former Parent."
- Other parent retains schedule history with anonymized actor references.
- All device tokens and notification records purged immediately.

---

## 10) Testing Strategy

### 10.1 Optimizer Tests

- **Known-answer tests:** Predefined constraint sets with manually verified correct schedules. Assert solver output matches.
- **Infeasibility tests:** Contradictory constraints → assert INFEASIBLE status and correct conflicting constraint identification.
- **Boundary tests:** Edge cases — 1-day horizon, all nights locked, max_consecutive = 1, 100% one parent.
- **Performance tests:** Solve 52-week horizon in <30s. Proposal generation (4-12 week horizon) in <10s.
- **Determinism tests:** Same inputs → same output (with fixed random seed).

### 10.2 API Tests

- Integration tests for each endpoint with test database.
- Auth flow: magic link send → verify → JWT → protected endpoint.
- Concurrency: simultaneous proposal acceptances → exactly one succeeds.
- Expiry: time-travel tests for proposal expiry background job.

### 10.3 Mobile Tests

- Component tests for calendar rendering (month/week views).
- Flow tests: onboarding → schedule view → request → proposal → accept.
- Offline: cache hit when network unavailable; queue replay on reconnect.

---

## 11) Performance Targets

| Metric | Target |
|---|---|
| Calendar month load (API) | <200ms p95 |
| Today card (API) | <100ms p95 |
| Base schedule generation (52 weeks) | <30s |
| Proposal generation (12 weeks, K=10) | <15s |
| Ledger/stability computation | <50ms (from snapshots) |
| ICS feed generation | <500ms |

---

## 12) Database Indexing Plan

```sql
-- Calendar queries (most frequent)
CREATE INDEX idx_overnight_family_date ON overnight_assignments (family_id, date);
CREATE INDEX idx_handoff_family_date ON handoff_events (family_id, date);

-- Active schedule lookup
CREATE UNIQUE INDEX idx_schedule_active ON base_schedule_versions (family_id) WHERE is_active = true;

-- Ledger queries
CREATE INDEX idx_ledger_family_window ON ledger_snapshots (family_id, window_type, window_end DESC);

-- Audit log
CREATE INDEX idx_audit_family_time ON audit_log (family_id, created_at DESC);

-- Request status queries
CREATE INDEX idx_request_family_status ON requests (family_id, status);

-- Share link lookup
CREATE UNIQUE INDEX idx_share_token ON share_links (token);

-- Proposal expiry job
CREATE INDEX idx_proposal_expiry ON proposal_bundles (expires_at) WHERE expires_at IS NOT NULL;
```

---

## 13) Build Phases (Aligned)

### Phase 1 — Foundations + Calendar
**Goal:** Two parents can sign up, form a family, and see a calendar.

- Auth (magic link) + JWT
- Family creation + invitation (deep links)
- React Native app shell + navigation
- Calendar month/week view component (static data)
- Manual schedule entry (admin/dev tool for testing)
- Schedule versioning + assignment storage
- Postgres schema + migrations
- CI/CD pipeline + Docker Compose dev environment
- Basic E2E: invite → accept → view calendar

### Phase 2 — Optimizer + Base Schedule
**Goal:** System generates a fair, stable base schedule from constraints.

- Constraints UI (locked nights, max streak, weekend split, transitions limit)
- Holiday calendar management
- Handoff location setup
- Python optimizer service (FastAPI + OR-Tools)
- `/generate` endpoint with solution pool
- Infeasibility detection + user-facing error messages
- Constraint conflict validation
- Store + render generated schedule
- Ledger computation (rolling windows)
- Stability metrics computation
- Fairness bar + stability bar on home screen
- Today card endpoint

### Phase 3 — Requests + Proposals
**Goal:** Parents can request exceptions and review ranked alternatives.

- Request creation UI (need coverage, want time, bonus week, swap date)
- Impact preview (before generating proposals)
- Proposal bundle generation (async via BullMQ)
- Proposal review UI (stacked cards with impact scores)
- Accept / Decline / Counter flows
- Schedule re-versioning on acceptance
- Optimistic locking (409 on version conflict)
- Audit log recording
- Notifications: proposal received, accepted, declined

### Phase 4 — Guardrails + Real-Time
**Goal:** Reduce friction with auto-approval, budgets, and live updates.

- Pre-consent rules UI + auto-approve logic
- Change budget tracking + enforcement
- Proposal expiry (background job + notifications)
- Emergency mode (activate, return-to-baseline)
- WebSocket gateway for real-time updates
- Push notifications (FCM/APNs)
- Notification preferences UI
- Fairness drift alerts
- Offline cache + outbound queue

### Phase 5 — Sharing + Exports
**Goal:** External stakeholders can view schedules; parents can export data.

- Share link creation + management
- Read-only web calendar view (public, scoped)
- ICS feed generation
- Monthly summary export (PDF or structured data)
- Caregiver role (read-only family member)
- Audit log UI (view history)

### Phase 6 — Premium + Polish
**Goal:** Advanced features for power users.

- Forecast simulator (school closures, travel overlays)
- Bonus week builder with auto-settlement plan
- Multi-child support (schema already supports it)
- Advanced analytics dashboard (stability trends over months)
- Onboarding templates + guided setup flow

---

## 14) Optimization Strategies

### 14.1 Incremental Ledger Computation
When a new schedule version is created, compute only the delta:
- Identify changed dates between old and new version.
- For each rolling window containing a changed date, recompute that window.
- Unchanged windows retain cached snapshots.

### 14.2 Optimizer Caching
- Hash the active constraint set (sorted constraint IDs + parameters).
- If hash matches a previous generation with the same horizon, return cached result.
- Cache invalidated on any constraint change.

### 14.3 Solver Warm-Start
When generating proposals:
```python
for d in horizon:
    model.AddHint(x[d], current_schedule[d])
```
This gives CP-SAT a feasible starting point, dramatically reducing solve time for incremental changes.

### 14.4 Lazy Snapshot Refresh
Snapshots store a `computed_at` timestamp and `schedule_version_id`. On read:
- If `schedule_version_id` matches active version, return cached.
- Otherwise, recompute on-demand (fast: <50ms from stored assignments).
- Background job also recomputes eagerly on version change, but lazy fallback prevents stale reads.

### 14.5 Calendar Query Optimization
Single composite endpoint returns all data for a date range in one query:
```sql
SELECT a.date, a.assigned_to, h.type, h.time_window_start, h.location_id, hol.label
FROM overnight_assignments a
LEFT JOIN handoff_events h ON h.family_id = a.family_id AND h.date = a.date
LEFT JOIN holiday_entries hol ON hol.family_id = a.family_id AND hol.date = a.date
WHERE a.family_id = $1 AND a.date BETWEEN $2 AND $3
  AND a.schedule_version_id = (SELECT id FROM base_schedule_versions WHERE family_id = $1 AND is_active)
ORDER BY a.date;
```

---

## 15) Core Domain Package (`packages/core-domain`)

A pure TypeScript domain layer with no framework dependencies. Contains the policy engine and observation subsystem.

### 15.1 Policy Engine

**Location:** `packages/core-domain/src/policy/`

#### TypedPolicyRule
```
id              string (generated)
familyId        string
ruleType        PolicyRuleType
  — enum: 'MIN_BLOCK_LENGTH' | 'ACTIVITY_COMMITMENT' | 'EXCHANGE_LOCATION' | 'SIBLING_COHESION'
priority        PolicyPriority
  — enum: 'SOFT' | 'STRONG' | 'HARD'
active          boolean
label           string
scope           { scopeType: 'FAMILY' | 'CHILD', childId?, dateStart?, dateEnd? }
parameters      Record<string, unknown>  — type-specific
sourceSuggestionId  string (optional)  — tracks origin for idempotent acceptance
createdAt       string (ISO timestamp)
updatedAt       string (ISO timestamp)
```

**Parameter schemas by rule type:**
- `MIN_BLOCK_LENGTH`: `{ nights: number }`
- `ACTIVITY_COMMITMENT`: `{ activityLabel: string, preferredResponsibleParentId: string, disruptionType?: string }`
- `EXCHANGE_LOCATION`: `{ preferredLocation: string }`
- `SIBLING_COHESION`: `{ allowDivergence: boolean }`

#### IPolicyRuleRepository
```typescript
findById(id: string): Promise<TypedPolicyRule | null>
findByFamilyId(familyId: string): Promise<TypedPolicyRule[]>
findActiveByFamilyId(familyId: string): Promise<TypedPolicyRule[]>
findBySourceSuggestionId(suggestionId: string): Promise<TypedPolicyRule | null>
save(rule: TypedPolicyRule): Promise<void>
update(rule: TypedPolicyRule): Promise<void>
delete(id: string): Promise<void>
```

### 15.2 Observation Subsystem

**Location:** `packages/core-domain/src/observations/`

#### Evidence Records
```
evidenceId      string
familyId        string
date            string (ISO date)
evidenceType    string
metadata        Record<string, unknown>
detectedBy      string (detector name)
createdAt       string (ISO timestamp)
```

#### Policy Suggestions
```
suggestionId    string
familyId        string
suggestionType  PolicySuggestionType
  — enum: 'MIN_BLOCK_LENGTH_ADJUSTMENT' | 'ACTIVITY_RESPONSIBILITY_RULE'
       | 'SIBLING_DIVERGENCE_PREFERENCE' | 'SCHOOL_CLOSURE_COVERAGE_PREFERENCE'
       | 'PREFERRED_EXCHANGE_LOCATION' | 'PREFERRED_EXCHANGE_DAY'
status          'PENDING_REVIEW' | 'ACCEPTED' | 'REJECTED'
confidenceScore number (0-1)
evidenceSummary { occurrenceCount, windowStart, windowEnd, representativeExamples[] }
proposedRuleType  string
proposedPriority  string
proposedParameters  Record<string, unknown>
proposedScope     { scopeType, childId?, dateStart?, dateEnd? }
createdAt       string (ISO timestamp)
resolvedAt      string (optional)
resolvedBy      string (optional)
```

#### Suggestion Resolution Workflow

The `PolicySuggestionResolutionWorkflow` handles accepting or rejecting suggestions:

1. Validate suggestion exists and is PENDING_REVIEW
2. On REJECT: update status to REJECTED, record resolver info
3. On ACCEPT:
   a. Check `CONVERSION_MAP` for supported suggestion → rule type mapping
   b. **Idempotency check**: query `findBySourceSuggestionId` — if rule exists from prior partial failure, reuse it
   c. If no existing rule: create `TypedPolicyRule` with `sourceSuggestionId` set
   d. Update suggestion status to ACCEPTED

**Conversion map:**
| Suggestion Type | Rule Type | Supported |
|----------------|-----------|-----------|
| MIN_BLOCK_LENGTH_ADJUSTMENT | MIN_BLOCK_LENGTH | Yes |
| ACTIVITY_RESPONSIBILITY_RULE | ACTIVITY_COMMITMENT | Yes |
| SIBLING_DIVERGENCE_PREFERENCE | SIBLING_COHESION | Yes |
| SCHOOL_CLOSURE_COVERAGE_PREFERENCE | ACTIVITY_COMMITMENT | Yes |
| PREFERRED_EXCHANGE_LOCATION | EXCHANGE_LOCATION | Yes |
| PREFERRED_EXCHANGE_DAY | — | No (throws UnsupportedSuggestionConversionError) |

### 15.3 Behavior Detectors

Six detectors registered via `DetectorRegistry`, each implementing `IBehaviorDetector`:

| Detector | Evidence Type | Output |
|----------|--------------|--------|
| MinBlockLengthDetector | Block length patterns | MIN_BLOCK_LENGTH_ADJUSTMENT suggestions |
| ActivityResponsibilityDetector | Activity handling patterns | ACTIVITY_RESPONSIBILITY_RULE suggestions |
| SiblingDivergenceDetector | Sibling schedule differences | SIBLING_DIVERGENCE_PREFERENCE suggestions |
| SchoolClosureCoverageDetector | School closure handling | SCHOOL_CLOSURE_COVERAGE_PREFERENCE suggestions |
| ExchangeLocationDetector | Exchange location usage | PREFERRED_EXCHANGE_LOCATION suggestions |
| PreferredExchangeDayDetector | Handoff day patterns | PREFERRED_EXCHANGE_DAY suggestions |

### 15.4 Test Coverage

229 tests across 12 test files in `packages/core-domain/src/observations/__tests__/`:
- 6 detector test suites
- Suggestion service integration tests
- Resolution workflow tests (accept, reject, idempotency)
- Failure path tests (partial failures, repository errors)
- Production hardening tests with DB-like detached repository doubles

---

## 16) Open Decisions (Require Product Input)

1. **Weekend definition default:** `fri_sat` (Fri + Sat overnights) or `sat_sun` (Sat + Sun)? Currently defaulting to `fri_sat`.
2. **Fairness band default:** ±1 overnight over 8 weeks. Is this right for most families?
3. **Change budget default:** 4 discretionary requests per parent per month. Too many? Too few?
4. **Proposal expiry default:** 48 hours. Should urgent requests have shorter expiry (e.g., 12h)?
5. **Bonus week frequency limit:** Should there be a max per quarter/year?
6. **Counter-proposal depth:** Can a counter be countered? Or max 1 level deep?
7. **Emergency mode constraints:** Should the other parent have to approve emergency activation, or is it unilateral with visibility?
8. **Schedule horizon:** Generate 12 weeks ahead? 26 weeks? Configurable per family?
