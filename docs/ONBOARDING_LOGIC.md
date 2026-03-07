# ADCP Onboarding Logic

How the SMS/WhatsApp onboarding process collects information, determines the schedule template, and generates the initial custody schedule.

---

## Architecture Overview

The onboarding is a **deterministic 5-stage interview** controlled by an LLM (Claude) that operates within strict guardrails. The LLM is conversational but the data model and stage progression are deterministic — the system always knows exactly what stage it's in and what's missing.

```
User SMS ──> MessagingService.handleLlmOnboarding()
                │
                ├── LLM reads system prompt (stage-aware instructions)
                ├── LLM calls get_onboarding_status tool (sees stage + missing fields)
                ├── LLM asks the right question for the current stage
                ├── User responds
                ├── LLM calls save_onboarding_data tool (structured extraction)
                │     └── computeStage() auto-advances if criteria met
                └── Loop until complete_onboarding is called
```

**Key files:**
- Schema: `packages/shared/src/onboarding/bootstrap-facts.ts`
- Tools + logic: `apps/api/src/messaging/llm-tools.service.ts`
- System prompt + session management: `apps/api/src/messaging/messaging.service.ts`
- Image generation: `apps/api/src/messaging/schedule-image.service.ts`

---

## The BootstrapFacts Schema

All onboarding data is stored in a single `BootstrapFacts` object persisted in the session's JSONB `context` column. It has three buckets:

### Bucket A: Observed Facts
What the family is currently doing. The LLM extracts these from natural conversation.

| Field | Type | Description |
|-------|------|-------------|
| `childrenCount` | number | Number of children (1-10) |
| `childrenAges` | number[] | Ages of each child |
| `currentArrangement` | string | Free-text description ("we alternate weeks") |
| `candidateTemplate` | ScheduleTemplate | Classified template if recognizable |
| `templateConfidence` | number (0-1) | How sure the LLM is about the template |
| `distanceMiles` | number | Distance between parents' homes |
| `partnerPhone` | string | Co-parent's phone (E.164 format) |
| `exchangeModality` | enum | How handoffs work (school, curbside, etc.) |
| `schoolDaycareSchedule` | number[] | Days of week children attend school |
| `midweekPattern` | enum | Non-custodial parent's midweek contact |
| `weekendPattern` | enum | How weekends are handled |

### Bucket B: Parent Constraints
Hard boundaries the schedule must respect. These become solver constraints.

| Field | Type | Description |
|-------|------|-------------|
| `lockedNights` | array | Nights always with a specific parent (per-parent, per day-of-week) |
| `unavailableDays` | array | Days a parent cannot have the children |
| `maxConsecutiveNights` | number | Max nights in a row (age-dependent) |
| `schoolNightRestrictions` | boolean | Whether school nights have special rules |
| `noDirectContact` | boolean | Whether parents have a no-contact order |

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

### Confidence Tracking
Every field has a confidence score (0.0 to 1.0) stored in `facts.confidence`. Fields extracted from explicit user statements get 1.0. Fields inferred by the LLM (like template classification) get lower confidence. Fields below 0.8 trigger clarifying questions before the system moves on.

---

## The 5 Stages

Stage advancement is **deterministic** — computed by `computeStage()` based on which fields are populated. The LLM cannot skip stages.

### Stage 1: Baseline Extraction
**Goal:** Understand who the family is and how custody roughly works.

**Collects:** `childrenCount`, `childrenAges`, `currentArrangement`, `candidateTemplate`

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
**Goal:** Understand the full weekly picture — every day accounted for.

This is the **most important stage**. The system will not advance until it has:
- At least one source of anchor info (locked nights OR weekend pattern)
- Weekend pattern explicitly set

**Collects:** `lockedNights`, `weekendPattern`, `midweekPattern`

**Advances when:** `weekendPattern` is set AND (locked nights exist OR weekend pattern exists).

**The LLM is instructed to ask:**
1. Which days are ALWAYS with you? (locked nights)
2. What happens on the OTHER days?
3. How do weekends work? (alternating, split, fixed)
4. Does co-parent have midweek visits?
5. What overall time split do you want? (50/50, 60/40, 70/30)

**Dynamic guidance:** The `get_onboarding_status` tool returns exactly how many nights are locked to each parent and how many are unassigned, so the LLM can say: *"So you have Mon-Wed (3 nights). That leaves 4 nights unaccounted for — what happens Thu-Sun?"*

### Stage 3: Stability Constraints
**Goal:** Logistics and the co-parent connection.

**Collects:** `distanceMiles`, `partnerPhone`, `exchangeModality`, `maxConsecutiveNights` (if kids < 5)

**Advances when:** Both `distanceMiles` and `partnerPhone` are set.

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
**Goal:** Show the schedule and get explicit confirmation.

**Actions:**
1. LLM calls `generate_schedule_preview` → generates a 3-week PNG image
2. Image shows the template pattern with split percentage
3. LLM summarizes: template, locked nights, split, goals
4. User confirms → LLM calls `complete_onboarding`

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

The template also maps to an arrangement type for legacy compatibility:
- `every_other_weekend`, `5-2` → `primary`
- Everything else → `shared`

