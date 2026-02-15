#!/usr/bin/env bash
# Automate remaining build phases (6-9) using claude -p
# Each phase runs sequentially since they depend on prior work.
# Run from project root: bash scripts/run-phases.sh

set -e
cd "$(dirname "$0")/.."
PROJECT_ROOT="$(pwd)"

# Allow running inside another Claude Code session
unset CLAUDECODE

LOG_DIR="$PROJECT_ROOT/scripts/logs"
mkdir -p "$LOG_DIR"

echo "=========================================="
echo "ADCP Build Automation — Phases 6-9"
echo "Project: $PROJECT_ROOT"
echo "Logs:    $LOG_DIR"
echo "=========================================="

###############################################################################
# PHASE 6 — Guardrails (Steps 6.1-6.4)
###############################################################################
echo ""
echo "[Phase 6] Guardrails — auto-approve, budgets, expiry, emergency mode"
echo "Started: $(date)"

claude -p --verbose "You are working on the ADCP co-parenting app at $PROJECT_ROOT. Phases 0-5 are complete. You must now implement Phase 6 (Guardrails) — all four steps (6.1-6.4) in one session.

Read docs/BUILD_PHASES.md for the full spec of steps 6.1-6.4. Read the existing stubs and entities before writing code.

KEY CONTEXT:
- Monorepo: apps/api (NestJS+TypeORM), apps/mobile (React Native Expo), apps/optimizer (Python FastAPI), packages/shared
- Entities already exist: PreConsentRule, ChangeBudgetLedger, EmergencyMode (in apps/api/src/entities/)
- Stub modules exist: apps/api/src/guardrails/{service,controller,module}.ts — rewrite these
- Shared enums/constants in packages/shared/src/ (AcceptanceType, DEFAULT_CHANGE_BUDGET_PER_MONTH, etc.)
- TypeORM JSONB .update() calls need 'as any' cast
- Use BullMQ for cron jobs (monthly budget reset, proposal expiry check every 15 min, expiry warning)
- Mobile: expo-router file-based routing, Zustand stores, colors from src/theme/colors.ts
- API client at apps/mobile/src/api/client.ts — add guardrailsApi module
- Settings screen at apps/mobile/app/(main)/(tabs)/settings.tsx — add Guardrails section
- Home screen at apps/mobile/app/(main)/(tabs)/index.tsx — add emergency mode banner

DO ALL OF THIS:
1. Step 6.1 — GuardrailsService: getConsentRules, addConsentRule, updateConsentRule, removeConsentRule, evaluateAutoApproval. GuardrailsController with CRUD endpoints at /families/:familyId/consent-rules. GuardrailsModule with TypeORM entities + imports.
2. Step 6.2 — Add to GuardrailsService: getBudgetStatus (per parent per month). Add BullMQ processor for monthly budget reset cron job and proposal expiry check (every 15 min). Add proposal expiry warning job. Add GET /families/:familyId/budgets endpoint.
3. Step 6.3 — Add to GuardrailsService: activateEmergency, getEmergencyStatus, updateEmergency, cancelEmergency. Add return-to-baseline BullMQ delayed job. Add POST/GET/PATCH/DELETE /families/:familyId/emergency endpoints.
4. Step 6.4 — Mobile UI: Add guardrailsApi to client.ts. Update settings.tsx with auto-approve rules list+add, budget display, emergency mode activation. Update home screen index.tsx with emergency banner when active.

After all code is written:
- Run 'npx tsc --noEmit' in apps/api to verify no type errors. Fix any errors.
- Add guardrailsApi to the mobile API client
- Git add all changed files and commit with message: 'Phase 6: Guardrails — auto-approve, budgets, expiry, emergency mode'
- Update docs/BUILD_PHASES.md: mark Phase 6 as DONE, add completion log entry" \
  2>&1 | tee "$LOG_DIR/phase6.log"

echo "[Phase 6] Finished: $(date)"

###############################################################################
# PHASE 7 — Audit, Sharing, Exports (Steps 7.1-7.3)
###############################################################################
echo ""
echo "[Phase 7] Audit + Sharing — audit log, ICS feeds, share links"
echo "Started: $(date)"

claude -p --verbose "You are working on the ADCP co-parenting app at $PROJECT_ROOT. Phases 0-6 are complete. You must now implement Phase 7 (Audit, Sharing, Exports) — all three steps (7.1-7.3) in one session.

Read docs/BUILD_PHASES.md for the full spec of steps 7.1-7.3. Read existing stubs and entities before writing.

