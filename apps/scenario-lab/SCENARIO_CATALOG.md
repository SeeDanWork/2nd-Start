# Scenario Lab — Catalog Reference

## Family Structure Presets

Each preset auto-fills children, distance, template, and target split.

| ID | Name | Children | Distance | Template | Split |
|----|------|----------|----------|----------|-------|
| `simple_shared` | Simple Shared Custody | 1 child (age 7) | 10 mi | 2-2-3 | 50/50 |
| `toddler_family` | Toddler Stability Sensitive | 1 child (age 2) | 5 mi | 2-2-3 | 50/50 |
| `school_family` | Multi-Child School Schedule | 2 children (ages 6, 10) | 15 mi | 3-4-4-3 | 50/50 |
| `teen_family` | Teen Flexibility | 1 child (age 15) | 20 mi | Alternating Weeks | 50/50 |
| `infant_split` | Infant Primary Care | 1 child (age 0) | 8 mi | 5-2 | 70/30 |
| `blended_ages` | Blended Ages | 3 children (ages 3, 8, 13) | 12 mi | 3-4-4-3 | 50/50 |

---

## Parent Behavior Personas

Each persona defines how a parent responds to proposals, disruptions, and schedule changes.

### Cooperative Organizer
- **ID:** `cooperative_organizer`
- **Description:** Prioritizes stability and cooperation. Accepts reasonable proposals quickly.
- Conflict: 1 | Fairness: 3 | Rigidity: 4 | Logistics: 4
- Speed: fast | Gaming: 0% | Base Acceptance: 80%

### Fairness Scorekeeper
- **ID:** `fairness_scorekeeper`
- **Description:** Tracks custody balance carefully and resists perceived imbalance.
- Conflict: 3 | Fairness: 5 | Rigidity: 3 | Logistics: 2
- Speed: medium | Gaming: 10% | Base Acceptance: 50%

### Flexible but Disorganized
- **ID:** `flexible_disorganized`
- **Description:** Accepts many changes but frequently introduces disruptions.
- Conflict: 1 | Fairness: 2 | Rigidity: 1 | Logistics: 5
- Speed: slow | Gaming: 0% | Base Acceptance: 90%

### Strategic Gamer
- **ID:** `strategic_gamer`
- **Description:** Attempts to gain extra time or advantage within system rules.
- Conflict: 4 | Fairness: 3 | Rigidity: 3 | Logistics: 2
- Speed: medium | Gaming: 70% | Base Acceptance: 30%

### Avoidant Parent
- **ID:** `avoidant_parent`
- **Description:** Responds slowly and often ignores requests.
- Conflict: 2 | Fairness: 2 | Rigidity: 2 | Logistics: 3
- Speed: very slow | Gaming: 0% | Base Acceptance: 40%

### High Conflict Controller
- **ID:** `high_conflict_controller`
- **Description:** Rejects proposals frequently and challenges fairness decisions.
- Conflict: 5 | Fairness: 4 | Rigidity: 5 | Logistics: 1
- Speed: fast | Gaming: 40% | Base Acceptance: 20%

---

## Interaction Archetypes (12)

Pre-defined parent pairings with calibrated conflict probabilities.

| ID | Parent A | Parent B | Conflict Prob | Summary |
|----|----------|----------|---------------|---------|
| `cooperative_pair` | Cooperative Organizer | Cooperative Organizer | 5% | Both stable, quick resolution |
| `organizer_scorekeeper` | Cooperative Organizer | Fairness Scorekeeper | 15% | Organizer proposes, Scorekeeper checks |
| `organizer_avoidant` | Cooperative Organizer | Avoidant Parent | 20% | Organizer drives, Avoidant delays |
| `flexible_organizer` | Flexible Disorganized | Cooperative Organizer | 10% | Frequent disruptions, quick resolution |
| `flexible_scorekeeper` | Flexible Disorganized | Fairness Scorekeeper | 25% | Disruptions trigger fairness negotiation |
| `strategic_scorekeeper` | Strategic Gamer | Fairness Scorekeeper | 35% | Gaming vs balance enforcement |
| `strategic_organizer` | Strategic Gamer | Cooperative Organizer | 20% | Organizer moderates gaming |
| `strategic_avoidant` | Strategic Gamer | Avoidant Parent | 30% | System must enforce fairness |
| `high_conflict_organizer` | High Conflict Controller | Cooperative Organizer | 45% | Mediation vs rejection |
| `high_conflict_scorekeeper` | High Conflict Controller | Fairness Scorekeeper | 55% | Frequent fairness disputes |
| `high_conflict_strategic` | High Conflict Controller | Strategic Gamer | 65% | Highly adversarial |
| `avoidant_pair` | Avoidant Parent | Avoidant Parent | 15% | Low engagement, system auto-resolves |