---

## Schedule Generation

When `complete_onboarding` is called, the system generates an 8-week schedule using `buildWeeklyPatterns()`.

### How patterns work

Each template defines TWO week patterns (week A and week B) that alternate. Locked nights override the template in both weeks.

**2-2-3 example** (index 0=Sun, 1=Mon ... 6=Sat):
```
Week A: [A, A, B, B, A, A, A]   ← Mon-Tue=A, Wed-Thu=B, Fri-Sat-Sun=A
Week B: [B, B, A, A, B, B, B]   ← Mon-Tue=B, Wed-Thu=A, Fri-Sat-Sun=B
```

**3-4-4-3 example:**
```
Week A: [B, A, A, A, B, B, B]   ← A: Mon-Wed, B: Thu-Sun
Week B: [A, B, B, B, B, A, A]   ← B: Mon-Thu, A: Fri-Sun
```

**Alternating weeks:**
```
Week A: [A, A, A, A, A, A, A]   ← All parent A
Week B: [B, B, B, B, B, B, B]   ← All parent B
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
5. Create constraint records (locked nights, max consecutive)
6. Set family status to 'active'
7. Send partner invite via SMS
8. Return viewer link URL
```

---

## What Gets Created on Completion

When `complete_onboarding` runs, it creates the following database records:

1. **Family** — with `onboardingInput` containing the full `BootstrapFacts`
2. **FamilyMembership** (parent A) — role `parent_a`, status `accepted`
3. **FamilyMembership** (parent B) — role `parent_b`, status `pending`
4. **User** (partner) — created if doesn't exist, with `onboardingCompleted: false`
5. **Child** records — one per age, with estimated date of birth
6. **ConstraintSet** + **Constraint** records:
   - One `LOCKED_NIGHT` constraint per parent's locked nights
   - One `MAX_CONSECUTIVE` constraint if `maxConsecutiveNights` was set
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
          │
          ▼
    Create User record
    Create ConversationSession (state: 'onboarding')
    Initialize empty BootstrapFacts
          │
          ▼
    ┌─────────────────────────┐
    │  STAGE 1: BASELINE      │ ← How many kids? Ages? How does custody work?
    │  Need: children + arrangement │
    └────────────┬────────────┘
                 │ childrenCount + childrenAges + currentArrangement set
                 ▼
    ┌─────────────────────────┐
    │  STAGE 2: ANCHORS       │ ← Which days are always yours? Weekends?
    │  Need: weekendPattern   │    What happens on the other days?
    │  + locked nights clarity │    What split do you want?
    └────────────┬────────────┘
                 │ weekendPattern set + anchor info exists
                 ▼
    ┌─────────────────────────┐
    │  STAGE 3: STABILITY     │ ← How far apart? How do handoffs work?
    │  Need: distance + phone │    Co-parent's phone number?
    └────────────┬────────────┘
                 │ distanceMiles + partnerPhone set
                 ▼
    ┌─────────────────────────┐
    │  STAGE 4: OPTIMIZATION  │ ← What frustrates you? What would you change?
    │  Need: ≥1 classified goal│
    └────────────┬────────────┘
                 │ classifiedGoals.length > 0
                 ▼
    ┌─────────────────────────┐
    │  STAGE 5: PREVIEW       │ ← Here's your 3-week schedule preview.
    │  Show image + confirm   │    Does this look right?
    └────────────┬────────────┘
                 │ User confirms
                 ▼
    complete_onboarding()
    ├── Create Family + memberships
    ├── Create children
    ├── Create constraints from BootstrapFacts
    ├── Generate 8-week schedule from template
    ├── Set family active
    ├── Send partner SMS invite
    └── Return viewer link
```

---

## Edge Cases

| Scenario | Behavior |
|----------|----------|
| User volunteers everything at once | LLM saves all fields in one `save_onboarding_data` call; stages may skip ahead if all criteria met |
| Template confidence < 0.8 | LLM asks clarifying question before committing template |
| No locked nights | Stage 2 can still advance if `weekendPattern` is set (some families have no fixed days) |
| Young children (< 5) | Stage 3 asks about max consecutive nights |
| No-contact order | Sets `noDirectContact` flag; exchanges should use school or third-party |
| Partner already has an account | Existing user gets a membership; no new user created |
| User says "start over" | Session context can be reset (not yet implemented as a tool) |

---

## Mapping to Solver (Future)

Currently the schedule is generated by `buildWeeklyPatterns()` with deterministic template patterns. In the future, the BootstrapFacts will map directly to the CP-SAT solver:

| BootstrapFacts field | Solver input |
|---------------------|--------------|
| `candidateTemplate` | Initial solution hint / warm start |
| `lockedNights` | Hard constraints (LOCKED_NIGHT) |
| `maxConsecutiveNights` | Soft constraint (MAX_CONSECUTIVE) |
| `classifiedGoals` | Weight profile adjustments |
| `distanceMiles` | Non-daycare handoff penalty scaling |
| `schoolDaycareSchedule` | School night identification |
| `weekendPattern` | Weekend fragmentation penalty tuning |

The solver endpoint is at `POST /solve/base-schedule` in the Python optimizer service.
