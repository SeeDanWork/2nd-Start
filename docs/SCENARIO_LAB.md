# Scenario Lab

The Scenario Lab (`apps/scenario-lab/`) is a Next.js testing and simulation environment for the ADCP conversation engine. It simulates dual-parent SMS conversations with persona-driven behavior, deterministic scheduling, and optional LLM interpretation.

## Architecture

```
HTTP Request (POST /api/simulate)
    |
    v
Orchestrator.orchestrate()
    |
    v
[Router by ActionType]
    |-- connect      --> handleConnect
    |-- send         --> handleSend --> Policy Engine
    |-- auto_respond --> handleAutoRespond --> Behavior Engine
    |-- simulate_pair --> handleSimulatePair --> Behavior Engine
    |-- run_setup    --> handleRunSetup
    |-- step_day     --> handleStepDay --> Operational Messages
    |-- inject_disruption --> handleInjectDisruption --> Disruption Engine
    |
    v
Response { status, data }
```

## Core Types (`lib/types.ts`)

- **ScenarioConfig**: Family setup (children, parents, template, target split, locked nights, personas)
- **Message**: SMS-style { id, from: user|system, text, timestamp, phone }
- **ScheduleDay**: { date, assignedTo, isTransition }
- **Scenario**: Full state (id, config, status, messagesA, messagesB, logs, schedule, activeDisruptions)
- **ScenarioStatus**: draft | configuring | simulating | completed | error

### Presets
- 6 custody templates (alternating_weeks, 2-2-3, 3-4-4-3, 5-2, every_other_weekend, custom)
- 15 ready-to-run scenario presets (cooperative to extreme edge cases)

## Data Layer

### Store (`lib/store.ts`)
In-memory scenario storage with `globalThis` HMR persistence:
- `createScenario(config)`, `getScenario(id)`, `listScenarios()`
- `updateScenario(id, updates)`, `deleteScenario(id)`, `addLog(id, type, phone, data)`

### Personas (`lib/personas.ts`)
6 parent personas with behavior profiles:
1. **cooperative_organizer** — Low conflict, high acceptance (0.8), fast response
2. **fairness_scorekeeper** — High fairness sensitivity (5), medium acceptance
3. **flexible_disorganized** — Low conflict, very high acceptance (0.9), slow response
4. **strategic_gamer** — High conflict (4), high gaming probability (0.7), low acceptance
5. **avoidant_parent** — Low engagement, very slow response, low acceptance (0.4)
6. **high_conflict_controller** — Max conflict (5), rigid schedule (5), lowest acceptance (0.2)

12 interaction archetypes for persona pairs (conflict probability 5%-65%).
6 family structure templates (simple shared, toddler, school, teen, infant, blended).

### Scenarios (`lib/scenarios.ts`)
40+ disruption scenarios across 11 categories (health, school, work, logistics, travel, holiday, conflict, stress, edgecase, family, legal). Difficulty 1-5.

## Conversation Framework

### Session (`lib/conversation/session.ts`)
Family-level state machine:
- **Modes**: onboarding → operational → mediation → followup
- **Shared EventStream**: Append-only log for both parents
- **CaseManager**: Mediation case lifecycle
- **Onboarding state**: Per-parent started/completed/answeredTopics

### Events (`lib/conversation/events.ts`)
25 event types organized by domain:
- Parent actions: ParentMessageReceived, ParentIntentParsed
- System: ClarificationRequested, SystemAcknowledgment
- Disruption: CoverageRequestCreated, DurationEstimateProvided
- Proposal: ProposalBundleGenerated, ProposalOptionSelected, ProposalDeclined
- Resolution: ResolutionApplied, ScheduleUpdated
- Case: CaseOpened, CaseClosed
- Onboarding: OnboardingStepCompleted, OnboardingComplete
- Operational: DaySummaryGenerated, FairnessAlertTriggered

### Case Manager (`lib/conversation/case-manager.ts`)
Mediation case lifecycle:
- Types: disruption, coverage_request, schedule_change_request, fairness_review, logistics_issue, feedback_thread
- Statuses: open → awaiting_clarification → awaiting_selection → resolution_pending → proposals_pending → resolved → closed

