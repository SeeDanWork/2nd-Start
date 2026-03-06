# Messaging-First Architecture

Technical architecture for shifting ADCP from a dedicated app interface to a messaging-first, calendar-integrated system.

---

## 1. System Architecture Overview

```
                        SMS / WhatsApp
                             |
                     [ Messaging Gateway ]
                        (Twilio / etc)
                             |
                      [ Webhook Ingress ]
                             |
                   [ Conversation Engine ]
                     |              |
              [ NLP Parser ]   [ Session Store ]
                     |
              [ Command Router ]
                     |
        +-----------+-----------+-----------+
        |           |           |           |
   [ Onboarding ] [ Requests ] [ Disruptions ] [ Approvals ]
        |           |           |           |
        +-----------+-----------+-----------+
                     |
              [ Scheduling Engine ]
              (Optimizer / CP-SAT)
                     |
              [ Schedule Store ]
                /          \
    [ Calendar Sync ]   [ Web Viewer ]
    (Google/Apple/      (read-only
     Outlook)            dashboard)
```

### What stays (core IP)

| Component | Location | Role |
|-----------|----------|------|
| Optimizer | `apps/optimizer/` | CP-SAT solver, brain, bootstrap |
| API core | `apps/api/` | Auth, families, children, constraints, schedules, requests, proposals, guardrails, metrics, disruptions |
| Shared | `packages/shared/` | Enums, types, validation, recommendations, calendar utils |
| Simulator | `apps/simulator/` | Scenario testing (51 scenarios) |

### What gets replaced

| Old | New | Reason |
|-----|-----|--------|
| `apps/mobile/` | Messaging gateway | Parents interact via SMS/WhatsApp |
| `apps/web/` (full UI) | Slim read-only viewer | No interactive scheduling UI needed |

### What gets added

| Component | Purpose |
|-----------|---------|
| `apps/api/src/messaging/` | Twilio/WhatsApp webhook handler, conversation engine |
| `apps/api/src/calendar-sync/` | Bidirectional calendar push (Google, Apple, Outlook) |
| `apps/web/` (rewrite) | Read-only dashboard linked from SMS |

---

## 2. Messaging Interface Design

### 2.1 Gateway Integration

**Provider:** Twilio Programmable Messaging (SMS + WhatsApp in one API)

**Webhook flow:**
```
Twilio POST /api/messaging/webhook
  -> Verify signature (X-Twilio-Signature)
  -> Look up parent by phone number
  -> Load or create conversation session
  -> Parse message through NLP
  -> Route to appropriate handler
  -> Send response via Twilio REST API
```

**New module:** `apps/api/src/messaging/`
```
messaging/
  messaging.module.ts
  messaging.controller.ts      # Webhook endpoint
  messaging.service.ts          # Orchestration
  conversation.service.ts       # Session state machine
  message-parser.service.ts     # NLP / intent extraction
  message-sender.service.ts     # Outbound via Twilio
  templates/                    # Response templates
    onboarding.ts
    schedule-confirmation.ts
    swap-request.ts
    disruption-report.ts
    approval-prompt.ts
    error-fallback.ts
```

### 2.2 Conversation State Machine

Each parent has a conversation session tracked in the database.

**States:**
```
IDLE -> ONBOARDING -> ACTIVE
                        |
                   +---------+---------+---------+
                   |         |         |         |
              REQUESTING  RESPONDING  REPORTING  REVIEWING
                   |         |         |         |
                   +---------+---------+---------+
                        |
                      IDLE
```

**Session model:**
```typescript
interface ConversationSession {
  id: string;
  parentId: string;
  familyId: string;
  state: ConversationState;
  context: Record<string, any>;  // state-specific data
  lastMessageAt: Date;
  expiresAt: Date;               // auto-expire stale sessions
  channel: 'sms' | 'whatsapp';
  phoneNumber: string;
}
```

Sessions expire after 30 minutes of inactivity, returning to IDLE.
Context carries partial data (e.g., half-completed swap request).

### 2.3 Command Parsing

Reuse and extend the existing `parseNaturalLanguage()` from `packages/shared/src/interpreter/`.

**Intent categories:**