KEY CONTEXT:
- AuditLog entity exists at apps/api/src/entities/audit-log.entity.ts (familyId, actorId, action, entityType, entityId, metadata JSONB, createdAt)
- ShareLink entity exists at apps/api/src/entities/share-link.entity.ts
- NotificationRecord entity exists at apps/api/src/entities/notification-record.entity.ts
- MetricsService already exists at apps/api/src/metrics/metrics.service.ts — add getAuditLog and getMonthlySummary methods
- MetricsController at apps/api/src/metrics/metrics.controller.ts — add audit/summary endpoints
- Sharing stubs: apps/api/src/sharing/{service,controller,module}.ts — rewrite these
- Schedules service at apps/api/src/schedules/schedules.service.ts has getActiveSchedule, getAssignments, getHandoffs
- Mobile settings screen at apps/mobile/app/(main)/(tabs)/settings.tsx
- Mobile API client at apps/mobile/src/api/client.ts

DO ALL OF THIS:
1. Step 7.1 — Add to MetricsService: getAuditLog(familyId, limit, offset) paginated newest-first, getMonthlySummary(familyId, month) with aggregates (total overnights, transitions, requests made/accepted/expired, schedule versions). Add GET /families/:familyId/audit and GET /families/:familyId/summary?month= endpoints. Add MetricsModule imports for AuditLog if not present. Create mobile audit screen at apps/mobile/app/(main)/audit.tsx showing chronological event list with neutral language, filter by event type, monthly summary card. Add navigation to it from settings.
2. Step 7.2 — SharingService: createShareLink (crypto.randomBytes token), listShareLinks, revokeShareLink, resolveShareLink. ICS generation: build .ics from active schedule (VEVENT per overnight block, VEVENT per handoff). Public endpoints (no auth): GET /share/:token (HTML calendar), GET /share/:token/feed.ics (ICS file). SharingModule with TypeORM entities. SharingController with all endpoints.
3. Step 7.3 — Mobile: Add sharingApi to client.ts. Add Sharing section to settings.tsx (list links, create new, copy, revoke). Add export button for monthly summary.

After all code is written:
- Run 'npx tsc --noEmit' in apps/api to verify no type errors. Fix any errors.
- Git add all changed files and commit with message: 'Phase 7: Audit log, ICS feeds, share links'
- Update docs/BUILD_PHASES.md: mark Phase 7 as DONE, add completion log entry" \
  2>&1 | tee "$LOG_DIR/phase7.log"

echo "[Phase 7] Finished: $(date)"

###############################################################################
# PHASE 8 — Notifications + Real-Time (Steps 8.1-8.2)
###############################################################################
echo ""
echo "[Phase 8] Notifications — email, WebSocket, push"
echo "Started: $(date)"

claude -p --verbose "You are working on the ADCP co-parenting app at $PROJECT_ROOT. Phases 0-7 are complete. You must now implement Phase 8 (Notifications + Real-Time) — both steps (8.1-8.2) in one session.

Read docs/BUILD_PHASES.md for the full spec of steps 8.1-8.2. Read existing code before writing.

KEY CONTEXT:
- NotificationRecord entity exists at apps/api/src/entities/notification-record.entity.ts
- User entity has notification preferences
- BullMQ already used in guardrails module (Phase 6)
- Existing modules that trigger notifications: proposals (generated, accepted, declined, expired), requests (created), guardrails (emergency activated/returned, auto-approved), schedules (generated)
- Mobile: expo-router, Zustand stores, apps/mobile/app/_layout.tsx is the root layout
- For email: use nodemailer with console transport for dev (no real email provider needed yet). Install @nestjs-modules/mailer or use nodemailer directly.
- For WebSocket: use @nestjs/websockets + @nestjs/platform-socket.io. Install socket.io.
- For push: stub with console.log for now (real FCM/APNs integration is production concern)

DO ALL OF THIS:
1. Step 8.1 — Create apps/api/src/notifications/ module. NotificationService: send(userId, type, data) that resolves channel preference and dispatches. Store NotificationRecord. Email templates as plain strings (magic link, invitation, proposal received, proposal accepted, expiring, expired, emergency, handoff reminder, weekly digest). BullMQ notification queue with retry+backoff. Wire notification triggers into existing services: ProposalsService (on generate, accept), GuardrailsService (on emergency, auto-approve, expiry). NotificationController: GET /notifications (list for user), POST /notifications/:id/read.
2. Step 8.2 — NestJS WebSocket gateway: FamilyGateway with JWT auth on connection, rooms per familyId. Events: schedule_updated, proposal_received, proposal_accepted, proposal_expired, emergency_changed. Emit from relevant services when state changes. Mobile: add socket.io-client to package.json, create apps/mobile/src/stores/socket.ts Zustand store that connects on auth, joins family room, listens for events and triggers data refresh. Add in-app notification banner component. Wire into _layout.tsx.

