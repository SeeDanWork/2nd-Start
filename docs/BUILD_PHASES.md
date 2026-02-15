# Anti-Drama Co-Parenting — Build Phases for Claude Code

> Each phase is broken into **steps**. Each step is a single Claude Code session.
> Steps are scoped so that each one ends with something testable.
> Dependencies between steps are explicit. No step requires context from a prior session beyond what's in the codebase.

---

## Phase 0 — Project Scaffold

### Step 0.1: Monorepo + Tooling
**Input:** Empty directory.
**Work:**
- Initialize Turborepo monorepo structure:
  ```
  /apps/mobile        — React Native (Expo)
  /apps/api           — NestJS backend
  /apps/optimizer     — Python FastAPI + OR-Tools
  /packages/shared    — TypeScript types, enums, validation schemas (shared between api + mobile)
  /packages/config    — Shared ESLint, Prettier, tsconfig
  /docker             — Docker Compose (Postgres, Redis, optimizer)
  ```
- `package.json` root with Turborepo config
- `.gitignore`, `.nvmrc`, `.python-version`
- `docker-compose.yml` with Postgres 16, Redis 7
- Root `README.md` with setup instructions
- Initialize git repo

**Test:** `turbo build` runs without errors. `docker compose up -d` starts Postgres + Redis.

---

### Step 0.2: Shared Types Package
**Input:** Monorepo from 0.1.
**Work:**
- `packages/shared/src/enums.ts` — all domain enums:
  - `ParentRole`, `MemberRole`, `InviteStatus`, `FamilyStatus`
  - `ConstraintType`, `ConstraintHardness`, `ConstraintOwner`
  - `WeekendDefinition` (`fri_sat`, `sat_sun`)
  - `HandoffType`, `LocationType`
  - `RequestType`, `RequestStatus`, `RequestUrgency`
  - `AcceptanceType`
  - `SolverStatus`
  - `AuditAction`, `EntityType`
  - `ShareLinkScope`, `ShareLinkFormat`
  - `NotificationChannel`, `NotificationType`
  - `EmergencyModeStatus`
- `packages/shared/src/types.ts` — API request/response shapes for each endpoint group
- `packages/shared/src/validation.ts` — Zod schemas for all inputs (constraint parameters, request creation, family settings)
- `packages/shared/src/constants.ts` — default fairness band, default change budget, max reason note length, solver timeout, etc.
- Export everything from `packages/shared/src/index.ts`

**Test:** Package builds. Types import cleanly from api and mobile apps.

---

### Step 0.3: NestJS API Skeleton
**Input:** Monorepo from 0.1, shared types from 0.2.
**Work:**
- Initialize NestJS app in `apps/api`
- Module structure (empty modules, controllers, services — just the skeleton):
  ```
  src/
    auth/          — AuthModule, AuthController, AuthService
    families/      — FamiliesModule, FamiliesController, FamiliesService
    children/      — ChildrenModule
    constraints/   — ConstraintsModule
    holidays/      — HolidaysModule
    locations/     — LocationsModule
    schedules/     — SchedulesModule
    requests/      — RequestsModule
    proposals/     — ProposalsModule
    guardrails/    — GuardrailsModule (consent rules, budgets, emergency)
    metrics/       — MetricsModule (ledger, stability, audit)
    sharing/       — SharingModule
    onboarding/    — OnboardingModule
    common/        — guards, interceptors, filters, decorators
  ```
- TypeORM setup with Postgres connection config (env vars)
- Global validation pipe (class-validator)
- Health check endpoint: `GET /health`
- Basic error filter (consistent error response shape)
- `.env.example` with all required env vars

**Test:** `npm run start:dev` boots. `GET /health` returns 200.

---

### Step 0.4: Database Schema + Migrations
**Input:** NestJS skeleton from 0.3, shared types from 0.2.
**Work:**
- TypeORM entities for ALL tables from refined spec §3:
  - Core: `User`, `Family`, `FamilyMembership`, `Child`, `HandoffLocation`
  - Constraints: `ConstraintSet`, `Constraint`, `HolidayCalendar`
  - Schedules: `BaseScheduleVersion`, `OvernightAssignment`, `HandoffEvent`
  - Requests: `Request`, `ProposalBundle`, `ProposalOption`, `Acceptance`
  - Guardrails: `PreConsentRule`, `ChangeBudgetLedger`, `EmergencyMode`
  - Metrics: `LedgerSnapshot`, `StabilitySnapshot`, `AuditLog`
  - Sharing: `ShareLink`, `NotificationRecord`
- All indexes from refined spec §12
- Initial migration generated and tested
- Seed script: creates two test users, one family, one child (dev convenience)

**Test:** `npm run migration:run` applies cleanly. Seed script populates test data. All tables exist with correct columns and indexes.

---

