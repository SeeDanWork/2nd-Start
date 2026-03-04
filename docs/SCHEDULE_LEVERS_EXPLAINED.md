# How Schedule Levers Work

Every lever that affects which parent has the child on any given night. Each lever includes a plain-English explanation and the underlying mathematics.

---

## How the Solver Thinks

The solver assigns every night in a planning window (default 126 days) to one of two parents. It uses a single binary variable per day:

```
x[d] = 0  means Parent A has the child on night d
x[d] = 1  means Parent B has the child on night d
```

It also tracks custody changes with a transition variable:

```
t[d] = 1  if the child switches parents between day d-1 and day d
t[d] = 0  if the same parent keeps the child
```

The solver then:
1. **Enforces hard constraints** (must be satisfied, no exceptions)
2. **Minimizes penalties** from soft constraints (tries its best, trades off between competing goals)

---

## Hard Constraints

These are non-negotiable. The solver will declare "no solution possible" rather than violate them.

### 1. Locked Nights

**Plain English**: "Dad can never have the child on school nights" or "Mom always has Wednesdays." A parent specifies days of the week where they cannot (or must) have custody. The solver treats this as an absolute rule.

**Math**: For each locked night specifying parent P on day-of-week W:
```
For every day d in the schedule where dayOfWeek(d) = W:
    x[d] = P_value    (0 for Parent A, 1 for Parent B)
```

**Exception**: During a bonus week (one parent gets uninterrupted time), locked nights are suspended.

**Where it comes from**: Onboarding wizard ("Which nights can you NOT have your child?") or constraint editor.

---

### 2. Max Consecutive Nights

**Plain English**: "No parent should have the child for more than 5 nights in a row." This prevents either parent from having an excessively long unbroken stretch, which research shows is harmful for young children's attachment.

**Math**: Uses a sliding window. If max is N nights, then in any window of N+1 consecutive days, the parent cannot occupy all of them:
```
For each window of (N+1) consecutive days:
    sum of days assigned to Parent P in that window <= N
```

Example: If max = 3 for Parent A, then in any 4-day window, Parent A can have at most 3 nights. This guarantees at least 1 night with Parent B in every 4-day stretch.

**Age defaults** (when no explicit constraint is set):

| Child's Age | Max Consecutive |
|------------|----------------|
| 0-6 months | 1 night |
| 6-12 months | 2 nights |
| 1-2 years | 2 nights |
| 2-3 years | 3 nights |
| 3-5 years | 4 nights |
| 5-7 years | 5 nights |
| 8-13 years | 7 nights |
| 14-17 years | 14 nights |

**Goal adjustment**: "Stability first" adds +1 (allows slightly longer blocks). "Minimize separation" subtracts -1 (forces more frequent switches).

**Multi-child rule**: The strictest child always wins. If you have a 2-year-old (max 2) and an 8-year-old (max 7), the family limit is 2.

---

### 3. Max Transitions Per Week

**Plain English**: "The child should not switch households more than 3 times per week." Too many transitions are destabilizing, especially for young children.

**Math**: For each calendar week (Mon-Sun):
```
sum of t[d] for all days d in that week <= max_transitions
```

Default: 3 transitions per week.

---

### 4. Weekend Split Bounds

**Plain English**: "Over any 4-week rolling window, each parent should get roughly half the weekend nights, give or take 10%."

**Math**: Over a rolling window of W weeks (default 4):
```
weekend_nights_in_window = all Friday and Saturday nights (or Sat/Sun, depending on setting)
parent_A_weekends = count of weekend nights assigned to Parent A
target = total_weekend_nights * target_percent / 100
tolerance = total_weekend_nights * tolerance_percent / 100

parent_A_weekends >= target - tolerance
parent_A_weekends <= target + tolerance
```

Default: 50% target, 10% tolerance. So in a 4-week window with 8 weekend nights, Parent A gets between 3 and 5.

---

### 5. Minimum Nights Per 2 Weeks (Onboarding Only)

**Plain English**: "Each parent must get at least X nights in any 2-week period." Prevents one parent from being nearly shut out.

**Math**:
```
total_parent_A_nights = n - sum(x)  >= minimum_A
total_parent_B_nights = sum(x)      >= minimum_B
```

---

### 6. Disruption Locks (Highest Priority)

**Plain English**: "Dad is sick on March 10-12, so the child must be with Mom those days." Disruption events (illness, travel, emergencies) generate hard date-specific locks that override everything.

