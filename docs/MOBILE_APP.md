# Mobile App

The React Native Expo app (`apps/mobile/`) is the primary mobile interface for ADCP. Chat-driven onboarding, schedule viewing, and request management.

**Note**: Mobile app is deprecated as primary interface in favor of messaging-first (SMS/WhatsApp) architecture. Retained for reference and potential future use.

## Stack

- **Expo SDK 54**, React Native 0.81, React 19
- **expo-router** 6.0 (file-based routing)
- **Zustand** 5.0 (state management)
- **axios** (HTTP client with JWT interceptors)
- **socket.io-client** (real-time events)
- **expo-secure-store** (JWT storage on native)
- **async-storage** (offline cache)

## Navigation Structure

```
app/
├── _layout.tsx              Root: AuthGate + NotificationBanner + InviteBanner + socket lifecycle
├── (auth)/
│   ├── _layout.tsx          Auth stack (no header)
│   ├── welcome.tsx          Landing page
│   ├── login.tsx            Magic link email/token verification
│   ├── signup.tsx           New account creation
│   ├── profile-setup.tsx    User profile initialization
│   ├── pending-invites.tsx  Pending invite listing & acceptance
│   └── onboarding.tsx       Wizard-driven family setup
└── (main)/
    ├── _layout.tsx          Main stack (no header)
    ├── audit.tsx            Audit log viewer
    └── (tabs)/
        ├── _layout.tsx      5-tab navigator
        ├── index.tsx        Home: fairness, tonight's assignment, metrics
        ├── calendar.tsx     Month/week calendar view
        ├── chat.tsx         Chat-driven onboarding/lifecycle
        ├── requests.tsx     Request creation & proposals
        └── settings.tsx     Family settings, members, invites
```

### AuthGate Logic
- Not authenticated → `/(auth)/welcome`
- Authenticated, no family (dev) → `/(auth)/onboarding`
- Authenticated, no family (prod) → `/(auth)/pending-invites`
- Authenticated + family → `/(main)/(tabs)/`

## Stores (Zustand)

### Auth Store (`src/stores/auth.ts`)
- **State**: `isAuthenticated`, `isLoading`, `user`, `family`, `accessToken`, `parentNames`, `pendingInvite`
- **Actions**: `setAuth`, `setFamily`, `checkForPendingInvites`, `acceptPendingInvite`, `logout`, `restoreSession`, `sendMagicLink`, `verifyMagicLink`, `restoreFamily`, `createFamily`, `fetchParentNames`

### Chat Store (`src/stores/chat.ts`)
- **State**: `messages[]`, `isOnboarding`, `onboardingStep`, `wizard` (WizardState), `options[]`, `isGenerating`, `selectedDays[]`
- **Joiner state**: `isJoinerOnboarding`, `joinerStep`, `joinerFamilyId`, `parentAInput`, `existingSchedulePreview`
- **Actions**: `addMessage`, `startOnboarding`, `startLifecycle`, `advanceOnboarding`, `handleGenerate`, `processUserInput`, `processChipSelection`, `startJoinerOnboarding`, `advanceJoinerOnboarding`, `handleJoinerGenerate`, `reset`, `setWizardField`, `setSelectedDays`

#### WizardState
```typescript
{
  childrenCount, ageBands, schoolDays, daycareDays,
  exchangeLocation, lockedNights, targetSharePct,
  maxHandoffsPerWeek, maxConsecutiveAway, weekendPreference,
  familyName, inviteEmail
}
```

### Socket Store (`src/stores/socket.ts`)
- **State**: `socket`, `connected`, `lastEvent`
- **Actions**: `connect(token)`, `disconnect`, `joinFamily`, `leaveFamily`
- **Events**: schedule_updated, proposal_received, proposal_accepted, proposal_expired, emergency_changed

### Cache Store (`src/stores/cache.ts`)
Persisted offline cache with AsyncStorage:
- **State**: `activeSchedule`, `assignments[]`, `familySettings`, `todayCard`, `recentRequests[]`, `lastFetchedAt`, `isOffline`, `writeQueue[]`
- **Actions**: `cacheSchedule`, `cacheToday`, `cacheFamilySettings`, `cacheRequests`, `setOffline`, `addToWriteQueue`, `removeFromWriteQueue`, `clearWriteQueue`, `isStale`

