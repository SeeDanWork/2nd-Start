# How Schedule Decisions Are Made

Plain-English guide to how the system generates and adjusts co-parenting schedules.

---

## The Big Picture

When a family goes through onboarding, the system collects information about the children, both parents' availability, and what matters most to the family. It then generates 3-5 different schedule options, each one optimized for a different priority (stability, fairness, logistics, etc.). The family picks the one that fits best.

After onboarding, if a parent needs a change (swap a night, get coverage), the system generates proposal options that respect the existing schedule while accommodating the request.

When life disrupts the schedule (illness, school closures, holidays, emergencies), a disruption overlay engine adjusts the schedule using deterministic rules — without requiring user input for routine situations.

Over time, the system learns from a family's repeated decisions and reduces prompts by converting approved patterns into household defaults.

Every decision is deterministic. Same inputs always produce the same outputs. No randomness.

---

## What the System Knows About Your Family

### Children's Ages

The system groups children into 9 age bands, each with developmentally appropriate limits:

| Age Band | Max Consecutive Nights | Max Nights Away | Preferred Templates |
|----------|----------------------|-----------------|-------------------|
| 0-6 months | 1 | 1 | 2-2-3 Daytime, 2-2-3 |
| 6-12 months | 2 | 2 | 2-2-3, 3-4-4-3 |
| 1-2 years | 2 | 3 | 2-2-3, 3-4-4-3 |
| 2-3 years | 3 | 3 | 2-2-3, 3-4-4-3, 2-2-5-5 |
| 3-5 years | 4 | 4 | 3-4-4-3, 2-2-5-5, 2-2-3 |
| 5-7 years | 5 | 5 | 2-2-5-5, 3-4-4-3, 7-on-7-off |
| 8-10 years | 7 | 7 | 7-on-7-off, 2-2-5-5 |
| 11-13 years | 7 | 7 | 7-on-7-off, 2-2-5-5, Primary + Midweek |
| 14-17 years | 7 | 7 | 7-on-7-off, 2-Week Blocks, Primary + Midweek |

### Living Arrangement

The family picks one of three arrangements during onboarding:

- **Shared** (default): Both parents expect roughly equal time. The system balances 50/50 splits and treats fairness as important.
- **Primary with visits**: One parent is the primary home. The system relaxes fairness penalties (unequal splits are expected), increases transition penalties (fewer handoffs matter more for stability), and suggests primary-home schedule templates.
- **Undecided**: Treated the same as shared. Safe default.

### Family Goals

Three optional goals adjust the defaults:

- **Stability first**: Adds 1 to the max consecutive nights cap. Allows longer uninterrupted blocks with each parent.
- **Minimize separation**: Subtracts 1 from the max consecutive cap. Keeps blocks shorter so the child sees both parents more often.
- **Fairness strict**: No numeric change, but signals the system to weight fairness higher in template selection.

### Parent Availability

Each parent provides:

- **Locked nights**: Days of the week they absolutely cannot have the child overnight (e.g., every Tuesday due to work).
- **Target share**: What percentage of overnights they want (default 50%).
- **Max handoffs per week**: Soft cap on how many times custody changes hands (default 3).
- **Max consecutive nights away**: Longest the child should go without seeing this parent (default 5).
- **Weekend preference**: Alternate weekends, fixed weekends, or flexible.

---

## Step 1: Check for Impossible Situations

Before generating any schedule, the system checks whether the constraints allow a valid solution:

- If both parents lock the same day of the week, no one is available that day. That is a conflict.
- If one parent locks all 7 days, the child can never be with them. That is a conflict.
- If a parent wants 50% of nights but locks 5 out of 7 days, there are not enough available nights. That is a conflict.
- If both parents want no-contact exchanges but the children have no school or daycare, there is no neutral handoff point.

If the situation is impossible, the system returns an error explaining what is wrong and what to relax. It does not try to force a schedule.

---

## Step 2: Build Solver Weights

The system uses a weighted scoring approach. Each schedule quality is given a numeric weight that says how important it is. Higher weight means the system tries harder to optimize for that quality.