**Math**:
```
For each locked date d with assigned parent P:
    x[d] = P_value
```

These are tier 0 -- they override even locked nights and max consecutive constraints.

---

## Soft Constraints (Penalties)

The solver minimizes a weighted sum of penalties. Each penalty captures something undesirable, and the weight controls how much the solver cares about it relative to other penalties.

```
Total Cost = w1 * penalty1 + w2 * penalty2 + w3 * penalty3 + ...
```

Higher weight = solver tries harder to avoid that penalty.

### 1. Fairness Deviation (default weight: 100)

**Plain English**: "How far is the schedule from a 50/50 split?" If one parent ends up with significantly more nights, this penalty grows. The solver tries to keep things balanced.

**Math**:
```
target_B_nights = total_days / 2    (or based on target_share_pct)
actual_B_nights = sum(x[d] for all d)
penalty = |actual_B_nights - target_B_nights|
cost = 100 * penalty
```

Example: Over 126 days, target is 63 nights each. If Parent B gets 70 nights, the penalty is |70 - 63| = 7, costing 700 points.

**What this means in practice**: The solver is willing to add about 2 extra transitions (2 * 50 = 100 points) to reduce fairness deviation by 1 night (100 points). Fairness and transitions are roughly balanced.

---

### 2. Total Transitions (default weight: 50)

**Plain English**: "How many times does the child switch households?" Every switch is disruptive -- packing bags, adjusting routines, emotional transitions. The solver tries to minimize these.

**Math**:
```
total_transitions = sum(t[d] for all d)
cost = 50 * total_transitions
```

Example: A 7-on/7-off schedule over 126 days has about 18 transitions. A 2-2-3 pattern has about 54. The difference in cost: (54-18) * 50 = 1,800 points.

---

### 3. Non-Daycare/Non-School Handoffs (default weight: 30)

**Plain English**: "If the child switches parents on a day without school or daycare, that means a direct parent-to-parent exchange -- which is harder to coordinate and can be more stressful in high-conflict situations."

**Math**:
```
For each transition day d:
    if dayOfWeek(d) is NOT a school/daycare day, or it's a holiday with daycare closed:
        non_daycare_transitions += t[d]
cost = 30 * non_daycare_transitions
```

This pushes the solver to schedule custody changes on school/daycare days where the child naturally moves between homes via a neutral location.

---

### 4. Weekend Fragmentation (default weight: 40)

**Plain English**: "Don't split a weekend in half." If the child is with Dad on Friday night but Mom on Saturday night, neither parent gets a real weekend. The solver prefers whole weekends with one parent.

**Math**: For each weekend (Friday + Saturday, or Saturday + Sunday):
```
fragmented = 1  if Friday and Saturday are assigned to DIFFERENT parents
fragmented = 0  if same parent

Technically: fragmented = x[friday] XOR x[saturday]
cost = 40 * sum(fragmented for each weekend)
```

Example: Over 18 weeks, if 4 weekends are fragmented, cost = 4 * 40 = 160 points.

---

### 5. School-Night Disruption (default weight: 60)

**Plain English**: "Don't make the child switch homes on a school night." Transitions on Sunday through Thursday night mean the child wakes up in a different house before school. The solver avoids this when possible.

**Math**:
```
For each transition day d where d is Sunday-Thursday (school nights):
    school_night_transitions += t[d]
cost = 60 * school_night_transitions
```

This has a higher weight than total transitions (60 vs 50), meaning the solver will accept a non-school-night transition rather than a school-night one.

---

### 6. Weekend Parity (Onboarding only, variable weight)

**Plain English**: "Over the full schedule, each parent should get roughly equal weekend nights." Separate from weekend fragmentation -- this is about total count balance, not whether individual weekends are split.

**Math**:
```
B_weekend_nights = count of weekend nights assigned to Parent B
target = total_weekend_nights / 2
penalty = |B_weekend_nights - target|
cost = weight * penalty
```

---

## How Weights Are Modified

Weights don't stay at their defaults. They pass through three modification stages:

### Stage 1: Age-Based Multipliers

The youngest child's age band determines multipliers on every weight:

| | Fairness | Transitions | Non-Daycare | Weekend Frag | School Night |
|---|---|---|---|---|---|
| **Infant** (0-1y) | 0.7x | **2.0x** | 1.5x | 1.0x | 0.5x |
| **Young Child** (1-5y) | 0.8x | **1.5x** | 1.2x | 1.0x | 0.8x |
| **School Age** (5-10y) | 1.0x | 1.0x | 1.0x | 1.0x | 1.0x |
| **Teen** (11-17y) | **1.5x** | 0.7x | 0.5x | 1.2x | 1.0x |

