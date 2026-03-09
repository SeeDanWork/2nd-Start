#!/bin/bash
# Execute all messaging-first architecture phases via claude -p
# Run from project root: bash scripts/execute-phases.sh
# Each phase commits its own work. Review after each phase if desired.

set -e

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_ROOT"

echo "============================================"
echo "  ADCP Messaging-First Architecture Build"
echo "  Branch: Messaging-First-Architecture"
echo "============================================"
echo ""

# Ensure we're on the right branch
BRANCH=$(git branch --show-current)
if [ "$BRANCH" != "Messaging-First-Architecture" ]; then
  echo "ERROR: Expected branch 'Messaging-First-Architecture', got '$BRANCH'"
  exit 1
fi

# ─── Phase 1A: Shared Enums and Types ───────────────────────────

echo ">>> Phase 1A: Shared Enums and Types"
claude -p "You are working on the ADCP project at $(pwd) on branch Messaging-First-Architecture.

Read docs/DEVELOPMENT_PLAN.md for context.

Execute Phase 1A: Shared Enums and Types.

1. Read packages/shared/src/enums.ts and add these new enums:
   - MessagingChannel { SMS = 'sms', WHATSAPP = 'whatsapp' }
   - ConversationState { IDLE = 'idle', ONBOARDING = 'onboarding', REQUESTING = 'requesting', RESPONDING = 'responding', REPORTING = 'reporting', REVIEWING = 'reviewing' }
   - MessageDirection { INBOUND = 'inbound', OUTBOUND = 'outbound' }
   - MessageIntent { REPORT_ILLNESS = 'report_illness', REQUEST_SWAP = 'request_swap', CONFIRM_SCHEDULE = 'confirm_schedule', REPORT_DISRUPTION = 'report_disruption', APPROVE = 'approve', DECLINE = 'decline', VIEW_SCHEDULE = 'view_schedule', HELP = 'help', UNKNOWN = 'unknown' }
   - DeliveryStatus { QUEUED = 'queued', SENT = 'sent', DELIVERED = 'delivered', FAILED = 'failed', UNDELIVERED = 'undelivered' }
   - CalendarProvider { GOOGLE = 'google', APPLE = 'apple', OUTLOOK = 'outlook' }
   - CalendarEventType { CUSTODY_BLOCK = 'custody_block', EXCHANGE = 'exchange', HOLIDAY = 'holiday', DISRUPTION = 'disruption' }
   - CalendarSyncStatus { PENDING = 'pending', SYNCED = 'synced', FAILED = 'failed', STALE = 'stale' }

2. Read packages/shared/src/types.ts and add:
   - ParsedIntent interface { intent: MessageIntent, confidence: number, entities: Record<string, string>, rawText: string }

3. Read packages/shared/src/validation.ts and add:
   - inboundMessageSchema (Zod schema: from: string, body: string, channel: MessagingChannel enum)

4. Update packages/shared/src/index.ts to export the new enums and types.

5. Run: npx turbo typecheck to verify.

6. Git add the changed files and commit with message: 'Add messaging and calendar sync enums, types, and validation schemas'

Do NOT create any new files except if absolutely needed. Prefer editing existing files."

echo ">>> Phase 1A complete"
echo ""

# ─── Phase 1B: New Entities ─────────────────────────────────────

echo ">>> Phase 1B: New Entities"
claude -p "You are working on the ADCP project at $(pwd) on branch Messaging-First-Architecture.

Read docs/DEVELOPMENT_PLAN.md for full context.

Execute Phase 1B: New Entities.

1. Read apps/api/src/entities/user.entity.ts. Add two new columns:
   - phoneNumber: text, nullable, unique
   - messagingChannel: text, nullable (stores 'sms' or 'whatsapp')

2. Create apps/api/src/entities/conversation-session.entity.ts:
   - Table: 'conversation_sessions'
   - Fields: id (uuid PK), userId (uuid FK to users), familyId (uuid FK to families), state (text, default 'idle'), context (jsonb, default '{}'), channel (text), phoneNumber (text), lastMessageAt (timestamptz), expiresAt (timestamptz), createdAt (timestamptz)
   - ManyToOne relations to User and Family