---

## Scenario Difficulty Levels

| Level | Description |
|-------|-------------|
| 1 | Simple disruption |
| 2 | Multi-step negotiation |
| 3 | Fairness balancing required |
| 4 | Repeated proposal rejection |
| 5 | Solver constraint edge case |

---

## Behavior Trait Definitions (1-5 scale)

| Trait | Description |
|-------|-------------|
| **Conflict Level** | How combative the parent is (1 = peaceful, 5 = highly adversarial) |
| **Fairness Sensitivity** | How closely they track the custody balance (1 = relaxed, 5 = hyper-vigilant) |
| **Schedule Rigidity** | How much they resist changes to the schedule (1 = flexible, 5 = immovable) |
| **Logistics Tolerance** | How flexible they are on logistics like pickup times (1 = rigid, 5 = accommodating) |
| **Response Speed** | How quickly they reply: fast (5-30s), medium (1-5min), slow (10-30min), very_slow (30min-2hr) |
| **Gaming Probability** | Chance of attempting to gain extra time strategically (0-100%) |
| **Proposal Acceptance Bias** | Base probability of accepting a reasonable proposal (0-100%) |

---

## Behavior Engine Decision Logic

When a parent receives a proposal, the engine calculates an acceptance score:

1. Start with `proposal_acceptance_bias`
2. **Fairness penalty:** If split deviation > 5%, subtract `(deviation / 100) * (fairness_sensitivity / 5)`
3. **Transition penalty:** If transitions increase, subtract `(schedule_rigidity / 5) * 0.2`
4. **Disruption bonus:** If responding to a disruption and conflict < 4, add `+0.15`
5. **Conflict penalty:** Subtract `(conflict_level / 5) * 0.15`
6. **Logistics bonus:** Add `(logistics_tolerance / 5) * 0.1`
7. Clamp to 0-1, roll random — accept if roll < score, else counter or reject

**Avoidant override:** If speed is `very_slow`, 40% chance of ignoring entirely.
**Gaming injection:** If roll < `gaming_probability`, an `extra_time_request` event is injected.
**Archetype modifier:** If archetype `conflict_probability` triggers, accept → counter escalation.

---

## Disruption Scenarios (49 total, 11 categories)

### Health (3)

| ID | Name | Description | Events |
|----|------|-------------|--------|
| `child_sick_exchange` | Child Sick During Exchange | Child becomes sick on the morning of a scheduled exchange | child_sick (day 3) |
| `parent_illness` | Parent Illness | Custodial parent too sick to care for child | parent_sick (day 6, parent A) |
| `hospitalization` | Child Hospitalization | Child hospitalized, both parents need access | child_hospitalization (day 11) |

### School (3)

| ID | Name | Description | Events |
|----|------|-------------|--------|
| `unexpected_school_closure` | Unexpected School Closure | School closes due to weather or facility issue | school_closed (day 7) |
| `school_trip` | School Trip Conflict | School trip on exchange day, both parents must consent | school_trip (day 8) |
| `activity_conflict` | After-School Activity Conflict | New activity creates pickup conflict on transition day | activity_added (day 9) |
| `camp_week` | Summer Camp Week | Child at day camp for full week, changes exchange logistics | camp_week (day 21, 5 days) |

### Work (1)

| ID | Name | Description | Events |
|----|------|-------------|--------|
| `work_emergency` | Parent Work Emergency | Parent cannot pick up child due to urgent work | work_emergency (day 4, parent A) |

### Logistics (2)

| ID | Name | Description | Events |
|----|------|-------------|--------|
| `late_pickup` | Late Pickup | Parent arrives late for scheduled handoff | late_pickup (day 6, parent B) |
| `transport_failure` | Transport Failure | Vehicle or transportation issue prevents exchange | transport_failure (day 5, parent A) |