### Base Weights

| Quality | Base Weight | What It Measures |
|---------|-----------|-----------------|
| Fairness deviation | 100 | How far the overnight split is from the target |
| Total transitions | 50 | How many times custody changes hands |
| Non-daycare handoffs | 30 | Handoffs that happen outside school or daycare |
| Weekend fragmentation | 40 | Weekends split across parents instead of kept whole |
| School-night disruption | 60 | Custody changes on Sunday through Thursday nights |

### Age Adjustments

These base weights get multiplied based on the youngest child's age profile:

| Profile | Applies To | Fairness | Transitions | Non-Daycare | Weekend Frag | School-Night |
|---------|-----------|----------|-------------|-------------|-------------|-------------|
| Infant | 0-12 months | 0.7x | **2.0x** | 1.0x | 1.0x | 0.5x |
| Young child | 1-5 years | 0.8x | **1.5x** | 1.0x | 1.0x | 0.8x |
| School age | 5-10 years | 1.0x | 1.0x | 1.0x | 1.0x | 1.0x |
| Teen | 11-17 years | **1.5x** | 0.7x | 1.0x | 1.0x | 1.0x |

- **Infants**: Fairness weight drops to 70%, transition weight doubles to 200%. The system cares much more about keeping transitions low and less about perfect 50/50.
- **Young children (1-5)**: Transition weight goes up 50%. Fairness drops slightly.
- **School age (5-10)**: No change. Base weights apply as-is.
- **Teens (11-17)**: Fairness weight increases 50%, transition weight drops to 70%. Teens handle transitions better, but care more about perceived fairness.

### Living Arrangement Adjustments

After the age adjustment, living arrangement multipliers apply:

| Arrangement | Fairness | Transitions | Non-Daycare | Weekend Frag | School-Night |
|------------|----------|-------------|-------------|-------------|-------------|
| Shared | 1.0x | 1.0x | 1.0x | 1.0x | 1.0x |
| Primary visits | **0.5x** | **1.5x** | 1.0x | 0.7x | **1.2x** |
| Undecided | 1.0x | 1.0x | 1.0x | 1.0x | 1.0x |

Both multipliers stack. An infant in a primary-visits arrangement would have fairness weight = 100 x 0.7 (age) x 0.5 (arrangement) = 35. Transitions = 50 x 2.0 x 1.5 = 150. The system strongly prioritizes stability over fairness for that family.

---

## Step 2b: Multi-Child Weight Aggregation

For families with more than one child, the system uses a more nuanced approach than simply following the youngest child's profile. The goal is to increase human realism for small families while preventing complexity explosion in large ones.

### Dual-Mode Scoring

The system uses a deterministic mode switch based on the number of children:

- **Individual Mode (1-4 children)**: Each child is scored separately and their contributions are aggregated. This gives nuanced modeling where every child's age influences the result.
- **Grouped Mode (5+ children)**: Children are collapsed into up to three meta-groups (Young 0-5, School 6-12, Teen 13-17) and each group contributes once. This prevents headcount distortion — a family with 6 school-age children should not get 6x the weight.

The threshold is fixed at 4. No dynamic heuristics.

### Hard Constraints: Strictest Child Wins

For safety-critical limits (max consecutive nights, max nights away), the family-level value is always the **minimum** across all children:

```
family_limit = MIN(child_limit for each child)
```

A family with a 2-year-old (max 3 consecutive) and a 14-year-old (max 7) gets a family limit of 3. The toddler's safety needs govern the whole household.

### Soft Weights: Category-Specific Aggregation

Different scoring categories use different aggregation rules:

**Stability categories** (transitions, school-night disruption, weekend fragmentation):

```
weight = MAX(weight from each child's age profile)
```

The most sensitive child defines the weight. If a toddler needs low transitions, the whole family gets that high transition penalty — even if the teenager would be fine with more handoffs.

**Fairness categories** (fairness deviation):

```
weight = weighted_average(child weights)
```

