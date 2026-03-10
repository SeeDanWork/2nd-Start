# Schedule Generation Levers — Complete Inventory

Every input/parameter that dynamically affects schedule generation and overnight assignment in ADCP, organized by category.

---

## 1. Hard Constraints (User-Defined)

Stored as `Constraint` entities, processed by the CP-SAT solver as inviolable rules.

| Lever | Parameters | Effect | Hardness |
|-------|-----------|--------|----------|
| **LOCKED_NIGHT** | `{ parent, daysOfWeek[] }` | Forces assignment to other parent on specified weekdays. Suspended during bonus weeks. | HARD |
| **MAX_CONSECUTIVE** | `{ parent, maxNights: 1-14 }` | Sliding window: parent cannot have all nights in any (maxNights+1) window. | HARD |
| **MIN_CONSECUTIVE** | `{ parent, minNights: 1-7 }` | Minimum block length when parent has custody. (Defined, not yet in solver.) | HARD |
| **WEEKEND_SPLIT** | `{ targetPctParentA: 0-100, tolerancePct: 0-50 }` | Weekend nights for Parent A must stay within target ± tolerance over rolling windows. | HARD |
| **MAX_TRANSITIONS_PER_WEEK** | `{ perWeek: 1-7 }` | Hard cap on custody changes per ISO week. Default: 3. | HARD |
| **DAYCARE_EXCHANGE_ONLY** | `{ enabled: boolean }` | Penalizes non-daycare handoffs (soft penalty despite constraint classification). | SOFT |
| **NO_SCHOOL_NIGHT_TRANSITION** | `{ enabled: boolean }` | Penalizes transitions on school nights (Sun-Thu). | SOFT |
| **HANDOFF_LOCATION_PREFERENCE** | `{ preferredLocationId }` | Preferred handoff location. Logistics only. | SOFT |

**Files**: `packages/shared/src/enums.ts`, `packages/shared/src/types.ts`, `apps/optimizer/app/solver/base_schedule.py`

---

## 2. Solver Weight Parameters (Soft Objectives)

Numerical weights controlling the objective function penalty terms.

| Weight | Default | Effect |
|--------|---------|--------|
| **fairnessDeviation** | 100 | Penalizes `|parent_b_nights - target|`. Higher = more equal split. |
| **totalTransitions** | 50 | Penalizes total handoffs. Higher = fewer transitions. |
| **nonDaycareHandoffs** | 30 | Penalizes transitions on non-daycare days. |
| **weekendFragmentation** | 40 | Penalizes splitting weekend nights across parents. |
| **schoolNightDisruption** | 60 | Penalizes transitions on school nights. |
| **weekendParity** | varies | Penalizes `|parentA_weekends - parentB_weekends|`. Brain solver only. |
| **maxConsecutivePenalty** | varies | Soft penalty for exceeding max consecutive. Brain solver only. |

**Files**: `packages/shared/src/constants.ts`, `apps/optimizer/app/brain/profiles.py`

---

## 3. Age-Based Weight Multipliers

Multiply base solver weights based on youngest child's age.

| Profile | Fairness | Transitions | Non-Daycare | Weekend Frag | School Night |
|---------|----------|-------------|-------------|--------------|--------------|
| **infant** | 0.7x | 2.0x | 1.5x | 1.0x | 0.5x |
| **young_child** | 0.8x | 1.5x | 1.2x | 1.0x | 0.8x |
| **school_age** | 1.0x | 1.0x | 1.0x | 1.0x | 1.0x |
| **teen** | 1.5x | 0.7x | 0.5x | 1.2x | 0.8x |

**Living Arrangement Multipliers** (applied on top):
- `shared`: all 1.0x
- `primary_visits`: fairness 0.5x, transitions 1.5x
- `undecided`: all 1.0x

**Files**: `packages/shared/src/constants.ts`, `apps/api/src/family-context/family-context.service.ts`

---

## 4. Age-Based Hard Constraint Defaults

Derived from child birthdates. Injected when no explicit constraint exists.

| Age Band | maxConsecutive | maxAway |
|----------|---------------|---------|
| 0-6m | 1 | 1 |
| 6-12m | 2 | 2 |
| 1-2y | 2 | 2 |
| 2-3y | 3 | 3 |
| 3-5y | 4 | 4 |
| 5-7y | 5 | 5 |
| 8-10y | 7 | 7 |
| 11-13y | 7 | 7 |
| 14-17y | 14 | 14 |