| Intent | Example | Action |
|--------|---------|--------|
| `REPORT_ILLNESS` | "Kai is sick today" | Create disruption, notify other parent |
| `REQUEST_SWAP` | "Can we swap this Friday?" | Create request, send approval to other parent |
| `CONFIRM_SCHEDULE` | "Who has the kids Monday?" | Look up schedule, reply |
| `REPORT_DISRUPTION` | "School is closed tomorrow" | Create disruption overlay |
| `APPROVE` | "Yes" / "Approve" | Accept pending proposal |
| `DECLINE` | "No" / "Decline" | Decline pending proposal |
| `VIEW_SCHEDULE` | "Show me this week" | Send web viewer link |
| `HELP` | "Help" / "?" | Send command list |

**Ambiguity handling:**
- Confidence threshold: 0.7
- Below threshold: ask clarifying question
- Above threshold: execute and confirm
- Critical actions (schedule changes): always confirm before executing

### 2.4 Identity Verification

- Parents register phone number during onboarding (via initial web form or admin setup)
- Incoming messages matched by `From` phone number -> parent record
- Unknown numbers receive: "This number isn't registered. Visit [link] to set up your account."
- Optional: PIN verification for sensitive actions (schedule modifications)

### 2.5 Message Routing Between Parents

The system mediates. Parents never message each other directly through the platform.

```
Parent A: "Can we swap Friday?"
  -> System creates SwapRequest
  -> System texts Parent B: "Parent A is requesting to swap Friday 3/13. Reply APPROVE or DECLINE."
  -> Parent B: "Approve"
  -> System executes swap
  -> System texts both: "Friday 3/13 swapped. A has the kids. Calendar updated."
```

### 2.6 Rate Limiting and Safety

- Max 20 inbound messages per parent per hour
- Profanity/abuse detection -> flag for review, don't forward
- No free-text relay between parents (all structured)
- Audit log every message

---

## 3. Calendar Synchronization Architecture

### 3.1 Calendar Event Model

Each schedule assignment maps to a calendar event:

```typescript
interface CalendarEvent {
  id: string;
  scheduleAssignmentId: string;
  familyId: string;
  parentId: string;
  calendarProvider: 'google' | 'apple' | 'outlook';
  externalEventId: string;        // provider's event ID
  eventType: 'custody_block' | 'exchange' | 'holiday' | 'disruption';
  startTime: Date;
  endTime: Date;
  title: string;
  description: string;
  location?: string;              // exchange location
  syncStatus: 'pending' | 'synced' | 'failed' | 'stale';
  lastSyncedAt: Date;
  syncVersion: number;            // optimistic concurrency
}
```

### 3.2 Sync Strategy

**Write-only push model.** The system writes to calendars; it does not read from them.

```
Schedule Change
  -> Create/Update CalendarEvent records
  -> Enqueue sync jobs (BullMQ)
  -> Worker pushes to Google/Apple/Outlook APIs
  -> Update syncStatus on success/failure
  -> Retry failed syncs with exponential backoff
```

**Why write-only:**
- System is source of truth, not the calendar
- Prevents users from editing calendar events and corrupting state
- Calendar events include: "Managed by [AppName]. Changes made here will be overwritten."
- Simpler architecture, no conflict resolution needed

### 3.3 Provider Integration

**Google Calendar:**
- OAuth 2.0 for calendar access
- Google Calendar API v3
- Use `events.insert`, `events.update`, `events.delete`
- Set `locked: true` and `source` fields to discourage edits

**Apple Calendar (CalDAV):**
- CalDAV protocol over HTTPS
- iCloud CalDAV endpoint
- App-specific password or OAuth (Sign in with Apple)
- Create/update VEVENT components

**Outlook Calendar:**
- Microsoft Graph API
- OAuth 2.0 via Azure AD
- `POST /me/events`, `PATCH /me/events/{id}`

### 3.4 Sync Module

**New module:** `apps/api/src/calendar-sync/`
```
calendar-sync/
  calendar-sync.module.ts
  calendar-sync.service.ts        # Orchestration
  calendar-event.entity.ts        # DB model
  providers/
    google-calendar.provider.ts
    apple-caldav.provider.ts
    outlook-graph.provider.ts
    calendar.provider.interface.ts
  sync-worker.service.ts          # BullMQ worker
  sync-reconciler.service.ts      # Detect drift, re-sync
```