**Plain English**:
- **Infants**: Stability is king. Transitions cost 2x as much. Fairness is less important (0.7x) because attachment to the primary caregiver matters more than equal time.
- **Teens**: Fairness becomes more important (1.5x) because teens are acutely aware of time imbalances. Transitions matter less (0.7x) because they're more adaptable.

### Stage 2: Living Arrangement Multipliers

| | Fairness | Transitions | Weekend Frag | School Night |
|---|---|---|---|---|
| **Shared custody** | 1.0x | 1.0x | 1.0x | 1.0x |
| **Primary + visits** | **0.5x** | **1.5x** | 0.7x | **1.2x** |
| **Undecided** | 1.0x | 1.0x | 1.0x | 1.0x |

**Plain English**: In a primary-custody arrangement, 50/50 isn't the goal, so fairness is halved. But minimizing transitions is more important (1.5x) because the visiting parent's time is precious and shouldn't be disrupted.

### Stage 3: Multi-Child Aggregation

When a family has multiple children:

- **Stability weights** (transitions, school night, weekend fragmentation): Take the MAX across all children. The most vulnerable child sets the floor.
- **Fairness weights**: Weighted average. Under-5s count at 0.5x (fairness less critical), teens at 1.5x (fairness more critical).
- **Safety cap**: If any child is under 5, fairness weight can never exceed the highest stability weight. Young child safety always wins over equal time.

**Example**: Family with a 2-year-old and a 12-year-old:
- Transitions weight: max(50*1.5, 50*0.7) = 75 (toddler governs)
- Fairness weight: average(100*0.8*0.5, 100*1.5*1.5) = average(40, 225) = 132.5
- But the safety cap kicks in: fairness (132.5) > max stability (75), so fairness is capped at 75.

---

## The Five Schedule Profiles

During onboarding, the solver runs 5 times with different weight profiles, producing 5 schedule options:

### 1. Stability First
- Transitions = **200**, Fairness = 40
- "Fewest possible switches. Accept some time imbalance."
- Best for: Very young children, high-conflict families

### 2. Fairness First
- Fairness = **200**, Transitions = 40
- "Equal time above all else. More switches are acceptable."
- Best for: Older children, cooperative parents

### 3. Logistics First
- Non-School Handoffs = **200**, Fairness = 60
- "Every custody change happens at school or daycare. No direct exchanges."
- Best for: High-conflict families, long commutes

### 4. Weekend Parity First
- Weekend Fragmentation = **200**, Weekend Parity = **200**
- "Both parents get equal, whole weekends."
- Best for: Parents who prioritize quality weekend time

### 5. Child Routine First
- School Night Disruption = **200**, Transitions = 80
- "Never disrupt a school night. Keep weekday routine stable."
- Best for: School-age children with strict routines

Each profile produces a meaningfully different schedule (minimum 2-day difference between any pair).

---

## Disruption Events

When life happens, the overlay engine translates events into solver modifications:

### Event Types (13 total)
PUBLIC_HOLIDAY, SCHOOL_CLOSED, SCHOOL_HALF_DAY, EMERGENCY_CLOSURE, CHILD_SICK, CAREGIVER_SICK, PARENT_TRAVEL, TRANSPORT_FAILURE, FAMILY_EVENT, CAMP_WEEK, BREAK, SUMMER_PERIOD, OTHER_DECLARED

### Override Actions

| Action | What Happens | Example |
|--------|-------------|---------|
| **NO_OVERRIDE** | Nothing changes | Minor family event |
| **LOGISTICS_FALLBACK** | Exchange location changes, not assignment | School closed but parents can swap at home |
| **BLOCK_ASSIGNMENT** | Blocked parent loses their days, gets up to 3 compensatory days after | Parent travel, child illness |
| **DELAY_EXCHANGE** | Current assignment frozen (no transitions) | Short transport disruption |
| **GENERATE_PROPOSALS** | Solver re-runs with boosted fairness weight (1.5x) | Extended illness, summer break |

### Compensatory Days Math
```
compensatory_days = min(disruption_duration_in_days, 3)
These days are hard-locked to the affected parent after the disruption ends.
```