Each child contributes once, with age-based multipliers:
- Children under 5: contribute at **0.5x** (fairness matters less for young children; stability matters more)
- Children 5-10: contribute at **1.0x**
- Children 11+: contribute at **1.5x** (teens have stronger fairness expectations)

**Stability-over-fairness precedence**: If any child in the family is under 5, the fairness weight is **capped** at the highest stability weight. This prevents the fairness goal from overriding safety requirements for young children.

### Sibling Unity

All children share the same custody assignment every day. The system enforces a `SIBLING_DIVERGENCE = 0` invariant — siblings are never split across households.

### Example: Family With Children Ages 2, 7, and 14

- **Hard constraints**: maxConsecutive = MIN(3, 7, 7) = **3** nights
- **Scoring mode**: Individual (3 children, ≤ 4)
- **Stability weight**: MAX of young_child (1.5x), school_age (1.0x), teen (0.7x) = **1.5x** → transitions = 50 x 1.5 = 75
- **Fairness weight**: weighted avg of young_child (0.8x at 0.5 contribution), school_age (1.0x at 1.0), teen (1.5x at 1.5) = (40 + 100 + 225) / (0.5 + 1.0 + 1.5) = **121.7**
- **Fairness capped**: The 2-year-old is under 5, so fairness is capped at max stability weight = 75 → **fairness = 75**
- The system strongly protects the toddler's stability while still considering everyone's needs

---

## Step 3: Generate 5 Schedule Options

The system generates one schedule for each of 5 different priority profiles. Each profile uses different weights so the resulting schedules emphasize different tradeoffs:

### Profile A: Stability First
- Very high transition penalty (200), low fairness penalty (40)
- Produces schedules with long blocks and few handoffs
- Might produce a 45/55 split instead of 50/50 to avoid extra transitions
- Best for: families who value routine, long-distance situations

### Profile B: Fairness First
- Very high fairness penalty (200) and weekend parity (150), low transition penalty (40)
- Produces schedules as close to the target split as possible
- Might need more handoffs to achieve exact parity
- Best for: families where equal time is the top priority

### Profile C: Logistics First
- Very high non-school handoff penalty (200)
- Pushes all custody changes to school drop-off or daycare pickup
- Minimizes direct parent-to-parent contact
- Best for: high-conflict families, or families where school is the natural exchange point

### Profile D: Weekend Parity
- Very high weekend fragmentation (200) and weekend parity (200) penalties
- Ensures Fridays and Saturdays are distributed evenly
- May create mid-week transitions to balance weekends
- Best for: families where weekends carry special importance

### Profile E: Child Routine
- Very high school-night disruption penalty (200)
- Moves all transitions to Friday or Saturday
- Keeps Monday through Friday consistent for the child
- Best for: families with school-age children who need weekday stability

After the age and arrangement multipliers are applied, these profile weights get further scaled. For a primary-visits family, even the Fairness First profile will not push as hard for 50/50.

---

## Step 4: How the Solver Works

For each profile, the system runs a mathematical optimization solver (Google OR-Tools CP-SAT). Here is what it does in plain terms:

### The Decision

For every day in the planning window (typically 18 weeks / ~126 days), the solver decides: does the child sleep at Parent A's home or Parent B's home? This is represented as a binary variable for each day — 0 for Parent A, 1 for Parent B.

A separate "transition" variable tracks whether custody changed from the previous day.

### Rules It Cannot Break (Hard Constraints)

Hard constraints are **absolute** — the solver will never violate them, even if the resulting schedule scores poorly on soft metrics. They are applied in this order:

1. **Disruption locks are highest priority.** If the disruption overlay engine has locked a date to a specific parent (e.g., other parent is traveling), that assignment is fixed before anything else.
2. **Locked nights are absolute.** If Parent A says they cannot have the child on Tuesdays, the child is always with Parent B on Tuesdays. (Exception: locks are suspended during bonus weeks.)
3. **Max consecutive nights are enforced.** If the max is 5, the solver uses a sliding window to ensure no parent has the child for more than 5 nights in a row.
4. **Max transitions per week** (if set). Prevents ping-ponging — custody cannot change hands more than a set number of times in any ISO week.
5. **Weekend split bounds** (rolling 8-week windows). Ensures neither parent monopolizes weekends over longer periods.
6. **Minimum nights per 2 weeks** (if set). If a parent requires at least 4 nights per 2-week cycle, the solver guarantees it.

