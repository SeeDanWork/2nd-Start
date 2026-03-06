# Deterministic Scheduling System Verification Report

Generated: 2026-03-05
Branch: Deterministic-Model-Refinement
Commit: 469eed5

This report is a structured systems audit of the ADCP (Anti-Drama Co-Parenting)
deterministic scheduling engine. Every section contains evidence snippets from
the actual codebase with file paths and line numbers.

---

# 1 System Architecture Overview

## Core Components

| Component | Primary Location | Entry Point |
|-----------|-----------------|-------------|
| Deterministic Scheduling Engine | `apps/optimizer/app/solver/base_schedule.py` | `generate_base_schedule()` |
| Proposal Solver | `apps/optimizer/app/solver/proposals.py` | `generate_proposals()` |
| Tie-Break Determinism Rules | `apps/optimizer/app/solver/tie_break.py` | `compute_tie_break_key()` |
| Relaxation Engine | `apps/optimizer/app/solver/relaxation.py` | `try_relaxation()` |
| Seasonal Weight Modes | `apps/optimizer/app/solver/seasons.py` | `apply_season_multipliers()` |
| Schedule Lever Registry | `packages/shared/src/constants.ts` | `DEFAULT_SOLVER_WEIGHTS`, `AGE_WEIGHT_MULTIPLIERS` |
| Canonical Data Model | `packages/shared/src/types.ts` | 40+ interfaces |
| Entity Schema | `apps/api/src/entities/` | 29 TypeORM entities |
| Disruption Event System | `apps/api/src/disruptions/disruptions.service.ts` | `reportDisruption()`, `computeAllOverlays()` |
| Default Disruption Policies | `packages/shared/src/disruption/default_policies.ts` | 23 event types |
| ChangeRequest Interpreter | `apps/api/src/requests/requests.service.ts` | `interpretRequest()` |
| Shared Interpreter | `packages/shared/src/interpreter/` | `interpretChangeRequest()` |
| Bootstrap Fact Interpreter | `apps/optimizer/app/bootstrap/orchestrator.py` | `process_bootstrap_request()` |
| Mediation Layer | `apps/api/src/mediation/mediation.service.ts` | `handleObjection()`, `acceptWithNotification()` |
| Proposal Generation Engine | `apps/api/src/proposals/proposals.service.ts` | `generateProposals()` |
| Guardrails System | `apps/api/src/guardrails/guardrails.service.ts` | `evaluateAutoApproval()`, `activateEmergency()` |
| Feedback System | `apps/api/src/feedback/feedback.service.ts` | `submitFeedback()`, `getAdjustedWeights()` |
| Explanation Model | `packages/shared/src/mediation/explain.ts` | `explainProposal()` |
| Pre-Conflict Prevention | `packages/shared/src/mediation/preconflict.ts` | `runPreConflictChecks()` |
| Guided Response Builder | `packages/shared/src/mediation/guided-response.ts` | `buildGuidedBundle()` |
| Notification System | `apps/api/src/notifications/notification.service.ts` | `send()` |
| WebSocket Gateway | `apps/api/src/notifications/family.gateway.ts` | 5 emit methods |
| Email Templates | `apps/api/src/email/templates/index.ts` | 14 notification types |
| Metrics Engine | `apps/api/src/metrics/metrics.service.ts` | `computeLedger()`, `computeStability()` |
| Family Context Service | `apps/api/src/family-context/family-context.service.ts` | `getContext()`, `getAdjustedWeights()` |
| Recommendations V2 | `packages/shared/src/recommendations/scoring.ts` | `recommendBaselineV2()` |
| Age Baselines | `packages/shared/src/recommendations/age_baselines.ts` | 9 fine-grained age bands |
| Simulator | `apps/simulator/` | 51 scenarios across 10 categories |
| Solver Test Suite | `apps/optimizer/tests/` | brain tests + bootstrap tests |
| Shared Test Suite | `packages/shared/tests/` | 37 files, 132+ suites |

---

# 2 Canonical Data Model Verification

## 2.1 TypeORM Entities (29 total)

### Schedule Domain

**BaseScheduleVersion** (`apps/api/src/entities/base-schedule-version.entity.ts:14-56`)
```
Fields:
  id                     uuid, PK
  familyId               uuid
  version                int
  constraintSetVersion   int
  horizonStart           date
  horizonEnd             date
  solverStatus           text
  solverMetadata         jsonb, nullable
  createdBy              text
  sourceProposalOptionId uuid, nullable
  isActive               boolean, default: true
  createdAt              timestamptz

Relations:
  OneToMany -> OvernightAssignment
  OneToMany -> HandoffEvent

Index: idx_schedule_active (familyId, isActive)
```

**OvernightAssignment** (`apps/api/src/entities/overnight-assignment.entity.ts:15-40`)
```
Fields:
  id                uuid, PK
  scheduleVersionId uuid
  familyId          uuid
  date              date
  assignedTo        text
  isTransition      boolean
  source            text, default: "generated"

Relation: ManyToOne -> BaseScheduleVersion
Index: idx_overnight_family_date (familyId, date)
Unique: [scheduleVersionId, date]
```

**HandoffEvent** (`apps/api/src/entities/handoff-event.entity.ts:13-50`)
```
Fields:
  id                uuid, PK
  scheduleVersionId uuid
  familyId          uuid
  date              date
  type              text
  timeWindowStart   time, nullable
  timeWindowEnd     time, nullable
  locationId        uuid, nullable
  fromParent        text
  toParent          text
  notes             text, nullable

Relation: ManyToOne -> BaseScheduleVersion
Index: idx_handoff_family_date (familyId, date)
```

### Request/Proposal Domain

**Request** (`apps/api/src/entities/request.entity.ts:12-51`)
```
Fields:
  id               uuid, PK
  familyId         uuid
  requestedBy      uuid
  type             text
  status           text, default: "draft"
  dates            date[]
  reasonTag        text, nullable
  reasonNote       text, nullable
  urgency          text, default: "normal"
  changeBudgetDebit int, default: 1
  expiresAt        timestamptz
  createdAt        timestamptz
  updatedAt        timestamptz

Index: idx_request_family_status (familyId, status)
```

**ProposalBundle** (`apps/api/src/entities/proposal-bundle.entity.ts:13-37`)
```
Fields:
  id               uuid, PK
  requestId        uuid
  familyId         uuid
  solverRunId      text, nullable
  generationParams jsonb, nullable
  expiresAt        timestamptz
  createdAt        timestamptz

Relation: OneToMany -> ProposalOption
Index: idx_proposal_expiry (expiresAt)
```

**ProposalOption** (`apps/api/src/entities/proposal-option.entity.ts:11-45`)
```
Fields:
  id               uuid, PK
  bundleId         uuid
  rank             int
  label            text, nullable
  calendarDiff     jsonb[]
  fairnessImpact   jsonb
  stabilityImpact  jsonb
  handoffImpact    jsonb
  penaltyScore     float
  isAutoApprovable boolean, default: false

Relation: ManyToOne -> ProposalBundle
```

**Acceptance** (`apps/api/src/entities/acceptance.entity.ts:9-30`)
```
Fields:
  id                uuid, PK
  proposalOptionId  uuid
  acceptedBy        uuid
  acceptanceType    text
  resultingVersionId uuid
  counterBundleId   uuid, nullable
  createdAt         timestamptz
```

### Feedback Domain

**UserFeedback** (`apps/api/src/entities/user-feedback.entity.ts:12-42`)
```
Fields:
  id               uuid, PK
  familyId         uuid
  userId           uuid
  requestId        uuid, nullable
  proposalOptionId uuid, nullable
  category         text
  severity         smallint
  freeText         text, nullable
  objectionRound   smallint, default: 0
  createdAt        timestamptz

Indexes:
  idx_feedback_family (familyId)
  idx_feedback_request (requestId)
```

**FeedbackProfile** (`apps/api/src/entities/feedback-profile.entity.ts:9-24`)
```
Fields:
  id                uuid, PK
  familyId          uuid, UNIQUE
  feedbackCount     int, default: 0
  accumulatedDeltas jsonb, default: '{}'
  updatedAt         timestamptz
```

### Disruption Domain

**DisruptionEvent** (`apps/api/src/entities/disruption-event.entity.ts:12-51`)
```
Fields:
  id               uuid, PK
  familyId         uuid
  type             text
  scope            text, default: "household"
  source           text, default: "user_declared"
  overrideStrength text, default: "none"
  startDate        date
  endDate          date
  metadata         jsonb, default: {}
  reportedBy       uuid, nullable
  resolvedAt       timestamptz, nullable
  createdAt        timestamptz
  updatedAt        timestamptz

Index: idx_disruption_family_dates (familyId, startDate, endDate)
```

**OverlayPolicyEntity** (`apps/api/src/entities/overlay-policy.entity.ts:12-45`)
```
Fields:
  id                  uuid, PK
  familyId            uuid, nullable
  appliesToEventType  text
  actionType          text
  defaultStrength     text
  promptingRules      jsonb, default: {}
  fairnessAccounting  jsonb, default: {}
  source              text, default: "global_default"
  isActive            boolean, default: true
  createdAt           timestamptz
  updatedAt           timestamptz

Index: idx_policy_family_event (familyId, appliesToEventType)
```

**PolicyDecisionRecord** (`apps/api/src/entities/policy-decision-record.entity.ts:11-38`)
```
Fields:
  id                uuid, PK
  familyId          uuid
  disruptionEventId uuid
  policyId          uuid
  actionTaken       text
  accepted          boolean, nullable
  decidedBy         uuid, nullable
  metadata          jsonb, default: {}
  createdAt         timestamptz

Index: idx_decision_family_event (familyId, disruptionEventId)
```

