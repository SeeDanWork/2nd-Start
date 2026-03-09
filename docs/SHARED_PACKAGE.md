# Shared Package (@adcp/shared)

The `packages/shared/` package provides types, enums, validation schemas, and constants used across the API, mobile, web, and optimizer.

## Exports

```typescript
export * from './enums';
export * from './types';
export * from './constants';
export * from './validation';
export * from './recommendations';
export * from './messaging';
export * from './onboarding';
```

## Enums (`enums.ts`)

35 enum types covering every domain concept:

### Identity & Access
- `ParentRole`: PARENT_A, PARENT_B
- `MemberRole`: PARENT_A, PARENT_B, CAREGIVER, VIEWER
- `InviteStatus`: PENDING, ACCEPTED, DECLINED
- `FamilyStatus`: ONBOARDING, ACTIVE, PAUSED, ARCHIVED

### Schedule
- `WeekendDefinition`: FRI_SAT, SAT_SUN
- `HandoffType`: DAYCARE_DROPOFF, DAYCARE_PICKUP, SCHOOL_DROPOFF, SCHOOL_PICKUP, NEUTRAL_EXCHANGE, HOME_EXCHANGE
- `LocationType`: DAYCARE, SCHOOL, NEUTRAL, HOME_PARENT_A, HOME_PARENT_B
- `SolverStatus`: OPTIMAL, FEASIBLE, INFEASIBLE, TIMEOUT
- `ScheduleSource`: GENERATION, PROPOSAL_ACCEPTANCE, MANUAL_OVERRIDE
- `AssignmentSource`: GENERATED, PROPOSAL, MANUAL

### Constraints
- `ConstraintType`: LOCKED_NIGHT, MAX_CONSECUTIVE, MIN_CONSECUTIVE, WEEKEND_SPLIT, MAX_TRANSITIONS_PER_WEEK, DAYCARE_EXCHANGE_ONLY, NO_SCHOOL_NIGHT_TRANSITION, HANDOFF_LOCATION_PREFERENCE, FAIRNESS_TARGET, UNAVAILABLE_DAY
- `ConstraintHardness`: HARD, SOFT
- `ConstraintOwner`: PARENT_A, PARENT_B, SHARED

### Requests & Proposals
- `RequestType`: NEED_COVERAGE, WANT_TIME, BONUS_WEEK, SWAP_DATE
- `RequestStatus`: DRAFT, PENDING, PROPOSALS_GENERATED, ACCEPTED, DECLINED, EXPIRED, CANCELLED
- `RequestUrgency`: NORMAL, URGENT
- `ReasonTag`: WORK_TRAVEL, MEDICAL, FAMILY_EVENT, OTHER
- `AcceptanceType`: MANUAL, AUTO_APPROVED, COUNTER

### Guardrails
- `ConsentRuleType`: FAIRNESS_BAND, MAX_TRANSITIONS, MAX_STREAK, REQUEST_TYPE
- `EmergencyModeStatus`: ACTIVE, RETURNED, CANCELLED
- `LedgerWindowType`: TWO_WEEK, FOUR_WEEK, EIGHT_WEEK, TWELVE_WEEK

### Audit & Notifications
- `AuditAction`: 17 action types (SCHEDULE_GENERATED through SHARE_LINK_CREATED)
- `AuditEntityType`: SCHEDULE, REQUEST, CONSTRAINT, CONSENT_RULE, EMERGENCY, MEMBER, SHARE_LINK
- `NotificationChannel`: EMAIL, PUSH
- `NotificationType`: 9 types (HANDOFF_REMINDER through FAIRNESS_DRIFT)
- `ShareLinkScope`: CALENDAR_READONLY, ICS_FEED, HANDOFF_SCHEDULE
- `ShareLinkFormat`: WEB, ICS

### Messaging
- `MessagingChannel`: SMS, WHATSAPP
- `ConversationState`: IDLE, ONBOARDING, REQUESTING, RESPONDING, REPORTING, REVIEWING
- `MessageDirection`: INBOUND, OUTBOUND
- `MessageIntent`: REPORT_ILLNESS, REQUEST_SWAP, CONFIRM_SCHEDULE, REPORT_DISRUPTION, APPROVE, DECLINE, VIEW_SCHEDULE, HELP, UNKNOWN
- `DeliveryStatus`: QUEUED, SENT, DELIVERED, FAILED, UNDELIVERED

### Calendar Sync
- `CalendarProvider`: GOOGLE, APPLE, OUTLOOK
- `CalendarEventType`: CUSTODY_BLOCK, EXCHANGE, HOLIDAY, DISRUPTION
- `CalendarSyncStatus`: PENDING, SYNCED, FAILED, STALE

## Constants (`constants.ts`)

### Solver & Schedule
- `SOLVER_TIMEOUT_SECONDS`: 30
- `SOLVER_MAX_SOLUTIONS`: 10
- `SOLVER_MIN_HAMMING_DISTANCE`: 2
- `DEFAULT_SCHEDULE_HORIZON_WEEKS`: 12
- `DEFAULT_PROPOSAL_HORIZON_WEEKS`: 8
- `DEFAULT_MAX_CONSECUTIVE_NIGHTS`: 5
- `BONUS_WEEK_MAX_CONSECUTIVE`: 7
- `DEFAULT_MAX_TRANSITIONS_PER_WEEK`: 3

### Solver Weights
```typescript
DEFAULT_SOLVER_WEIGHTS = {
  fairnessDeviation: 100,
  totalTransitions: 50,
  nonDaycareHandoffs: 30,
  weekendFragmentation: 40,
  schoolNightDisruption: 60,
};
```