### View Builder (`lib/conversation/view-builder.ts`)
Converts EventStream to legacy Message[] arrays for UI backward compatibility.

## Handlers (7)

### connect (`handlers/connect.ts`)
Initializes session, sends welcome message, marks parent as started.

### send (`handlers/send.ts`)
Routes every user message through the policy engine:
1. Syncs onboarding state from legacy messages
2. Runs `processMessageSync(session, sender, body)`
3. For onboarding: uses old synthetic response engine for reply text
4. For operational/mediation: uses policy engine's acknowledgment text
5. Returns interpretation + recommendation for diagnostics

### auto_respond (`handlers/auto-respond.ts`)
Persona-driven auto-response based on last system message context.

### simulate_pair (`handlers/simulate-pair.ts`)
Both parents respond simultaneously. Computes resolution paths (mutual agreement, escalation, counter-proposal, deadlock).

### run_setup (`handlers/run-setup.ts`)
Executes full onboarding conversation for both parents (up to 15 turns each).

### step_day (`handlers/step-day.ts`)
Advances simulation N days. For each day:
- Generates day summary for each parent
- Checks fairness alerts (every 7 days)
- Checks friction ahead (every 7 days)
- Uses simulated dates for timestamps (date separators work in UI)

### inject_disruption (`handlers/inject-disruption.ts`)
Realistic SMS disruption flow:
1. Day context sent to both parents
2. Reporter texts about the disruption (parent message first)
3. System acknowledges and asks duration
4. Reporter answers duration
5. System notifies other parent it's contacting co-parent
6. Other parent gets coverage request with specific event name
7. Proposals shown to other parent
8. Other parent responds (accept/reject/counter)
9. Both parents see schedule change details (coverage days, fairness adjustment, compensation)

## Policy Engine (`lib/conversation/policy-engine.ts`)

The decision layer between LLM interpretation and action:

```
processMessageSync(session, sender, messageText)
    1. Record ParentMessageReceived event
    2. Build LLM context from session state
    3. Interpret message (heuristic only in sync mode)
    4. Record ParentIntentParsed event
    5. Get next-step recommendation
    6. Execute action (emit events, update state)
    7. Return PolicyResult
```