### Guardrails Domain

**PreConsentRule** (`apps/api/src/entities/pre-consent-rule.entity.ts:9-30`)
```
Fields:
  id        uuid, PK
  familyId  uuid
  createdBy uuid
  ruleType  text
  threshold jsonb
  isActive  boolean, default: true
  createdAt timestamptz
```

**ChangeBudgetLedger** (`apps/api/src/entities/change-budget-ledger.entity.ts:8-26`)
```
Fields:
  id          uuid, PK
  familyId    uuid
  userId      uuid
  month       date
  budgetLimit int
  used        int, default: 0
```

**EmergencyMode** (`apps/api/src/entities/emergency-mode.entity.ts:9-33`)
```
Fields:
  id                  uuid, PK
  familyId            uuid
  activatedBy         uuid
  activatedAt         timestamptz
  returnToBaselineAt  date
  relaxedConstraints  jsonb[], default: []
  status              text, default: "active"
  returnedAt          timestamptz, nullable
```

### Metrics Domain

**LedgerSnapshot** (`apps/api/src/entities/ledger-snapshot.entity.ts:10-46`)
```
Fields:
  id                  uuid, PK
  familyId            uuid
  scheduleVersionId   uuid
  windowType          text
  windowStart         date
  windowEnd           date
  parentAOvernights   int
  parentBOvernights   int
  parentAWeekendNights int
  parentBWeekendNights int
  withinFairnessBand  boolean
  computedAt          timestamptz

Index: idx_ledger_family_window (familyId, windowType)
```

**StabilitySnapshot** (`apps/api/src/entities/stability-snapshot.entity.ts:8-41`)
```
Fields:
  id                        uuid, PK
  familyId                  uuid
  scheduleVersionId         uuid
  windowStart               date
  windowEnd                 date
  transitionsPerWeek        float
  maxConsecutiveA           int
  maxConsecutiveB           int
  schoolNightConsistencyPct float
  weekendFragmentationCount int
  computedAt                timestamptz
```

### Supporting Entities

**User** (`apps/api/src/entities/user.entity.ts:12-45`)
```
id, email (unique), displayName, timezone, notificationPreferences (jsonb),
deviceTokens (text[]), onboardingCompleted (boolean), deletedAt, createdAt, updatedAt
```

**Family** (`apps/api/src/entities/family.entity.ts:13-52`)
```
id, name, timezone, weekendDefinition, fairnessBand (jsonb), changeBudget (jsonb),
onboardingInput (jsonb), familyContext (jsonb), status, createdAt, updatedAt
```

**FamilyMembership** (`apps/api/src/entities/family-membership.entity.ts:13-51`)
```
id, familyId, userId, role, label, inviteStatus, inviteEmail, invitedAt, acceptedAt, createdAt
```

**Child** (`apps/api/src/entities/child.entity.ts:12-34`)
```
id, familyId, firstName, dateOfBirth (date), schoolName, createdAt
```

**ConstraintSet** (`apps/api/src/entities/constraint-set.entity.ts:11-32`)
```
id, familyId, version, isActive, createdBy, createdAt
Relation: OneToMany -> Constraint
```

**Constraint** (`apps/api/src/entities/constraint.entity.ts:12-46`)
```
id, constraintSetId, type, hardness, weight, owner, recurrence (jsonb),
dateRange (jsonb), parameters (jsonb), createdAt
```

**AuditLog** (`apps/api/src/entities/audit-log.entity.ts:11-35`)
```
id (increment), familyId, actorId, action, entityType, entityId, metadata (jsonb), createdAt
Index: idx_audit_family_time (familyId, createdAt)
```

**ShareLink** (`apps/api/src/entities/share-link.entity.ts:11-41`)
```
id, familyId, createdBy, token (unique), scope, label, format, expiresAt, revokedAt, createdAt
```

**NotificationRecord** (`apps/api/src/entities/notification-record.entity.ts:8-32`)
```
id, familyId, userId, channel, type, referenceId, sentAt, deliveredAt
```

**HandoffLocation** (`apps/api/src/entities/handoff-location.entity.ts:9-33`)
```
id, familyId, name, type, address, isDefault, availableWindows (jsonb[]), createdAt
```

**HolidayCalendar** (`apps/api/src/entities/holiday-calendar.entity.ts:10-28`)
```
id, familyId, name, entries (jsonb[]), createdAt, updatedAt
```

**GoogleCalendarToken** (`apps/api/src/entities/google-calendar-token.entity.ts:10-46`)
```
id, userId (unique), accessTokenEncrypted, refreshTokenEncrypted, tokenExpiry,
googleEmail, calendarId, syncStatus, lastSyncError, lastSyncedAt, createdAt, updatedAt
```

## 2.2 Shared Type Interfaces

**File**: `packages/shared/src/types.ts`

Key interfaces with line numbers:

```
ProposalBundle          (lines 268-277)  bundleId, requestId, familyId, options[]
ProposalOption          (lines 285-296)  id, rank, label, calendarDiff[], fairnessImpact, stabilityImpact, handoffImpact, penaltyScore, isAutoApprovable
CalendarDiffEntry       (lines 298-302)  date, oldParent, newParent
FairnessImpact          (lines 304-308)  overnightDelta, weekendDelta, windowWeeks
StabilityImpact         (lines 310-314)  transitionsDelta, maxStreakChange, schoolNightChanges
HandoffImpact           (lines 316-320)  newHandoffs, removedHandoffs, nonDaycareHandoffs
BaseScheduleVersion     (lines 204-217)  id, familyId, version, horizonStart/End, solverStatus, isActive
OvernightAssignment     (lines 226-234)  id, scheduleVersionId, date, assignedTo, isTransition, source
Request                 (lines 252-266)  id, familyId, type, status, dates[], urgency, expiresAt
Acceptance              (lines 322-330)  id, proposalOptionId, acceptedBy, acceptanceType, resultingVersionId
TodayCard               (lines 432-446)  tonight, nextHandoff, fairness, stability, familyContext, pendingRequests
```

## 2.3 Mediation Types

**File**: `packages/shared/src/mediation/types.ts`

```
FeedbackCategory enum   (lines 5-11)   FAIRNESS, TRANSITIONS, INCONVENIENCE, ROUTINE, TIMING
StructuredFeedback      (lines 13-17)  category, severity (1|2|3), freeText?
WeightDelta             (lines 19-25)  fairnessDeviation, totalTransitions, nonDaycareHandoffs, weekendFragmentation, schoolNightDisruption
LabeledCalendarDiff     (lines 29-35)  date, oldParent, newParent, isRequested, isCompensation
FairnessExplanation     (lines 39-45)  fairnessDeltaText, transitionImpactText, routineImpactText, compensationSummary, overallAssessment
GuidedProposalResponse  (lines 49-57)  optionId, rank, label, explanation, labeledDiffs[], isAutoApprovable, penaltyScore
AlertType enum          (lines 61-65)  FAIRNESS_DRIFT, LONG_STRETCH, BUDGET_LOW
PreConflictAlert        (lines 67-76)  type, familyId, severity, message, metric, currentValue, thresholdValue, referenceDate
```

## 2.4 Enums (30+ total)

**File**: `packages/shared/src/enums.ts` (313 lines)

```
ParentRole              (lines 3-6)     PARENT_A, PARENT_B
RequestType             (lines 78-83)   NEED_COVERAGE, WANT_TIME, BONUS_WEEK, SWAP_DATE
RequestStatus           (lines 85-93)   DRAFT, PENDING, PROPOSALS_GENERATED, ACCEPTED, DECLINED, EXPIRED, CANCELLED
DisruptionEventType     (lines 224-249) 23 event types
OverrideStrength        (lines 263-268) NONE, LOGISTICS_ONLY, SOFT, HARD
OverlayActionType       (lines 270-276) NO_OVERRIDE, LOGISTICS_FALLBACK, BLOCK_ASSIGNMENT, DELAY_EXCHANGE, GENERATE_PROPOSALS
SolverStatus            (lines 117-122) OPTIMAL, FEASIBLE, INFEASIBLE, TIMEOUT
ConstraintType          (lines 35-44)   8 constraint types
NotificationType        (lines 199-212) 12 notification types (including OBJECTION_RECEIVED, PRECONFLICT_ALERT)
AuditAction             (lines 145-166) 20 audit actions (including FEEDBACK_SUBMITTED, OBJECTION_FILED, PROPOSALS_REGENERATED)
SeasonMode              (lines 293-297) SCHOOL_YEAR, SUMMER, HOLIDAY_PERIOD
ConsentRuleType         (lines 301-306) FAIRNESS_BAND, MAX_TRANSITIONS, MAX_STREAK, REQUEST_TYPE
```

---

# 3 Deterministic Solver Verification

## 3.1 CP-SAT Model Setup

**File**: `apps/optimizer/app/solver/base_schedule.py`

Solver initialization (lines 512-514):
```python
solver = cp_model.CpSolver()
solver.parameters.max_time_in_seconds = request.timeout_seconds
solver.parameters.num_workers = 1
```

**Critical**: `num_workers = 1` enforces single-threaded deterministic search.
OR-Tools CP-SAT is deterministic when single-threaded with no random seed manipulation.

Identical setup in proposals solver (proposals.py, lines 326-328):
```python
solver = cp_model.CpSolver()
solver.parameters.max_time_in_seconds = request.timeout_seconds
solver.parameters.num_workers = 1
```

And in brain solver (brain/solver.py, lines 329-332):
```python
solver = cp_model.CpSolver()
solver.parameters.max_time_in_seconds = timeout_seconds
# Use 1 worker for determinism
solver.parameters.num_workers = 1
```