### Step 0.5: Python Optimizer Skeleton
**Input:** Docker Compose from 0.1.
**Work:**
- Initialize FastAPI app in `apps/optimizer`
- `pyproject.toml` with dependencies: `fastapi`, `uvicorn`, `ortools`, `pydantic`
- Pydantic models mirroring the solver input/output contract:
  - `ScheduleRequest` (constraints, horizon, locked nights, holidays, parameters)
  - `ScheduleResponse` (solutions list, each with assignments + metrics + penalty breakdown + solver status)
  - `ProposalRequest` (same as above + frozen history + request constraints)
- Stub endpoints:
  - `POST /generate_base_schedule` — returns mock solution
  - `POST /generate_proposals` — returns mock solutions
  - `GET /health`
- Dockerfile for optimizer service
- Add to `docker-compose.yml`

**Test:** `docker compose up optimizer` boots. `POST /generate_base_schedule` with sample input returns mock response with correct shape.

---

### Step 0.6: React Native App Shell
**Input:** Monorepo from 0.1, shared types from 0.2.
**Work:**
- Initialize Expo app in `apps/mobile` (blank template, TypeScript)
- Navigation structure (React Navigation):
  ```
  AuthStack
    LoginScreen
  MainTabs
    HomeTab → HomeScreen
    CalendarTab → CalendarScreen
    RequestsTab → RequestsListScreen → RequestDetailScreen
    SettingsTab → SettingsScreen
  ```
- Placeholder screens (text only, no real UI yet)
- API client setup (axios instance with base URL, auth interceptor placeholder)
- Theme/colors foundation (parent_a color, parent_b color, neutral, background)
- Shared types imported from `packages/shared`

**Test:** `npx expo start` launches. Navigation between all placeholder screens works.

---

## Phase 1 — Auth + Family Formation

### Step 1.1: Magic Link Auth (API)
**Input:** API skeleton from 0.3, DB schema from 0.4.
**Work:**
- `AuthService`:
  - `sendMagicLink(email)` — generate token, store in Redis (15min TTL), send email (use console.log for now, real email provider later)
  - `verifyMagicLink(token)` — validate, create user if new, return JWT pair (access + refresh)
  - `refreshToken(refreshToken)` — rotate refresh token, return new pair
  - `getProfile(userId)` — return user
  - `updateProfile(userId, data)` — update name, timezone, notification prefs
  - `deleteAccount(userId)` — soft delete, 30-day cascade logic
- `AuthController` — endpoints from spec §5.1
- JWT strategy (Passport) + `AuthGuard` for protected routes
- Rate limiting on magic link sends (5/email/hour via Redis)

**Test:** Full flow via curl/Postman: send magic link → verify → get JWT → hit protected endpoint → refresh token. Rate limit triggers on 6th send.

---

### Step 1.2: Family + Invitation (API)
**Input:** Auth from 1.1.
**Work:**
- `FamiliesService`:
  - `create(userId, name, timezone)` — create family + FamilyMembership (parent_a, accepted)
  - `invite(familyId, email, role, label)` — create pending membership + invite token (Redis, 7 day TTL) + send invite email (console.log)
  - `acceptInvite(token, userId)` — validate, create/link user, mark accepted
  - `getFamily(familyId)` — with members
  - `updateSettings(familyId, settings)` — timezone, weekend def, fairness band, change budget
- `FamiliesController` — endpoints from spec §5.2
- `FamilyGuard` — middleware that verifies `user ∈ family.members` for all `/families/:familyId/*` routes
- `ChildrenService` + `ChildrenController` — basic CRUD from spec §5.3

**Test:** Create family → invite → accept → both users see family. Non-member gets 403. Child CRUD works.

---

### Step 1.3: Auth + Family Screens (Mobile)
**Input:** App shell from 0.6, auth API from 1.1, family API from 1.2.
**Work:**
- `LoginScreen`:
  - Email input → "Send magic link" → confirmation message
  - Deep link handler for magic link verification
  - Store JWT in secure storage (expo-secure-store)
- Auth state management (React Context or Zustand):
  - `isAuthenticated`, `user`, `family`, `login()`, `logout()`
  - Auto-refresh token on 401
- `OnboardingScreen` (simple — just family creation for now):
  - Enter family name → create family → show invite link/code
- `InviteAcceptScreen`:
  - Deep link target for invitations
  - Accept → navigate to main app
- Protected route wrapper (redirect to login if no token)

**Test:** Full flow on device/simulator: enter email → tap magic link → land in app → create family → share invite link → second device accepts → both see family.

---

## Phase 2 — Calendar + Manual Schedules

### Step 2.1: Calendar UI Component (Mobile)
**Input:** App shell from 0.6, theme from 0.6.
**Work:**
- `CalendarScreen` with month view:
  - Day cells colored by assigned parent (parent_a color / parent_b color / unassigned)
  - Handoff icons on transition days (small icon indicating type)
  - Today indicator
  - Month navigation (swipe or arrows)
  - Tap day → bottom sheet with:
    - Overnight assignment (who has the child)
    - Handoff details (type, time, location)
    - Holiday label if applicable
- Week view toggle (optional, stretch)
- Uses mock/hardcoded data initially (no API calls yet)

**Test:** Calendar renders month. Colors display correctly. Tap day shows details. Month navigation works.

---

