# Project Overview

Anti-Drama Co-Parenting (ADCP / 2ndStart) is a deterministic, constraint-based co-parenting scheduling platform. It uses a CP-SAT solver for fair schedule generation, messaging-first communication, and read-only web dashboards.

## Monorepo Structure

```
2ndStart/
├── apps/
│   ├── api/            NestJS backend (TypeScript, TypeORM, Postgres, Redis)
│   ├── optimizer/      Python FastAPI + OR-Tools CP-SAT solver
│   ├── mobile/         React Native Expo app (deprecated as primary UI)
│   ├── web/            Vite + React read-only dashboard & SMS simulator
│   ├── scenario-lab/   Next.js testing/simulation environment
│   ├── simulator/      Chat Brain scenario validator (51 scenarios)
│   └── llm-router/     Multi-provider LLM routing (OpenAI, Anthropic, Google)
├── packages/
│   ├── shared/         @adcp/shared — enums, types, Zod schemas, constants
│   └── config/         Shared tsconfig.base.json
├── docker/             docker-compose.yml (Postgres 16, Redis 7, Optimizer)
├── docs/               Architecture & reference documentation
└── scripts/            Utility scripts
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Monorepo | Turborepo 2.4, npm workspaces |
| Backend | NestJS 10.4, TypeORM 0.3, Postgres 16, Redis 7, BullMQ |
| Solver | Python 3.12, FastAPI, Google OR-Tools CP-SAT |
| Mobile | React Native 0.81, Expo SDK 54, expo-router, Zustand |
| Web | Vite 6, React 19, react-router-dom 7, Zustand |
| Scenario Lab | Next.js 15.1, Tailwind CSS 3.4, FullCalendar |
| Shared | TypeScript 5.7, Zod 3.24 |
| Auth | Passport JWT, magic link, in-memory tokens (dev), Redis (prod) |
| Email | Resend (prod), console (dev), 11 HTML templates |
| Node | v20 (.nvmrc) |

## Architecture Direction

**Messaging-first**: SMS/WhatsApp via Twilio is the primary interface. Calendar sync (Google/Apple/Outlook) for schedule visibility. Web app serves read-only dashboards via share links.

The mobile app is retained but no longer the primary interface.

## Core Flow

```
Parent SMS → Twilio Webhook → API (NestJS)
    → Conversation Engine → Intent Parser → Policy Engine
    → Solver (Python) → Schedule Generation
    → Response SMS → Parent
```

## Key Subsystems

### API (`apps/api/`)
21 NestJS modules, 28 entities, ~93 endpoints. Handles auth, families, schedules, requests, proposals, guardrails, metrics, messaging, sharing, calendar sync. See `docs/API_REFERENCE.md`.

### Optimizer (`apps/optimizer/`)
CP-SAT constraint solver with 5 weight profiles (Stability, Fairness, Logistics, Weekend Parity, Child Routine). Heuristic fallback when OR-Tools unavailable. See `docs/OPTIMIZER_AND_SOLVER.md`.

### Shared Package (`packages/shared/`)
35 enums, 33+ constants, 30+ Zod schemas. Recommendations engine with age-based baselines, template scoring, and explanation generation. See `docs/SHARED_PACKAGE.md`.

### Scenario Lab (`apps/scenario-lab/`)
Next.js simulation environment with dual-phone SMS UI, persona-driven behavior, disruption injection, and policy engine testing. 18 test files. See `docs/SCENARIO_LAB.md`.

### Simulator (`apps/simulator/`)
51 scenarios across 10 categories validating the conversation engine. CLI + dev UI + golden test fixtures. See `docs/SIMULATOR.md`.

### Mobile App (`apps/mobile/`)
React Native Expo with chat-driven onboarding, 5-tab layout, 4 Zustand stores, 11 API modules. See `docs/MOBILE_APP.md`.

### Web App (`apps/web/`)
Read-only viewer (schedule, metrics, history via share links) + SMS simulator for testing. See `docs/WEB_APP.md`.

## Infrastructure

### Docker Services
```yaml
postgres:16-alpine    # Port 5432, user=adcp, db=adcp
redis:7-alpine        # Port 6379
optimizer             # Port 8000, FastAPI + OR-Tools
```

### Build Pipeline (turbo.json)
- `build`: depends on `^build`, outputs `dist/**`, `.next/**`
- `dev`: persistent, no cache
- `lint`: depends on `^build`
- `typecheck`: depends on `^build`

### Key Environment Variables

| Variable | Service | Purpose |
|----------|---------|---------|
| DATABASE_URL | API | Postgres connection |
| REDIS_URL | API | Redis connection |
| JWT_SECRET | API | Token signing |
| EMAIL_PROVIDER | API | console or resend |
| RESEND_API_KEY | API | Email delivery |
| TWILIO_* | API | SMS/WhatsApp |
| SOLVER_URL | API | Optimizer HTTP URL |
| EXPO_PUBLIC_API_URL | Mobile | API base URL |
| VITE_API_URL | Web | API base URL |

## Conventions

- **Day-of-week**: JS-style (0=Sun...6=Sat) in DB/API. Python converts: `js_dow = (py_dow + 1) % 7`
- **Schedule versioning**: Immutable. New versions created, old deactivated.
- **Audit logging**: Append-only on all mutations.
- **TypeORM JSONB**: Use `as any` cast on `.update()` calls.
- **Error-swallowed email**: Email sends never block the caller.

## Documentation Index

| Document | Description |
|----------|-------------|
| [API_REFERENCE.md](API_REFERENCE.md) | 21 modules, 28 entities, ~93 endpoints |
| [OPTIMIZER_AND_SOLVER.md](OPTIMIZER_AND_SOLVER.md) | CP-SAT solver, weight profiles, heuristics |
| [SHARED_PACKAGE.md](SHARED_PACKAGE.md) | Enums, types, schemas, constants, recommendations |
| [SCENARIO_LAB.md](SCENARIO_LAB.md) | Simulation environment, handlers, policy engine |
| [SIMULATOR.md](SIMULATOR.md) | 51 scenarios, CLI, golden tests |
| [MOBILE_APP.md](MOBILE_APP.md) | React Native Expo, stores, API client |
| [WEB_APP.md](WEB_APP.md) | Read-only dashboard, SMS simulator |
| [MESSAGING_FIRST_ARCHITECTURE.md](MESSAGING_FIRST_ARCHITECTURE.md) | Architecture direction |
| [BUILD_PHASES.md](BUILD_PHASES.md) | Phase-by-phase build progress |
| [TECH_SPEC_REFINED.md](TECH_SPEC_REFINED.md) | Technical specification |
| [USE_CASES.md](USE_CASES.md) | User stories and flows |