## 3.2 Variable Creation (Deterministic Identifiers)

**File**: `apps/optimizer/app/solver/base_schedule.py` (lines 192-205)

```python
model = cp_model.CpModel()
x = {d: model.new_bool_var(f"x_{d.isoformat()}") for d in dates}
```

Variables use ISO date strings as identifiers — lexicographically ordered, deterministic.

## 3.3 Tie-Break Ordering (6-Level Lexicographic)

**File**: `apps/optimizer/app/solver/tie_break.py` (lines 17-89)

```python
def compute_tie_break_key(
    assignments: dict[date, int],
    dates: list[date],
    weekend_def: str,
    current_schedule: dict[date, int] | None = None,
    long_distance_dates: list[str] | None = None,
) -> tuple:
    """
    Levels (all minimize):
    1. Total transitions
    2. Weekend fragmentation (split weekends)
    3. Deviation from existing schedule (Hamming distance)
    4. Long-distance exchanges (transitions on long-distance dates)
    5. Stability block start index (first transition index)
    6. Binary vector ordering (tuple of assignments)
    """
```

Level 1 — Total transitions (lines 29-37):
```python
transitions = 0
prev = None
for d in dates:
    if d in assignments:
        val = assignments[d]
        if prev is not None and val != prev:
            transitions += 1
        prev = val
```

Level 2 — Weekend fragmentation (lines 39-53):
```python
weekend_groups: dict[int, set[int]] = {}
for d in dates:
    if d in assignments and is_weekend(d):
        wk = d.isocalendar()[1]
        if wk not in weekend_groups:
            weekend_groups[wk] = set()
        weekend_groups[wk].add(assignments[d])
fragmentation = sum(1 for parents in weekend_groups.values() if len(parents) > 1)
```

Level 3 — Hamming distance from existing schedule (lines 55-61):
```python
deviation = 0
if current_schedule:
    for d in dates:
        if d in assignments and d in current_schedule:
            if assignments[d] != current_schedule[d]:
                deviation += 1
```

Level 4 — Long-distance exchanges (lines 63-73):
```python
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
```

Level 5 — Stability block start (lines 75-84):
```python
first_transition_idx = len(dates)
prev = None
for i, d in enumerate(dates):
    if d in assignments:
        val = assignments[d]
        if prev is not None and val != prev:
            first_transition_idx = i
            break
        prev = val
```

Level 6 — Binary vector lexicographic order (line 87):
```python
binary_vector = tuple(assignments.get(d, 0) for d in dates)
```

Integration in solution sorting (base_schedule.py, lines 681-696):
```python
solutions.sort(key=lambda s: (s.penalties.total, s._tie_break))
for i, s in enumerate(solutions):
    s.rank = i + 1
```

Deterministic Python tuple comparison on (total_penalty, 6-level_tie_break).

## 3.4 Solution Collection (No Random Sampling)

**File**: `apps/optimizer/app/solver/base_schedule.py` (lines 49-64)

```python
class SolutionCollector(cp_model.CpSolverSolutionCallback):
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
```

Solutions collected in solver discovery order. No random sampling, no shuffling.

Diversity filtering (lines 540-552):
```python
diverse: list[dict[date, int]] = []
for sol in raw_solutions:
    if all(_hamming_distance(sol, existing) >= 2 for existing in diverse):
        diverse.append(sol)
```

Processes solutions in collector order. No shuffling, no random selection.

## 3.5 No Randomness Evidence

Search results across the entire optimizer codebase:
```
random.X functions:    0 matches
shuffle:               0 matches
numpy.random:          0 matches
randint, choice:       0 matches
random_seed:           0 matches
```

`time.time()` is used only for elapsed time measurement (lines 198, 519), not for
any algorithmic decisions. `uuid.uuid4()` appears only in brain/heuristic.py for
option metadata IDs — not for scheduling logic.

## 3.6 Constraint Processing Order

**File**: `apps/optimizer/app/solver/base_schedule.py` (lines 222-345)

Hard constraints processed in fixed order:
```
1. Disruption locks         (lines 224-231)
2. Locked nights            (lines 233-244)
3. Max consecutive nights   (lines 246-260)
4. Min consecutive nights   (lines 262-315)
5. Max transitions/week     (lines 317-329)
6. Weekend split bounds     (lines 331-344)
```

All constraints are additive to the CP-SAT model. Order does not affect
feasibility but is consistent and predictable.

DOW conversion (line 239):
```python
py_dow = d.weekday()   # 0=Mon ... 6=Sun
js_dow = (py_dow + 1) % 7  # JS: 0=Sun...6=Sat
```

Mathematical modulo arithmetic — deterministic.

---

# 4 Schedule Lever Registry

## 4.1 Default Solver Weights

**File**: `packages/shared/src/constants.ts` (lines 23-31)

```typescript
export const DEFAULT_SOLVER_WEIGHTS = {
  fairnessDeviation: 100,
  totalTransitions: 50,
  nonDaycareHandoffs: 30,
  weekendFragmentation: 40,
  schoolNightDisruption: 60,
};
```

## 4.2 Age-Adjusted Multipliers

**File**: `packages/shared/src/constants.ts` (lines 33-64)

```typescript
export const AGE_WEIGHT_MULTIPLIERS: Record<string, Record<string, number>> = {
  infant: {
    fairnessDeviation: 0.6,
    totalTransitions: 2.0,
    nonDaycareHandoffs: 1.5,
    weekendFragmentation: 0.5,
    schoolNightDisruption: 0.3,
  },
  young_child: {
    fairnessDeviation: 0.8,
    totalTransitions: 1.5,
    nonDaycareHandoffs: 1.3,
    weekendFragmentation: 0.8,
    schoolNightDisruption: 0.6,
  },
  school_age: {
    fairnessDeviation: 1.0,
    totalTransitions: 1.0,
    nonDaycareHandoffs: 1.0,
    weekendFragmentation: 1.0,
    schoolNightDisruption: 1.0,
  },
  teen: {
    fairnessDeviation: 1.2,
    totalTransitions: 0.7,
    nonDaycareHandoffs: 0.8,
    weekendFragmentation: 1.2,
    schoolNightDisruption: 1.3,
  },
};
```

## 4.3 Living Arrangement Multipliers

**File**: `packages/shared/src/constants.ts` (lines 66-72)

```typescript
export const LIVING_ARRANGEMENT_WEIGHT_MULTIPLIERS: Record<string, Record<string, number>> = {
  shared:          { fairnessDeviation: 1.0, totalTransitions: 1.0, ... },
  primary_visits:  { fairnessDeviation: 0.5, totalTransitions: 1.5, ... },
  undecided:       { fairnessDeviation: 1.0, totalTransitions: 1.0, ... },
};
```

## 4.4 Seasonal Multipliers

**File**: `apps/optimizer/app/solver/seasons.py` (lines 50-68)

```python
SEASON_WEIGHT_MULTIPLIERS: dict[SeasonMode, dict[str, float]] = {
    SeasonMode.SCHOOL_YEAR: {
        "fairness_deviation": 1.0,
        "total_transitions": 1.0,
        ...
    },
    SeasonMode.SUMMER: {
        "fairness_deviation": 1.3,
        "total_transitions": 0.8,
        ...
    },
    SeasonMode.HOLIDAY_PERIOD: {
        "fairness_deviation": 1.5,
        ...
    },
}

def apply_season_multipliers(weights: SolverWeights, mode: SeasonMode) -> SolverWeights:
    multipliers = SEASON_WEIGHT_MULTIPLIERS[mode]
    return SolverWeights(
        fairness_deviation=int(round(weights.fairness_deviation * multipliers["fairness_deviation"])),
        ...
    )
```

All weight computation is deterministic floating-point arithmetic, rounded to int.

## 4.5 Solver Penalty Functions

**File**: `apps/optimizer/app/solver/base_schedule.py` (lines 346-507)

10 penalty functions, all with fixed weights:

| Penalty | Lines | Weight Source |
|---------|-------|-------------|
| Fairness deviation | 367-373 | `w.fairness_deviation` |
| Total transitions | 375-378 | `w.total_transitions` |
| Non-daycare handoffs | 381-389 | `w.non_daycare_handoffs` |
| Weekend fragmentation | 391-410 | `w.weekend_fragmentation` |
| School-night disruption | 412-415 | `w.school_night_disruption` |
| Handoff location pref | 417-426 | `w.handoff_location_preference` |
| Template alignment | 428-447 | `w.template_alignment` |
| Short block penalty | 449-461 | `w.short_block_penalty` |
| Weekly rhythm | 463-490 | `w.weekly_rhythm_weight` |
| Routine consistency | 492-506 | `w.routine_consistency_weight` |

## 4.6 Solver Precedence Hierarchy

**File**: `packages/shared/src/constants.ts` (lines 103-120)

```typescript
export const SOLVER_PRECEDENCE_HIERARCHY = [
  { tier: 1, name: 'Hard Constraints',       items: ['locked_nights', 'max_consecutive', 'disruption_locks'] },
  { tier: 2, name: 'Fairness Target',        items: ['fairness_deviation', 'weekend_split'] },
  { tier: 3, name: 'Stability Preferences',  items: ['total_transitions', 'max_transitions_per_week'] },
  { tier: 4, name: 'Routine Consistency',     items: ['school_night_disruption', 'routine_consistency'] },
  { tier: 5, name: 'Weekend Quality',        items: ['weekend_fragmentation', 'short_block_penalty'] },
  { tier: 6, name: 'Template Alignment',     items: ['template_alignment', 'weekly_rhythm'] },
  { tier: 7, name: 'Logistics Optimization', items: ['non_daycare_handoffs', 'handoff_location_preference'] },
];
```