After all code is written:
- Install needed deps: cd apps/api && npm install @nestjs/websockets @nestjs/platform-socket.io socket.io nodemailer
- Install mobile dep: cd apps/mobile && npm install socket.io-client
- Run 'npx tsc --noEmit' in apps/api to verify no type errors. Fix any errors.
- Git add all changed files and commit with message: 'Phase 8: Notifications — email, WebSocket, push stubs'
- Update docs/BUILD_PHASES.md: mark Phase 8 as DONE, add completion log entry" \
  2>&1 | tee "$LOG_DIR/phase8.log"

echo "[Phase 8] Finished: $(date)"

###############################################################################
# PHASE 9 — Offline + Polish (Steps 9.1-9.3)
###############################################################################
echo ""
echo "[Phase 9] Offline + Polish — cache, templates, UI polish"
echo "Started: $(date)"

claude -p --verbose "You are working on the ADCP co-parenting app at $PROJECT_ROOT. Phases 0-8 are complete. You must now implement Phase 9 (Offline + Polish) — all three steps (9.1-9.3) in one session.

Read docs/BUILD_PHASES.md for the full spec of steps 9.1-9.3. Read existing code before writing.

KEY CONTEXT:
- Mobile: React Native Expo, expo-router, Zustand, apps/mobile/src/api/client.ts, apps/mobile/src/stores/auth.ts
- Calendar screen: apps/mobile/app/(main)/(tabs)/calendar.tsx
- Home screen: apps/mobile/app/(main)/(tabs)/index.tsx
- Settings screen: apps/mobile/app/(main)/(tabs)/settings.tsx
- Requests screen: apps/mobile/app/(main)/(tabs)/requests.tsx
- Onboarding screen: apps/mobile/app/(auth)/onboarding.tsx
- API onboarding stubs: apps/api/src/onboarding/{service,controller,module}.ts
- Constraints API: apps/api/src/constraints/ (already functional)
- Schedule generation: apps/api/src/schedules/schedules.service.ts has generateBaseSchedule
- Colors: apps/mobile/src/theme/colors.ts (parentA=#4A90D9, parentB=#7B61C1)
- Use @react-native-async-storage/async-storage for offline cache (already available in Expo)

DO ALL OF THIS:
1. Step 9.1 — Offline cache: Create apps/mobile/src/stores/cache.ts Zustand store with persist middleware (AsyncStorage). Cache: active schedule assignments (12 weeks), family settings, today card data, recent requests. On each API fetch success, update cache. When API call fails (network error), fall back to cached data. Add offline indicator banner to _layout.tsx. Add stale data warning (>1 hour old). Add offline write queue: queue request creation and proposal acceptance when offline, replay on reconnect.
2. Step 9.2 — Onboarding templates: OnboardingService with template catalog (4 templates: 'Daycare week split', 'Alternating weeks', '2-2-3 rotation', '5-2 weekday/weekend split'). Each template has pre-built constraints + description. GET /onboarding/templates endpoint. POST /onboarding/from-template (creates family + constraint set + generates schedule in one call). OnboardingModule + OnboardingController. Update mobile onboarding screen: template picker cards, customize step (pre-filled from template), review, invite co-parent.
3. Step 9.3 — UI polish: Audit all user-facing strings for neutral language (no blame/debt, use 'band'/'stability'). Verify all screens have empty states. Add loading skeletons to calendar. Ensure error handling on all API calls shows user-friendly messages with retry. Add accessibility labels to key touchable elements. Ensure tap targets >= 44px on interactive elements.

After all code is written:
- Run 'npx tsc --noEmit' in apps/api to verify no type errors. Fix any errors.
- Git add all changed files and commit with message: 'Phase 9: Offline cache, onboarding templates, UI polish'
- Update docs/BUILD_PHASES.md: mark Phase 9 as DONE, add completion log entry with final status noting all 28 steps complete" \
  2>&1 | tee "$LOG_DIR/phase9.log"

echo "[Phase 9] Finished: $(date)"

###############################################################################
# DONE
###############################################################################
echo ""
echo "=========================================="
echo "All phases complete!"
echo "Check logs in $LOG_DIR/"
echo "Run 'git log --oneline' to see all commits"
echo "=========================================="