### Step 2.2: Schedule Storage + Calendar API
**Input:** DB schema from 0.4, family API from 1.2.
**Work:**
- `SchedulesService`:
  - `getActiveSchedule(familyId)` — return active BaseScheduleVersion
  - `getAssignments(familyId, versionId, startDate, endDate)` — query OvernightAssignments
  - `getHandoffs(familyId, versionId, startDate, endDate)` — query HandoffEvents
  - `getCalendar(familyId, startDate, endDate)` — composite: assignments + handoffs + holidays in one query (optimized SQL from spec §14.5)
  - `createManualSchedule(familyId, assignments[])` — for dev/testing: create a BaseScheduleVersion with manually specified assignments, auto-generate handoff events on transition days
- `SchedulesController`:
  - `GET /families/:familyId/calendar?start=&end=`
  - `GET /families/:familyId/schedules/active`
  - `GET /families/:familyId/schedules/:version/assignments`
  - `GET /families/:familyId/schedules/:version/handoffs`
  - `POST /families/:familyId/schedules/manual` (dev tool)
- `AuditService` — log schedule creation events

**Test:** Create manual schedule via API → `GET /calendar` returns correct assignments + handoffs for date range. Composite query returns everything in one call.

---

### Step 2.3: Calendar Wired to API (Mobile)
**Input:** Calendar UI from 2.1, calendar API from 2.2, auth from 1.3.
**Work:**
- Connect `CalendarScreen` to live API:
  - Fetch calendar data for visible month (+ 1 week buffer on each side for smooth scrolling)
  - Cache fetched months in memory (avoid re-fetching on swipe back)
  - Loading state while fetching
  - Error state if API fails
- Home screen (`HomeScreen`) — first real content:
  - "Tonight" card: who has the child, handoff info if transition day
  - Next upcoming handoff (type, time, location)
- Pull-to-refresh on calendar

**Test:** Create manual schedule on API → open mobile app → calendar shows colored days → tap day shows correct details → home screen shows tonight card.

---

## Phase 3 — Constraints + Optimizer

### Step 3.1: Constraints CRUD (API)
**Input:** DB schema from 0.4, family API from 1.2.
**Work:**
- `ConstraintsService`:
  - `getActiveConstraintSet(familyId)` — return current constraints
  - `addConstraint(familyId, userId, constraintData)` — add to active set, increment version
  - `updateConstraint(familyId, constraintId, data)` — update, increment version
  - `removeConstraint(familyId, constraintId)` — remove, increment version
  - `validateConstraints(familyId)` — dry-run: basic conflict detection (overlapping locked nights, impossible splits). Full solver-based validation comes in 3.3.
- `ConstraintsController` — endpoints from spec §5.4
- `HolidaysService` + `HolidaysController` — CRUD from spec §5.5
- `LocationsService` + `LocationsController` — CRUD from spec §5.6

**Test:** Add locked nights (Mon/Tue for parent_a) → add max consecutive (5) → add weekend split (50/50) → validate returns OK. Add conflicting constraint → validate returns conflict details.

---

### Step 3.2: Constraints UI (Mobile)
**Input:** Constraints API from 3.1, app shell from 0.6.
**Work:**
- `SettingsScreen` → "Schedule Rules" section:
  - **Locked nights:** Day-of-week picker per parent. Visual: week row with toggles.
  - **Max consecutive nights:** Slider (2-7) per parent, with bonus week exception note.
  - **Weekend preference:** Slider (0-100% parent_a) with tolerance range display.
  - **Max transitions per week:** Stepper (1-5).
  - **Daycare-first handoffs:** Toggle (on/off).
  - **School-night consistency:** Toggle (on/off).
- Each setting saves immediately on change (optimistic update + API call)
- Show current constraint set summary at top
- Holiday calendar screen:
  - List holidays → add/edit entries (date + label + daycare_closed toggle)
- Handoff location screen:
  - List locations → add (name, type, address, available windows)
  - Mark one as default

**Test:** Set locked nights + max consecutive + weekend preference → API reflects changes. Add holiday entries. Add handoff location.

---

### Step 3.3: CP-SAT Base Schedule Solver (Optimizer)
**Input:** Optimizer skeleton from 0.5.
**Work:**
- Implement full CP-SAT model in `apps/optimizer/solver/base_schedule.py`:
  - Decision variables: `x[d]` for each day in horizon
  - Hard constraints from spec §4.2:
    - Locked nights
    - Max consecutive (with bonus week exemption)
    - Max transitions per week
    - Weekend split bounds
    - Handoff feasibility (no daycare exchange on closure days)
    - School-night consistency
  - Soft constraints / objective from spec §4.3:
    - Fairness deviation (weighted)
    - Total transitions (weighted)
    - Non-daycare handoffs (weighted)
    - Weekend fragmentation (weighted)
    - School-night disruption (weighted)
  - Solution pool callback: collect up to K=10 solutions
  - Diversity filter: min Hamming distance of 2 between solutions
  - Rank by penalty score
- Metrics computation per solution:
  - Overnights per parent
  - Weekend nights per parent
  - Transitions per week
  - Max consecutive streak per parent
  - School-night consistency percentage