### 3.5 Source of Truth Enforcement

- Calendar events include read-only indicators (description text, event metadata)
- Nightly reconciliation job compares system state to calendar state
- Drift detected -> overwrite calendar with system state
- Calendar edits by users are treated as no-ops from system perspective
- Each event carries a `syncVersion` — if external version differs, system wins

---

## 4. Backend Service Changes

### 4.1 New Services

| Service | Purpose |
|---------|---------|
| `MessagingModule` | Webhook ingress, outbound messaging, Twilio integration |
| `ConversationService` | Session state machine, context management |
| `MessageParserService` | NLP intent extraction (extends shared interpreter) |
| `CalendarSyncModule` | Event creation, provider push, reconciliation |
| `SyncWorkerService` | BullMQ background sync jobs |

### 4.2 Modified Services

| Service | Change |
|---------|--------|
| `SchedulesService` | Emit `schedule.updated` event -> triggers calendar sync + SMS notification |
| `RequestsService` | Emit `request.created` event -> triggers SMS to other parent |
| `ProposalsService` | Emit `proposal.accepted/declined` -> triggers SMS + calendar sync |
| `DisruptionsService` | Accept disruptions from messaging -> trigger re-solve |
| `NotificationModule` | Route notifications through SMS instead of push |
| `OnboardingModule` | Support messaging-based onboarding flow |

### 4.3 Event-Driven Architecture

Add an internal event bus (NestJS `EventEmitter2`) to decouple services:

```typescript
// Events
'schedule.updated'     -> CalendarSyncService, MessagingService
'request.created'      -> MessagingService (notify other parent)
'proposal.generated'   -> MessagingService (send options)
'proposal.accepted'    -> SchedulesService, CalendarSyncService, MessagingService
'disruption.reported'  -> SchedulesService (re-solve), MessagingService
'onboarding.completed' -> CalendarSyncService (initial sync)
```

### 4.4 API Surface Changes

**Keep:** All existing REST endpoints (needed for web viewer and internal operations)

**Add:**
```
POST /api/messaging/webhook/twilio     # Twilio inbound
POST /api/messaging/webhook/whatsapp   # WhatsApp inbound
POST /api/messaging/status             # Delivery status callback
GET  /api/calendar-sync/:familyId/status
POST /api/calendar-sync/:familyId/reconnect
POST /api/calendar-sync/:familyId/force-sync
GET  /api/viewer/:familyId/:token      # Public read-only schedule view
```

---

## 5. Data Model Updates

### 5.1 New Entities

```typescript
// Conversation session
@Entity()
class ConversationSession {
  id: string;
  parent: FamilyMember;
  family: Family;
  state: string;           // FSM state
  context: object;         // JSONB - state-specific data
  channel: string;         // 'sms' | 'whatsapp'
  phoneNumber: string;
  lastMessageAt: Date;
  expiresAt: Date;
  createdAt: Date;
}

// Message log (append-only)
@Entity()
class MessageLog {
  id: string;
  conversationSessionId: string;
  direction: 'inbound' | 'outbound';
  channel: string;
  fromNumber: string;
  toNumber: string;
  body: string;
  parsedIntent: object;    // JSONB
  confidence: number;
  providerMessageId: string;
  deliveryStatus: string;
  createdAt: Date;
}

// Calendar sync tracking
@Entity()
class CalendarConnection {
  id: string;
  parent: FamilyMember;
  provider: string;        // 'google' | 'apple' | 'outlook'
  accessToken: string;     // encrypted
  refreshToken: string;    // encrypted
  calendarId: string;
  isActive: boolean;
  lastSyncAt: Date;
  createdAt: Date;
}

@Entity()
class CalendarEvent {
  id: string;
  calendarConnection: CalendarConnection;
  scheduleAssignment: ScheduleAssignment;
  externalEventId: string;
  eventType: string;
  syncStatus: string;
  syncVersion: number;
  lastSyncedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}
```

### 5.2 Modified Entities

| Entity | Change |
|--------|--------|
| `FamilyMember` | Add `phoneNumber`, `messagingChannel`, `calendarProvider` |
| `Family` | Add `messagingEnabled`, `calendarSyncEnabled` |

### 5.3 Existing Entities (no changes needed)