3. Create apps/api/src/entities/message-log.entity.ts:
   - Table: 'message_logs'
   - Fields: id (uuid PK), conversationSessionId (uuid FK), direction (text), channel (text), fromNumber (text), toNumber (text), body (text), parsedIntent (jsonb nullable), confidence (float nullable), providerMessageId (text nullable), deliveryStatus (text, default 'queued'), createdAt (timestamptz)
   - ManyToOne relation to ConversationSession

4. Read apps/api/src/entities/index.ts and add exports for the two new entities.

5. Run: cd apps/api && npx tsc --noEmit to verify types.

6. Git add and commit: 'Add ConversationSession and MessageLog entities, phone number to User'

Follow existing entity patterns exactly (column naming with snake_case name option, TypeORM decorators, etc). Look at existing entities for reference."

echo ">>> Phase 1B complete"
echo ""

# ─── Phase 1C: Intent Parser ────────────────────────────────────

echo ">>> Phase 1C: Intent Parser"
claude -p "You are working on the ADCP project at $(pwd) on branch Messaging-First-Architecture.

Read docs/DEVELOPMENT_PLAN.md for context.

Execute Phase 1C: Message Parser Service.

1. Create packages/shared/src/messaging/intent-parser.ts:
   - Export function parseIntent(text: string): ParsedIntent
   - Use regex patterns to detect intents:
     - REPORT_ILLNESS: sick, ill, fever, not feeling well, threw up, vomiting, doctor
     - REQUEST_SWAP: swap, switch, trade, exchange days, can you take, can he/she take
     - CONFIRM_SCHEDULE: who has, whose turn, who's got, what's the schedule, show schedule, this week
     - REPORT_DISRUPTION: school closed, snow day, no school, cancelled, closure, holiday, weather
     - APPROVE: yes, approve, ok, agreed, accept, confirm, sounds good, sure, go ahead
     - DECLINE: no, decline, reject, deny, not ok, disagree, can't, won't work
     - VIEW_SCHEDULE: show me, send link, schedule link, view, see the schedule
     - HELP: help, commands, what can, how do I, ?
   - Extract date entities using patterns like 'monday', 'friday', 'tomorrow', 'today', 'this weekend', 'next week', specific dates
   - Extract child name entities if mentioned
   - Return confidence score: exact keyword match = 0.9, partial = 0.7, fuzzy = 0.5
   - UNKNOWN intent if no match, confidence 0.3
   - Case-insensitive matching

2. Create packages/shared/src/messaging/index.ts that exports parseIntent and re-exports ParsedIntent type.

3. Update packages/shared/src/index.ts to export from './messaging'.

4. Create packages/shared/tests/messaging/intent-parser.test.ts with tests:
   - 'Who has the kids Monday?' -> CONFIRM_SCHEDULE, confidence >= 0.7, date entity 'monday'
   - 'Can we swap Friday?' -> REQUEST_SWAP, confidence >= 0.7, date entity 'friday'
   - 'Kai is sick today' -> REPORT_ILLNESS, confidence >= 0.7
   - 'School is closed tomorrow' -> REPORT_DISRUPTION, confidence >= 0.7
   - 'Yes' -> APPROVE, confidence >= 0.9
   - 'No' -> DECLINE, confidence >= 0.9
   - 'Help' -> HELP, confidence >= 0.9
   - 'Send me the schedule link' -> VIEW_SCHEDULE, confidence >= 0.7
   - 'asdfghjkl' -> UNKNOWN, confidence <= 0.5
   - 'Can she take them Saturday?' -> REQUEST_SWAP, date entity 'saturday'

5. Run the tests: cd packages/shared && npx vitest run tests/messaging/

6. Run typecheck: npx turbo typecheck

7. Git add and commit: 'Add intent parser for messaging with regex-based NLP and tests'

Import MessageIntent enum from the shared enums. Import ParsedIntent from shared types."

echo ">>> Phase 1C complete"
echo ""

# ─── Phase 1D-1E: Messaging Module ──────────────────────────────

echo ">>> Phase 1D-1E: Messaging Module + Templates"
claude -p "You are working on the ADCP project at $(pwd) on branch Messaging-First-Architecture.

Read docs/DEVELOPMENT_PLAN.md for full context. Read the existing code patterns in apps/api/src/ for module structure.

Execute Phase 1D and 1E: Messaging Module with Templates.