## 4.7 Multi-Child Weight Aggregation

**File**: `apps/optimizer/app/brain/profiles.py` (lines 182-277)

```python
def aggregate_multi_child_weights(base_weights, age_bands):
    # Stability categories: MAX across children
    # Fairness categories: weighted average (young 0.5x, teen 1.5x)
    age_multipliers = {
        "0-4":  {"fairness_deviation": 0.7, "total_transitions": 2.0, ...},
        "5-10": {"fairness_deviation": 1.0, "total_transitions": 1.0, ...},
        "11-17": {"fairness_deviation": 1.5, "total_transitions": 0.7, ...},
    }
```

Deterministic: MAX for stability, weighted average for fairness. No randomness.

---

# 5 Disruption Event System

## 5.1 Event Types (23 total)

**File**: `packages/shared/src/enums.ts` (lines 224-249)

```
PUBLIC_HOLIDAY, SCHOOL_CLOSED, SCHOOL_HALF_DAY, EMERGENCY_CLOSURE,
CHILD_SICK, CAREGIVER_SICK, PARENT_TRAVEL, TRANSPORT_FAILURE,
FAMILY_EVENT, CAMP_WEEK, BREAK, SUMMER_PERIOD, OTHER_DECLARED,
WORK_SHIFT_CHANGE, EMERGENCY_WORK_CALL, HOSPITALIZATION,
SCHOOL_TRIP, HOLIDAY_TRAVEL, WEATHER_EMERGENCY, FLIGHT_DELAY,
FUNERAL, POWER_OUTAGE, HOME_REPAIR
```

## 5.2 Default Policy Table (Deterministic Resolution)

**File**: `packages/shared/src/disruption/default_policies.ts` (lines 62-252)

Each of 23 event types maps to a fixed policy:
```
CHILD_SICK       -> DELAY_EXCHANGE,     SOFT,           compensatory (3 max days)
CAREGIVER_SICK   -> BLOCK_ASSIGNMENT,   HARD,           compensatory
PARENT_TRAVEL    -> BLOCK_ASSIGNMENT,   HARD,           compensatory
SCHOOL_CLOSED    -> LOGISTICS_FALLBACK, LOGISTICS_ONLY, auto-prompting
SUMMER_PERIOD    -> GENERATE_PROPOSALS, SOFT,           compensatory
PUBLIC_HOLIDAY   -> LOGISTICS_FALLBACK, LOGISTICS_ONLY, auto-prompting
EMERGENCY_CLOSURE-> BLOCK_ASSIGNMENT,   HARD,           compensatory
```

## 5.3 Illness Decision Tree

**File**: `packages/shared/src/disruption/default_policies.ts` (lines 278-289)

```typescript
export function resolveIllnessAction(
  durationHours: number,
  isExchangeDay: boolean,
): OverlayActionType {
  if (durationHours <= 72) {
    if (isExchangeDay) return OverlayActionType.DELAY_EXCHANGE;
    return OverlayActionType.NO_OVERRIDE;
  }
  return OverlayActionType.GENERATE_PROPOSALS;
}
```

Deterministic: same duration + exchange day = same action.

## 5.4 Solver Overlay Integration

**File**: `apps/api/src/disruptions/disruptions.service.ts` (lines 233-268)

```typescript
async computeAllOverlays(familyId, currentAssignments): Promise<SolverPayloadOverlay> {
  const events = await this.getActiveDisruptions(familyId);
  const policies = await this.getOverlayPolicies(familyId);

  for (const event of events) {
    const resolved = resolvePolicy(event.type, policies);
    const overlay = computeOverlay(event, resolved, currentAssignments);
    overlays.push(overlay);
  }

  return toSolverPayload(overlays);
  // Returns: { disruption_locks: [], weight_adjustments: {}, disruption_context: [] }
}
```

Weight adjustments applied in schedule generation (schedules.service.ts, lines 275-282):
```typescript
const finalWeights = { ...adjustedWeights };
for (const [key, multiplier] of Object.entries(disruptionOverlay.weight_adjustments)) {
  const camelKey = key as keyof typeof finalWeights;
  if (camelKey in finalWeights) {
    finalWeights[camelKey] = Math.round(finalWeights[camelKey] * multiplier);
  }
}
```

## 5.5 Policy Learning

**File**: `apps/api/src/disruptions/disruptions.service.ts` (lines 306-373)

Promotion eligibility check:
```typescript
async checkPromotionEligibility(familyId, eventType): Promise<PromotionEligibility> {
  const records = await this.decisionRepo.find({ where: { familyId } });
  const filtered = records.filter(r => eventIds.has(r.disruptionEventId));
  return evaluateForPromotion(eventType, filtered);
  // Threshold: 2 consecutive acceptances -> eligible
}
```

---

# 6 Bootstrap Scheduling Verification

## 6.1 Bootstrap Models

**File**: `apps/optimizer/app/bootstrap/models.py` (lines 48-108)

```python
class BootstrapFacts(BaseModel):
    current_parent: str | None = None
    current_parent_confidence: float | None = None
    locked_ranges: list[LockedRange] = []
    recurring_patterns: list[RecurringPattern] = []
    exchange_anchors: list[ExchangeAnchor] = []
    target_split_pct: float | None = None

class BootstrapScheduleRequest(BaseModel):
    reference_date: str
    horizon_start: str | None = None
    horizon_end: str | None = None
    facts: BootstrapFacts
    already_asked: list[str] = []

class BootstrapScheduleResponse(BaseModel):
    schedule: BaseScheduleResponse
    clarifications: list[ClarificationPrompt]
    conflicts: list[ConflictDescription]
    discovery_questions: list[DiscoveryQuestion]
    stabilization: StabilizationSuggestion | None
    applied_facts_count: int
    ignored_facts_count: int
```

## 6.2 8-Step Orchestration Pipeline

**File**: `apps/optimizer/app/bootstrap/orchestrator.py` (lines 17-108)

```python
def process_bootstrap_request(request: BootstrapScheduleRequest) -> BootstrapScheduleResponse:
    # Step 1: Resolve horizon (default 14 days)
    horizon_start, horizon_end = resolve_horizon(request)

    # Step 2: Clamp facts to horizon
    clamped_facts = resolve_dates(request.facts, horizon_start, horizon_end)

    # Step 3: Detect contradictions
    conflicts = validate_consistency(clamped_facts, reference_date, horizon_start, horizon_end)

    # Step 4: Partition by confidence (HIGH >= 0.8, MEDIUM >= 0.5, LOW dropped)
    high_facts, medium_facts, clarifications = filter_by_confidence(clamped_facts)

    # Step 5: Convert facts to ScheduleRequest
    schedule_request = facts_to_schedule_request(high_facts, reference_date, horizon_start, horizon_end)

    # Step 6: Call existing deterministic solver
    schedule_response = generate_base_schedule(schedule_request)

    # Step 7: Post-processing (stabilization + discovery)
    stabilization = detect_template_match(schedule_response)
    discovery = get_next_discovery_question(request.facts, request.already_asked)

    # Step 8: Return response with all metadata
    return BootstrapScheduleResponse(...)
```

## 6.3 Confidence Filtering

**File**: `apps/optimizer/app/bootstrap/validator.py` (lines 18-140)

```python
CONFIDENCE_HIGH = 0.8
CONFIDENCE_MEDIUM = 0.5

def filter_by_confidence(facts):
    # HIGH (>= 0.8): applied directly to solver
    # MEDIUM (>= 0.5): generates clarification prompt
    # LOW (< 0.5): dropped entirely
```

## 6.4 Conflict Detection (4 types)

**File**: `apps/optimizer/app/bootstrap/validator.py` (lines 143-282)

```
1. Date overlap:          Two locked ranges assign different parents to overlapping dates
2. Recurring conflict:    Two patterns assign different parents to same DOW
3. Range vs recurring:    Locked range contradicts recurring pattern in horizon
4. Current parent vs range: Current parent contradicts range covering reference date
```

## 6.5 Facts-to-Solver Conversion

**File**: `apps/optimizer/app/bootstrap/converter.py` (lines 20-153)

```python
def facts_to_schedule_request(facts, reference_date, horizon_start, horizon_end):
    # current_parent       -> DisruptionLock for reference_date
    # locked_ranges        -> DisruptionLock per day in range
    # ALTERNATING_WEEKS    -> template_id="7on7off" + first-week locks
    # WEEKENDS/WEEKDAYS    -> LockedNight constraints
    # exchange_anchors     -> preferred_handoff_days + location weight
    # target_split_pct     -> WeekendSplit constraint

    # Deduplication by (date, parent) key
    seen_locks = set()
    deduped = []
    for lock in disruption_locks:
        key = (lock.date, lock.parent)
        if key not in seen_locks:
            seen_locks.add(key)
            deduped.append(lock)
```

## 6.6 Template Stabilization

**File**: `apps/optimizer/app/bootstrap/stabilizer.py` (lines 13-84)

```python
ADHERENCE_THRESHOLD = 0.85

def detect_template_match(response):
    assignments = response.solutions[0].assignments
    binary = [0 if a.parent == "parent_a" else 1 for a in sorted_assignments]

    for template_id, pattern in TEMPLATES.items():
        for offset in range(len(pattern)):
            deviations = sum(1 for i, val in enumerate(binary)
                           if val != pattern[(i + offset) % len(pattern)])
            adherence = 1 - (deviations / len(binary))
            # Best by: (adherence DESC, cycle_length ASC, template_id ASC)

    if best_adherence >= ADHERENCE_THRESHOLD:
        return StabilizationSuggestion(template_id, name, adherence_score, recommendation)
```

Deterministic: templates iterated in insertion order, ties broken by template_id.