- Infeasibility handling from spec §4.5:
  - If INFEASIBLE, iteratively relax to find conflicting subset
  - Return structured error with constraint IDs + suggestion

**Test:**
- Known-answer test: Mon/Tue locked to parent_a, max 5 consecutive, 50/50 weekend → solver produces valid schedule matching expectations.
- Infeasibility test: lock all 7 nights to parent_a + require 50/50 split → returns INFEASIBLE with conflicting constraints.
- Performance test: 52-week horizon solves in <30s.
- Determinism test: same inputs → same output.

---

### Step 3.4: Optimizer ↔ API Integration
**Input:** Optimizer from 3.3, constraints API from 3.1, schedule storage from 2.2.
**Work:**
- `SchedulesService.generateBaseSchedule(familyId)`:
  1. Load active constraint set + holidays + locations
  2. Build `ScheduleRequest` payload
  3. Call optimizer `POST /generate_base_schedule` (via HTTP)
  4. On success: create new `BaseScheduleVersion` + `OvernightAssignment` rows + auto-generate `HandoffEvent` rows (infer type from location availability + day type)
  5. Mark new version as active, deactivate old
  6. Log to audit
  7. Trigger ledger/stability snapshot recomputation (async job)
- Async via BullMQ:
  - `schedule-generation` queue
  - Job: call optimizer, store result, notify completion
  - `POST /families/:familyId/schedules/generate` → enqueue job, return job ID
  - `GET /families/:familyId/schedules/generate/:jobId` → poll status
- Error handling:
  - Optimizer timeout → return partial result or error
  - Infeasible → return constraint conflicts to user
  - Optimizer service down → retry with backoff (3 attempts)

**Test:** Set constraints → call generate → poll until done → GET calendar shows generated schedule. Infeasible constraints return useful error. Optimizer down → retry works.

---

### Step 3.5: Generate Schedule Flow (Mobile)
**Input:** Optimizer integration from 3.4, constraints UI from 3.2, calendar from 2.3.
**Work:**
- After setting constraints in Settings, add "Generate Schedule" button
- Generation flow:
  1. Tap "Generate Schedule"
  2. Show preview of constraints summary ("Mon/Tue locked to Mom, max 5 nights, 50/50 weekends...")
  3. Loading state with progress indication
  4. On success: navigate to calendar showing the new schedule
  5. On infeasible: show which constraints conflict + suggestion
  6. On error: retry option
- Calendar auto-refreshes to show new schedule
- Home screen fairness/stability bars (placeholder values from schedule metadata)

**Test:** Full flow: set constraints → generate → calendar shows correct schedule → home screen shows tonight card with generated data.

---

## Phase 4 — Fairness + Stability Metrics

### Step 4.1: Ledger + Stability Computation (API)
**Input:** Schedule storage from 2.2, DB schema from 0.4.
**Work:**
- `MetricsService`:
  - `computeLedger(familyId, versionId, windowWeeks)`:
    - For each rolling window (2/4/8/12 weeks):
      - Count overnights per parent
      - Count weekend nights per parent
      - Determine if within fairness band
    - Store as `LedgerSnapshot`
  - `computeStability(familyId, versionId, startDate, endDate)`:
    - Transitions per week
    - Max consecutive per parent
    - School-night consistency %
    - Weekend fragmentation count
    - Store as `StabilitySnapshot`
  - `getLedger(familyId, windows[])` — return snapshots (lazy recompute if stale per spec §14.4)
  - `getStability(familyId, startDate, endDate)` — return snapshot
- `MetricsController`:
  - `GET /families/:familyId/ledger?windows=2,4,8,12`
  - `GET /families/:familyId/stability?start=&end=`
- BullMQ job: recompute metrics on new schedule version (triggered from 3.4)
- `GET /families/:familyId/today` — composite endpoint:
  - Tonight's assignment
  - Next handoff
  - Current 8-week fairness (within band? delta?)
  - Current week stability (transitions this week)
  - Pending requests count

**Test:** Generate schedule → GET ledger returns correct overnight counts per window. Stability shows correct transitions. Today endpoint returns composite data. Stale detection + lazy recompute works.

---

### Step 4.2: Metrics UI (Mobile)
**Input:** Metrics API from 4.1, home screen from 2.3.
**Work:**
- `HomeScreen` upgrades:
  - **Fairness bar**: horizontal bar showing parent_a vs parent_b overnights over 8 weeks. Green if within band, yellow if close, red if outside.
  - **Stability indicator**: "X transitions this week" with icon. Green/yellow/red thresholds.
  - Both bars are tappable → navigate to detail view
- `LedgerScreen` (from HomeScreen tap or Settings):
  - Rolling window selector (2/4/8/12 weeks)
  - Table: window period | parent_a nights | parent_b nights | delta | within band
  - Trend chart (simple bar chart or line chart showing fairness over time)
  - "Within band" indicator per window
- `StabilityScreen`:
  - Transitions per week (current + trend)
  - Max consecutive streaks
  - School-night consistency %
  - Weekend fragmentation count