**Goal Adjustments**: `stabilityFirst` → +1, `minimizeSeparation` → -1 (capped at 7/14).

**Files**: `packages/shared/src/recommendations/age_baselines.ts`

---

## 5. Multi-Child Scoring

| Lever | Value | Effect |
|-------|-------|--------|
| **MULTI_CHILD_THRESHOLD** | 4 | ≤4 children: individual scoring. 5+: grouped. |
| **Hard constraint floors** | MIN across children | Strictest child's maxConsecutive governs the family. |
| **Stability weights** | MAX across children | Most sensitive child wins. |
| **Fairness weights** | Weighted average | Under-5 at 0.5x, 11+ at 1.5x. |
| **SIBLING_DIVERGENCE** | 0 (invariant) | Siblings never split across households. |

**Files**: `packages/shared/src/recommendations/multi_child.ts`, `apps/optimizer/app/brain/profiles.py`

---

## 6. Family Settings

| Setting | Values | Effect |
|---------|--------|--------|
| **weekendDefinition** | `fri_sat` / `sat_sun` | Which nights are "weekend" for constraints & penalties. |
| **fairnessBand** | `{ maxOvernightDelta, windowWeeks }` | Acceptable imbalance window (guardrail, not solver). |
| **changeBudget** | `{ maxPerMonth: 1-20 }` | Limits schedule change requests per month. |
| **timezone** | IANA string | Date boundary calculations. |

**Files**: `apps/api/src/entities/family.entity.ts`

---

## 7. Onboarding Wizard Inputs

Collected during chat-based onboarding, assembled by `buildOnboardingInput()`.

| Input | Values | Maps To | Hardness |
|-------|--------|---------|----------|
| **childrenCount** | integer ≥ 1 | `number_of_children` | Structural |
| **ageBands** | `under_5` / `5_to_10` / `11_to_17` | `children_age_bands` | Structural |
| **livingArrangement** | `shared` / `primary_visits` / `undecided` | `living_arrangement` | Weight modifier |
| **schoolDays** | day-of-week ints[] | `school_schedule.school_days` | SOFT |
| **daycareDays** | day-of-week ints[] | `daycare_schedule.daycare_days` | SOFT |
| **exchangeLocation** | `school` / `daycare` / `home` / `other` | `preferred_exchange_location` | SOFT |
| **lockedNights** | day-of-week ints[] | `parent_a.availability.locked_nights` | HARD |
| **targetSharePct** | 0-100 | `target_share_pct` | SOFT |
| **maxHandoffsPerWeek** | integer ≥ 1 | `max_handoffs_per_week` | SOFT |
| **maxConsecutiveAway** | integer ≥ 1 | `max_consecutive_nights_away` | HARD |
| **weekendPreference** | `alternate` / `fixed` / `flexible` | `weekend_preference` | SOFT |
| **scheduleStartDate** | ISO date | `shared.start_date` | Structural |

**Files**: `apps/mobile/src/stores/chat.ts`, `apps/mobile/src/chat/flows/onboarding.ts`

---

## 8. Brain Solver Option Profiles

The onboarding brain generates 5 schedule options with different weight emphases.

| Profile | Primary Weight | Secondary | Character |
|---------|---------------|-----------|-----------|
| **stability_first** | transitions=200 | fairness=40 | Few handoffs, accept drift |
| **fairness_first** | fairness=200 | transitions=40 | Tight parity |
| **logistics_first** | nonSchoolHandoffs=200 | fairness=60 | Maximize school exchanges |
| **weekend_parity_first** | weekendFrag=200 | weekendParity=200 | Balance weekends |
| **child_routine_first** | schoolNight=200 | transitions=80 | School stability |

**Files**: `apps/optimizer/app/brain/profiles.py`, `apps/optimizer/app/brain/domain.py`

---

## 9. Disruption Events