## 6.7 Discovery Questions

**File**: `apps/optimizer/app/bootstrap/discovery.py` (lines 12-100)

6 fixed questions with priorities:
```python
_QUESTION_CATALOG = [
    ("weekend_pattern",      priority=10),
    ("weekday_primary",      priority=20),
    ("target_balance",       priority=30),
    ("exchange_logistics",   priority=40),
    ("special_constraints",  priority=50),
    ("flexibility",          priority=60),
]
```

Skips questions already answered by facts or already asked. Always returns
highest-priority unanswered question.

---

# 7 Mediation Layer Verification

## 7.1 Mediation Service

**File**: `apps/api/src/mediation/mediation.service.ts`

### getGuidedProposals (lines 53-72)

```typescript
async getGuidedProposals(familyId, requestId): Promise<GuidedProposalResponse[]> {
  const bundle = await this.bundleRepo.findOne({
    where: { requestId, familyId },
    relations: ['options'],
    order: { createdAt: 'DESC' },
  });
  const requestDates = request.dates;
  return buildGuidedBundle(bundle.options, requestDates);
}
```

### handleObjection (lines 77-150)

```typescript
async handleObjection(familyId, requestId, userId, feedbacks, declinedOptionIds) {
  // 1. Check MAX_OBJECTION_ROUNDS limit
  const round = await this.feedbackService.getObjectionRound(requestId);
  if (round >= MAX_OBJECTION_ROUNDS) throw BadRequest;

  // 2. Submit feedback with round number
  await this.feedbackService.submitFeedback(familyId, userId, feedbacks, {
    requestId, objectionRound: round + 1
  });

  // 3. Reset request to PENDING
  await this.requestRepo.update(requestId, { status: RequestStatus.PENDING });

  // 4. Regenerate proposals (feedback-adjusted weights applied automatically)
  const bundle = await this.proposalsService.generateProposals(familyId, requestId, userId);

  // 5. Audit OBJECTION_FILED
  // 6. Notify other parent
  // 7. Emit WebSocket
}
```

### acceptWithNotification (lines 155-184)

```typescript
async acceptWithNotification(familyId, optionId, userId) {
  const result = await this.proposalsService.acceptProposal(familyId, optionId, userId);
  // Notify other parent of acceptance
  // Emit WebSocket: schedule_updated + proposal_accepted
}
```

## 7.2 Mediation Controller Endpoints

**File**: `apps/api/src/mediation/mediation.controller.ts`

```
GET  /families/:familyId/mediation/proposals/:requestId   -> getGuidedProposals
POST /families/:familyId/mediation/accept                 -> acceptWithNotification
POST /families/:familyId/mediation/decline                -> declineWithFeedback
POST /families/:familyId/mediation/objection              -> handleObjection
POST /families/:familyId/mediation/feedback               -> submitFeedback
GET  /families/:familyId/mediation/feedback-profile       -> getProfile
GET  /families/:familyId/mediation/alerts                 -> checkFamily (pre-conflict)
POST /mediation/cron/daily                                -> runDailyCheck
```

---

# 8 Compensation-First Rule Verification

## 8.1 Calendar Diff Labeling

**File**: `packages/shared/src/mediation/compensation.ts` (lines 9-22)

```typescript
export function labelCalendarDiffs(
  calendarDiff: CalendarDiffEntry[],
  requestDates: string[],
): LabeledCalendarDiff[] {
  const requestDateSet = new Set(requestDates);

  return calendarDiff.map((entry) => ({
    date: entry.date,
    oldParent: entry.oldParent as ParentRole,
    newParent: entry.newParent as ParentRole,
    isRequested: requestDateSet.has(entry.date),
    isCompensation: !requestDateSet.has(entry.date),
  }));
}
```

Any date in the solver's calendar diff that is NOT in the original request dates
is automatically labeled as compensation. The solver generates these compensation
dates to maintain fairness balance.

## 8.2 Compensation Summary in Explanation

**File**: `packages/shared/src/mediation/explain.ts` (lines 133-159)

```typescript
export function describeCompensation(labeledDiffs: LabeledCalendarDiff[]): string | null {
  const compensationDiffs = labeledDiffs.filter((d) => d.isCompensation);
  if (compensationDiffs.length === 0) return null;

  const dates = compensationDiffs.map((d) => d.date).sort();
  const recipient = compensationDiffs[0].newParent === 'parent_a' ? 'Parent A' : 'Parent B';

  if (dates.length === 1) {
    return `Compensation: ${recipient} receives ${dates[0]}.`;
  }

  // Check if dates are contiguous
  const isContiguous = dates.every((date, i) => {
    if (i === 0) return true;
    const prev = new Date(dates[i - 1] + 'T00:00:00Z');
    const curr = new Date(date + 'T00:00:00Z');
    return curr.getTime() - prev.getTime() === 86400000;
  });

  if (isContiguous) {
    return `Compensation: ${recipient} receives ${dates[0]} to ${dates[dates.length - 1]}.`;
  }

  return `Compensation: ${recipient} receives ${dates.join(', ')}.`;
}
```

## 8.3 Proposal Generation with Compensation

**File**: `apps/api/src/proposals/proposals.service.ts` (lines 218-230)

The solver is called with frozen_assignments (existing schedule) plus the
request constraint (which dates the requesting parent wants). The solver
automatically generates compensation dates to maintain fairness within the
configured fairness band.

Each returned option includes:
```
calendarDiff[]     — all changed dates
fairnessImpact     — overnightDelta, weekendDelta, windowWeeks
stabilityImpact    — transitionsDelta, maxStreakChange, schoolNightChanges
handoffImpact      — newHandoffs, removedHandoffs, nonDaycareHandoffs
```

The Guided Response builder then labels which diffs are requested vs compensation.

---

# 9 Fairness Transparency Verification

## 9.1 Explanation Model

**File**: `packages/shared/src/mediation/explain.ts` (lines 7-34)

```typescript
export function explainProposal(
  fairnessImpact: FairnessImpact,
  stabilityImpact: StabilityImpact,
  handoffImpact: HandoffImpact,
  labeledDiffs: LabeledCalendarDiff[],
): FairnessExplanation {
  return {
    fairnessDeltaText: describeFairnessDelta(
      fairnessImpact.overnightDelta,
      fairnessImpact.weekendDelta,
      fairnessImpact.windowWeeks,
    ),
    transitionImpactText: describeTransitionImpact(
      stabilityImpact.transitionsDelta,
      stabilityImpact.maxStreakChange,
      stabilityImpact.schoolNightChanges,
    ),
    routineImpactText: describeRoutineImpact(
      handoffImpact,
      stabilityImpact.schoolNightChanges,
    ),
    compensationSummary: describeCompensation(labeledDiffs),
    overallAssessment: assessOverall(
      fairnessImpact.overnightDelta,
      stabilityImpact.transitionsDelta,
    ),
  };
}
```

## 9.2 Fairness Delta Description

**File**: `packages/shared/src/mediation/explain.ts` (lines 39-67)

```typescript
export function describeFairnessDelta(overnightDelta, weekendDelta, windowWeeks): string {
  if (overnightDelta === 0 && weekendDelta === 0) {
    return 'No change to overnight or weekend balance.';
  }

  if (overnightDelta !== 0) {
    const direction = overnightDelta > 0 ? '+' : '';
    const who = overnightDelta > 0 ? 'Parent A' : 'Parent B';
    parts.push(`${who} ${direction}${overnightDelta} night${nights !== 1 ? 's' : ''}`);
  }

  if (weekendDelta !== 0) {
    parts.push(`weekend balance ${direction}${weekendDelta}`);
  }

  const suffix = windowWeeks > 0
    ? `. Balance measured over ${windowWeeks}-week window.`
    : '.';

  return parts.join(', ') + suffix;
}
```

Example output:
```
Parent A +1 night. Balance measured over 8-week window.
```

## 9.3 Transition Impact Description

**File**: `packages/shared/src/mediation/explain.ts` (lines 72-98)

```typescript
export function describeTransitionImpact(transitionsDelta, maxStreakChange, schoolNightChanges): string {
  if (transitionsDelta === 0 && maxStreakChange === 0 && schoolNightChanges === 0) {
    return 'No additional transitions.';
  }
  // "Adds 2 transitions; longest streak increases by 1; 3 school nights affected."
}
```

## 9.4 Overall Assessment

**File**: `packages/shared/src/mediation/explain.ts` (lines 164-174)

```typescript
export function assessOverall(overnightDelta, transitionsDelta):
  'favorable' | 'neutral' | 'unfavorable' {
  const fairnessImpact = Math.abs(overnightDelta);
  const totalImpact = fairnessImpact + Math.max(0, transitionsDelta);

  if (totalImpact === 0) return 'favorable';
  if (totalImpact <= 2) return 'neutral';
  return 'unfavorable';
}
```

## 9.5 Guided Proposal Response (Full Output)

**File**: `packages/shared/src/mediation/guided-response.ts` (lines 9-43)

```typescript
export function buildGuidedResponse(option, requestDates): GuidedProposalResponse {
  const labeledDiffs = labelCalendarDiffs(option.calendarDiff, requestDates);
  const explanation = explainProposal(
    option.fairnessImpact, option.stabilityImpact, option.handoffImpact, labeledDiffs,
  );

  return {
    optionId: option.id,
    rank: option.rank,
    label: option.label || `Option ${option.rank}`,
    explanation,        // FairnessExplanation
    labeledDiffs,       // LabeledCalendarDiff[]
    isAutoApprovable: option.isAutoApprovable,
    penaltyScore: option.penaltyScore,
  };
}
```