**Test:** Home screen shows live fairness bar + stability from generated schedule. Tap → see detailed ledger with correct numbers. Window selector changes displayed data.

---

## Phase 5 — Requests + Proposals

### Step 5.1: Request Creation (API)
**Input:** DB schema from 0.4, family/schedule APIs.
**Work:**
- `RequestsService`:
  - `create(familyId, userId, type, dates, reasonTag, reasonNote, urgency)`:
    - Validate: user is parent in family
    - Validate: no other active request for this family (mutual exclusion)
    - Validate: change budget not exhausted
    - Debit change budget
    - Set expiry (48h default, 12h for urgent)
    - Store request, log to audit
  - `list(familyId, filters)` — by status, paginated
  - `get(familyId, requestId)` — with full details
  - `update(familyId, requestId, data)` — only if draft
  - `cancel(familyId, requestId)` — refund budget debit
  - `getImpactPreview(familyId, requestId)`:
    - Without running solver, compute: how many days affected, current fairness delta, which constraints are impacted
    - Quick heuristic, not full solve
- `RequestsController` — endpoints from spec §5.8 (create, list, get, update, cancel, impact-preview)

**Test:** Create "need coverage" request for 3 dates → deducts budget → impact preview shows affected days. Second request while first active → 409. Cancel → budget refunded.

---

### Step 5.2: Proposal Generation (Optimizer + API)
**Input:** Request API from 5.1, optimizer from 3.3.
**Work:**
- Implement `apps/optimizer/solver/proposals.py`:
  - Accept frozen history (past assignments) + request constraints + active constraints
  - Solve forward horizon (configurable, default 8 weeks)
  - Warm-start from current schedule (spec §4.6 `AddSolutionHint`)
  - Generate solution pool (K=10)
  - For each: compute fairness impact, stability impact, handoff impact
  - Check each against pre-consent rules → flag `is_auto_approvable`
  - Rank and return top 5
- `POST /generate_proposals` endpoint on optimizer
- `ProposalsService` (API side):
  - `generateProposals(familyId, requestId)`:
    1. Load request + active schedule + constraints + consent rules
    2. Build ProposalRequest payload
    3. Call optimizer (async via BullMQ)
    4. Store ProposalBundle + ProposalOptions
    5. Update request status → `proposals_generated`
    6. If any option is auto-approvable, mark it (don't auto-accept yet — that's Phase 6)
    7. Notify other parent
  - `getProposals(familyId, requestId)` — return bundle with options
- `ProposalsController`:
  - `POST /families/:familyId/requests/:id/generate-proposals`
  - `GET /families/:familyId/requests/:id/proposals`

**Test:** Create request → generate proposals → get proposals returns 3-5 ranked options with impact scores. Warm-start reduces solve time vs cold start. Each option has fairness + stability + handoff breakdown.

---