### Qualities It Optimizes (Soft Constraints)

The solver tries to minimize a total penalty score. Each quality contributes to the penalty based on the profile's weights:

- **Fairness penalty**: How many nights the split deviates from the target. If the target is 7 nights for Parent B in a 2-week period and the schedule gives 5, the penalty is 2 times the fairness weight.
- **Transition penalty**: Each time custody changes from one day to the next adds to the penalty. Linearized as `t[d] = x[d] XOR x[d-1]`.
- **Non-school handoff penalty**: Each transition that happens on a non-school/daycare day adds extra penalty. Only days in the family's configured daycare days avoid this penalty.
- **Weekend fragmentation penalty**: Each weekend (Friday + Saturday pair) where the two nights are with different parents adds penalty.
- **School-night disruption penalty**: Each transition on Sunday through Thursday adds penalty. These are "school nights" — the night before a school day. (See Rule C below for how holidays modify this.)
- **Weekend parity penalty**: The difference in weekend nights between parents adds penalty.

The solver finds the assignment of all days that produces the **lowest total penalty** while respecting all hard constraints.

### Day-of-Week Convention

The system stores days in JavaScript convention (0=Sunday, 6=Saturday) in the database and API. The Python solver converts to Python convention (0=Monday, 6=Sunday) for date calculations. All conversions are tested and deterministic:

```
JS Sunday (0) → Python Sunday (6)
JS Friday (5) → Python Friday (4)
```

### Determinism

The base schedule solver uses 4 worker threads for parallel evaluation, and the onboarding brain solver uses 1 worker thread. Both use fixed parameters and no randomness. Same input always produces the same output.

### Timeout

The solver gets a 30-second total timeout. If it cannot find a perfect solution in time, it returns the best solution found so far.

---

## Step 5: Fallback When Solver is Unavailable

If the mathematical solver is not available (e.g., the Python optimization service is down), the system falls back to pattern matching.

It has 8 predefined 14-day custody patterns (using Mon-Sun layout, A=Parent A, B=Parent B):

| Template | Pattern (Week 1 → Week 2) | Handoffs | Max Block | Split |
|----------|--------------------------|----------|-----------|-------|
| **2-2-3** | AA BB AAA \| BB AA BBB | 6 | 3 | 7/7 |
| **2-2-3 Daytime** | AA BB AAA \| BB AA BBB | 6 | 3 | 7/7* |
| **3-4-4-3** | AAA BBBB \| AAAA BBB | 4 | 4 | 7/7 |
| **2-2-5-5** | AA BB AAAAA \| BBBBB | 4 | 5 | 7/7 |
| **7-on-7-off** | AAAAAAA \| BBBBBBB | 2 | 7 | 7/7 |
| **Primary + Midweek** | AA B AAAB \| AA B AAA B | 8 | 4 | 10/4 |
| **2-Week Blocks** | AAAAAAAAAAAAA A | 1 | 14 | 14/0 |
| **Primary + Weekends** | AAAAA BB \| AAAAA BB | 4 | 5 | 10/4 |

*2-2-3 Daytime is designed for infants (0-6m) with daytime-only contact; overnight pattern serves as a placeholder.

Each priority profile has a preferred order of patterns. The system tries them in order and uses the first one that does not violate any locked nights.

For primary-visits families, the Stability and Child Routine profiles prefer the primary-home patterns (Primary + Weekends, Primary + Midweek) instead of the standard ones.

---

## Step 6: Diversity Filtering

After generating up to 5 options, the system checks that they are actually different from each other. It counts how many days differ between each pair of options (Hamming distance). If two options differ by fewer than 2 days, one is removed (unless that would leave fewer than 3 options).

This prevents showing the family five schedules that are nearly identical.

---

## Step 7: Score and Explain Each Option

### Statistics

