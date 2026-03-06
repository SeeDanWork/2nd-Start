# Development Plan: Messaging-First Architecture

Executable plan organized into phases. Each phase is a deployable increment.
All work on branch `Messaging-First-Architecture`.

---

## Phase 1: Messaging Foundation

**Goal:** Twilio webhook receives SMS, identifies parent, responds. Console provider for local dev (no Twilio account needed yet).

### 1A. Shared Enums and Types

- Add to `packages/shared/src/enums.ts`:
  - `MessagingChannel` (sms, whatsapp)
  - `ConversationState` (idle, onboarding, requesting, responding, reporting, reviewing)
  - `MessageDirection` (inbound, outbound)
  - `MessageIntent` (report_illness, request_swap, confirm_schedule, report_disruption, approve, decline, view_schedule, help, unknown)
  - `DeliveryStatus` (queued, sent, delivered, failed, undelivered)
  - `CalendarProvider` (google, apple, outlook)
  - `CalendarEventType` (custody_block, exchange, holiday, disruption)
  - `CalendarSyncStatus` (pending, synced, failed, stale)
- Add to `packages/shared/src/types.ts`:
  - `ParsedIntent` type (intent, confidence, entities, rawText)
- Add to `packages/shared/src/validation.ts`:
  - `inboundMessageSchema` (Zod: from, body, channel)

### 1B. New Entities

- `apps/api/src/entities/conversation-session.entity.ts`
  - id, userId, familyId, state, context (JSONB), channel, phoneNumber, lastMessageAt, expiresAt, createdAt
- `apps/api/src/entities/message-log.entity.ts`
  - id, conversationSessionId, direction, channel, fromNumber, toNumber, body, parsedIntent (JSONB), confidence, providerMessageId, deliveryStatus, createdAt
- Add `phoneNumber` and `messagingChannel` columns to `User` entity
- Register in `entities/index.ts`

### 1C. Message Parser Service