### Step 5.3: Accept / Decline / Counter (API)
**Input:** Proposal generation from 5.2, schedule storage from 2.2.
**Work:**
- `ProposalsService`:
  - `accept(optionId, userId, expectedVersion)`:
    1. Optimistic lock check (version matches active)
    2. Create new `BaseScheduleVersion` from option's `calendar_diff`
    3. Create new `OvernightAssignment` + `HandoffEvent` rows
    4. Mark new version active
    5. Create `Acceptance` record
    6. Update request status → `accepted`
    7. Trigger metric recomputation (async)
    8. Log to audit
    9. Notify both parents
  - `decline(optionId, userId)`:
    1. Mark option declined
    2. If all options declined, update request → `declined`
    3. Log to audit, notify
  - `counter(optionId, userId)`:
    1. Generate new proposal bundle with modified constraints (the declined option's worst aspect is softened)
    2. Counter-depth check (max 1 counter per spec open decision — configurable)
    3. Store new bundle linked to original via `counter_bundle_id`
    4. Notify
- `ProposalsController`:
  - `POST /families/:familyId/proposals/:optionId/accept`
  - `POST /families/:familyId/proposals/:optionId/decline`
  - `POST /families/:familyId/proposals/:optionId/counter`
- Version conflict handling: 409 with current version on stale accept

**Test:** Accept option → new schedule version created → calendar shows updated schedule → metrics recomputed. Decline all → request marked declined. Counter → new bundle generated. Concurrent accept → second gets 409.

---

### Step 5.4: Request + Proposal UI (Mobile)
**Input:** Request API from 5.1, proposal API from 5.2/5.3, calendar from 2.3.
**Work:**
- `RequestsListScreen`:
  - List of requests (active, recent history)
  - Status badges (pending, proposals ready, accepted, expired)
  - FAB: "New Request"
- `CreateRequestScreen`:
  - Request type picker (need coverage, want time, bonus week, swap date)
  - Date picker (multi-date selection on calendar mini-view)
  - Reason tag selector (work, medical, family, other)
  - Optional short note (200 char limit)
  - Impact preview panel (before submitting)
  - Submit → loading → navigate to proposals when ready
- `ProposalReviewScreen`:
  - Stacked option cards, each showing:
    - Label ("Minimal disruption", "Best fairness")
    - Fairness impact ("+1 overnight to Dad over 8 weeks")
    - Stability impact ("+1 transition this week")
    - Handoff summary ("1 new neutral exchange")
    - Calendar mini-diff (highlighted changed days)
  - Buttons per option: Accept / Decline
  - Bottom action: "Counter with alternatives"
  - Expiry countdown timer
- Notifications: when proposals arrive, badge on Requests tab

**Test:** Full flow: create request → see impact preview → submit → proposals generated → review cards → accept one → calendar updates → metrics update. Also: decline all → counter → new proposals appear.

---

## Phase 6 — Guardrails

### Step 6.1: Pre-Consent + Auto-Approve (API)
**Input:** Proposal flow from 5.2/5.3, DB schema.
**Work:**
- `GuardrailsService`:
  - `getConsentRules(familyId)` — list active rules
  - `addConsentRule(familyId, userId, ruleType, threshold)` — both parents can add
  - `updateConsentRule(familyId, ruleId, data)`
  - `removeConsentRule(familyId, ruleId)`
  - `evaluateAutoApproval(familyId, proposalOption)`:
    - Check each active rule against option's impacts
    - If ALL rules pass → option is auto-approvable
  - Auto-approve integration:
    - When proposals are generated, if an option is auto-approvable AND the requesting parent is the "other" parent:
      - Auto-accept the best auto-approvable option
      - Create Acceptance with type `auto_approved`
      - Still visible in audit log + notification sent ("Auto-approved: swap on March 5")
- `GuardrailsController` — consent rules CRUD from spec §5.9

**Test:** Set consent rule (auto-approve if fairness delta ≤ 1) → create request that produces an option within band → auto-approved without manual accept. Option outside band → requires manual review.

---

### Step 6.2: Change Budgets + Expiry (API)
**Input:** Request flow from 5.1, guardrails from 6.1.
**Work:**
- `GuardrailsService` additions:
  - `getBudgetStatus(familyId)` — per parent: limit, used, remaining for current month
  - Budget enforcement already in request creation (5.1), ensure it's correct
  - Monthly reset: BullMQ cron job on 1st of each month → reset `used` to 0
- Proposal expiry:
  - BullMQ repeating job (every 15 min):
    - Find bundles past `expires_at`
    - Mark request → `expired`
    - Notify both parents
    - No schedule change
  - Also: BullMQ delayed job per bundle (at `expires_at - 4h`) → send "expiring soon" notification
- `GuardrailsController`:
  - `GET /families/:familyId/budgets`

**Test:** Exhaust budget (4 requests) → 5th request rejected. Monthly reset → budget available again. Create proposal → wait for expiry → request marked expired + notification sent. Expiry warning sent 4h before.

---

### Step 6.3: Emergency Mode (API)
**Input:** Constraints from 3.1, schedule generation from 3.4.
**Work:**
- `GuardrailsService`:
  - `activateEmergency(familyId, userId, returnDate, relaxedConstraintIds)`:
    - Store EmergencyMode record
    - Temporarily suspend specified constraints
    - Optionally trigger schedule regeneration for the emergency window
    - Log to audit, notify other parent
  - `getEmergencyStatus(familyId)`
  - `updateEmergency(familyId, returnDate)` — extend/shorten
  - `cancelEmergency(familyId)` — restore constraints immediately
  - Return-to-baseline: BullMQ delayed job at `return_to_baseline_at`:
    - Reactivate suspended constraints
    - Trigger schedule regeneration
    - Mark emergency → `returned`
    - Notify both parents
- `GuardrailsController`:
  - `POST/GET/PATCH/DELETE /families/:familyId/emergency`

**Test:** Activate emergency → constraints relaxed → generate schedule works with fewer constraints. Return date arrives → constraints restored → schedule regenerated. Cancel early → same restoration.

---

### Step 6.4: Guardrails UI (Mobile)
**Input:** Guardrails APIs from 6.1-6.3.
**Work:**
- `SettingsScreen` → "Guardrails" section:
  - **Auto-approve rules**: list current rules, add new (type picker + threshold slider)
  - **Change budget**: show "X of Y requests used this month" per parent
  - **Emergency mode**: activation button → date picker for return date → select which constraints to relax → confirm. Active emergency shows banner across app.
- Notification integration:
  - Auto-approve events shown in request history with "Auto-approved" badge
  - Expiry warnings shown as in-app alert
  - Emergency mode banner on home screen when active

**Test:** Set auto-approve rule → see it in settings. Budget display matches API. Activate emergency → banner shows → constraints relaxed. Return date notification received.

---

## Phase 7 — Audit, Sharing, Exports

### Step 7.1: Audit Log (API + Mobile)
**Input:** Audit logging already wired from prior phases.
**Work:**
- `MetricsService`:
  - `getAuditLog(familyId, limit, offset)` — paginated, newest first
  - `getMonthlySummary(familyId, month)` — aggregate: total overnights, transitions, requests made/accepted/expired, schedule versions created
- `MetricsController`:
  - `GET /families/:familyId/audit`
  - `GET /families/:familyId/summary?month=`
- Mobile `AuditScreen`:
  - Chronological list of events with neutral language:
    - "Schedule generated (v3)" / "Request accepted: coverage Mar 5-7" / "Auto-approved: swap Mar 12"
  - Filter by event type
  - Monthly summary card at top

**Test:** Perform several actions → audit log shows all events in order with correct metadata. Monthly summary aggregates match.

---

### Step 7.2: ICS Feeds + Share Links
**Input:** Schedule storage, sharing schema.
**Work:**
- `SharingService`:
  - `createShareLink(familyId, userId, scope, label, format, expiresAt)` — generate crypto token
  - `listShareLinks(familyId)` — list active links
  - `revokeShareLink(familyId, linkId)` — set `revoked_at`
  - `resolveShareLink(token)` — validate not expired/revoked, return scoped data
- ICS generation:
  - Generate `.ics` file from active schedule:
    - VEVENT per overnight block (consolidated: consecutive same-parent nights = one event)
    - VEVENT per handoff event (with time, location in LOCATION field)
    - Refresh: ICS endpoint always returns current active schedule
- Public endpoints (no auth):
  - `GET /share/:token` — render simple read-only HTML calendar
  - `GET /share/:token/feed.ics` — return ICS file
- `SharingController` — endpoints from spec §5.11

**Test:** Create share link → access via token → see read-only calendar. ICS feed imports correctly into Google Calendar / Apple Calendar. Revoke → 404. Expired → 410.

---

### Step 7.3: Sharing UI (Mobile)
**Input:** Sharing API from 7.2.
**Work:**
- `SettingsScreen` → "Sharing" section:
  - List active share links (label, scope, created date, expiry)
  - "Create share link" → scope picker (calendar / ICS feed) + optional label + optional expiry
  - Copy link button
  - Revoke button (with confirmation)
- Monthly export:
  - `SettingsScreen` → "Export" → month picker → "Download summary" (opens summary in webview or shares as PDF)

**Test:** Create share link → copy → open in browser → see read-only calendar. Create ICS link → subscribe in calendar app. Revoke → link stops working.

---

## Phase 8 — Notifications + Real-Time

### Step 8.1: Email Notifications
**Input:** All prior flows that trigger notifications.
**Work:**
- Email service integration (Resend or Postmark):
  - Transactional email templates (plain, neutral language):
    - Magic link
    - Family invitation
    - New proposal received
    - Proposal accepted
    - Proposal expiring (4h warning)
    - Proposal expired
    - Emergency mode activated/returned
    - Handoff reminder
    - Weekly fairness digest
  - `NotificationService`:
    - `send(userId, type, data)` — resolve channel preference, send via appropriate provider
    - Store `NotificationRecord`
  - BullMQ integration:
    - All notification sends go through job queue (resilient to provider failures)
    - Retry with backoff on send failure

**Test:** Trigger each event type → email received with correct content. Notification preferences respected (email disabled → no send). Failed send → retried.

---

### Step 8.2: WebSocket + Push Notifications
**Input:** Email notifications from 8.1.
**Work:**
- NestJS WebSocket gateway:
  - Auth: validate JWT on connection
  - Rooms: one per family
  - Events pushed: `schedule_updated`, `proposal_received`, `proposal_accepted`, `proposal_expired`, `emergency_changed`
  - Client subscribes on app foreground, disconnects on background
- React Native integration:
  - WebSocket client (socket.io-client or native WS)
  - On event received → refresh affected data (calendar, proposals, metrics)
  - In-app notification banner for important events
- Push notifications (FCM/APNs via Expo):
  - Register device token on login
  - `NotificationService` sends push for high-priority events (new proposal, accepted, handoff reminder)
  - Tap push → deep link to relevant screen

**Test:** Parent A accepts proposal → Parent B sees calendar update in real-time (WebSocket). App backgrounded → push notification received → tap → opens proposal screen.

---

## Phase 9 — Offline + Polish

### Step 9.1: Offline Cache + Sync
**Input:** All prior mobile work.
**Work:**
- Local storage layer (expo-sqlite or AsyncStorage):
  - Cache on login and each data change:
    - Active schedule (next 12 weeks of assignments + handoffs)
    - Family settings
    - Today card data
    - Recent requests
  - Cache invalidation: on WebSocket `schedule_updated` event, refetch
- Offline read:
  - Calendar renders from cache when no connectivity
  - Today card renders from cache
  - Show "offline" indicator
- Offline write queue:
  - If offline, queue: request creation, proposal acceptance
  - On reconnect: replay in order
  - Version conflict → surface to user ("Schedule was updated while you were offline. Please review.")
- Stale data indicator: if cached data is >1 hour old, show subtle warning

**Test:** Load app with data → go offline → calendar still renders → create request offline → go online → request syncs. Version conflict scenario handled gracefully.

---

### Step 9.2: Onboarding Templates
**Input:** Constraints API, schedule generation, auth flow.
**Work:**
- `OnboardingService`:
  - Template catalog (hardcoded initially, 3-5 archetypes):
    - **"Daycare week split"**: Mon/Tue locked parent_a, Wed/Thu/Fri flexible, alternating weekends, daycare exchanges
    - **"Alternating weeks"**: 7-on/7-off, daycare Monday exchange
    - **"2-2-3 rotation"**: 2 days each, alternating 3-day weekends
    - **"5-2 weekday/weekend split"**: one parent weekdays, other weekends
  - Each template: pre-built constraint set + recommended settings
  - `GET /onboarding/templates` — return templates with descriptions + preview schedules
  - `POST /onboarding/from-template` — create family + constraint set + generate initial schedule (all in one)
- Mobile `OnboardingFlow` (replaces simple family creation):
  1. "Pick a starting pattern" → template cards with mini calendar preview
  2. "Customize" → adjust locked nights, max streak, weekend pref (pre-filled from template)
  3. "Set handoff style" → daycare default + add locations
  4. "Review" → show generated schedule preview
  5. "Invite co-parent" → send invite
  6. Done → navigate to main app

**Test:** Select template → customize one constraint → generate → preview looks correct → invite sent → both parents land in working app with schedule. Full onboarding < 5 minutes.

---

### Step 9.3: UI Polish + Edge Cases
**Input:** All prior work.
**Work:**
- Neutral language audit: review all user-facing strings for blame/debt phrasing. Replace with band/stability language.
- Empty states: first login with no family, no schedule, no requests — each screen has helpful empty state guiding to next action
- Error handling: network errors, timeout, server errors — all show user-friendly messages with retry
- Loading states: skeletons for calendar, spinner for generation, progress for proposal generation
- Accessibility: screen reader labels, sufficient contrast, tap targets ≥ 44px
- Calendar performance: virtualized month list for smooth scrolling through many months
- Deep link handling: magic links, invite links, notification taps → correct screen

**Test:** Manual QA pass through every flow. Empty states render. Errors handled. Language is neutral throughout.

---

## Phase Summary

| Phase | Steps | Status | What you have after |
|---|---|---|---|
| **0 — Scaffold** | 0.1–0.6 | DONE | Monorepo, shared types, API skeleton, DB schema, optimizer stub, RN app shell |
| **1 — Auth + Family** | 1.1–1.3 | DONE | Two parents can sign up, form a family, invite each other |
| **2 — Calendar** | 2.1–2.3 | DONE | Calendar renders schedules, home screen shows tonight card |
| **3 — Constraints + Optimizer** | 3.1–3.5 | DONE | Parents set rules, system generates fair stable schedules |
| **4 — Metrics** | 4.1–4.2 | TODO | Fairness bars, stability scores, rolling ledger |
| **5 — Requests + Proposals** | 5.1–5.4 | TODO | Exception handling via ranked proposal bundles |
| **6 — Guardrails** | 6.1–6.4 | TODO | Auto-approve, change budgets, expiry, emergency mode |
| **7 — Audit + Sharing** | 7.1–7.3 | TODO | Audit log, ICS feeds, share links, exports |
| **8 — Notifications** | 8.1–8.2 | TODO | Email, push, real-time WebSocket updates |
| **9 — Offline + Polish** | 9.1–9.3 | TODO | Offline support, onboarding templates, UI polish |

**Total: 28 steps across 10 phases.** Each step is one Claude Code session producing testable output.

### Completion Log
- **2026-02-15**: Phases 0-3 completed (commits `4147a39`, `5c0d7e7`). API typechecks clean. Full CP-SAT solver implemented. Mobile auth + calendar + constraints UI functional.

---

## Dependency Graph (critical path)

```
0.1 → 0.2 → 0.3 → 0.4 ──────────────────────────────────────→ (all API work)
0.1 → 0.5 ────────────────────→ 3.3 → 3.4                     (optimizer track)
0.1 → 0.2 → 0.6 ──────────────────────────────────────────────→ (all mobile work)

1.1 → 1.2 → 1.3               (auth + family)
2.1 → 2.3                     (calendar mobile needs calendar component first)
2.2 → 2.3                     (calendar mobile needs calendar API)
3.1 → 3.2                     (constraints UI needs constraints API)
3.1 → 3.3 → 3.4 → 3.5        (optimizer chain)
4.1 → 4.2                     (metrics UI needs metrics API)
5.1 → 5.2 → 5.3 → 5.4        (requests chain)
6.1 → 6.2 → 6.3 → 6.4        (guardrails chain)
7.1 → 7.2 → 7.3               (sharing chain)
8.1 → 8.2                     (notifications chain)
9.1, 9.2, 9.3                 (can parallelize)
```

**Parallel tracks after Phase 0:**
- API track (1.1 → 1.2 → 2.2 → 3.1 → 3.4 → 4.1 → 5.1 → ...)
- Mobile track (1.3 → 2.1 → 2.3 → 3.2 → 3.5 → 4.2 → 5.4 → ...)
- Optimizer track (3.3 → 5.2 solver work)

These three tracks can run in parallel once Phase 0 is complete.