Example output structure:
```
Option A
Extend holiday until Monday

Fairness:
  Parent A +1 night. Balance measured over 8-week window.

Transitions:
  No additional transitions.

Routine:
  No school night changes.

Compensation:
  Compensation: Parent B receives 2026-01-10 to 2026-01-11.

Assessment: neutral
```

---

# 10 Subjective Feedback System

## 10.1 Feedback Categories and Weight Mapping

**File**: `packages/shared/src/mediation/feedback-weights.ts` (lines 7-31)

```typescript
const FEEDBACK_WEIGHT_MAP: Record<FeedbackCategory, {
  targetWeight: keyof WeightDelta;
  severityDeltas: Record<1 | 2 | 3, number>;
}> = {
  [FeedbackCategory.FAIRNESS]: {
    targetWeight: 'fairnessDeviation',
    severityDeltas: { 1: 5, 2: 10, 3: 20 },
  },
  [FeedbackCategory.TRANSITIONS]: {
    targetWeight: 'totalTransitions',
    severityDeltas: { 1: 4, 2: 8, 3: 15 },
  },
  [FeedbackCategory.ROUTINE]: {
    targetWeight: 'schoolNightDisruption',
    severityDeltas: { 1: 3, 2: 6, 3: 12 },
  },
  [FeedbackCategory.INCONVENIENCE]: {
    targetWeight: 'weekendFragmentation',
    severityDeltas: { 1: 3, 2: 5, 3: 10 },
  },
  [FeedbackCategory.TIMING]: {
    targetWeight: 'fairnessDeviation',
    severityDeltas: { 1: 0, 2: 0, 3: 0 },  // metadata only
  },
};
```

| Feedback | Severity 1 | Severity 2 | Severity 3 | Target Weight |
|----------|-----------|-----------|-----------|--------------|
| "Feels unfair" | +5 | +10 | +20 | fairnessDeviation |
| "Too many transitions" | +4 | +8 | +15 | totalTransitions |
| "Routine disruption" | +3 | +6 | +12 | schoolNightDisruption |
| "Inconvenient" | +3 | +5 | +10 | weekendFragmentation |
| "Bad timing" | +0 | +0 | +0 | (metadata only) |

## 10.2 Delta Computation

**File**: `packages/shared/src/mediation/feedback-weights.ts` (lines 50-67)

```typescript
export function computeFeedbackDelta(feedbacks: StructuredFeedback[]): WeightDelta {
  const delta = emptyWeightDelta();

  for (const fb of feedbacks) {
    const mapping = FEEDBACK_WEIGHT_MAP[fb.category];
    if (!mapping) continue;
    const increment = mapping.severityDeltas[fb.severity] || 0;
    delta[mapping.targetWeight] += increment;
  }

  // Cap each dimension at MAX_FEEDBACK_DELTA_PER_WEIGHT (50)
  for (const key of Object.keys(delta) as (keyof WeightDelta)[]) {
    delta[key] = Math.min(delta[key], MAX_FEEDBACK_DELTA_PER_WEIGHT);
  }

  return delta;
}
```

## 10.3 Weight Application

**File**: `packages/shared/src/mediation/feedback-weights.ts` (lines 73-86)

```typescript
export function applyFeedbackToWeights(
  baseWeights: Record<string, number>,
  delta: WeightDelta,
): Record<string, number> {
  const result = { ...baseWeights };
  for (const key of Object.keys(delta) as (keyof WeightDelta)[]) {
    if (key in result) {
      result[key] = Math.max(0, Math.min(500, result[key] + delta[key]));
    }
  }
  return result;
}
```

Weights clamped to [0, 500] per dimension.

## 10.4 Feedback Service (API)

**File**: `apps/api/src/feedback/feedback.service.ts` (lines 29-134)

```typescript
async submitFeedback(familyId, userId, feedbacks, opts?) {
  // 1. Save individual UserFeedback records
  // 2. Compute delta via computeFeedbackDelta()
  // 3. Upsert FeedbackProfile via accumulateDeltas()
  // 4. Audit FEEDBACK_SUBMITTED
  return { feedbackIds, profile };
}

async getAdjustedWeights(familyId, baseWeights) {
  // 1. Get accumulated deltas from FeedbackProfile
  // 2. Call applyFeedbackToWeights(baseWeights, deltas)
  return adjustedWeights;
}
```

## 10.5 Integration in Proposal Generation

**File**: `apps/api/src/proposals/proposals.service.ts` (lines 174-185)

```typescript
// Apply feedback-adjusted weights
const feedbackProfile = await this.feedbackService.getProfile(familyId);
const adjustedWeights = feedbackProfile
  ? this.feedbackService.getAdjustedWeights(familyId, baseWeights)
  : baseWeights;

// Then apply disruption multipliers on top
for (const [key, multiplier] of Object.entries(disruptionOverlay.weight_adjustments)) {
  adjustedWeights[key] = Math.round(adjustedWeights[key] * multiplier);
}
```

Weight pipeline: DEFAULT_SOLVER_WEIGHTS -> age multipliers -> living arrangement
multipliers -> feedback deltas -> disruption multipliers -> solver.

---

# 11 Pre-Conflict Prevention

## 11.1 Fairness Drift Monitoring

**File**: `packages/shared/src/mediation/preconflict.ts` (lines 10-49)

```typescript
export function checkFairnessDrift(
  parentANights, parentBNights, windowWeeks, maxDelta, refDate, familyId,
  warningFraction = FAIRNESS_DRIFT_WARNING_FRACTION,  // 0.75
): PreConflictAlert | null {
  const currentDelta = Math.abs(parentANights - parentBNights);
  const warningThreshold = maxDelta * warningFraction;

  if (currentDelta >= maxDelta) {
    return { type: AlertType.FAIRNESS_DRIFT, severity: 'critical',
      message: `Overnight balance has exceeded the fairness band: ${currentDelta}-night difference...` };
  }
  if (currentDelta >= warningThreshold) {
    return { type: AlertType.FAIRNESS_DRIFT, severity: 'warning',
      message: `Overnight balance is approaching the fairness limit...` };
  }
  return null;
}
```

## 11.2 Long Stretch Detection

**File**: `packages/shared/src/mediation/preconflict.ts` (lines 54-88)

```typescript
export function checkLongStretch(maxConsecutiveCurrent, maxConsecutiveAllowed, refDate, familyId) {
  if (maxConsecutiveCurrent >= maxConsecutiveAllowed) {
    return { type: AlertType.LONG_STRETCH, severity: 'critical', ... };
  }
  if (maxConsecutiveCurrent >= maxConsecutiveAllowed - 1) {
    return { type: AlertType.LONG_STRETCH, severity: 'warning', ... };
  }
  return null;
}
```

## 11.3 Budget Low Detection

**File**: `packages/shared/src/mediation/preconflict.ts` (lines 93-132)

```typescript
export function checkBudgetLow(
  used, limit, familyId, refDate,
  warningFraction = BUDGET_LOW_WARNING_FRACTION,  // 0.75
) {
  if (remaining <= 0) return { severity: 'critical', ... };
  if (usedFraction >= warningFraction) return { severity: 'warning', ... };
  return null;
}
```

## 11.4 Aggregated Pre-Conflict Check

**File**: `packages/shared/src/mediation/preconflict.ts` (lines 137-178)

```typescript
export function runPreConflictChecks(params): PreConflictAlert[] {
  const alerts: PreConflictAlert[] = [];
  const fairness = checkFairnessDrift(...);
  if (fairness) alerts.push(fairness);
  const stretch = checkLongStretch(...);
  if (stretch) alerts.push(stretch);
  const budget = checkBudgetLow(...);
  if (budget) alerts.push(budget);
  return alerts;
}
```

## 11.5 Pre-Conflict Service (API)

**File**: `apps/api/src/mediation/preconflict.service.ts` (lines 34-132)

```typescript
async checkFamily(familyId, referenceDate): Promise<PreConflictAlert[]> {
  // 1. Get 8-week ledger (overnight balance)
  // 2. Get 2-week stability (max consecutive)
  // 3. Get budget status
  // 4. Get age-aware maxConsecutive from familyContextService
  // 5. Call shared runPreConflictChecks()
  return alerts;
}

async runDailyCheck(familyId) {
  const alerts = await this.checkFamily(familyId, today);
  await this.notifyAlerts(familyId, alerts);
  return { familyId, alerts };
}
```

## 11.6 Email Notifications

**File**: `apps/api/src/email/templates/preconflict-alert.ts`

```typescript
function renderPreConflictAlert(data: { message, severity, metric }) {
  const severityLabel = data.severity === 'critical' ? 'Action Needed' : 'Heads Up';
  return {
    subject: `${severityLabel}: Schedule alert`,
    html: `<h2>${severityLabel}</h2><p>${data.message}</p>...`,
  };
}
```

---

# 12 Deterministic Mediation Verification

## 12.1 Shared Layer Determinism Test

**File**: `packages/shared/tests/mediation/determinism.test.ts` (lines 16-84)

