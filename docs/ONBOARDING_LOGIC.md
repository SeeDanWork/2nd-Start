# ADCP Onboarding Logic

How the SMS/WhatsApp onboarding process recovers the current operating schedule, validates coherence, and generates a continuity-first baseline.

---

## Architecture Overview

The onboarding is a **deterministic 5-stage interview** controlled by an LLM (Claude) that operates within strict guardrails. The LLM is conversational but the data model and stage progression are deterministic — the system always knows exactly what stage it's in and what's missing. The goal is to recover the current operating pattern with enough fidelity to generate a continuity-first baseline — not merely classify into a template.

```
User SMS ──> MessagingService.handleLlmOnboarding()
                │
                ├── LLM reads system prompt (stage-aware instructions)
                ├── LLM calls get_onboarding_status tool (sees stage + missing fields)
                ├── LLM asks the right question for the current stage
                ├── User responds
                ├── LLM calls save_onboarding_data tool (structured extraction)
                │     ├── computeStage() auto-advances if criteria met
                │     └── validateCoherence() checks cross-field consistency
                └── Loop until complete_onboarding is called
```

**Key files:**
- Schema: `packages/shared/src/onboarding/bootstrap-facts.ts`
- Tools + logic: `apps/api/src/messaging/llm-tools.service.ts`
- System prompt + session management: `apps/api/src/messaging/messaging.service.ts`
- Image generation: `apps/api/src/messaging/schedule-image.service.ts`

---

## The BootstrapFacts Schema

All onboarding data is stored in a single `BootstrapFacts` object persisted in the session's JSONB `context` column. It has three data buckets plus coherence/provenance tracking:

### Bucket A: Observed Facts
What the family is currently doing. The LLM extracts these from natural conversation.

| Field | Type | Description |
|-------|------|-------------|
| `childrenCount` | number | Number of children (1-10) |
| `childrenAges` | number[] | Ages of each child |
| `children` | ChildProfile[] | Per-child profiles (age, school days, anchors, preferences) |
| `currentArrangement` | string | Free-text description ("we alternate weeks") |
| `candidateTemplate` | ScheduleTemplate | Classified template if recognizable |
| `templateConfidence` | number (0-1) | How sure the LLM is about the template |
| `currentObservedSplitPct` | number | Current actual split percentage for parent A |
| `responsibilityModel` | enum | Which responsibility defines primary (overnight, school night, etc.) |
| `currentStretchLength` | number | Typical consecutive nights in current arrangement |
| `midweekPattern` | enum | Non-custodial parent's midweek contact |
| `weekendPattern` | enum | How weekends are handled |
| `exchangeModality` | enum | How handoffs work (school, curbside, etc.) |
| `exchangeTiming` | ExchangeTiming | When handoffs happen (after school, evening, etc.) |
| `handoffTiming` | string | Legacy free-text handoff timing |
| `schoolDaycareSchedule` | number[] | Days of week children attend school |
| `schoolExchangeAllowed` | boolean | Can school serve as exchange point? |
| `schoolExchangePreferred` | boolean | Is school the preferred exchange point? |
| `childrenShareSchoolRhythm` | boolean | Do all children share the same school schedule? |
| `seasonalPatternMode` | enum | Whether schedule varies by season |
| `seasonalNotes` | string | Description of seasonal variation |
| `effectiveStartDate` | string | When this schedule should start |
| `baselineWindowMode` | enum | When the baseline begins (now, this week, next week, custom) |
| `distanceMiles` | number | Distance between parents' homes |
| `partnerPhone` | string | Co-parent's phone (E.164 format) |
| `participationMode` | enum | Whether one or both parents are providing info |

### Bucket B: Parent Constraints
Hard boundaries and policies the schedule must respect. These become solver constraints.

