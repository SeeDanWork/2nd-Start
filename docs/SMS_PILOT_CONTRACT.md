# SMS Pilot Contract

> Scope lock for the SMS-first production pilot.
> This document defines what the pilot is, what it is not, and the authoritative path that inbound messages follow.

---

## 1. Pilot Definition

### Interaction Channel
**SMS-first.** The primary user interface is text messaging via a phone number provisioned through Twilio. No mobile app required. No web app required for core interaction (web is read-only review surface for richer artifacts).

### Authoritative Stack
The pilot runs against the **production application stack**, not a toy fork:

| Component | Authority | Location |
|-----------|-----------|----------|
| CP-SAT solver | Schedule generation | `apps/optimizer/app/solver/` |
| Policy engine | Rule management | `packages/core-domain/src/policy/` |
| Observation subsystem | Pattern detection + suggestions | `packages/core-domain/src/observations/` |
| Proposal/versioning | Schedule mutations | `apps/api/src/proposals/`, `apps/api/src/schedules/` |
| Fairness ledger | Overnight balance tracking | `apps/api/src/metrics/` |
| Mediation layer | Objection handling + guided responses | `apps/api/src/mediation/` |
| Explanation artifacts | Artifact-backed reasoning | `packages/shared/src/mediation/` |
| Guardrails | Auto-approve, budgets, emergency | `apps/api/src/guardrails/` |
| Notification service | Event-driven messaging | `apps/api/src/notifications/` |

### Simulator Constraint
The Scenario Lab and accelerated timeline engine **must call the same live application services** used by real SMS traffic. No separate "simulation mode" with different business logic. The simulator differs only in:
- Clock source (virtual vs real)
- SMS transport (in-memory capture vs Twilio)
- Identity resolution (seeded test families vs real phone numbers)

### Success Window
1. **Accelerated simulation**: One 90-day family timeline replayed deterministically through the SMS path
2. **Real phone test**: One operator-driven test where a real person texts the system and completes a proposal lifecycle

### Schedule Mutation Invariant
**No schedule mutations outside proposal/version acceptance.** This is non-negotiable:
- SMS cannot directly assign overnights
- SMS cannot bypass optimistic locking
- SMS cannot create schedule versions without proposal acceptance
- SMS cannot skip the explanation artifact requirement
- Every version change produces an audit log entry with actor, source, and artifact references

---

## 2. Authoritative Path: Inbound SMS → Schedule Change

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Twilio      │────▶│  SMS Webhook      │────▶│  Identity        │
│  Inbound     │     │  Controller       │     │  Resolution      │
└─────────────┘     └──────────────────┘     └────────┬────────┘
                                                       │
                                              user, family, role,
                                              timezone, conversation
                                                       │
                                                       ▼
                                             ┌─────────────────┐
                                             │  Conversation    │
                                             │  Orchestrator    │
                                             └────────┬────────┘
                                                      │
                                        ┌─────────────┼─────────────┐
                                        ▼             ▼             ▼
                              ┌──────────────┐ ┌──────────┐ ┌──────────────┐
                              │ Intent        │ │ Clarify  │ │ Unrecognized │
                              │ Classification│ │ (narrow  │ │ (safe reject │
                              │               │ │ question)│ │ + help text) │
                              └──────┬───────┘ └──────────┘ └──────────────┘
                                     │
                    ┌────────────────┼────────────────┐
                    ▼                ▼                ▼
          ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
          │ DISRUPTION   │  │ SWAP/CHANGE  │  │ PROPOSAL     │
          │ REPORT       │  │ REQUEST      │  │ REVIEW       │
          └──────┬───────┘  └──────┬───────┘  └──────┬───────┘
                 │                 │                 │
                 ▼                 ▼                 ▼
          ┌──────────────────────────────────────────────┐
          │          Domain Workflow Services             │
          │  (RequestsService, ProposalsService,          │
          │   GuardrailsService, MediationService,        │
          │   DisruptionsService, MetricsService)          │
          └──────────────────┬───────────────────────────┘
                             │
                             ▼
                    ┌──────────────────┐
                    │  Artifact-Backed  │
                    │  Reply Renderer   │
                    └────────┬─────────┘
                             │
                             ▼
                    ┌──────────────────┐
                    │  Outbound SMS     │
                    │  (via Twilio)     │
                    └──────────────────┘