### Travel (3)

| ID | Name | Description | Events |
|----|------|-------------|--------|
| `parent_travel` | Parent Work Travel | Parent A must travel for work during scheduled custody | parent_travel (day 10, 3 days, parent A) |
| `flight_delay` | Travel Delay | Parent delayed returning from trip, misses exchange | flight_delay (day 12, parent A) |
| `vacation_request` | Vacation Request | Parent requests extra days for family vacation | vacation_request (day 15, 5 days, parent B) |

### Holiday (2)

| ID | Name | Description | Events |
|----|------|-------------|--------|
| `holiday_override` | Holiday Schedule Conflict | Holiday falls on exchange, both parents want the day | holiday (day 25) |
| `holiday_extension` | Holiday Extension Request | Parent requests extra days beyond normal allocation | holiday_extension_request (day 25, parent A) |

### Conflict (3)

| ID | Name | Description | Events |
|----|------|-------------|--------|
| `proposal_rejection_loop` | Proposal Rejection Loop | Parent repeatedly rejects reasonable proposals | 2x proposal_rejected (days 4-5, parent B) |
| `strategic_gaming` | Strategic Gaming Attempt | Parent repeatedly requests additional time | 2x extra_time_request (days 6, 8, parent A) |
| `fairness_complaint` | Fairness Complaint | Parent formally disputes fairness metrics | fairness_complaint (day 10, parent B) |

### Stress Tests (3)

| ID | Name | Description | Events |
|----|------|-------------|--------|
| `compound_disruption` | Compound Disruption | Illness, school closure, and travel in same two-week window | child_sick (day 4) + school_closed (day 6) + parent_travel (day 7, 3 days) |
| `seasonal_chaos` | Seasonal Chaos | Holiday, school break, and travel request collide | holiday (day 21) + school_break (day 22) + vacation_request (day 23) |
| `conflict_cascade` | High Conflict Cascade | Multiple rejections followed by fairness complaint | 2x proposal_rejected (days 3-4) + fairness_complaint (day 5) |

### Edge Cases (4)

| ID | Name | Description | Events |
|----|------|-------------|--------|
| `constraint_conflict` | Constraint Conflict | Locked night and unavailability create infeasible constraint | locked_night_conflict (day 5) |
| `long_distance_exchange` | Long Distance Exchange | Heavy traffic or distance makes exchange impractical | traffic_delay (day 3) |
| `response_timeout` | Parent Does Not Respond | Parent fails to respond within time window | response_timeout (day 5, parent B) |
| `weekend_fragmentation` | Weekend Fragmentation | Swap request fragments a full weekend into split days | schedule_swap_request (day 13, parent A) |

### Expanded: Health (2)

| ID | Difficulty | Name | Events |
|----|------------|------|--------|
| `mental_health_day` | L1 | Mental Health Day | mental_health_day (day 5) |
| `doctor_appointment_conflict` | L2 | Doctor Appointment Conflict | doctor_appointment (day 4, parent A) |

### Expanded: School (5)

| ID | Difficulty | Name | Events |
|----|------------|------|--------|
| `sports_tournament_weekend` | L3 | Sports Tournament Weekend | sports_tournament (day 6, 2 days) |
| `parent_teacher_conference` | L2 | Parent-Teacher Conference | parent_teacher_conference (day 9) |
| `snow_day_exchange` | L1 | Snow Day Exchange | snow_day (day 7) |
| `school_year_start` | L2 | School Year Start | school_year_start (day 1, 5 days) |
| `child_activity_overload` | L3 | Child Activity Overload | 3x activity_added (days 3, 5, 8) |

### Expanded: Logistics (2)

| ID | Difficulty | Name | Events |
|----|------------|------|--------|
| `public_transport_strike` | L2 | Public Transport Strike | transport_strike (day 4, 2 days) |
| `car_breakdown_mid_exchange` | L1 | Car Breakdown Mid-Exchange | car_breakdown (day 6, parent B) |

### Expanded: Travel (2)

| ID | Difficulty | Name | Events |
|----|------------|------|--------|
| `late_flight_return` | L2 | Late Flight Return | late_flight (day 14, parent A) |
| `summer_schedule_shift` | L3 | Summer Schedule Shift | summer_shift (day 1, 14 days) |