| Lever | Values | Effect |
|-------|--------|--------|
| **Event type** | 13 types (HOLIDAY, SCHOOL_CLOSED, CHILD_SICK, PARENT_TRAVEL, etc.) | Maps to default policy action. |
| **overrideStrength** | `none` / `logistics_only` / `soft` / `hard` | How strongly disruption overrides base schedule. |
| **scope** | `household` / `child_id` | All children or specific child. |
| **affectedParent** | parent role | Which parent is blocked (for BLOCK_ASSIGNMENT). |
| **Disruption locks** | date→parent pairs | Hard date-level locks sent to solver (tier 0, highest priority). |
| **Weight adjustments** | multipliers | Long disruption: fairness×1.3. Proposals: fairness×1.5. School holidays: schoolNight×0.1. |

**Files**: `packages/shared/src/enums.ts`, `packages/shared/src/disruption/overlay_engine.ts`, `packages/shared/src/disruption/default_policies.ts`

---

## 10. Overlay Policies

| Axis | Values | Effect |
|------|--------|--------|
| **actionType** | NO_OVERRIDE / LOGISTICS_FALLBACK / BLOCK_ASSIGNMENT / DELAY_EXCHANGE / GENERATE_PROPOSALS | Per-event-type schedule action. |
| **promptingRules** | `{ leadTimeHours, suppressPrompt, maxAutoApply }` | Auto-apply or require confirmation. |
| **fairnessAccounting** | `{ countsTowardFairness, createCompensatory, maxCompensatoryDays }` | Whether disruption changes count for fairness + compensatory day locks. |

**Files**: `apps/api/src/entities/overlay-policy.entity.ts`

---

## 11. Request / Proposal System

| Lever | Values | Effect |
|-------|--------|--------|
| **Request type** | NEED_COVERAGE / WANT_TIME / BONUS_WEEK / SWAP_DATE | Determines constraint type in proposal solver. |
| **Request dates** | ISO date strings (1-31) | Specific dates to change. Non-request dates frozen. |
| **Request urgency** | `normal` / `urgent` | Expiry timing (48h vs 12h). |
| **Frozen assignments** | date→parent pairs | Immovable days the proposal solver must respect. |
| **Bonus weeks** | `{ parent, start, end }` | Suspends locked night constraints for duration. |

**Files**: `apps/api/src/proposals/proposals.service.ts`, `apps/optimizer/app/models/requests.py`

---

## 12. Emergency Mode

| Lever | Values | Effect |
|-------|--------|--------|
| **relaxedConstraints** | `[{ constraintId, originalValue }]` | Temporarily relaxes specified hard constraints. |
| **returnToBaselineAt** | ISO date | When emergency ends and constraints restore. |

**Files**: `apps/api/src/entities/emergency-mode.entity.ts`

---

## 13. Guardrails / Pre-Consent Rules

| Rule | Threshold | Effect |
|------|-----------|--------|
| **FAIRNESS_BAND** | `{ maxOvernightDelta }` | Auto-approve if delta within band. |
| **MAX_TRANSITIONS** | `{ maxAdditional }` | Auto-approve if transitions below threshold. |
| **MAX_STREAK** | threshold | Auto-approve based on streak impact. |
| **REQUEST_TYPE** | `{ autoApproveTypes[] }` | Auto-approve certain request types. |

---

## 14. Solver Execution Parameters

| Parameter | Default | Effect |
|-----------|---------|--------|
| **SOLVER_TIMEOUT_SECONDS** | 30 | Max solver search time. |
| **SOLVER_MAX_SOLUTIONS** | 10 | Max distinct solutions collected. |
| **SOLVER_MIN_HAMMING_DISTANCE** | 2 | Min differing days between solutions. |
| **DEFAULT_SCHEDULE_HORIZON_WEEKS** | 18 (126 days) | Base schedule planning window. |
| **DEFAULT_PROPOSAL_HORIZON_WEEKS** | 8 (56 days) | Proposal planning window. |
| **weekend_split_window_weeks** | 4 | Rolling window for weekend split evaluation. |

**Files**: `packages/shared/src/constants.ts`

---

## 15. Holiday Calendar

| Field | Effect |
|-------|--------|
| **date** | Holiday date. |
| **daycareClosed** | If true, transitions on this date incur non-daycare penalty. |
| **label** | Display label. No solver impact. |

---

## 16. Solver Precedence Hierarchy

7 tiers (tier 1 = highest authority, never overridden):