1. Create apps/api/src/messaging/ directory with these files:

   messaging.module.ts:
   - Import TypeOrmModule.forFeature for ConversationSession, MessageLog, User, Family, FamilyMembership
   - Providers: MessagingService, ConversationService, MessageParserService, MessageSenderService
   - Controllers: MessagingController
   - Exports: MessagingService, MessageSenderService

   messaging.controller.ts:
   - POST /messaging/webhook — accepts { From: string, Body: string, To?: string, MessageSid?: string }
     - Look up user by phone number
     - If not found, reply 'This number is not registered.'
     - Otherwise, pass to MessagingService.handleInbound()
     - Return TwiML-compatible response (text/xml content type, <Response><Message>reply</Message></Response>)
   - POST /messaging/status — accepts delivery status updates, logs them
   - No auth guard on these endpoints (Twilio calls them)

   messaging.service.ts:
   - handleInbound(phoneNumber, body, channel, providerMessageId?): orchestrates the flow
     - Get or create conversation session via ConversationService
     - Parse intent via MessageParserService
     - Log inbound message
     - Route based on intent (for now, just return acknowledgment)
     - Send response via MessageSenderService
     - Log outbound message
     - Return response text

   conversation.service.ts:
   - getOrCreateSession(userId, familyId, phoneNumber, channel): finds active session or creates new one
   - updateState(sessionId, newState, context?): transitions state machine
   - expireStale(): finds sessions where lastMessageAt + 30 min < now, sets state to idle
   - Injectable, uses TypeORM repository for ConversationSession

   message-parser.service.ts:
   - Thin wrapper around shared parseIntent()
   - addSessionContext(parsed, session): augments parsed intent with session state (e.g., if session is in REQUESTING state and user says 'yes', boost APPROVE confidence)

   message-sender.service.ts:
   - Provider pattern like EmailModule:
     - If TWILIO_ACCOUNT_SID env var set: use Twilio SDK (import twilio)
     - Otherwise: console.log the message (dev mode)
   - sendMessage(to: string, body: string): Promise<string | null> (returns providerMessageId)
   - Do NOT add twilio as a dependency yet — just make the Twilio path throw 'Twilio not configured' for now. Only implement console sender.

2. Create apps/api/src/messaging/templates/ with these template files, each exporting a function that returns a string:
   - welcome.ts: welcomeMessage(parentName: string) — greeting + brief help
   - help.ts: helpMessage() — list of commands
   - unknown.ts: unknownMessage() — couldn't understand, try these examples
   - confirm.ts: confirmMessage(intent: string, details: string) — echo back what was understood
   - error.ts: errorMessage() — something went wrong, try again

3. Read apps/api/src/app.module.ts and add MessagingModule to imports.

4. Run typecheck: cd apps/api && npx tsc --noEmit

5. Git add and commit: 'Add messaging module with webhook controller, conversation engine, and response templates'

Follow existing NestJS patterns in the codebase. Use @Injectable(), @Controller(), @InjectRepository()."

echo ">>> Phase 1D-1E complete"
echo ""

# ─── Phase 2A-2B: Schedule Query + Disruption Reporting ─────────

echo ">>> Phase 2A-2B: Schedule Query and Disruption Reporting"
claude -p "You are working on the ADCP project at $(pwd) on branch Messaging-First-Architecture.

Read docs/DEVELOPMENT_PLAN.md for context.
Read apps/api/src/messaging/messaging.service.ts to understand current flow.
Read apps/api/src/schedules/schedules.service.ts to understand schedule queries.
Read apps/api/src/disruptions/disruptions.service.ts (or disruptions.controller.ts) to understand disruption creation.

Execute Phase 2A and 2B: Schedule Query and Disruption Reporting flows.

1. Update messaging.service.ts to route intents:

   For CONFIRM_SCHEDULE:
   - Look up the family's active schedule
   - Find assignments for the queried date(s) or current week
   - Format as text: 'This week: Mon-Wed: You | Thu-Sun: [Other Parent]'
   - If no schedule: 'No schedule has been generated yet.'

   For REPORT_DISRUPTION:
   - Parse the disruption type from the message (school_closed, weather_closure, illness, etc.)
   - Parse the affected date(s)
   - Create a disruption record (use existing service/repository)
   - Notify the other parent via MessageSenderService
   - Reply: 'Got it. [Type] logged for [date]. [Other Parent] has been notified.'

   For REPORT_ILLNESS:
   - Similar to disruption but with illness type
   - Reply: 'Got it. Illness reported for [child/date]. [Other Parent] has been notified.'

   For HELP:
   - Return help template

   For UNKNOWN:
   - Return unknown template

   For other intents (APPROVE, DECLINE, REQUEST_SWAP, VIEW_SCHEDULE):
   - Return: 'This feature is coming soon. Type HELP for available commands.'