For each option the system calculates:

- **Stability score** (0 to 1.0): 1.0 means zero transitions. Drops as handoffs increase. Formula: 1.0 minus (transitions divided by 7, which is the assumed max for a 2-week period).
- **Fairness score** (0 to 1.0): 1.0 means exactly on target. Drops as the overnight split deviates. Formula: 1.0 minus (deviation divided by half the total nights).
- **Weekend parity score** (0 to 1.0): 1.0 means weekends are split evenly. Drops as one parent gets more weekend nights.
- Counts of: each parent's total overnights, weekend nights, transition count, non-school handoffs, school-night consistency percentage, max consecutive streak for each parent.

### Explanations

Each option gets a human-readable explanation with:

- **Summary bullets** (3-6 points): The overnight split, handoffs per week, where exchanges happen, weekend distribution, and the key tradeoff.
- **Respected constraints**: Which locked nights were honored, whether no-contact preferences were met, minimum night guarantees.
- **Tradeoffs**: What the schedule sacrificed to optimize for its priority. For example, "Accepts slight fairness drift to minimize transitions" for the Stability profile.
- **Assumptions** (single-parent mode only): Notes that Parent B's defaults are estimated and the schedule should be re-optimized when Parent B joins.

---

## Template Recommendations (Separate from Solver)

In addition to the solver-generated options, the system scores the 8 predefined templates to rank which one best fits the family. This scoring uses four components:

### Age Fit (40% of score)
How well the template matches the youngest child's age band. Templates listed as preferred for that band score highest (1.0 for first choice, 0.8 for second, 0.6 for third). Templates not listed score 0.3 baseline, and get penalized further if their longest block exceeds the age band's limit.

### Goal Fit (25% of score)
How well the template matches the family's stated goals:
- Stability first: Fewer handoffs score higher.
- Minimize separation: Shorter max blocks score higher.
- Fairness strict: Symmetric 50/50 templates score 1.0; asymmetric ones score 0.3.

### Logistics Fit (20% of score)
How practical the template is given the family's situation:
- Long distance between homes (over 45 minutes) penalizes high-handoff templates.
- Very long distance (over 90 minutes) bonuses low-handoff templates like 7-on-7-off.
- School-aligned templates get a bonus when children are in school or daycare.

### Constraint Fit (15% of score)
How well the template works with hard constraints:
- Many locked nights (3+) penalizes frequent-handoff templates.
- Shift work bonuses long-block templates.
- No in-person exchange preference bonuses school-aligned templates.

The system assigns a confidence level based on how far ahead the top template is:
- Gap of 0.15+ to the second choice: high confidence
- Gap of 0.10+: medium confidence
- Gap under 0.10: low confidence (close call, family should review carefully)

---

## Cross-Family Preset Recommendations

At onboarding and during policy setup, the system can suggest defaults based on aggregated patterns from families in similar situations. These are **suggestions only** — they influence initial rankings and defaults but never silently change an active schedule.

### What Drives Suggestions

The preset engine is a pure, deterministic function that takes:

- **Locale** (country/state)
- **Living arrangement** (shared, primary visits, undecided)
- **Youngest child's age band**
- **Number of children**
- **Commute time between homes** (minutes)
- **Whether school/daycare is the exchange anchor**

### What It Returns

- **Template ranking**: Reordered list of preferred templates. For example, primary-visits families see Primary + Weekends and Primary + Midweek ranked higher. Long commutes (>30 min) push 7-on-7-off and 2-Week Blocks to the top to minimize transitions.
- **Suggested overlay policies**: Default disruption handling rules. For example, families with young children get an automatic DELAY_EXCHANGE policy for sick days.
- **Prompt lead time**: How far in advance the system should ask about upcoming events. Default is 24 hours. Long commutes (>45 min) increase this to 48 hours; infants increase to 36 hours.
- **Plain-language reasons**: Every suggestion includes an explanation like: "Families with similar school-age kids in your area often choose week-on/week-off in summer to reduce transitions."

Once a family makes their own choices, those choices become the permanent source of truth. Presets are never re-applied after initial setup.