```typescript
describe('Deterministic mediation outcomes', () => {
  test('computeFeedbackDelta: same input = same output', () => {
    const input = [{ category: FeedbackCategory.FAIRNESS, severity: 2 }];
    const result1 = computeFeedbackDelta(input);
    const result2 = computeFeedbackDelta(input);
    expect(result1).toEqual(result2);
  });

  test('applyFeedbackToWeights: idempotent application', () => {
    const weights = { fairnessDeviation: 100, totalTransitions: 50, ... };
    const delta = { fairnessDeviation: 10, ... };
    const result1 = applyFeedbackToWeights(weights, delta);
    const result2 = applyFeedbackToWeights(weights, delta);
    expect(result1).toEqual(result2);
  });

  test('labelCalendarDiffs: deterministic labeling', () => {
    const diffs = [{ date: '2026-01-05', oldParent: 'parent_a', newParent: 'parent_b' }];
    const result1 = labelCalendarDiffs(diffs, ['2026-01-05']);
    const result2 = labelCalendarDiffs(diffs, ['2026-01-05']);
    expect(result1).toEqual(result2);
  });

  test('runPreConflictChecks: deterministic alerts', () => {
    const params = { familyId: 'f1', parentANights: 30, parentBNights: 22, ... };
    const result1 = runPreConflictChecks(params);
    const result2 = runPreConflictChecks(params);
    expect(result1).toEqual(result2);
  });

  test('buildGuidedResponse: deterministic explanation', () => {
    const option = { id: 'o1', rank: 1, ... };
    const result1 = buildGuidedResponse(option, ['2026-01-05']);
    const result2 = buildGuidedResponse(option, ['2026-01-05']);
    expect(result1).toEqual(result2);
  });
});
```

## 12.2 Bootstrap Determinism Test

**File**: `apps/optimizer/tests/bootstrap/test_integration.py` (lines 82-100)

```python
class TestDeterminism:
    def test_same_input_same_output(self, simple_request):
        results = []
        for _ in range(10):
            response = process_bootstrap_request(simple_request)
            results.append(response)

        for r in results[1:]:
            assert r.schedule.status == results[0].schedule.status
            assert r.applied_facts_count == results[0].applied_facts_count
            assert r.ignored_facts_count == results[0].ignored_facts_count
            for a1, a2 in zip(r.schedule.solutions[0].assignments,
                              results[0].schedule.solutions[0].assignments):
                assert a1.date == a2.date
                assert a1.parent == a2.parent
```

10 runs of the same request produce identical:
- schedule status
- applied/ignored fact counts
- every assignment date and parent

## 12.3 Stabilizer Determinism Test

**File**: `apps/optimizer/tests/bootstrap/test_stabilizer.py` (lines 144-150)

```python
def test_deterministic_output(self):
    results = [detect_template_match(schedule) for _ in range(10)]
    for r in results[1:]:
        assert r.template_id == results[0].template_id
        assert r.adherence_score == results[0].adherence_score
```

## 12.4 Discovery Determinism Test

**File**: `apps/optimizer/tests/bootstrap/test_discovery.py` (lines 98-104)

```python
def test_deterministic(self):
    results = [get_next_discovery_question(empty_facts, []) for _ in range(10)]
    for r in results[1:]:
        assert r.id == results[0].id
        assert r.priority == results[0].priority
```

## 12.5 Simulator Determinism Test

**File**: `apps/simulator/tests/scenarios.test.ts` (lines 53-66)

```typescript
describe.each(implementedScenarios)('Determinism: %s', (key, scenario) => {
  test('two runs produce identical output', () => {
    const result1 = simulate(scenario);
    const result2 = simulate(scenario);
    expect(JSON.stringify(result1.validatedMessages))
      .toEqual(JSON.stringify(result2.validatedMessages));
    expect(JSON.stringify(result1.stateTransitions))
      .toEqual(JSON.stringify(result2.stateTransitions));
  });
});
```

20 implemented scenarios, 2 runs each, JSON-level equality verified.

---

# 13 Solver Scenario Test Suite

## 13.1 Brain Tests

**Location**: `apps/optimizer/tests/` (8 pytest files)

Tests covering:
- Conflict detection across age bands
- Heuristic scoring functions
- Profile weight selection
- Multi-child weight aggregation
- Onboarding solver integration

## 13.2 Bootstrap Tests

**Location**: `apps/optimizer/tests/bootstrap/` (7 files)

| Test File | Tests | Coverage |
|-----------|-------|----------|
| test_validator.py | 17 | Confidence filtering (HIGH/MEDIUM/LOW), conflict detection (4 types) |
| test_converter.py | 14 | Facts-to-solver mapping: current_parent, locked_ranges, recurring_patterns, exchange_anchors, target_split |
| test_discovery.py | 9 | Priority ordering, fact-covered skipping, already-asked filtering, determinism |
| test_stabilizer.py | 7 | Template exact/near match, offset search, threshold enforcement, determinism |
| test_integration.py | 13 | End-to-end pipeline: simple/locked/conflict/empty facts, determinism (10 runs), horizon, stabilization |

## 13.3 Shared Mediation Tests

**Location**: `packages/shared/tests/mediation/` (6 files)

| Test File | Tests | Coverage |
|-----------|-------|----------|
| explain.test.ts | 20 | Fairness delta, transition impact, routine impact, compensation summary, overall assessment |
| compensation.test.ts | 6 | Calendar diff labeling: requested vs compensation detection |
| feedback-weights.test.ts | 13 | Delta computation by category/severity, capping, weight application, accumulation |
| preconflict.test.ts | 13 | Fairness drift, long stretch, budget low detection with warning/critical thresholds |
| guided-response.test.ts | 7 | Response building, rank sorting, label fallback, bundle construction |
| determinism.test.ts | 5 | Same input = same output for all 5 core functions |

## 13.4 Shared Package Tests (Full)

**Location**: `packages/shared/tests/` (37 files, 132+ suites, ~850 assertions)

Categories:
```
Mediation:          6 files (covered above)
Recommendations:    7 files (scoring, templates, age baselines, multi-child, preferences)
Disruption:         5 files (overlay engine, policy learning, policy resolver, defaults, new event types)
Interpreter:        7 files (canonicalize, apply mode, stability budget, consent, scenarios, determinism)
ICS:                1 file (calendar export)
LLM Safety:         2 files (prompt safety, regression)
Determinism:        1 file (interpreter determinism)
Constants:          1 file (seasons)
Presets:            1 file (preset recommendations)
Baselines:          1 file (legacy V1)
```

## 13.5 Simulator Tests

**Location**: `apps/simulator/tests/scenarios.test.ts`

```
51 total scenarios across 10 categories:
  onboarding, routine, exception, emergency, holiday,
  activity, fairness, compliance, billing, admin

20 fully implemented, 31 stubs
Tests: registry integrity, schema validation, determinism (2 runs each),
       state transitions, timeout policies, stub execution
```

---

# 14 Determinism Regression Tests

## 14.1 Solver-Level (CP-SAT)

Determinism guaranteed by:
```
num_workers = 1                              (base_schedule.py:514, proposals.py:328, brain/solver.py:332)
No random seeds                              (0 matches for random.X, shuffle, numpy.random)
6-level lexicographic tie-break              (tie_break.py:17-89)
Deterministic Python sort with tuple key     (base_schedule.py:692, proposals.py:483)
Fixed constraint processing order            (base_schedule.py:222-345)
Fixed relaxation step order                  (relaxation.py:152-170)
```

## 14.2 Bootstrap-Level (10-Run Verification)

```python
# test_integration.py:82-100
for _ in range(10):
    response = process_bootstrap_request(same_request)
    # Assert identical: status, fact counts, assignments
```

## 14.3 Mediation-Level (Pure Function Verification)

```typescript
// determinism.test.ts:16-84
// 5 core functions verified: computeFeedbackDelta, applyFeedbackToWeights,
// labelCalendarDiffs, runPreConflictChecks, buildGuidedResponse
```

## 14.4 Simulator-Level (20 Scenarios x 2 Runs)

```typescript
// scenarios.test.ts:53-66
const result1 = simulate(scenario);
const result2 = simulate(scenario);
expect(JSON.stringify(result1)).toEqual(JSON.stringify(result2));
```

## 14.5 Interpreter-Level

**File**: `packages/shared/tests/interpreter_determinism.test.ts`

Verifies that `interpretChangeRequest()` produces identical results for
same inputs across multiple runs.

## 14.6 Permutation Determinism Tests

The most powerful test for hidden non-determinism: verify that **input ordering
does not affect output**. Catches bugs from dictionary iteration order, unsorted
arrays, database result ordering, and event ingestion order.

### TypeScript (Shared Mediation Layer)

**File**: `packages/shared/tests/mediation/permutation-determinism.test.ts`

9 tests, 100 permutations each, all passing:

```
computeFeedbackDelta:    100 shuffled feedback orderings   -> 1 unique hash  PASS
applyFeedbackToWeights:  100 shuffled delta key orderings  -> 1 unique hash  PASS
accumulateDeltas:        commutativity A+B == B+A           -> equal          PASS
accumulateDeltas:        100 shuffled multi-delta orderings -> 1 unique hash  PASS
labelCalendarDiffs:      100 shuffled diff orderings        -> 1 unique hash  PASS
labelCalendarDiffs:      100 shuffled requestDate orderings -> 1 unique hash  PASS
buildGuidedBundle:       100 shuffled option orderings      -> 1 unique hash  PASS
runPreConflictChecks:    100 calls with spread params       -> 1 unique hash  PASS
cross-function pipeline: 100 shuffled feedback -> weights   -> 1 unique hash  PASS
```

Test strategy:
```typescript
for (let i = 0; i < 100; i++) {
  const permuted = shuffle(inputs, seededRng);
  const result = functionUnderTest(permuted);
  hashes.add(hashJson(result));
}
expect(hashes.size).toBe(1);
```

### Python (Solver + Bootstrap)

**File**: `apps/optimizer/tests/bootstrap/test_permutation_determinism.py`

8 tests covering solver and bootstrap pipelines:

```
TestBaseSchedulePermutation:
  constraint_order_does_not_affect_schedule:    100 runs, all list fields shuffled
  disruption_lock_order_independence:            50 runs, disruption_locks shuffled
  locked_night_dow_order_independence:           50 runs, DOW arrays shuffled

TestBootstrapPermutation:
  fact_order_does_not_affect_schedule:          100 runs, all fact lists shuffled
  locked_range_order_independence:               50 runs, locked_ranges shuffled
  recurring_pattern_order_independence:          50 runs, recurring_patterns shuffled
  exchange_anchor_order_independence:            50 runs, exchange_anchors shuffled
```