| Field | Type | Description |
|-------|------|-------------|
| `lockedNights` | array | Nights always with a specific parent (per-parent, per day-of-week) |
| `unavailableDays` | array | Days a parent cannot have the children |
| `maxConsecutiveNights` | number | Max nights in a row (age-dependent) |
| `schoolNightRestrictions` | boolean | Whether school nights have special rules |
| `noDirectContact` | boolean | Whether parents have a no-contact order |
| `targetSplitPct` | number | Desired custody split percentage for parent A (0-100) |
| `targetSplitStrictness` | enum | How strictly the split must be enforced (soft/firm/hard) |
| `siblingCohesionPolicy` | enum | Whether siblings stay together or can have different schedules |
| `childSpecificExceptionPolicy` | object | Policy for child-specific schedule exceptions |

### Bucket C: Optimization Goals
What to optimize for, derived from expressed pain points.

| Field | Type | Description |
|-------|------|-------------|
| `painPoints` | string[] | Raw text of what frustrates the parent |
| `classifiedGoals` | OptimizationGoal[] | Mapped goals (see below) |
| `weightAdjustments` | Partial\<WeightProfile\> | Solver weight overrides |

**Optimization goals:**
- `reduce_transitions` — Fewer handoffs per week
- `shorten_stretches` — No long stretches away from either parent
- `preserve_weekends` — Keep weekends intact
- `school_night_consistency` — Same parent on school nights
- `reduce_driving` — Minimize handoff logistics
- `increase_fairness` — More equal time split
- `more_stability` — Predictable recurring pattern
- `more_flexibility` — Ability to adjust week-to-week

### Bucket D: Coherence / Provenance
Cross-field validation results tracked automatically.

| Field | Type | Description |
|-------|------|-------------|
| `score` | number | Overall coherence score (0-1) |
| `issues` | CoherenceIssue[] | Specific conflicts found |
| `confirmedFields` | string[] | Fields explicitly confirmed by parent |
| `inferredFields` | string[] | Fields inferred by LLM |
| `assumptions` | string[] | Assumptions made during extraction |

### Confidence Tracking
Every field has a confidence score (0.0 to 1.0) stored in `facts.confidence`. Fields extracted from explicit user statements get 1.0. Fields inferred by the LLM (like template classification) get lower confidence. Fields below 0.8 trigger clarifying questions before the system moves on.

---

## The 5 Stages

Stage advancement is **deterministic** — computed by `computeStage()` based on which fields are populated. The LLM cannot skip stages.

### Stage 1: Baseline Extraction
**Goal:** Understand who the family is and how custody roughly works.

**Collects:** `childrenCount`, `childrenAges`, `currentArrangement`, `candidateTemplate`, `seasonalPatternMode`

**Advances when:** Children count + ages are set AND either `currentArrangement` or `candidateTemplate` is set.

**Example exchange:**
```
ADCP: Tell me about your kids — how many, and how does custody work right now?
User: 2 kids, ages 4 and 7. We alternate weeks.
→ saves: childrenCount=2, childrenAges=[4,7],
         currentArrangement="we alternate weeks",
         candidateTemplate="alternating_weeks" (confidence 0.9)
→ advances to Stage 2
```

### Stage 2: Anchor Extraction
**Goal:** Reconstruct the full weekly rhythm — every day accounted for.

This is the **most important stage**. The system will not advance until it has ALL of:
- Weekend pattern explicitly set
- Target split percentage set
- Anchor clarity (locked nights exist OR explicitly confirmed none)
- Exchange timing or modality

**Collects:** `lockedNights`, `weekendPattern`, `midweekPattern`, `targetSplitPct`, `exchangeModality`/`exchangeTiming`

**Advances when:** `weekendPattern` is set AND `targetSplitPct` is set AND anchor clarity is established AND exchange info is provided.

**The LLM is instructed to ask:**
1. Which days are ALWAYS with you? (locked nights). If none, explicitly confirm.
2. What happens on the OTHER days?
3. How do weekends work? (alternating, split, fixed)
4. Does co-parent have midweek visits?
5. What overall time split do you want? (50/50, 60/40, 70/30)
6. How and when do exchanges happen? (school drop-off, evening pickup, etc.)