### LLM Context includes:
- Session mode, sender, message text
- Recent 10 events (summarized)
- Active case (if any)
- Family info (child names, parent labels, template, target split)
- Schedule info (exists, current day, today's assignment)
- Onboarding progress

### Action Execution handles:
acknowledge, ask_clarification, open_case, update_case, generate_proposals, show_metrics, record_feedback_only, advance_onboarding, complete_onboarding, no_action.

## LLM Layer (`lib/llm/`)

### Schema (`schema.ts`)
- **LLMMessageInterpretation**: 13 intent types, emotional tone, urgency, structured objections, ambiguity flags, confidence
- **NextStepRecommendation**: 14 next-step types, rationale, clarification questions, suggested choices
- **LLMContext**: Full context sent to LLM

### Interpret Message (`interpret-message.ts`)
- `interpretMessage(context)` — Tries LLM first, falls back to heuristic
- `heuristicInterpret(context)` — Keyword/pattern matching for all 13 intents
- Helpers: detectDisruption, classifyDisruptionFromText, detectUrgency, detectDuration, detectTone, classifyObjection, detectOnboardingTopics

### Next Step Recommender (`next-step-recommender.ts`)
- `recommendNextStep(interpretation, context)` — Tries LLM, falls back to heuristic
- `heuristicRecommend(interpretation, context)` — Rule-based mapping from intent to next step

### LLM Client (`client.ts`)
Routes to `LLM_ROUTER_URL` (default localhost:3100). Returns null if unavailable — system continues with heuristics.

## Supporting Engines

### Behavior Engine (`lib/behavior-engine.ts`)
- `evaluateProposal(persona, fairnessDeviation, ...)` — Accept/reject/counter/ignore decision
- `evaluateDisruption(persona, event, affectedDays)` — Response pattern
- `generatePersonaMessage(persona, situation, context)` — Natural language message
- `generateSyntheticSystemResponse(config, answeredTopics)` — Onboarding flow questions
- `getArchetype(personaAId, personaBId)` — Interaction archetype lookup

### Disruption Engine (`lib/disruption-engine.ts`)
State machine: DISRUPTION_REPORTED → DURATION_ASKED → COVERAGE_REQUESTED → PROPOSALS_GENERATED → PARENT_RESPONSE_PENDING → RESOLUTION_APPLIED → FOLLOWUP_PENDING → RESOLVED.

8 event types: parent_sick, child_sick, work_emergency, transport_failure, school_closure, family_emergency, schedule_conflict, other.

### Proposal Generator (`lib/proposal-generator.ts`)
Generates 2-4 coverage options with fairness impact, transition impact, routine impact, and compensation days.

### Explanation Engine (`lib/explanation-engine.ts`)
- `buildDaySummaryExplanation(config, schedule, simDay, recipient)` — "Mon, Mar 9 | Emma & Jake with you."
- `snapshotMetrics(config, schedule, day)` — Current fairness/stability metrics

### Operational Messages (`lib/operational-messages.ts`)
- `getOperationalMessage(config, schedule, day, parent)` — Daily message type (SILENT, TRANSITION, etc.)
- `checkFairnessAlert(config, schedule, day)` — Drift detection
- `checkFrictionAhead(config, schedule, day)` — Upcoming friction points

### Schedule Generator (`lib/schedule-generator.ts`)
Template-based generation from config (alternating weeks, 2-2-3, etc.).

### Monte Carlo (`lib/monte-carlo/`)
- `runMonteCarlo(config)` — 1000+ randomized runs
- `sweepGuardrail(parameter, values, config)` — Parameter calibration
- `generateRegressionTests(summary)` — Codify edge cases

## UI Components

### PhoneSimulator (`components/PhoneSimulator.tsx`)
SMS-style dual chat interface:
- Blue bubbles (user), gray bubbles (system)
- Centered date separators ("Today", "Mon, Mar 8")
- Quick action buttons
- Schedule preview on creation
- Auto-scroll to latest message

### DiagnosticsPanel (`components/DiagnosticsPanel.tsx`)
Debug output with color-coded log entries and bootstrap facts.

### ScheduleCalendar (`components/ScheduleCalendar.tsx`)
FullCalendar month view with parent-colored events.

## Pages

- `/` — Dashboard: list/create/delete scenarios
- `/scenarios/new` — Scenario creation
- `/scenarios/[id]/simulate` — Main simulator (dual phones, calendar, diagnostics, persona config, lifecycle controls, disruption injection, export)
- `/monte-carlo` — Monte Carlo simulation control panel

## API Routes

| Method | Path | Description |
|--------|------|-------------|
| GET/POST/DELETE | /api/scenarios | CRUD |
| GET/PATCH | /api/scenarios/:id | Single scenario |
| POST | /api/simulate | Main orchestrator |
| POST | /api/monte-carlo | MC simulation |
| POST | /api/export | Download conversation/schedule/diagnostics |

## Test Coverage (18 files)

| Test File | Coverage |
|-----------|----------|
| behavior-engine.test.ts | Persona decisions, message generation |
| case-manager.test.ts | Case lifecycle, objections, resolution |
| conversation-state.test.ts | Topic tracking |
| disruption-engine.test.ts | State transitions, idempotency |
| event-stream.test.ts | Append-only log queries |
| explanation-engine.test.ts | Day summaries, fairness alerts |
| interpret-message.test.ts | LLM + heuristic interpretation |
| llm-client.test.ts | Graceful degradation |
| message-router.test.ts | Intent routing |
| next-step-recommender.test.ts | Recommendation logic |
| operational-messages.test.ts | Daily messages, alerts |
| orchestrator.test.ts | Routing, error handling |
| policy-engine.test.ts | Full pipeline, context building |
| proposal-generator.test.ts | Option generation, formatting |
| schedule-generator.test.ts | Template expansion |
| session.test.ts | Session creation, onboarding state |
| store.test.ts | CRUD operations |
| view-builder.test.ts | Event → message transcription |
