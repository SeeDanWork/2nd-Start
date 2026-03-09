# Simulator

The Chat Brain scenario simulator (`apps/simulator/`) validates the ADCP conversation engine across 51 scenarios in 10 categories. Includes CLI, dev UI, golden test fixtures, and Zod schema validation.

## Stack

- **TypeScript** (ES2022, CommonJS)
- **commander** (CLI)
- **express** (dev server)
- **zod** (runtime schema validation)
- **vitest** (test framework)

## Architecture

```
ScenarioDefinition
  ├── paramsSchema (Zod)
  ├── seedStateBuilder(params) → AppState
  ├── triggerEvent(state, params) → TriggerResult { state, outgoingMessages[] }
  ├── expectedStateTransitions (actionId → mutator)
  └── timeoutPolicy? { durationMinutes, onTimeout(state) → TriggerResult }
```

### Simulation Runner (`src/runner.ts`)
1. Parse params with schema
2. Build seed state
3. Execute triggerEvent
4. Validate each outgoing message against ChatMessageSchema
5. Apply each expectedStateTransition
6. Run timeoutPolicy.onTimeout if present
7. Return `SimulationTranscript`

## Categories & Scenarios (51 total, 20 implemented)

### Onboarding (1-10) — 6 implemented
| # | Key | Status |
|---|-----|--------|
| 1 | invite-other-parent | FULL (72h timeout) |
| 2 | confirm-child-profile | STUB |
| 3 | confirm-exchange-defaults | STUB |
| 4 | confirm-hard-constraints | STUB |
| 5 | resolve-conflicting-constraints | FULL |
| 6 | choose-schedule-option | FULL |
| 7 | confirm-schedule-start-date | STUB |
| 8 | confirm-special-rules | STUB |
| 9 | confirm-pre-consent-rules | STUB |
| 10 | finalize-baseline-schedule | FULL |

### Routine (11-14) — 3 implemented
| # | Key | Status |
|---|-----|--------|
| 11 | reminder-acknowledgement | FULL |
| 12 | handoff-status-update | FULL |
| 13 | missed-check-in | FULL (60min timeout) |
| 14 | change-of-location | STUB |

### Exceptions (15-20) — 3 implemented
| # | Key | Status |
|---|-----|--------|
| 15 | one-off-swap-request | FULL |
| 16 | bundled-swap-request | STUB |
| 17 | counterproposal-selection | FULL |
| 18 | partial-acceptance | STUB |
| 19 | request-for-clarification | STUB |
| 20 | time-bounded-decision | FULL (24h timeout) |

### Emergencies (21-27) — 2 implemented
| # | Key | Status |
|---|-----|--------|
| 21 | child-illness-same-day | FULL |
| 23 | parent-emergency | FULL |
| 22, 24-27 | Various | STUB |

### Holidays (28-32) — 2 implemented
| # | Key | Status |
|---|-----|--------|
| 28 | holiday-rule-selection | FULL |
| 30 | vacation-block-request | FULL |
| 29, 31-32 | Various | STUB |

### Activities (33-36) — 1 implemented
| # | Key | Status |
|---|-----|--------|
| 33 | add-recurring-activity | FULL |
| 34-36 | Various | STUB |

### Fairness (37-41) — 2 implemented
| # | Key | Status |
|---|-----|--------|
| 37 | weekly-fairness-nudge | FULL |
| 38 | rebalance-proposal-after-swaps | FULL |
| 39-41 | Various | STUB |

### Compliance (42-44) — 1 implemented
| # | Key | Status |
|---|-----|--------|
| 42 | court-order-guardrail-trigger | FULL |
| 43-44 | Various | STUB |

### Billing (45-48) — 1 implemented
| # | Key | Status |
|---|-----|--------|
| 45 | trial-ending-upgrade-prompt | FULL |
| 46-48 | Various | STUB |

### Admin (49-51) — 1 implemented
| # | Key | Status |
|---|-----|--------|
| 49 | mediator-admin-override | FULL |
| 50-51 | Various | STUB |

## Types (`src/types.ts`)

### AppState
- `parents[]` — id, name, joined, preferences, constraints
- `children[]` — id, name, ageBand, schoolDays, schoolStart/End
- `baselineSchedule[]` — date, assignedTo, isTransition
- `pendingProposals[]` — id, requestedBy, type, dates, status, counterOptions, expiresAt
- `ledger` — parentA/B overnights, weekends, transitions, maxConsecutive
- `holidays[]` — date, name, rule (rotate/split/attach-weekend/unset)
- `activities[]` — id, childId, name, dayOfWeek, time, transportParent
- `activeEmergency?`, `courtOrder?`, `preConsentRules[]`, `subscriptions[]`

### ChatMessage (Zod-validated)
- `messageId`, `scenarioNumber`, `createdAt`, `to` (parentIds[])
- `urgency` (low/normal/high), `expiresAt?`
- `text`, `sections?` (title + bullets), `actions[]`
- `metadata?` — requiresBothParents, relatesToDateRange, scheduleDeltaPreview

## Helpers (`src/helpers.ts`)

- `defaultParentA/B()` — Preset parent builders
- `defaultChild()` — "Riley", school-age
- `defaultState()` — Complete AppState with 2 parents, 1 child
- `stateWithSchedule()` — defaultState + 84-day baseline (3/4 pattern)
- `generateSchedule(start, days, pattern)` — Alternating assignment generator
- `msg(scenarioNumber, opts)` — ChatMessage factory with auto-incrementing IDs
- `stub(number, key, title, category, description)` — Unimplemented scenario factory

## CLI (`src/cli.ts`)

```bash
npm run cli list                              # List all scenarios
npm run cli list --category FAIRNESS          # Filter by category
npm run cli list --implemented                # Only implemented
npm run cli run 15                            # Run scenario #15
npm run cli run 15 --params '{"key":"val"}'   # With params
npm run cli run-all --implemented-only        # Run all implemented
npm run cli run-all --json                    # JSON output
```

## Dev Server (`src/server.ts`)

Port 4100 (configurable via `SIMULATOR_PORT`).

| Endpoint | Method | Description |
|----------|--------|-------------|
| /dev | GET | Interactive dev UI |
| /dev/scenarios | GET | List all scenarios |
| /dev/simulate | POST | Run scenario by number or key |

## Golden Tests (`tests/`)

- `generate-golden.ts` — Generates 51 deterministic baseline fixtures
- `tests/golden/*.json` — One file per scenario with messages, transitions, errors
- `scenarios.test.ts` — Registry validation, schema validation, determinism, state transitions, timeout policies, stub verification

```bash
npm test                  # Run test suite
npm run golden:generate   # Regenerate fixtures
```