**Dynamic guidance:** The `get_onboarding_status` tool returns exactly how many nights are locked to each parent and how many are unassigned, so the LLM can say: *"So you have Mon-Wed (3 nights). That leaves 4 nights unaccounted for — what happens Thu-Sun?"*

### Stage 3: Stability Constraints
**Goal:** Logistics, sibling policy, and the co-parent connection.

**Collects:** `distanceMiles`, `partnerPhone`, `maxConsecutiveNights` (if kids < 5), `siblingCohesionPolicy` (if multiple children)

**Advances when:** `distanceMiles` is set AND exchange info exists. `partnerPhone` is collected here but does **NOT** gate advancement — if the parent hesitates, the system moves on.

### Stage 4: Optimization Target
**Goal:** Understand what's not working and what to optimize for.

**Collects:** `painPoints`, `classifiedGoals`

**Advances when:** At least one `classifiedGoal` is set.

**How classification works:** The LLM maps free-text pain points to structured goals:
- "too many handoffs" → `reduce_transitions`
- "kids are stressed switching so often" → `shorten_stretches` or `more_stability`
- "I never get a full weekend" → `preserve_weekends`
- "too much driving" → `reduce_driving`

### Stage 5: Preview + Confirmation
**Goal:** Show the schedule, validate coherence, and get explicit confirmation.

**Actions:**
1. `validateCoherence()` runs automatically — high-severity issues are surfaced in guidance
2. LLM calls `generate_schedule_preview` → generates a 3-week PNG image
3. Image shows the template pattern with split percentage
4. LLM summarizes: template, locked nights, split, goals
5. If coherence issues exist, the LLM addresses them with the parent
6. User confirms → LLM calls `complete_onboarding`

**Coherence checks include:**
- Target split vs locked nights feasibility (>15% deviation)
- Template vs locked night structural conflict
- No-contact + no school exchange = limited exchange options
- Seasonal divergence noted but not described
- Sibling cohesion policy vs child-specific anchors

---

## Template Recognition

When a parent describes their arrangement, the LLM classifies it into one of 6 known templates:

| Template | Pattern | Typical Split |
|----------|---------|---------------|
| `alternating_weeks` | Full week A, full week B | 50/50 |
| `2-2-3` | AA-BB-AAA / BB-AA-BBB | 50/50 |
| `3-4-4-3` | AAA-BBBB / BBBB-AAA | 50/50 |
| `5-2` | Weekdays A, weekends B | 71/29 |
| `every_other_weekend` | A weekdays, alternate weekends | ~79/21 |
| `custom` | Doesn't match a known pattern | varies |

**Classification is LLM-driven with confidence scoring.** If the LLM isn't sure (confidence < 0.8), it asks a clarifying question rather than guessing.

The template also maps to an arrangement type for schedule generation:
- `every_other_weekend`, `5-2` → `primary`
- Everything else → `shared`

---

## Schedule Generation

When `complete_onboarding` is called, the system generates an 8-week schedule using `buildWeeklyPatterns()`.

### How patterns work

Each template defines TWO week patterns (week A and week B) that alternate. Locked nights override the template in both weeks.

**2-2-3 example** (index 0=Sun, 1=Mon ... 6=Sat):
```
Week A: [A, A, B, B, A, A, A]   <- Mon-Tue=A, Wed-Thu=B, Fri-Sat-Sun=A
Week B: [B, B, A, A, B, B, B]   <- Mon-Tue=B, Wed-Thu=A, Fri-Sat-Sun=B
```

**3-4-4-3 example:**
```
Week A: [B, A, A, A, B, B, B]   <- A: Mon-Wed, B: Thu-Sun
Week B: [A, B, B, B, B, A, A]   <- B: Mon-Thu, A: Fri-Sun
```

**Alternating weeks:**
```
Week A: [A, A, A, A, A, A, A]   <- All parent A
Week B: [B, B, B, B, B, B, B]   <- All parent B
```