```

### Path Rules

1. **Identity resolution is mandatory.** Every inbound SMS must resolve to a known user + family before any processing. Unknown numbers get a registration prompt, not silent drops.

2. **Intent classification is schema-validated.** The orchestrator produces a typed intent object, not freeform interpretation. First-wave intents:

   | Intent | Maps To | Domain Service |
   |--------|---------|---------------|
   | `DISRUPTION_REPORT` | Disruption event creation | DisruptionsService |
   | `SWAP_REQUEST` | Change request (SWAP_DATE) | RequestsService |
   | `COVERAGE_REQUEST` | Change request (NEED_COVERAGE) | RequestsService |
   | `EXTRA_TIME_REQUEST` | Change request (WANT_TIME) | RequestsService |
   | `PROPOSAL_ACCEPT` | Proposal acceptance | ProposalsService |
   | `PROPOSAL_DECLINE` | Proposal decline | ProposalsService |
   | `POLICY_CONFIRM` | Suggestion acceptance | PolicySuggestionResolutionWorkflow |
   | `STATUS_CHECK` | Read-only query | MetricsService, SchedulesService |
   | `HELP` | Help text | Static response |

3. **Ambiguity triggers clarification, not inference.** If intent classification confidence is below threshold, the system asks a narrow yes/no or multiple-choice question. It never guesses.

4. **No freeform mutation.** Messages like "just give me Thursday" are not valid schedule mutations. They must go through the request → proposal → acceptance flow.

5. **Replies are artifact-backed.** Every consequential reply (proposal summary, fairness update, acceptance confirmation) is generated from saved structured artifacts (ProposalOption, LedgerSnapshot, ExplanationArtifact), not ad-hoc text.

---

## 3. What the Pilot Is Not

- **Not a chatbot.** The system interprets structured intents, not open-ended conversation.
- **Not an AI scheduler.** The CP-SAT solver makes schedule decisions. SMS is interpretation, not generation.
- **Not a notification-only channel.** SMS is bidirectional — parents can initiate actions, not just receive alerts.
- **Not a replacement for the full app.** Complex review (proposal comparison, multi-option diffs) hands off to web review pages via short links.

---

## 4. Pilot Constraints

### Technical
- Single SMS provider (Twilio) for pilot
- Single phone number per pilot family (one number per parent)
- English only
- US phone numbers only for pilot
- Rate limit: 10 inbound messages per parent per hour
- Rate limit: 30 outbound messages per family per hour

### Operational
- Maximum 5 pilot families concurrently
- Operator must be able to pause any family without data loss
- All SMS content must be auditable via existing audit log
- Conversation state persisted in DB (not in-memory)

### Safety
- No PII in SMS beyond first names and dates
- No custody language — use "time with" not "custody of"
- No emotional language — factual, calm, brief
- Opt-out honored immediately (STOP keyword)
- No SMS sent between 9pm-8am family timezone unless urgent

---

## 5. SMS Message Tone Guidelines

All outbound SMS follows the existing neutral-language principles:

- **Do**: "Dad has tonight. Handoff at school tomorrow at 3pm."
- **Don't**: "It's Dad's turn tonight. Mom needs to drop off."
- **Do**: "2 options ready for Mar 15-17. Review: [link]"
- **Don't**: "We generated some proposals you might like!"
- **Do**: "Schedule updated. Version 7 active."
- **Don't**: "Great news! Your swap was approved!"

Maximum SMS length: 160 characters for single-segment, 320 for two-segment. Prefer single-segment.

---

## 6. Exit Criteria for Phase 0

- [x] Pilot scope documented (this document)
- [x] Authoritative path documented (Section 2)
- [x] Schedule mutation invariant stated (Section 1)
- [x] SMS cannot directly mutate schedules — must go through proposal/version acceptance
- [ ] Team review and approval

---

## 7. Execution Phases

| Phase | Focus | Key Deliverable |
|-------|-------|----------------|
| **0** | Scope freeze | This document |
| **1** | Production hardening | Background jobs, durable state, notification wiring |
| **2** | SMS transport + orchestration | Real phone ↔ system communication |
| **3** | Messaging UX + artifacts | Legible SMS replies, short-link review handoff |
| **4** | Accelerated timeline engine | Virtual clock + event replay through live services |
| **5** | Persona emulator library | Deterministic simulated co-parent behavior |
| **6** | Scenario coverage expansion | 80-90% of high-risk scenarios implemented |
| **7** | E2E test suite | API integration + simulator integration + contract tests |
| **8** | Operator tooling | Admin surface, trace views, kill switches |
| **9** | Internal pilot | Real phone + simulated families + mixed mode |
| **10** | Market pilot readiness | Security hardening, onboarding, support workflow |