- `packages/shared/src/messaging/intent-parser.ts`
  - Regex-based intent extraction (extend patterns from scenario lab's `parseNaturalLanguage`)
  - Returns `ParsedIntent` with confidence score
  - Export from `packages/shared/src/index.ts`
- Unit tests in `packages/shared/tests/messaging/intent-parser.test.ts`

### 1D. Messaging Module

- `apps/api/src/messaging/messaging.module.ts`
- `apps/api/src/messaging/messaging.controller.ts`
  - `POST /messaging/webhook` — Twilio inbound handler
  - `POST /messaging/status` — delivery status callback
  - Validate Twilio signature (skip in dev)
- `apps/api/src/messaging/messaging.service.ts`
  - Orchestrates: receive message -> find/create session -> parse intent -> route
- `apps/api/src/messaging/conversation.service.ts`
  - Load/create ConversationSession by phone number
  - State machine transitions
  - Session expiry (30 min)
- `apps/api/src/messaging/message-sender.service.ts`
  - Provider interface: `sendMessage(to, body)`
  - Console provider (logs to stdout) — default for dev
  - Twilio provider (uses `twilio` npm package) — used when `TWILIO_ACCOUNT_SID` is set
- `apps/api/src/messaging/message-parser.service.ts`
  - Wraps shared `parseIntent()`, adds context from conversation session
- Register in `app.module.ts`

### 1E. Response Templates

- `apps/api/src/messaging/templates/`
  - `welcome.ts` — first-time greeting
  - `help.ts` — command list
  - `unknown.ts` — couldn't parse, offer suggestions
  - `confirm.ts` — echo back parsed intent for confirmation
  - `error.ts` — something went wrong

### 1F. Verification

- API starts clean with new module
- `POST /messaging/webhook` with `{ From: '+15551234567', Body: 'Who has the kids Monday?' }` logs parsed intent and sends console response
- Unknown phone number gets "not registered" response
- Registered phone number gets parsed intent response

---

## Phase 2: Core Conversation Flows

**Goal:** Parents can query schedules, report disruptions, and request swaps via SMS.

### 2A. Schedule Query Flow

- "Who has the kids Monday?" / "Show me this week"
- Looks up current schedule for family
- Replies with text summary (e.g., "Mon-Wed: You | Thu-Sun: Other Parent")
- If no schedule exists: "No schedule generated yet."

### 2B. Disruption Reporting Flow

- "School is closed tomorrow" / "Kai is sick today"
- Parse disruption type and date
- Create disruption via existing `DisruptionsService`
- Notify other parent via SMS
- Reply: "Got it. School closure logged for tomorrow. [Other Parent] has been notified."

### 2C. Swap Request Flow (multi-step)

- State machine: IDLE -> REQUESTING
- Parent A: "Can we swap Friday?"
  - System: "You're requesting to swap Fri 3/13. You currently have the kids. Confirm? (Yes/No)"
  - Parent A: "Yes"
  - System creates Request via existing `RequestsService`
  - System texts Parent B: "Parent A is requesting to swap Fri 3/13. Reply APPROVE or DECLINE."
  - Parent B: "Approve"
  - System accepts via `ProposalsService`
  - System texts both: "Swap confirmed. Friday 3/13: Parent B has the kids. Calendar updated."

### 2D. Approval/Decline Handling

- Context-aware: if a parent replies "Yes" or "Approve", check for pending action in their session
- If no pending action: "Nothing to approve right now."

### 2E. Web Viewer Link

- "Send me the schedule link" / "Show schedule"
- Generate signed JWT token (7-day expiry, read-only)
- Reply with URL: `https://[domain]/view/[familyId]/[token]`

### 2F. Notification Routing

- Extend `NotificationService.send()` to check `user.messagingChannel`
- If set: send SMS instead of (or in addition to) email
- Reuse existing `NotificationType` enums

---

## Phase 3: Calendar Sync

**Goal:** Schedule changes push to Google Calendar. Parents see custody blocks in their calendar app.

### 3A. New Entities

- `apps/api/src/entities/calendar-connection.entity.ts`
  - id, userId, familyId, provider, accessToken (encrypted), refreshToken (encrypted), calendarId, isActive, lastSyncAt, createdAt
- `apps/api/src/entities/calendar-event.entity.ts`
  - id, calendarConnectionId, assignmentId, externalEventId, eventType, title, startTime, endTime, location, syncStatus, syncVersion, lastSyncedAt, createdAt, updatedAt

### 3B. Calendar Sync Module

- `apps/api/src/calendar-sync/calendar-sync.module.ts`
- `apps/api/src/calendar-sync/calendar-sync.service.ts`
  - `syncSchedule(familyId)` — diff current schedule vs synced events, push changes
  - `syncSingleEvent(calendarEventId)` — push one event
  - `reconcile(familyId)` — full re-sync
- `apps/api/src/calendar-sync/calendar-sync.controller.ts`
  - `GET /calendar-sync/:familyId/status`
  - `POST /calendar-sync/:familyId/reconnect`
  - `POST /calendar-sync/:familyId/force-sync`
  - `GET /calendar-sync/oauth/google/callback` — OAuth redirect

### 3C. Provider Interface

- `apps/api/src/calendar-sync/providers/calendar.provider.interface.ts`
  - `createEvent(connection, event): Promise<string>` (returns externalEventId)
  - `updateEvent(connection, externalEventId, event): Promise<void>`
  - `deleteEvent(connection, externalEventId): Promise<void>`
  - `testConnection(connection): Promise<boolean>`

### 3D. Google Calendar Provider

- `apps/api/src/calendar-sync/providers/google-calendar.provider.ts`
  - Uses `googleapis` npm package
  - OAuth 2.0 flow for authorization
  - Maps schedule assignments to Google Calendar events
  - Sets event description: "Managed by [App]. Do not edit — changes will be overwritten."
  - Custody blocks as all-day events, exchanges as timed events

### 3E. Console Calendar Provider (dev)

- `apps/api/src/calendar-sync/providers/console-calendar.provider.ts`
  - Logs event operations to console
  - Default when no OAuth credentials configured

### 3F. Sync Worker

- BullMQ queue: `calendar-sync`
- Jobs: `sync-event`, `sync-schedule`, `reconcile`
- Retry with exponential backoff (3 attempts)
- Dead-letter logging on permanent failure

### 3G. Event Pipeline

- When `SchedulesService` activates a new schedule version:
  - Emit `schedule.updated` event
  - CalendarSyncService listens, enqueues sync jobs
- When disruption changes schedule:
  - Same pipeline — new schedule version triggers sync

---

## Phase 4: Read-Only Web Viewer

**Goal:** Lightweight web dashboard accessible via signed link from SMS.

### 4A. Strip Existing Web App

- Remove scenario lab, onboarding UI, settings, chat components
- Keep: Vite + React scaffold, routing
- New routes:
  - `/view/:familyId/:token` — calendar view
  - `/view/:familyId/:token/metrics` — fairness dashboard
  - `/view/:familyId/:token/history` — audit log
  - `/view/:familyId/:token/plan` — parenting plan export

### 4B. Token Validation

- API endpoint: `GET /viewer/validate/:token`
  - Verify JWT signature and expiry
  - Return familyId, scope, expiresAt
- Web app calls this on load, shows schedule or "Link expired"

### 4C. Calendar View Component

- Read-only month view showing custody blocks
- Color-coded by parent (A = orange, B = green)
- Exchange markers, holiday overlays, disruption indicators
- Reuse calendar rendering logic from scenario lab (simplified)

### 4D. Metrics View

- Fairness split (% overnights per parent)
- Transitions per week
- Stability score
- Weekend balance
- Pull from existing `GET /families/:id/today` endpoint

### 4E. History View

- Audit log timeline
- Pull from existing `AuditLog` entity
- Shows: schedule changes, requests, approvals, disruptions

### 4F. Plan Export

- Printable/PDF-friendly parenting plan summary
- Current schedule template, constraints, exchange details
- "Generated by [App] on [date]" footer

---

## Phase 5: Onboarding via Messaging

**Goal:** New families can onboard through SMS conversation.

### 5A. Onboarding State Machine

- Conversation states: `onboarding_*` sub-states
  - `onboarding_welcome` — explain service
  - `onboarding_children` — "How many children? What are their ages?"
  - `onboarding_arrangement` — "Shared custody or primary + visits?"
  - `onboarding_distance` — "How far apart do you live?"
  - `onboarding_schedule` — "Any specific days locked? (e.g., 'I always have Wednesdays')"
  - `onboarding_partner` — "What's the other parent's phone number?"
  - `onboarding_confirm` — Summary + confirm

### 5B. Family Creation from Conversation

- On confirm: create Family, Users, FamilyMembership, Children, ConstraintSet
- Reuse existing `OnboardingModule` logic
- Send invite SMS to other parent
- Trigger initial schedule generation via optimizer

### 5C. Partner Onboarding

- Other parent receives: "You've been invited to [App] by [Name]. Reply START to begin."
- Abbreviated onboarding (confirm arrangement, add constraints)
- On completion: family status -> `active`, trigger schedule sync

---

## Phase 6: Additional Providers and Hardening

**Goal:** WhatsApp, Apple Calendar, Outlook, production readiness.

### 6A. WhatsApp Channel

- Twilio WhatsApp Business API (same SDK, different `from` number format)
- Rich message formatting (bold, line breaks)
- Same conversation engine, different templates

### 6B. Apple Calendar (CalDAV)

- CalDAV provider implementation
- iCloud app-specific password auth
- VEVENT creation/update/delete

### 6C. Outlook Calendar (Microsoft Graph)

- OAuth 2.0 via Azure AD
- Graph API event CRUD
- Same provider interface

### 6D. Production Hardening

- Twilio signature validation (enforce in prod)
- Rate limiting (20 msgs/parent/hour)
- Token encryption for calendar OAuth credentials
- Redis-backed conversation sessions (replace in-memory)
- Monitoring: delivery failure alerts, sync failure alerts
- Message audit logging (append-only, never delete)

---

## Execution Order

| Step | Phase | Deliverable | Dependencies |
|------|-------|-------------|--------------|
| 1 | 1A | Shared enums + types | None |
| 2 | 1B | DB entities | 1A |
| 3 | 1C | Intent parser + tests | 1A |
| 4 | 1D-1E | Messaging module + templates | 1B, 1C |
| 5 | 1F | End-to-end webhook test | 1D |
| 6 | 2A | Schedule query flow | 1F |
| 7 | 2B | Disruption reporting | 1F |
| 8 | 2C-2D | Swap request + approvals | 2A |
| 9 | 2E-2F | Web link + notification routing | 2A |
| 10 | 3A-3B | Calendar sync entities + module | None (parallel with Phase 2) |
| 11 | 3C-3E | Provider interface + Google + console | 3B |
| 12 | 3F-3G | Sync worker + event pipeline | 3D |
| 13 | 4A-4B | Strip web app + token validation | 2E |
| 14 | 4C-4F | Viewer components | 4B |
| 15 | 5A-5C | Onboarding via messaging | 2D |
| 16 | 6A-6D | Additional providers + hardening | All above |

---

## What We Keep Untouched

- `apps/optimizer/` — entire Python solver, brain, bootstrap
- `apps/simulator/` — scenario testing
- `packages/shared/src/recommendations/` — age baselines, templates, scoring
- `packages/shared/src/calendar/` — ICS parser, event classifier
- All existing API modules: auth, families, children, constraints, schedules, requests, proposals, guardrails, metrics, disruptions, onboarding, sharing, presets, family-context
- All 24 existing entities
- Docker setup (Postgres + Redis)

## What We Deprecate (not delete, just stop building on)

- `apps/mobile/` — React Native app (keep for reference, no new work)
- `apps/web/src/components/scenario-lab/` — internal testing tool (keep on `Deterministic-Model-Refinement` branch)