### Locked night override

If a parent has locked nights (e.g., "Tuesdays are always mine"), those days are forced to that parent in BOTH week patterns, regardless of what the template says.

### Generation process

```
1. Build week A and week B patterns from template + locked nights
2. Create BaseScheduleVersion (version 1, status 'default')
3. For each day in the 8-week horizon:
   - Even weeks use pattern A, odd weeks use pattern B
   - Mark transition days (parent changes from previous day)
4. Save all OvernightAssignment rows
5. Create constraint records:
   - LOCKED_NIGHT per parent's locked nights
   - MAX_CONSECUTIVE if maxConsecutiveNights was set
   - FAIRNESS_TARGET from targetSplitPct + strictness
   - UNAVAILABLE_DAY from unavailableDays
6. Set family status to 'active'
7. Send partner invite via SMS
8. Return viewer link URL
```

---

## What Gets Created on Completion

When `complete_onboarding` runs, it validates two things:
1. **Schedule-quality readiness** (`getRequiredMissingFields`) — children, arrangement, weekend pattern, target split, exchange info
2. **Coherence validation** (`validateCoherence`) — blocks completion if high-severity issues exist
3. **Completion readiness** (`getCompletionMissingFields`) — requires partner phone for the invite

Then it creates:

1. **Family** — with `onboardingInput` containing the full `BootstrapFacts`
2. **FamilyMembership** (parent A) — role `parent_a`, status `accepted`
3. **FamilyMembership** (parent B) — role `parent_b`, status `pending`
4. **User** (partner) — created if doesn't exist, with `onboardingCompleted: false`
5. **Child** records — one per age, with estimated date of birth
6. **ConstraintSet** + **Constraint** records:
   - `LOCKED_NIGHT` per parent's locked nights
   - `MAX_CONSECUTIVE` if set (age-dependent)
   - `FAIRNESS_TARGET` from `targetSplitPct` + `targetSplitStrictness`
   - `UNAVAILABLE_DAY` from `unavailableDays`
7. **BaseScheduleVersion** — version 1, 8-week horizon, status `default`
8. **OvernightAssignment** rows — one per day (~56 rows for 8 weeks)

The partner receives an SMS invite: *"You've been invited to ADCP by [name]. Reply START to begin."*

---

## Session Context Management

All onboarding state lives in the `ConversationSession.context` JSONB column:

```json
{
  "bootstrapFacts": { ... },
  "conversationHistory": [
    { "role": "user", "content": "..." },
    { "role": "assistant", "content": "..." }
  ],
  "onboardingStep": "llm"
}
```

**Important:** After the LLM finishes its turn (which may include multiple tool calls that update `bootstrapFacts` in the DB), the messaging service re-reads the fresh context before merging the updated conversation history. This prevents stale context overwrites.

Conversation history is capped at 20 messages to prevent context overflow.

---

## Preview Image Generation

The `ScheduleImageService` generates PNG images from SVG using the `sharp` library.