---

## Disruption Overlay Engine

The disruption overlay engine handles calendar-driven events (holidays, school closures) and unpredictable life disruptions (sick days, emergencies, travel) with minimal user input. The key principle: the system manages reality by default.

### How Disruptions Are Represented

Every special situation becomes a **DisruptionEvent** with:

- **Type** (one of 13 categories): PUBLIC_HOLIDAY, SCHOOL_CLOSED, SCHOOL_HALF_DAY, EMERGENCY_CLOSURE, CHILD_SICK, CAREGIVER_SICK, PARENT_TRAVEL, TRANSPORT_FAILURE, FAMILY_EVENT, CAMP_WEEK, BREAK, SUMMER_PERIOD, OTHER_DECLARED
- **Scope**: HOUSEHOLD (affects everyone) or CHILD_ID (specific child — but schedule remains unified due to sibling unity)
- **Source**: AUTO_LOCALE (from calendar), AUTO_INFERRED (from patterns), USER_DECLARED (parent reported), or LEARNED_POLICY (from past behavior)
- **Override strength**: NONE (informational), LOGISTICS_ONLY (just change exchange details), SOFT (adds scoring penalties), HARD (locks assignments)
- **Date range**: Start and end dates (inclusive)
- **Metadata**: Additional context like affected parent, exchange preferences, notes

### Overlay Policies

When a disruption occurs, the system selects a policy that determines how to respond. Policies exist at three levels with strict precedence:

1. **Family-specific policies** (set by the family or promoted from learned behavior) — highest priority
2. **Learned policies** (automatically promoted from repeated accepted decisions)
3. **Global defaults** (built-in safe rules) — lowest priority
4. **Safe fallback** (NO_OVERRIDE — if nothing else matches, do nothing)

### The Five Actions

Each policy maps to one of five deterministic actions:

| Action | What It Does | When Used |
|--------|-------------|-----------|
| **NO_OVERRIDE** | Keep the base schedule as-is (Rule A: base schedule sovereignty) | Family events, unknown situations |
| **LOGISTICS_FALLBACK** | Keep custody assignment, change exchange location/time (Rule B) | School closed, holidays, transport failure |
| **DELAY_EXCHANGE** | Keep current parent, prevent scheduled transitions (Rule D) | Short illness (≤72h), minor disruptions |
| **BLOCK_ASSIGNMENT** | Lock dates to a specific parent | Caregiver sick, parent travel, camp week |
| **GENERATE_PROPOSALS** | Invoke the solver to rebalance (Rule E) | Long disruptions (>72h), breaks, summer |

### Default Policy Table

| Disruption Type | Default Action | Auto or Prompt? | Creates Comp Days? |
|----------------|---------------|-----------------|-------------------|
| Public holiday | Logistics fallback | Auto | No |
| School closed | Logistics fallback | Auto | No |
| School half-day | Logistics fallback | Auto | No |
| Emergency closure | Logistics fallback | Prompt | No |
| Child sick | Delay exchange | Prompt | Yes (up to 3) |
| Caregiver sick | Block assignment | Prompt | Yes (up to 3) |
| Parent travel | Block assignment | Prompt | Yes (up to 3) |
| Transport failure | Logistics fallback | Auto | No |
| Family event | No override | Prompt | No |
| Camp week | Block assignment | Prompt | Yes (up to 3) |
| School break | Generate proposals | Prompt | Yes (up to 3) |
| Summer period | Generate proposals | Prompt | Yes (up to 3) |
| Other declared | No override | Prompt | No |

### Illness Decision Tree (Spec 11.6)

When a child is sick, the response depends on duration and timing:

```
Is the disruption ≤ 72 hours?
├─ Yes: Is today an exchange day?
│   ├─ Yes → DELAY_EXCHANGE (keep current parent, shift exchange to next stable day)
│   └─ No  → NO_OVERRIDE (base schedule continues, child stays where they are)
└─ No (> 72 hours) → GENERATE_PROPOSALS (solver rebalances with frozen unaffected days)
```

### Rule C: School-Night Sensitivity Depends on Tomorrow