### Weight Adjustments
- Disruption > 72 hours: fairness weight * 1.3 (ensure rebalancing)
- Proposal-requiring disruption: fairness weight * 1.5
- Night before a holiday: school-night penalty * 0.1 (the night before a holiday is basically a weekend)
- Multiple overlapping disruptions: multipliers stack multiplicatively (1.3 * 1.3 = 1.69)

---

## Request / Proposal System

### How Swaps Work

1. Parent requests specific dates (e.g., "I need March 15-17")
2. All OTHER days in the schedule are frozen -- solver cannot change them
3. Solver re-runs on just the affected window, trying to accommodate the request while minimizing disruption
4. Result: up to 3 proposal options ranked by total penalty

### Request Types

| Type | Effect on Solver |
|------|-----------------|
| **NEED_COVERAGE** | Requesting parent gives up dates (assign to other parent) |
| **WANT_TIME** | Requesting parent takes dates (assign to requesting parent) |
| **BONUS_WEEK** | One parent gets uninterrupted block, locked nights suspended |
| **SWAP_DATE** | Specific date exchange between parents |

### Frozen Assignments Math
```
For each day d NOT in the request dates:
    x[d] = current_schedule[d]    (hard constraint, immovable)

For request dates:
    Solver optimizes freely, subject to all other constraints
```

---

## Emergency Mode

**Plain English**: "Everything is falling apart -- temporarily relax some rules."

When activated:
1. Specified hard constraints are temporarily relaxed (e.g., max consecutive increased from 3 to 7)
2. The `returnToBaselineAt` date defines when original constraints restore
3. Original constraint values are stored so they can be restored exactly

---

## Guardrails (Auto-Approve Rules)

These don't affect the schedule directly but control whether proposals need the other parent's approval:

| Rule | Auto-Approves If... |
|------|-------------------|
| **FAIRNESS_BAND** | Overnight delta stays within X nights |
| **MAX_TRANSITIONS** | Additional transitions below threshold |
| **MAX_STREAK** | Max consecutive streak stays within limits |
| **REQUEST_TYPE** | Request is of an approved type (e.g., always approve NEED_COVERAGE) |

---

## Priority Hierarchy

When levers conflict, this hierarchy determines the winner (tier 1 = highest):

| Tier | What | Overrides |
|------|------|-----------|
| **1** | Hard constraints (locked nights, max consecutive) | Everything below |
| **2** | Young child stability (transition caps for youngest child) | Everything below |
| **3** | Living arrangement (shared vs primary) | Everything below |
| **4** | Age-band weight profile | Everything below |
| **5** | Fairness & weekend goals | Everything below |
| **6** | Parent preferences | Only logistics |
| **7** | Logistics optimizations | Nothing |

**Key implication**: A parent's preference for 50/50 time (tier 6) can never override a toddler's max-consecutive limit (tier 1). The system is child-first by design.

---

## Solver Parameters

| Parameter | Default | What It Controls |
|-----------|---------|-----------------|
| Timeout | 30 seconds | How long the solver searches for better solutions |
| Max solutions | 10 | How many distinct schedules to collect |
| Min Hamming distance | 2 | Minimum days different between collected solutions |
| Schedule horizon | 18 weeks (126 days) | How far ahead to plan |
| Proposal horizon | 8 weeks (56 days) | How far ahead proposals can affect |
| Weekend split window | 4 weeks | Rolling window for weekend balance checking |

---

## Interaction Examples

### "Why did my child switch homes on Wednesday?"
The solver weighed: school-night penalty (60) vs. the cost of a longer consecutive stretch that would violate max-consecutive. If max-consecutive is 3 (hard constraint), the solver HAD to create a transition somewhere, and Wednesday was the least-costly option.

### "Why isn't it exactly 50/50?"
Fairness weight (100) competes with other penalties. If making it exactly even would require 4 extra transitions (4 * 50 = 200 points), but being off by 1 night only costs 100 points, the solver accepts 1-night imbalance to avoid extra disruption.

### "Why does my infant's schedule look so different from my teen's?"
Infant multipliers: transitions cost 2x, fairness costs 0.7x. The solver heavily prioritizes stability over equal time. Teen multipliers flip this: fairness costs 1.5x, transitions cost 0.7x. The solver prioritizes equal time since teens handle transitions better.

### "What happens when both parents lock the same night?"
Conflict detection catches this before the solver runs. The system reports "Both parents have locked nights that prevent either from having the child on [day]" and blocks schedule generation until resolved.