2. Create a helper: apps/api/src/messaging/schedule-formatter.ts
   - formatWeekSchedule(assignments, parentRole): returns human-readable week view
   - formatDaySchedule(assignment, parentRole): returns single day answer

3. Inject SchedulesService (or the OvernightAssignment repository) and disruption handling into MessagingService.
   Update MessagingModule imports as needed.

4. Run typecheck: cd apps/api && npx tsc --noEmit

5. Git add and commit: 'Add schedule query and disruption reporting flows to messaging'

Use existing entities and services. Do not duplicate data access logic."

echo ">>> Phase 2A-2B complete"
echo ""

# ─── Phase 2C-2D: Swap Requests + Approvals ─────────────────────

echo ">>> Phase 2C-2D: Swap Requests and Approvals"
claude -p "You are working on the ADCP project at $(pwd) on branch Messaging-First-Architecture.

Read docs/DEVELOPMENT_PLAN.md for context.
Read apps/api/src/messaging/messaging.service.ts for current flow.
Read apps/api/src/messaging/conversation.service.ts for session state.
Read apps/api/src/requests/requests.service.ts for request creation.
Read apps/api/src/proposals/proposals.service.ts for proposal handling.

Execute Phase 2C and 2D: Swap Request and Approval flows.

1. Update conversation.service.ts:
   - Add method: setPendingAction(sessionId, action: { type: string, requestId?: string, data?: any })
   - Store pending action in session context JSONB
   - Add method: getPendingAction(sessionId): returns pending action or null
   - Add method: clearPendingAction(sessionId)

2. Update messaging.service.ts for REQUEST_SWAP intent:
   - Multi-step flow:
     Step 1 (user sends swap request text):
       - Parse date(s) from message
       - Look up current assignment for that date
       - Set session state to REQUESTING
       - Store pending swap details in session context
       - Reply: 'You want to swap [date]. Currently [assignment]. Send YES to confirm or NO to cancel.'
     Step 2 (user confirms):
       - If session is in REQUESTING state and intent is APPROVE:
         - Create Request via RequestsService (or directly via repository)
         - Find other parent in family
         - Send SMS to other parent: '[Parent] requests to swap [date]. Reply APPROVE or DECLINE.'
         - Set other parent's session to REVIEWING with pending action
         - Reply to requester: 'Request sent to [other parent]. Waiting for response.'
       - If DECLINE: clear session, reply 'Swap request cancelled.'

3. Update messaging.service.ts for APPROVE/DECLINE intents:
   - Check session for pending action
   - If pending action is a swap review:
     - APPROVE: Accept the proposal/request, update schedule, notify both parents
     - DECLINE: Decline the request, notify requesting parent
   - If no pending action: reply 'Nothing to approve right now.'

4. Create templates:
   - apps/api/src/messaging/templates/swap-request.ts: messages for each step
   - apps/api/src/messaging/templates/swap-response.ts: approval/decline notifications

5. Run typecheck: cd apps/api && npx tsc --noEmit

6. Git add and commit: 'Add swap request and approval conversation flows'

Keep the flow simple. Use existing Request/Proposal entities where possible."

echo ">>> Phase 2C-2D complete"
echo ""

# ─── Phase 2E-2F: Web Link + Notification Routing ───────────────

echo ">>> Phase 2E-2F: Web Viewer Link and Notification Routing"
claude -p "You are working on the ADCP project at $(pwd) on branch Messaging-First-Architecture.

Read docs/DEVELOPMENT_PLAN.md for context.
Read apps/api/src/messaging/messaging.service.ts for current flow.
Read apps/api/src/notifications/notification.service.ts for notification sending.
Read apps/api/src/auth/auth.module.ts for JWT setup.

Execute Phase 2E and 2F.