Hashing method:
```python
def hash_schedule(response) -> str:
    parts = []
    for sol in response.solutions:
        for a in sorted(sol.assignments, key=lambda x: x.date):
            parts.append(f"{a.date}:{a.parent}")
    return hashlib.sha256("|".join(parts).encode()).hexdigest()
```

Assertion:
```python
assert len(unique_hashes) == 1, f"Found {len(unique_hashes)} hashes (expected 1)"
```

---

# 15 Integration Flow Verification

## 15.1 Schedule Generation Flow

```
FamilyContextService.getContext()
  -> age band, maxConsecutive, solverWeightProfile
  -> apps/api/src/family-context/family-context.service.ts:32-54

FamilyContextService.getAdjustedWeights()
  -> DEFAULT_SOLVER_WEIGHTS * AGE_MULTIPLIERS * ARRANGEMENT_MULTIPLIERS
  -> apps/api/src/family-context/family-context.service.ts:79-118

DisruptionsService.computeAllOverlays()
  -> disruption_locks, weight_adjustments
  -> apps/api/src/disruptions/disruptions.service.ts:233-268

SchedulesService.generateBaseSchedule()
  -> HTTP POST /solve/base-schedule
  -> apps/api/src/schedules/schedules.service.ts:191-442

Solver._solve_core()
  -> CP-SAT model, constraints, penalties
  -> apps/optimizer/app/solver/base_schedule.py:192-510

SolutionCollector.on_solution_callback()
  -> collect solutions
  -> apps/optimizer/app/solver/base_schedule.py:49-64

compute_tie_break_key() + sort
  -> deterministic ranking
  -> apps/optimizer/app/solver/tie_break.py:17-89

SchedulesService.createVersion()
  -> deactivate old, save new, save assignments + handoffs
  -> apps/api/src/schedules/schedules.service.ts:348-430
```

## 15.2 Mediation Resolution Flow

```
User Intent: "I need to keep the kids until Monday."
  |
  v
RequestsService.create()
  -> validate budget, create Request (PENDING)
  -> apps/api/src/requests/requests.service.ts:37-112
  |
  v
ProposalsService.generateProposals()
  -> get constraints, family context, disruption overlay
  -> apply feedback-adjusted weights
  -> HTTP POST /solve/proposals
  -> save ProposalBundle + ProposalOptions
  -> apps/api/src/proposals/proposals.service.ts:79-309
  |
  v
NotificationService.send() to other parent
  -> "Three solutions are available."
  -> apps/api/src/notifications/notification.service.ts:20-55
  |
  v
MediationService.getGuidedProposals()
  -> buildGuidedBundle(options, requestDates)
  -> returns: GuidedProposalResponse[] with FairnessExplanation
  -> apps/api/src/mediation/mediation.service.ts:53-72
  |
  v
Parent selects option
  |
  v
MediationService.acceptWithNotification()
  -> ProposalsService.acceptProposal() -> apply calendarDiff -> create new version
  -> notify other parent
  -> emit WebSocket: schedule_updated + proposal_accepted
  -> apps/api/src/mediation/mediation.service.ts:155-184
  |
  v
Schedule updated. Fairness explanation included:
  "This change keeps parenting time balanced within 2%."
```

## 15.3 Objection Flow

```
Parent B rejects all proposals
  |
  v
MediationService.handleObjection()
  -> check MAX_OBJECTION_ROUNDS (2)
  -> FeedbackService.submitFeedback() with round number
    -> save UserFeedback records
    -> computeFeedbackDelta() -> accumulateDeltas()
    -> upsert FeedbackProfile
  -> reset Request to PENDING
  -> ProposalsService.generateProposals()
    -> getAdjustedWeights() applies accumulated feedback deltas
    -> solver generates new options with adjusted weights
  -> notify other parent: "New proposals being generated"
  -> audit OBJECTION_FILED
  |
  v
New proposals available with adjusted weights
```

## 15.4 Pre-Conflict Prevention Flow

```
Daily cron or GET /mediation/alerts
  |
  v
PreConflictService.checkFamily()
  -> MetricsService.computeLedger() (8-week window)
  -> MetricsService.computeStability() (2-week window)
  -> GuardrailsService.getBudgetStatus()
  -> FamilyContextService.getContext() (age-aware maxConsecutive)
  -> runPreConflictChecks()
    -> checkFairnessDrift() (warning at 75%, critical at 100%)
    -> checkLongStretch() (warning at max-1, critical at max)
    -> checkBudgetLow() (warning at 75%, critical at 100%)
  |
  v
PreConflictService.notifyAlerts()
  -> send email: "Heads Up: Overnight balance is approaching..."
  -> apps/api/src/mediation/preconflict.service.ts:82-119
```

## 15.5 Weight Pipeline (Full Chain)

```
DEFAULT_SOLVER_WEIGHTS (constants.ts:23-31)
  fairnessDeviation: 100, totalTransitions: 50, nonDaycareHandoffs: 30,
  weekendFragmentation: 40, schoolNightDisruption: 60
  |
  v
AGE_WEIGHT_MULTIPLIERS (constants.ts:33-64)
  infant: transitions 2.0x, teen: fairness 1.2x
  |
  v
LIVING_ARRANGEMENT_WEIGHT_MULTIPLIERS (constants.ts:66-72)
  primary_visits: fairness 0.5x
  |
  v
Multi-child aggregation (if applicable)
  MAX(stability), weighted_avg(fairness)
  |
  v
FeedbackProfile.accumulatedDeltas (feedback-weights.ts:73-86)
  clamped [0, 500] per dimension
  |
  v
Disruption overlay weight_adjustments (disruptions.service.ts:275-282)
  Math.round(weight * multiplier)
  |
  v
Seasonal multipliers (seasons.py:50-68)
  SCHOOL_YEAR (1.0x), SUMMER (fairness 1.3x), HOLIDAY (fairness 1.5x)
  |
  v
Solver penalties applied to CP-SAT objective
```

---

# 16 Final Determinism Statement

## Verification Summary

| Aspect | Evidence | Deterministic |
|--------|----------|:---:|
| Solver initialization | `num_workers=1` (3 files) | Y |
| Random seeding | 0 matches for random/shuffle/numpy.random | Y |
| Weight definitions | Fixed constants + frozen dataclasses | Y |
| Seasonal multipliers | Fixed dict, predetermined float values | Y |
| Relaxation order | Fixed 13-step tuple, never shuffled | Y |
| Tie-break ranking | 6-level lexicographic tuple | Y |
| Solution sorting | Python `.sort()` with deterministic key | Y |
| Constraint processing | Fixed order for all constraints | Y |
| DOW conversion | Mathematical modulo arithmetic | Y |
| Time measurement | Used only for elapsed time, not decisions | Y |
| UUID generation | Used only for option metadata IDs | Y |
| Feedback weights | Fixed category-severity mapping, capped deltas | Y |
| Pre-conflict alerts | Deterministic threshold comparisons | Y |
| Explanation generation | Pure functions, same input = same output | Y |
| Calendar diff labeling | Set membership check, deterministic | Y |
| Bootstrap pipeline | 8-step deterministic orchestration | Y |
| Template matching | Sorted iteration, deterministic tie-breaking | Y |
| Discovery questions | Fixed priority catalog, no randomness | Y |

## Determinism Guarantees

```
1. All scheduling decisions originate from the deterministic CP-SAT solver.

2. Interpreter layers only produce structured inputs:
   - ParentRequest
   - BootstrapFacts
   - ChangeRequest
   - UserFeedback

3. No stochastic processes influence scheduling:
   - No random number generators
   - No time-based seeds
   - No non-deterministic iteration
   - No floating-point scoring without rounding

4. Given identical inputs, the system produces identical:
   - Schedules (same assignments, same ranking)
   - Proposals (same options, same penalty scores, same tie-break order)
   - Mediation outcomes (same explanations, same compensation labeling)
   - Pre-conflict alerts (same thresholds, same messages)
   - Feedback adjustments (same weight deltas, same capping)

5. The solver is the single source of truth for all schedule changes:
   - Base schedule generation
   - Proposal generation (with compensation)
   - Bootstrap provisional schedules
   - Emergency mode adjustments

6. Determinism is verified at every layer:
   - Solver level: num_workers=1, 6-level tie-break
   - Bootstrap level: 10-run integration test
   - Mediation level: 5 pure function tests
   - Simulator level: 20 scenarios x 2 runs
   - Interpreter level: determinism regression test
```

---

# Appendix: File Count Summary

```
TypeORM Entities:           29
Shared Type Interfaces:     40+
Shared Enums:               30+
Zod Validation Schemas:     30+
Constants Defined:           50+
API Modules:                20
API Services:               16
API Controllers:            14
Email Templates:            14 notification types
Optimizer Solver Files:      5 (base_schedule, proposals, tie_break, relaxation, seasons)
Optimizer Bootstrap Files:   8 (models, fact_resolver, validator, converter, discovery, orchestrator, stabilizer, routes)
Brain Files:                 5+ (solver, heuristic, profiles, conflict, models)
Shared Mediation Files:      7 (types, explain, compensation, feedback-weights, preconflict, guided-response, index)
Test Files (shared):        37 (132+ suites, ~850 assertions)
Test Files (bootstrap):      7 (50+ test cases)
Test Files (brain):          8
Simulator Scenarios:        51 (20 implemented, 31 stubs)
Total Lines of Code:        ~30,000+
```

---

End of Report.