### Expanded: Family (3)

| ID | Difficulty | Name | Events |
|----|------------|------|--------|
| `family_wedding` | L2 | Family Wedding | family_event (day 13, 2 days, parent B) |
| `funeral_travel` | L2 | Funeral Travel | funeral_travel (day 8, 3 days, parent A) |
| `grandparent_visit` | L1 | Grandparent Visit | grandparent_visit (day 10, 3 days, parent B) |

### Expanded: Holiday (1)

| ID | Difficulty | Name | Events |
|----|------------|------|--------|
| `religious_holiday_conflict` | L3 | Religious Holiday Conflict | religious_holiday (day 18, 2 days, parent A) |

### Expanded: Conflict (4)

| ID | Difficulty | Name | Events |
|----|------------|------|--------|
| `schedule_swap_chain` | L4 | Schedule Swap Chain | 3x schedule_swap_request (days 3, 7, 12) |
| `unilateral_schedule_change` | L4 | Unilateral Schedule Change | unilateral_change (day 5, parent A) |
| `parent_refuses_exchange` | L5 | Parent Refuses Exchange | exchange_refusal (day 7, parent B) |
| `major_schedule_change_request` | L4 | Major Schedule Change Request | major_change_request (day 1, parent A) |

### Expanded: Edge Cases (3)

| ID | Difficulty | Name | Events |
|----|------------|------|--------|
| `child_preference_conflict` | L3 | Child Preference Conflict | child_preference (day 10) |
| `child_refuses_exchange` | L4 | Child Refuses Exchange | child_refusal (day 6) |
| `emergency_relocation` | L5 | Emergency Relocation | emergency_relocation (day 3, parent A) |

### Expanded: Legal (1)

| ID | Difficulty | Name | Events |
|----|------------|------|--------|
| `court_order_update` | L5 | Court Order Update | court_order_update (day 14) |

### Expanded: Stress (1)

| ID | Difficulty | Name | Events |
|----|------------|------|--------|
| `multi_disruption_overlap` | L5 | Multi-Disruption Overlap | child_sick + school_closed + parent_travel + holiday (days 1-4) |

---

## Disruption Response Patterns (12)

Expected resolution paths for key scenarios, with archetype conflict flags.

| Scenario | Typical Resolution | High-Conflict Archetypes |
|----------|--------------------|--------------------------|
| `child_sick_exchange` | delay_exchange, temp_care, compensation | strategic_scorekeeper, high_conflict_scorekeeper |
| `parent_travel` | temp_custody_transfer, future_compensation | strategic_scorekeeper, strategic_avoidant |
| `unexpected_school_closure` | logistics_adjustment, daytime_coverage | flexible_scorekeeper |
| `proposal_rejection_loop` | new_proposal_bundle, compensation_balancing | high_conflict_scorekeeper, high_conflict_strategic |
| `response_timeout` | auto_accept_after_timeout | organizer_avoidant, avoidant_pair |
| `vacation_request` | future_compensation, split_vacation_days | strategic_scorekeeper, high_conflict_organizer |
| `holiday_override` | alternating_year_rule, split_day, compensation | high_conflict_scorekeeper, strategic_scorekeeper |
| `parent_refuses_exchange` | escalation, documentation, compensation | high_conflict_strategic, high_conflict_organizer |
| `child_refuses_exchange` | temp_flex, parent_mediation, review | high_conflict_scorekeeper, organizer_avoidant |
| `emergency_relocation` | schedule_rebuild, temp_primary, court_review | high_conflict_strategic, high_conflict_scorekeeper |
| `court_order_update` | constraint_rebuild, schedule_regeneration | high_conflict_organizer, strategic_avoidant |
| `multi_disruption_overlap` | triage_priority, temp_single_parent, batch_comp | high_conflict_strategic, strategic_scorekeeper |

---

## Test Matrix

**6 families × 12 archetypes × 49 scenarios = 3,528 high-value simulations**

Recommended high-value combinations:

| Family | Archetype | Scenario | Difficulty | Why |
|--------|-----------|----------|------------|-----|
| Simple Shared | organizer_scorekeeper | Child Sick | L1 | Baseline cooperative disruption |
| School Family | high_conflict_strategic | Compound Disruption | L4 | Worst-case stress test |
| Toddler | organizer_avoidant | Response Timeout | L2 | Tests unresponsive parent path |
| Teen | flexible_scorekeeper | Vacation Request | L3 | Disruption → fairness negotiation |
| Infant Primary | high_conflict_strategic | Conflict Cascade | L5 | Maximum adversarial combo |
| Blended Ages | strategic_scorekeeper | Seasonal Chaos | L4 | Multi-child holiday stress |
| Simple Shared | avoidant_pair | Parent Refuses Exchange | L5 | Low-engagement escalation |
| School Family | high_conflict_organizer | Court Order Update | L5 | Legal constraint rebuild |
| Teen | flexible_organizer | Child Preference Conflict | L3 | Teen autonomy scenario |
| Blended Ages | high_conflict_scorekeeper | Multi-Disruption Overlap | L5 | Maximum system stress |

---

## Monte Carlo Simulation

### Overview

The Monte Carlo runner (`lib/monte-carlo/runner.ts`) executes N simulated families with randomized disruptions and measures solver stability. It produces **engineering and policy insights only** — no behavioral predictions.

### Output Categories

| Category | Purpose | Storage Model |
|----------|---------|---------------|
| **Solver Stability** | Fairness drift, transitions, schedule volatility | `SolverRunMetrics` |
| **Edge Cases** | Rare constraint conflicts | `ConstraintConflict` |
| **Policy Gaps** | Events with no policy coverage | `PolicyGap` |
| **Failure Patterns** | Recurring solver failures | `FailurePattern` |
| **Guardrail Calibration** | Threshold testing for constraints | `GuardrailCalibration` |
| **Regression Tests** | Auto-generated from discovered failures | `RegressionTest` |

### Custody Logistics Stress Model

Real-world disruption frequencies (`lib/monte-carlo/stress-model.ts`) based on pediatric illness rates, school closure data, DOT travel statistics, and employment surveys.

| Disruption | Weekly Probability | Duration | Seasonal Peak | Age Sensitive |
|------------|--------------------|----------|---------------|---------------|
| Child illness | 6% | 2 days | Winter (2x) | Under 5 (1.8x) |
| Parent illness | 3% | 2 days | Winter (1.8x) | No |
| Child hospitalization | 0.2% | 3 days | None | No |
| School closure | 4% | 1 day | Winter (2.5x) | School-age only |
| School trip | 2% | 1 day | None | School-age (1x) |
| Activity conflict | 1.5% | — | Fall (2x) | 4-13 (1x) |
| Camp week | 2% | 5 days | Summer (4x) | 5-12 (1x) |
| Work emergency | 4% | 1 day | None | No |
| Parent travel | 3% | 3 days | None | No |
| Late pickup | 8% | — | None | No |
| Transport failure | 1% | 1 day | None | No |
| Traffic delay | 5% | — | None | Distance >20mi |
| Vacation request | 1.5% | 5 days | Summer (3x) | No |
| Flight delay | 0.5% | 1 day | None | No |
| Holiday conflict | 2% | 1 day | Winter (4x) | No |
| Holiday extension | 1% | 2 days | Winter (3x) | No |
| Swap request | 6% | — | None | No |
| Fairness complaint | 2% | — | None | No |
| Extra time request | 3% | — | None | No |

### Guardrail Sweep

Tests different constraint thresholds to find the sweet spot. Example:

```
max_transitions_per_week = [1, 2, 3, 4, 5]
→ value=2: infeasible 17%, stability 0.72
→ value=3: infeasible 4%, stability 0.68  ← recommended
→ value=4: infeasible 1%, stability 0.61
```

### API Usage

```
POST /api/monte-carlo
{ "action": "run", "config": { "runs": 1000, "horizon_weeks": 8, "disruption_model": "realistic" } }

POST /api/monte-carlo
{ "action": "sweep", "parameter": "max_transitions_per_week", "values": [1,2,3,4,5] }
```

### What This Data IS Used For

1. Discover solver edge cases
2. Calibrate constraint thresholds
3. Identify policy gaps
4. Build regression test suites
5. Improve UX flows (proposal bundle complexity)

### What This Data Is NOT Used For

- Parent personality models
- Proposal preference prediction
- Negotiation forecasting
- Any behavioral AI training