1. Phase 2E - Web Viewer Link:
   Update messaging.service.ts for VIEW_SCHEDULE intent:
   - Generate a signed JWT with: { familyId, scope: 'viewer', sub: userId }, 7-day expiry
   - Construct URL: process.env.VIEWER_BASE_URL || 'http://localhost:5173' + '/view/' + familyId + '/' + token
   - Reply: 'Here is your schedule: [URL]'
   - Inject JwtService from AuthModule

   Create apps/api/src/messaging/viewer-token.service.ts:
   - generateViewerToken(familyId, userId): returns { token, url }
   - Uses JwtService to sign

2. Phase 2F - Notification Routing via SMS:
   Update apps/api/src/notifications/notification.service.ts:
   - After existing email dispatch logic, add SMS dispatch:
   - Look up user's phoneNumber and messagingChannel
   - If messagingChannel is set and phoneNumber exists:
     - Format notification as SMS text based on NotificationType
     - Send via MessageSenderService
   - Import MessageSenderService from messaging module
   - Update NotificationModule to import MessagingModule (or just the sender service)

   Create apps/api/src/messaging/templates/notification-sms.ts:
   - formatNotificationSms(type: NotificationType, data: Record<string, unknown>): string
   - Map each NotificationType to a short SMS-friendly message

3. Run typecheck: cd apps/api && npx tsc --noEmit

4. Git add and commit: 'Add viewer token generation and SMS notification routing'

Be careful with circular module dependencies. If MessagingModule and NotificationModule would create a circular import, use forwardRef()."

echo ">>> Phase 2E-2F complete"
echo ""

# ─── Phase 3A-3E: Calendar Sync Foundation ───────────────────────

echo ">>> Phase 3A-3E: Calendar Sync Entities and Module"
claude -p "You are working on the ADCP project at $(pwd) on branch Messaging-First-Architecture.

Read docs/DEVELOPMENT_PLAN.md for context (Phase 3).
Read apps/api/src/entities/ for entity patterns.

Execute Phase 3A through 3E: Calendar Sync.

1. Create apps/api/src/entities/calendar-connection.entity.ts:
   - Table: 'calendar_connections'
   - Fields: id (uuid PK), userId (uuid FK), familyId (uuid FK), provider (text), accessToken (text nullable), refreshToken (text nullable), calendarId (text nullable), isActive (boolean default true), lastSyncAt (timestamptz nullable), createdAt (timestamptz), updatedAt (timestamptz)
   - ManyToOne to User and Family

2. Create apps/api/src/entities/calendar-event.entity.ts:
   - Table: 'calendar_events'
   - Fields: id (uuid PK), calendarConnectionId (uuid FK), assignmentId (uuid FK nullable — references overnight_assignments), externalEventId (text nullable), eventType (text), title (text), startTime (timestamptz), endTime (timestamptz), location (text nullable), description (text nullable), syncStatus (text default 'pending'), syncVersion (int default 1), lastSyncedAt (timestamptz nullable), createdAt (timestamptz), updatedAt (timestamptz)
   - ManyToOne to CalendarConnection

3. Register both in entities/index.ts

4. Create apps/api/src/calendar-sync/ directory:

   providers/calendar.provider.interface.ts:
   - Export interface CalendarProviderInterface { createEvent(connection, event): Promise<string>; updateEvent(connection, externalId, event): Promise<void>; deleteEvent(connection, externalId): Promise<void>; testConnection(connection): Promise<boolean>; }

   providers/console-calendar.provider.ts:
   - Implements CalendarProviderInterface
   - All methods log to console and return mock data
   - Default provider for development

   providers/google-calendar.provider.ts:
   - Implements CalendarProviderInterface
   - Stub implementation that throws 'Google Calendar not configured — set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET'
   - Leave actual googleapis integration for Phase 6

   calendar-sync.service.ts:
   - syncSchedule(familyId): loads active schedule assignments, diffs against CalendarEvent records, creates/updates/deletes as needed
   - syncSingleEvent(calendarEventId): pushes one event via provider
   - getStatus(familyId): returns sync status summary
   - Uses console provider by default, google provider when configured

   calendar-sync.controller.ts:
   - GET /calendar-sync/:familyId/status — returns sync status
   - POST /calendar-sync/:familyId/force-sync — triggers full re-sync
   - Protected with JWT auth guard

   calendar-sync.module.ts:
   - Imports TypeOrmModule for CalendarConnection, CalendarEvent, OvernightAssignment
   - Providers: CalendarSyncService, console provider
   - Controllers: CalendarSyncController
   - Exports: CalendarSyncService

5. Register CalendarSyncModule in app.module.ts