1. **hard_constraints** — Locked nights, max consecutive
2. **young_child_stability** — Transition caps for youngest child
3. **living_arrangement** — Arrangement weight multipliers
4. **profile_weights** — Age-band solver weight profile
5. **fairness_and_weekend_goals** — Soft fairness goals (capped by stability)
6. **parent_preferences** — User-declared preferences
7. **logistics_optimizations** — Exchange timing, locations

**Files**: `packages/shared/src/constants.ts`

---

## 17. Policy Rules (Observation-Driven)

Rules created from accepted policy suggestions. Stored as `TypedPolicyRule` in `packages/core-domain/src/policy/types/TypedPolicyRule.ts`.

| Rule Type | Parameters | Effect | Priority |
|-----------|-----------|--------|----------|
| **MIN_BLOCK_LENGTH** | `{ nights: number }` | Enforces minimum consecutive nights per custody block. | SOFT / STRONG / HARD |
| **ACTIVITY_COMMITMENT** | `{ activityLabel, preferredResponsibleParentId, disruptionType? }` | Assigns responsibility for specific activities (sports, school closures) to a parent. | SOFT / STRONG / HARD |
| **EXCHANGE_LOCATION** | `{ preferredLocation }` | Sets preferred exchange/handoff location. | SOFT / STRONG / HARD |
| **SIBLING_COHESION** | `{ allowDivergence: boolean }` | Controls whether siblings can have different schedules. | SOFT / STRONG / HARD |

**Scope**: Each rule can be scoped to `FAMILY` (all children) or `CHILD` (specific child, with optional `dateStart`/`dateEnd`).

**Source Traceability**: Rules created via suggestion acceptance carry `sourceSuggestionId` for idempotent acceptance and audit.

**Files**: `packages/core-domain/src/policy/types/TypedPolicyRule.ts`, `packages/core-domain/src/enums/PolicyRuleType.ts`, `packages/core-domain/src/enums/PolicyPriority.ts`

---

## 18. Observation Detectors

6 behavior detectors that analyze family evidence windows and generate policy suggestions.

| Detector | Suggestion Type | What It Detects |
|----------|----------------|-----------------|
| **MinBlockLengthDetector** | `MIN_BLOCK_LENGTH_ADJUSTMENT` | Family consistently requesting longer custody blocks |
| **ActivityResponsibilityDetector** | `ACTIVITY_RESPONSIBILITY_RULE` | One parent consistently handling specific activities |
| **SiblingDivergenceDetector** | `SIBLING_DIVERGENCE_PREFERENCE` | Siblings needing different schedule patterns |
| **SchoolClosureCoverageDetector** | `SCHOOL_CLOSURE_COVERAGE_PREFERENCE` | Recurring school closure coverage patterns |
| **ExchangeLocationDetector** | `PREFERRED_EXCHANGE_LOCATION` | Preferred exchange location patterns |
| **PreferredExchangeDayDetector** | `PREFERRED_EXCHANGE_DAY` | Preferred handoff day-of-week patterns (no rule conversion) |

**Files**: `packages/core-domain/src/observations/detectors/`, `packages/core-domain/src/observations/core/PolicySuggestionService.ts`

---

## Summary

| Category | Count | Hard | Soft |
|----------|-------|------|------|
| Constraint Types | 8 | 5 | 3 |
| Solver Weights | 7 | 0 | 7 |
| Age Multipliers | 2 tables | 0 | 2 |
| Age Defaults | 18 (9 bands × 2) | 18 | 0 |
| Multi-Child | 5 rules | 2 | 3 |
| Family Settings | 6 | 0 | 6 |
| Onboarding Inputs | 12 | 3 | 9 |
| Brain Profiles | 5 | 0 | 5 |
| Disruptions | 6 | 3 | 3 |
| Overlay Policies | 3 axes | 1 | 2 |
| Requests/Proposals | 6 | 2 | 4 |
| Emergency Mode | 2 | 1 | 1 |
| Guardrails | 4 | 0 | 4 |
| Solver Execution | 6 | 0 | 6 |
| Holidays | 3 | 1 | 2 |
| Policy Rules | 4 types | 0-4 | 0-4 |
| Observation Detectors | 6 | 0 | 6 |
| **Total** | **~90+** | **~36-40** | **~63-67** |