The system treats a night as "school-night sensitive" only if the **next** calendar day is a school day. If the next day is a PUBLIC_HOLIDAY, SCHOOL_CLOSED, or EMERGENCY_CLOSURE:

- The **night before** the event has its school-night disruption weight multiplied by 0.1 (near-zero)
- This treats that night as weekend-like for scoring purposes
- The change is deterministic and does not require a school calendar import — it operates based on declared disruption events

Example: If Monday is a public holiday, Sunday night's school-night penalty drops from its normal weight to effectively zero. A custody transition on Sunday night is no longer penalized as a school-night disruption.

### When to Prompt vs Auto-Handle

The system only prompts a parent when:
- Custody assignment would actually change from the base schedule
- Pre-consent thresholds have not been met
- No safe logistics fallback exists
- The disruption spans multiple scheduled transitions

The system auto-handles when:
- Only exchange logistics change (location, time)
- The disruption is short and can be resolved by delaying the next exchange
- A learned or default fallback rule covers the situation

### How Overlays Feed Into the Solver

When generating schedules or proposals:

1. Collect all active DisruptionEvents in the planning window
2. For each event, resolve the best policy (family > learned > global > fallback)
3. Apply each policy to produce: hard locks, logistics adjustments, weight tweaks, prompt requirements
4. Merge overlay locks into the solver payload as `disruption_locks` (separate from regular locked nights for audit clarity)
5. Apply weight adjustments on top of age + arrangement weights
6. Run the solver with the combined constraints
7. Include explanation of which events were detected and which policies applied

### Compensatory Days

When a disruption blocks one parent from their scheduled time (BLOCK_ASSIGNMENT or DELAY_EXCHANGE), the system schedules compensatory days. These are the 1-3 days immediately after the disruption ends, offered to the parent who lost time. The number of compensatory days is capped at 3 and cannot exceed the disruption length.

---

## Policy Learning Engine

The system reduces prompts over time by converting repeated approved decisions into household defaults.

### How It Works

1. When a disruption occurs and a parent approves the system's response, the decision is recorded as a **PolicyDecisionRecord** (append-only, for audit).
2. The system tracks consecutive accepted decisions for each disruption type.
3. After **2 consecutive acceptances** of the same action pattern, the system asks: "Save this as the default next time?"
4. If both parents agree, it becomes a **LEARNED_POLICY** with auto-apply enabled.

### What Gets Learned

The system learns the combination of:
- Disruption type (e.g., CHILD_SICK)
- Action taken (e.g., DELAY_EXCHANGE)
- The pattern of approval

### Guardrails

- Promotion to a learned policy **requires explicit consent** from the family. The system never auto-promotes.
- Learned policies have a limited auto-apply count (5 applications) before re-prompting to confirm the pattern still works.
- Learned policies use SOFT strength (never HARD) — the system can be overridden.
- Families can disable any learned policy at any time through settings.
- Learned policies override global defaults but are overridden by family-specific explicit policies.

### Example

1. First time a child is sick on an exchange day → system suggests delaying exchange → Parent A approves
2. Second time the same thing happens → Parent A approves again
3. System asks: "You've handled sick-day exchanges the same way twice. Save this as your default?"
4. Both parents agree → next time, exchange is automatically delayed without prompting

---

## After Onboarding: Change Requests and Proposals

Once a family has an active schedule, either parent can request a change:

### Types of Requests
- **Need coverage**: "I cannot have the child on these dates, can the other parent cover?"
- **Want time**: "I would like the child on these dates instead."
- **Bonus week**: One parent takes a full extra week.
- **Swap date**: Trade specific days between parents.

### How Proposals Are Generated

1. The system loads the current schedule. All days **except** the requested dates are frozen (cannot change).
2. It builds a solver request with the frozen assignments, the change request, the family's adjusted weights, and any active disruption overlays.
3. The solver generates 3-5 options, **heavily penalizing** any changes to non-requested days (weight 200 for Hamming distance from current schedule). This ensures proposals stay "close" to the existing schedule.
4. For each option, the system computes impact metrics:
   - **Fairness impact**: Change in overnight balance
   - **Stability impact**: Change in transition count, school-night changes
   - **Handoff impact**: New handoffs added, handoffs removed
   - **Penalty score**: Combined disruption measure for ranking