### Arrangement preview (onboarding)
- Shows **3 weeks** of the selected template pattern
- Displays split percentage (e.g., "Split: 50/50 over 3 weeks")
- Parent A = orange (#FFA54C), Parent B = green (#4CAF7C)
- Template-specific patterns (2-2-3 shows actual 2-2-3 day distribution)
- Locked nights are respected in the preview

### Week card (post-onboarding)
- 7-day strip from real schedule data
- Transition days marked with an arrow icon

### Month calendar (post-onboarding)
- Full month grid from real assignment data

Images are saved to the `media/` directory and served via `GET /messaging/media/:filename`.

---

## Flow Diagram

```
New user texts in (or connects via simulator)
          |
          v
    Create User record
    Create ConversationSession (state: 'onboarding')
    Initialize empty BootstrapFacts
          |
          v
    +-----------------------------+
    |  STAGE 1: BASELINE          | <- How many kids? Ages? How does custody work?
    |  Need: children + arrangement|
    +-------------+---------------+
                  | childrenCount + childrenAges + arrangement set
                  v
    +-----------------------------+
    |  STAGE 2: ANCHORS           | <- Which days are always yours? Weekends?
    |  Need: weekendPattern       |    What happens on the other days?
    |  + targetSplitPct           |    What split do you want?
    |  + anchor clarity           |    How do exchanges happen?
    |  + exchange info            |
    +-------------+---------------+
                  | All criteria met
                  v
    +-----------------------------+
    |  STAGE 3: STABILITY         | <- How far apart? Max consecutive nights?
    |  Need: distance + exchange  |    Co-parent's phone? Sibling policy?
    |  (phone NOT required)       |
    +-------------+---------------+
                  | distanceMiles set
                  v
    +-----------------------------+
    |  STAGE 4: OPTIMIZATION      | <- What frustrates you? What would you change?
    |  Need: >=1 classified goal  |
    +-------------+---------------+
                  | classifiedGoals.length > 0
                  v
    +-----------------------------+
    |  STAGE 5: PREVIEW           | <- Coherence check + 3-week preview image
    |  Validate + confirm         |    Does this look right?
    +-------------+---------------+
                  | User confirms + no high-severity coherence issues
                  v
    complete_onboarding()
    +-- Validate schedule readiness
    +-- Validate coherence (block on high-severity)
    +-- Validate completion readiness (partner phone)
    +-- Create Family + memberships
    +-- Create children
    +-- Create constraints from BootstrapFacts
    +-- Generate 8-week schedule from template
    +-- Set family active
    +-- Send partner SMS invite
    +-- Return viewer link
```

---

## Edge Cases

| Scenario | Behavior |
|----------|----------|
| User volunteers everything at once | LLM saves all fields in one `save_onboarding_data` call; stages may skip ahead if all criteria met |
| Template confidence < 0.8 | LLM asks clarifying question before committing template |
| No locked nights | Parent explicitly confirms none → `no_locked_nights=true` set in confidence; Stage 2 can advance |
| Young children (< 5) | Stage 3 asks about max consecutive nights |
| Multiple children | Stage 3 asks about sibling cohesion policy |
| No-contact order | Sets `noDirectContact` flag; if school exchange also not allowed, coherence issue flagged |
| Partner already has an account | Existing user gets a membership; no new user created |
| Partner phone not provided | Schedule can still be generated; completion blocked until phone provided |
| Seasonal variation | `seasonalPatternMode` noted in Stage 1; `seasonalNotes` collected for summer pattern |
| Target split conflicts with locked nights | Coherence issue flagged (high severity if >15% deviation) |
| User says "start over" | Session context can be reset (not yet implemented as a tool) |

---

## Mapping to Solver

Currently the schedule is generated by `buildWeeklyPatterns()` with deterministic template patterns. The BootstrapFacts map to solver inputs as follows:

| BootstrapFacts field | Solver input |
|---------------------|--------------|
| `candidateTemplate` | Initial solution hint / warm start |
| `lockedNights` | Hard constraints (LOCKED_NIGHT) |
| `unavailableDays` | Hard constraints (UNAVAILABLE_DAY) |
| `maxConsecutiveNights` | Soft constraint (MAX_CONSECUTIVE) |
| `targetSplitPct` + `targetSplitStrictness` | Fairness target constraint (FAIRNESS_TARGET) |
| `classifiedGoals` | Weight profile adjustments |
| `distanceMiles` | Non-daycare handoff penalty scaling |
| `schoolDaycareSchedule` | School night identification |
| `weekendPattern` | Weekend fragmentation penalty tuning |
| `siblingCohesionPolicy` | Sibling cohesion constraints |
| `currentObservedSplitPct` | Continuity bonus baseline |
| `currentStretchLength` | Stretch length penalty calibration |

The solver endpoint is at `POST /solve/base-schedule` in the Python optimizer service.