### Age Weight Multipliers
Four profiles (infant, young_child, school_age, teen) that scale DEFAULT_SOLVER_WEIGHTS. Example: teens get fairnessDeviation x1.2, infants get x0.8.

### Fairness & Guardrails
- `DEFAULT_FAIRNESS_BAND`: { maxOvernightDelta: 1, windowWeeks: 8 }
- `DEFAULT_WEEKEND_TARGET_PCT`: 50
- `DEFAULT_WEEKEND_TOLERANCE_PCT`: 10
- `DEFAULT_CHANGE_BUDGET_PER_MONTH`: 4
- `MAX_PROPOSALS_RETURNED`: 5
- `MAX_COUNTER_DEPTH`: 1

### Proposals
- `DEFAULT_PROPOSAL_EXPIRY_HOURS`: 48
- `URGENT_PROPOSAL_EXPIRY_HOURS`: 12
- `PROPOSAL_EXPIRY_WARNING_HOURS`: 4

### Auth & Security
- `MAGIC_LINK_TTL_MINUTES`: 15
- `INVITE_TOKEN_TTL_DAYS`: 7
- `MAGIC_LINK_RATE_LIMIT_PER_HOUR`: 5
- `JWT_ACCESS_TOKEN_TTL`: '5h'
- `JWT_REFRESH_TOKEN_TTL`: '30d'
- `ACCOUNT_DELETION_GRACE_DAYS`: 30
- `SHARE_LINK_TOKEN_BYTES`: 32

### Rate Limits
```typescript
RATE_LIMITS = {
  magicLinkPerEmailPerHour: 5,
  authVerifyPerToken: 10,
  scheduleGenerationPerFamilyPerHour: 3,
  proposalGenerationPerFamilyPerHour: 5,
  generalApiPerUserPerMinute: 100,
};
```

### Caching
- `CACHE_HORIZON_WEEKS`: 12
- `CACHE_STALE_THRESHOLD_HOURS`: 1
- `DEFAULT_REMINDER_HOURS_BEFORE`: 24

## Validation (`validation.ts`)

30+ Zod schemas for API input validation:

- **Auth**: sendMagicLinkSchema, verifyMagicLinkSchema, updateProfileSchema
- **Families**: createFamilySchema, updateFamilySchema, inviteMemberSchema
- **Children**: createChildSchema, updateChildSchema
- **Constraints**: addConstraintSchema, updateConstraintSchema, constraintParametersSchema
- **Holidays**: createHolidayCalendarSchema, holidayEntrySchema
- **Locations**: createLocationSchema, updateLocationSchema
- **Requests**: createRequestSchema, updateRequestSchema
- **Proposals**: acceptProposalSchema, generateProposalsSchema
- **Guardrails**: createConsentRuleSchema, activateEmergencySchema
- **Sharing**: createShareLinkSchema
- **Schedules**: generateScheduleSchema, manualAssignmentSchema
- **Queries**: dateRangeQuerySchema, paginationQuerySchema, ledgerQuerySchema
- **Messaging**: inboundMessageSchema

## Recommendations (`recommendations/`)

### Age Baselines (`age_baselines.ts`)
9 fine-grained age bands (V2): 0-6m, 6-12m, 1-2y, 2-3y, 3-5y, 5-7y, 8-10y, 11-13y, 14-17y.

Each band has:
- `maxConsecutive`: max nights away from either parent
- `maxAway`: max consecutive days away
- `preferredTemplates`: best-fit custody templates

### Templates (`templates.ts`)
8 custody pattern templates with concrete 14-day patterns:
- 223, 223_daytime, 3443, 2255, 7on7off, primary_plus_midweek, 2week_blocks, primary_weekends

### Scoring (`scoring.ts`)
`recommendBaselineV2(input)` — Scores templates against family context (children ages, goals, distance, exchange preferences).

### Explain (`explain.ts`)
- `generateRationale(input, aggregate, topTemplates)` — Human-readable reasons
- `generateTradeoffs(template, input)` — What you give up
- `getDisclaimers(input)` — Legal/advisory disclaimers

### Context (`context.ts`)
`computeFamilyContextDefaults(children, goals)` — Returns solver weight profile, max consecutive, preferred templates based on youngest child's age band.

## Messaging (`messaging/`)

### Intent Parser (`intent-parser.ts`)
`parseIntent(text)` — Returns intent, confidence, extracted entities.

Priority-ordered intent detection:
1. HELP (help keywords)
2. APPROVE (yes/yeah/ok/approve)
3. DECLINE (no/nope/reject)
4. VIEW_SCHEDULE (show/view schedule)
5. REPORT_ILLNESS (sick/fever/doctor)
6. REQUEST_SWAP (swap/switch/cover)
7. CONFIRM_SCHEDULE (who has/whose turn)
8. REPORT_DISRUPTION (school closed/snow day)
9. UNKNOWN (fallback)

Entity extraction: days of week, relative dates (today, tomorrow), specific dates (MM/DD), child names.

## Onboarding (`onboarding/`)

### Bootstrap Facts (`bootstrap-facts.ts`)
12 domain enums for onboarding wizard:
- ScheduleTemplate (6 patterns)
- ExchangeModality (5 types)
- ExchangeTimingType, MidweekPattern, WeekendPattern
- OptimizationGoal (8 goals)
- OnboardingStage (6 stages)
- SeasonalPatternMode, BaselineWindowMode
- ParticipationMode, ResponsibilityModel, SiblingCohesionPolicy