These continue as-is — the scheduling core is unchanged:
- `ScheduleAssignment`, `BaseScheduleVersion`, `ScheduleBlock`
- `Request`, `ProposalOption`, `ProposalScore`
- `Constraint`, `Holiday`, `Location`
- `AuditLog`, `DisruptionEvent`
- `GuardrailViolation`, `MetricsLedger`

---

## 6. Reliability and Failure Handling

### 6.1 Missed SMS Messages

- Twilio provides delivery status callbacks (`delivered`, `failed`, `undelivered`)
- Failed deliveries: retry once after 5 minutes
- Still failed: log, mark notification as `failed`, surface in web viewer
- Critical messages (approval requests): retry up to 3 times over 1 hour
- Escalation: if no response to approval within 24h, send reminder; after 48h, apply default policy

### 6.2 Calendar Sync Errors

- BullMQ retry with exponential backoff (3 attempts, 1m/5m/30m)
- OAuth token refresh on 401 responses
- Permanent failures: mark `CalendarConnection.isActive = false`, notify parent via SMS
- Nightly reconciliation catches any drift
- Sync status visible in web viewer

### 6.3 Conflicting Parent Actions

- **Simultaneous swap requests:** First-write-wins with optimistic locking on schedule version
- **Contradictory responses:** System enforces business rules (both must approve swaps)
- **Race conditions:** Conversation sessions are per-parent, schedule mutations are serialized via DB transactions
- **Stale sessions:** Auto-expire after 30 minutes, require fresh context

### 6.4 Partial System Failures

| Failure | Mitigation |
|---------|------------|
| Twilio down | Queue outbound messages in BullMQ, drain when restored |
| Calendar API down | Sync jobs retry with backoff, events marked `pending` |
| Optimizer down | Return last-known-good schedule, queue re-solve |
| Database down | Standard connection pooling + retry, no data loss |
| Webhook missed | Twilio retries webhook delivery 3 times |

### 6.5 Determinism Guarantees

These remain unchanged:
- Same inputs -> same schedule output (CP-SAT with fixed seeds)
- Schedule versions are immutable (new version on every change)
- All mutations logged in `AuditLog`
- Disruption overlays applied deterministically
- Guardrails enforced on every schedule generation

---

## 7. Web Viewer (Minimal)

### Purpose
Read-only dashboard linked from SMS messages. Not an interactive app.

### Routes
```
/view/:familyId/:token          # Schedule calendar view
/view/:familyId/:token/metrics  # Fairness metrics
/view/:familyId/:token/history  # Change history / audit log
/view/:familyId/:token/plan     # Exportable parenting plan
```

### Security
- Time-limited signed tokens (JWT, 7-day expiry)
- Read-only, no mutations
- New link generated on request via SMS ("Send me the schedule link")

### Tech
- Reuse `apps/web/` with Vite + React
- Strip to 4 views: calendar, metrics, history, plan export
- No auth flow, no state management beyond token validation
- Static-deployable (Vercel/Cloudflare Pages)

---

## 8. Build Order

### Phase 1: Messaging Foundation
1. `MessagingModule` with Twilio webhook + signature verification
2. `ConversationSession` entity + state machine
3. `MessageParserService` (extend shared interpreter)
4. Basic inbound/outbound flow (echo bot)
5. Identity lookup by phone number

### Phase 2: Core Conversations
1. Schedule query ("Who has the kids Monday?")
2. Disruption reporting ("School closed tomorrow")
3. Swap request flow (request -> notify -> approve/decline -> execute)
4. Illness reporting
5. Response templates

### Phase 3: Calendar Sync
1. `CalendarConnection` + `CalendarEvent` entities
2. Google Calendar provider (OAuth + event CRUD)
3. BullMQ sync worker
4. Schedule-change -> calendar-sync event pipeline
5. Reconciliation job

### Phase 4: Web Viewer
1. Strip `apps/web/` to read-only views
2. Token-based access
3. Calendar view, metrics, history, plan export
4. Link generation via SMS

### Phase 5: Additional Providers
1. WhatsApp channel support
2. Apple Calendar (CalDAV) provider
3. Outlook (Graph API) provider
4. Onboarding-via-messaging flow

---

*Waiting for further instructions before discussing product strategy or business considerations.*
