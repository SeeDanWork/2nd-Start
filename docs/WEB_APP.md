# Web App

The React web app (`apps/web/`) serves as a read-only dashboard and SMS simulator for the ADCP platform. Built with Vite + React 19.

## Stack

- **Vite 6.0** + React 19 + react-router-dom 7.13
- **Zustand** (harness store)
- **axios** (API client)
- Inline CSS (no CSS framework)
- ES module build

## Routes

```
/                                    → Landing (branding + links)
/simulator                           → SMS Simulator (phone frame mockup)
/view/:familyId/:token              → Protected Viewer Layout
  ├─ (index)                         → ScheduleViewer (calendar grid)
  ├─ /metrics                        → MetricsViewer (6-card grid)
  └─ /history                        → HistoryViewer (audit timeline)
```

## Viewer Components (`components/viewer/`)

### ViewerLayout
- Validates share token via `GET /viewer/validate/{token}`
- Creates `ViewerContext` with `{ familyId, token }`
- Navigation bar with 3 tabs: Schedule, Metrics, History
- Handles invalid/expired links

### ScheduleViewer
- `GET /viewer/{token}/schedule?start={ISO}&end={ISO}`
- Month navigation with calendar grid (7 columns, 6-week view)
- Color coding: Parent A (#ffedd0 orange), Parent B (#dcfee5 green)
- Transition day indicator (arrows symbol)

### MetricsViewer
- `GET /viewer/{token}/metrics`
- 6-card grid: fairness split, parent A/B nights, transitions/week, max consecutive

### HistoryViewer
- `GET /viewer/{token}/history`
- Timeline view with timestamps and user attribution

## Simulator Component (`components/simulator/`)

### SmsSimulator
- iPhone frame mockup (390x760px with notch)
- `POST /messaging/connect` for initial LLM message
- `POST /messaging/webhook` for user messages (TwiML parsing)
- Auto-scroll, typing indicator, quick-action buttons
- Image/URL detection for markdown rendering
- Phone number formatting and connect/disconnect flow

## Schedule Components (`components/schedule/`)

- **ScheduleList** — Maps ScheduleDay[] to rows
- **ScheduleRow** — Colored background per parent, transition detection, source badge

## Calendar Components (`components/calendar/`)

- **MonthlyCalendar** — 6-month grid from current date
- **CalendarMonth** — 7-column grid with month title
- **CalendarDay** — Color-coded cell, today highlight

## Report Components (`components/report/`)

- **DecisionReport** — Aggregates all report sub-components
- **OnboardingFactors** — 2-column label-value display of onboarding inputs
- **WeightProfile** — Solver profile badge + normalized weight bars
- **FairnessGauge** — 4-window (2w/4w/8w/12w) stacked horizontal bars
- **StabilityMetrics** — 2x2 card grid (transitions, avg/max consecutive, school night consistency)

## Chat Component (`components/chat/`)

### ChatIframe
- Loads Expo Web URL in iframe (393px width)
- Query params: `storagePrefix={role}_`, `devToken={accessToken}`, `devRefresh={refreshToken}`
- Header colors: father=#ffedd0, mother=#dcfee5

## Hooks (`hooks/`)

| Hook | API Call | Returns |
|------|----------|---------|
| useScheduleData | GET /families/{id}/calendar (90 days) | `{ days, loading, error }` |
| useLedgerData | GET /families/{id}/ledger (4 windows) | `{ windows, loading, error }` |
| useStabilityData | GET /families/{id}/stability (8 weeks) | `{ metrics, loading, error }` |
| useOnboardingInput | GET /onboarding/saved-input/{id} | `{ input, loading, error }` |
| useIframeMessages | window message listener | Side-effect: sets familyId, triggers refresh |

## API Client (`api/client.ts`)

- Base URL: `VITE_API_URL` (default `http://localhost:3000`)
- Timeout: 15s
- Response interceptor: Unwraps NestJS envelope
- `createAuthedClient(getToken)` factory for auth'd requests

## Harness Store (`stores/harness.ts`)

Dev testing store for dual-parent simulation:
- **State**: `father`, `mother` (UserAuth), `familyId`, `isSettingUp`, `error`, `refreshCounter`
- **Actions**: `setup()` (dev login both parents), `setFamilyId`, `refresh()`
- Dev login emails via `VITE_FATHER_EMAIL` / `VITE_MOTHER_EMAIL`

## Environment Variables

| Variable | Purpose | Default |
|----------|---------|---------|
| VITE_API_URL | API base URL | http://localhost:3000 |
| VITE_EXPO_WEB_URL | Expo Web iframe URL | http://localhost:8081 |
| VITE_FATHER_EMAIL | Father dev-login email | father@test.local |
| VITE_MOTHER_EMAIL | Mother dev-login email | mother@test.local |

## Color Palette

- Parent A (Father): `#ffedd0` (warm peach)
- Parent B (Mother): `#dcfee5` (soft green)
- Primary: `#4A90D9` (blue)
- Text: `#1a1a2e` (dark navy)
- Text Secondary: `#6b7280`
- Borders: `#e5e7eb`

## Build

```bash
npm run dev      # Vite dev server (port 5173)
npm run build    # tsc check + Vite build
npm run preview  # Vite preview
```