## API Client (`src/api/client.ts`)

Base URL: `EXPO_PUBLIC_API_URL` (default `http://localhost:3000`), timeout 10s.

**Interceptors**:
- Request: Attach JWT from secure store
- Response: Unwrap NestJS `{ data, timestamp }` envelope
- 401: Auto-refresh with refreshToken, retry original request

### API Modules (11)

| Module | Key Methods |
|--------|------------|
| authApi | sendMagicLink, verifyMagicLink, getProfile, updateProfile, getMyFamily |
| familiesApi | create, getFamily, updateSettings, invite, acceptInvite, getMembers, resendInvite, getMyInvites, acceptInviteById |
| calendarApi | getCalendar, getActiveSchedule, generateSchedule, createManualSchedule |
| metricsApi | getToday, getLedger, getStability |
| constraintsApi | getConstraints, addConstraint, updateConstraint, removeConstraint, validate |
| requestsApi | list, get, create, cancel, impactPreview, getBudget |
| guardrailsApi | getConsentRules, addConsentRule, updateConsentRule, removeConsentRule, getBudgets, activateEmergency, getEmergency, updateEmergency, cancelEmergency |
| onboardingApi | getTemplates, validate, detectConflicts, generateOptions (35s timeout), explainOption, saveInput, getSavedInput |
| auditApi | getAuditLog, getMonthlySummary |
| sharingApi | createShareLink, listShareLinks, revokeShareLink |
| proposalsApi | generate, get, accept, decline |

## Chat Components (`src/components/chat/`)

| Component | Purpose |
|-----------|---------|
| ChatScreen.tsx | Main chat UI container, routes input to store |
| ChatBubble.tsx | Message bubble (user/bot) with content, card, chips |
| ChipRow.tsx | Horizontal chip button row |
| DayChipRow.tsx | Day-of-week multi-select chips |
| MiniCalendar.tsx | Small calendar grid (A/B assignments) |
| OnboardingChecklist.tsx | Turn-by-turn visual progress |
| ScheduleOptionCard.tsx | Schedule option with stats |
| OptionDetailModal.tsx | Full option details with accept/decline |

## Chat Flows

### Onboarding (`src/chat/flows/onboarding.ts`)
12-turn wizard: children count → age bands → school days → exchange location → locked nights → target split → family name → invite email → generate → select → complete.

### Joiner (`src/chat/flows/joiner.ts`)
8-turn variant for Parent B: loads Parent A's input, shows schedule preview, merges preferences, generates new schedule.

### Lifecycle (`src/chat/flows/lifecycle.ts`)
Post-setup chat with quick-action chips for ongoing interactions.

### Intent Resolution (`src/chat/intents.ts`)
`resolveIntent(text, context)` — keyword patterns for: propose_swap, notify_late, explain_schedule, create_task, view_schedule.

## Hooks

- `useParentName` — Maps parent_a/parent_b to display names
- `useWebHarnessSync` — Posts auth state to parent iframe for web harness dev testing

## Theme (`src/theme/colors.ts`)

```typescript
parentA: '#4A90D9', parentB: '#7B61C1',
parentALight: '#B3D4F5', parentBLight: '#D1C4E9',
background: '#FFFFFF', surface: '#F8F9FA',
text: '#1A1A2E', textSecondary: '#6B7280',
success: '#22C55E', warning: '#F59E0B', error: '#EF4444'
```

## Platform-Aware Storage (`src/utils/storage.ts`)
- Native: expo-secure-store
- Web: localStorage with optional `?storagePrefix=` for multi-iframe testing

## Config (`app.json`)
- Name: Anti-Drama Co-Parenting
- Slug: adcp
- Scheme: adcp (deep linking)
- iOS bundle: com.adcp.app
- Android package: com.adcp.app
- Plugins: expo-router, expo-secure-store