### Auto-Approval

Some proposals can be auto-approved if the family has set pre-consent rules:
- Maximum penalty score threshold (how much disruption is acceptable without asking).
- Maximum overnight delta threshold (how many nights can shift without asking).

If a proposal meets both thresholds, it is marked as auto-approvable. Otherwise, the other parent must review and accept or decline.

### Change Budget

Each family gets a monthly change budget (default 4 requests per month). This prevents one parent from constantly requesting changes.

---

## Guardrails

The system has built-in guardrails that prevent schedules from drifting too far:

- **Fairness band**: Maximum overnight difference between parents over an 8-week window (default: 1 night tolerance).
- **Max transitions**: Cap on custody changes per week (default: 3).
- **Max streak**: Cap on consecutive nights with one parent. Uses the strictest child's limit.
- **Request type limits**: Certain request types can be restricted by pre-consent rules.

These guardrails use the same age-adjusted and arrangement-adjusted weights. A primary-visits family will have a wider fairness band (since unequal splits are expected), while an infant family will have a tighter transition cap.

For multi-child families, guardrails operate on **family-level** metrics (the unified household schedule), not per-child. Grouped mode (5+ children) does not widen guardrails — the strictest child still governs.

---

## Solver Precedence Hierarchy

The system enforces a strict 7-tier precedence. Higher tiers are never overridden by lower tiers. This hierarchy is preserved by multi-child logic, disruption overlays, and all weight adjustments:

| Tier | Category | Description |
|------|----------|-------------|
| 1 | **Hard constraints** | Locked nights, max consecutive, max away — absolute, never relaxed |
| 2 | **Young-child stability** | Transition caps and stability weights for youngest child — safety-critical |
| 3 | **Living arrangement** | Arrangement multipliers (shared / primary visits / undecided) |
| 4 | **Profile weights** | Age-band solver weight profile (infant / young child / school age / teen) |
| 5 | **Fairness & weekend goals** | Fairness deviation, weekend parity — soft goals, capped by stability |
| 6 | **Parent preferences** | User-declared preferences and template selections |
| 7 | **Logistics optimizations** | Exchange timing, handoff locations, commute minimization |

This hierarchy is encoded as an explicit constant in the codebase (`SOLVER_PRECEDENCE_HIERARCHY`) and tested to ensure it is maintained.

---

## Schedule Versioning

Schedules are never edited in place. Every change creates a new version:

1. The current version is deactivated.
2. A new version is created with the updated assignments.
3. The old version is preserved for audit history.

This means the system has a complete history of every schedule the family has used and why it changed.

Disruption overlays reference the schedule version that was active at the time of the decision, maintaining a full audit trail.

---

## Summary of What Influences a Schedule

From most to least impact:

1. **Hard constraints** (locked nights, max consecutive): These are absolute. The schedule must respect them.
2. **Disruption overlays** (active events): Locked days from illness, travel, closures take priority after hard constraints.
3. **Young-child stability**: The youngest child's age band drives the weight profile and sets safety floors.
4. **Living arrangement**: Scales weight profiles. Primary-visits families get fundamentally different optimization priorities.
5. **Profile choice**: Which of the 5 priority options the family selects determines the overall character of the schedule.
6. **Multi-child aggregation**: Additional children influence weight calculations (stability=MAX, fairness=weighted average with age multipliers).
7. **Family goals**: Fine-tune consecutive limits and template scoring.
8. **Learned policies**: Reduce prompts and auto-apply proven patterns for recurring situations.
9. **Parent preferences**: Target share percentage, handoff caps, weekend preferences shape the specific allocation.
10. **Cross-family presets**: Inform initial suggestions but are overridden once the family makes their own choices.
11. **Logistics**: Distance between homes, school/daycare schedules, no-contact preferences influence where and when handoffs happen.