6. Run typecheck: cd apps/api && npx tsc --noEmit

7. Git add and commit: 'Add calendar sync module with connection/event entities and provider interface'

Follow existing patterns. Use the CALENDAR_SYNC_PROVIDER injection token pattern similar to EMAIL_PROVIDER."

echo ">>> Phase 3A-3E complete"
echo ""

# ─── Phase 3F-3G: Sync Worker + Event Pipeline ──────────────────

echo ">>> Phase 3F-3G: Sync Worker and Event Pipeline"
claude -p "You are working on the ADCP project at $(pwd) on branch Messaging-First-Architecture.

Read docs/DEVELOPMENT_PLAN.md for context (Phase 3F-3G).
Read apps/api/src/calendar-sync/ for current module.
Read apps/api/src/schedules/schedules.service.ts to understand schedule activation.

Execute Phase 3F and 3G: Sync Worker and Event Pipeline.

1. Install @nestjs/event-emitter:
   cd apps/api && npm install @nestjs/event-emitter

2. Create apps/api/src/calendar-sync/sync-worker.service.ts:
   - Uses BullMQ Queue named 'calendar-sync' (ioredis is already a dependency)
   - Methods:
     - enqueueSyncSchedule(familyId): adds job to queue
     - enqueueSyncEvent(calendarEventId): adds job to queue
   - For dev without Redis: catch connection errors gracefully, fall back to synchronous execution via CalendarSyncService

3. Create apps/api/src/calendar-sync/schedule-sync.listener.ts:
   - Uses @nestjs/event-emitter OnEvent decorator
   - Listens for 'schedule.activated' event
   - When fired: calls CalendarSyncService.syncSchedule(familyId) or enqueues via worker

4. Register EventEmitterModule.forRoot() in app.module.ts

5. Update calendar-sync.module.ts to include SyncWorkerService and ScheduleSyncListener

6. In apps/api/src/schedules/schedules.service.ts (if it has a method that activates schedules):
   - Inject EventEmitter2
   - After activating a schedule, emit: this.eventEmitter.emit('schedule.activated', { familyId })
   - If schedules.service.ts doesn't have EventEmitter2, add it minimally

7. Run typecheck: cd apps/api && npx tsc --noEmit

8. Git add and commit: 'Add calendar sync worker, event pipeline, and schedule activation listener'

If SchedulesService is complex, make minimal changes — just add the event emission. Don't refactor existing code."

echo ">>> Phase 3F-3G complete"
echo ""

# ─── Phase 4: Web Viewer ────────────────────────────────────────

echo ">>> Phase 4: Read-Only Web Viewer"
claude -p "You are working on the ADCP project at $(pwd) on branch Messaging-First-Architecture.

Read docs/DEVELOPMENT_PLAN.md for context (Phase 4).
Read apps/web/src/App.tsx and apps/web/package.json to understand current web app structure.

Execute Phase 4: Read-Only Web Viewer.

1. Read current apps/web/src/App.tsx. This will be heavily simplified.

2. Create a new minimal App.tsx that:
   - Uses react-router-dom (install if not present: cd apps/web && npm install react-router-dom)
   - Routes:
     /view/:familyId/:token — ScheduleViewer (main calendar view)
     /view/:familyId/:token/metrics — MetricsViewer
     /view/:familyId/:token/history — HistoryViewer
     / — redirect or simple landing: 'ADCP Schedule Viewer. Access your schedule via the link sent to your phone.'
   - Wrap routes in a ViewerLayout that:
     - On mount, validates token by calling GET /api/viewer/validate/:token (or just decodes JWT client-side)
     - Stores familyId and validity in React state
     - Shows 'Link expired or invalid' if token is bad

3. Create apps/web/src/components/viewer/ScheduleViewer.tsx:
   - Fetches schedule data from API: GET /families/:familyId/schedules/active (use familyId from URL, token as Bearer)
   - Renders a simple read-only month calendar view
   - Color-coded blocks: Parent A (orange #ffedd0), Parent B (green #dcfee5)
   - Exchange markers
   - Navigation: prev/next month
   - Use inline CSSProperties style objects (project pattern)

4. Create apps/web/src/components/viewer/MetricsViewer.tsx:
   - Fetches from GET /families/:familyId/today
   - Shows: fairness split, transitions/week, stability score, weekend balance
   - Simple card layout

5. Create apps/web/src/components/viewer/HistoryViewer.tsx:
   - Fetches audit log from API
   - Timeline view of changes

6. Create apps/web/src/components/viewer/ViewerLayout.tsx:
   - Header bar with nav links (Schedule | Metrics | History)
   - Token validation on mount
   - Renders Outlet (react-router)

7. Add a viewer validation endpoint to the API:
   Create apps/api/src/messaging/viewer.controller.ts:
   - GET /viewer/validate/:token — decode JWT, check expiry, return { valid, familyId, expiresAt }
   - No auth guard (the token IS the auth)
   Add to MessagingModule controllers.

8. Run typecheck for both: npx turbo typecheck

9. Git add and commit: 'Add read-only web viewer with schedule, metrics, and history views'

Keep the viewer very simple. No state management library needed — just useState/useEffect with fetch calls. The old App.tsx content (scenario lab, deterministic model, etc.) can be removed from this branch — it lives on other branches."

echo ">>> Phase 4 complete"
echo ""

# ─── Phase 5: Onboarding via Messaging ──────────────────────────

echo ">>> Phase 5: Onboarding via Messaging"
claude -p "You are working on the ADCP project at $(pwd) on branch Messaging-First-Architecture.

Read docs/DEVELOPMENT_PLAN.md for context (Phase 5).
Read apps/api/src/messaging/messaging.service.ts for current routing.
Read apps/api/src/messaging/conversation.service.ts for session management.
Read apps/api/src/onboarding/onboarding.service.ts (or controller) for existing onboarding logic.
Read apps/api/src/entities/family.entity.ts, user.entity.ts, child.entity.ts, family-membership.entity.ts.

Execute Phase 5: Onboarding via Messaging.

1. Create apps/api/src/messaging/onboarding-flow.service.ts:
   - Manages multi-step onboarding conversation
   - States (stored in session context as onboardingStep):
     a. welcome: 'Welcome to ADCP! I will help set up your co-parenting schedule. How many children do you have?'
     b. children_count: Parse number, ask 'What are their ages? (e.g., 6, 10)'
     c. children_ages: Parse ages, ask 'What type of arrangement? Reply: SHARED, PRIMARY, or UNDECIDED'
     d. arrangement: Parse choice, ask 'How far apart do you and the other parent live? (miles)'
     e. distance: Parse number, ask 'Are there specific days locked to one parent? (e.g., I always have Wednesdays) or reply NONE'
     f. locked_days: Parse days or none, ask 'What is the other parent phone number? (e.g., +15551234567)'
     g. partner_phone: Parse phone, ask 'Summary: [children], [arrangement], [distance]mi, [constraints]. Reply YES to confirm or NO to start over.'
     h. confirm: If YES -> create family, users, children, constraints, memberships. Send invite to partner. If NO -> reset to welcome.

2. Each step:
   - Validates input (number for count, valid ages, valid phone format)
   - On invalid: re-ask with guidance
   - Stores partial data in session.context

3. Update messaging.service.ts:
   - When a message comes from an unknown phone number:
     Instead of 'not registered', start onboarding flow
     Create a temporary User with just the phone number
     Begin onboarding state machine
   - When session state is ONBOARDING:
     Route to OnboardingFlowService.handleStep(session, message)

4. Create apps/api/src/messaging/templates/onboarding.ts:
   - Template for each step's prompt and validation error messages

5. Partner onboarding:
   - When partner receives invite SMS: 'You have been invited to ADCP by [name]. Reply START to begin.'
   - Partner says START -> abbreviated onboarding (confirm arrangement, add own constraints)
   - On completion: set family status to 'active'

6. Register OnboardingFlowService in MessagingModule.

7. Run typecheck: cd apps/api && npx tsc --noEmit

8. Git add and commit: 'Add conversational onboarding flow via messaging'

Use existing entity creation patterns from the onboarding module. If OnboardingService has useful methods, delegate to it rather than duplicating."

echo ">>> Phase 5 complete"
echo ""

# ─── Final: Push all commits ────────────────────────────────────

echo ">>> Pushing all commits"
cd "$PROJECT_ROOT"
git push

echo ""
echo "============================================"
echo "  All phases complete!"
echo "  Branch: Messaging-First-Architecture"
echo "============================================"
echo ""
echo "Commits:"
git log --oneline Brain-and-Onboarding..HEAD
