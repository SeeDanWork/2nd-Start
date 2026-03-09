# API Reference

Complete reference for the ADCP NestJS backend (`apps/api/`).

## Modules (21)

| Module | Purpose |
|--------|---------|
| auth | Magic link auth, JWT tokens, profile management |
| families | Family CRUD, member invitations, settings |
| children | Child CRUD tied to families |
| constraints | Constraint sets (locked nights, max consecutive, fairness) |
| schedules | Schedule generation via optimizer, versioning, calendar queries |
| requests | Change requests for schedule swaps, budget tracking |
| proposals | Proposal generation/acceptance for requests |
| guardrails | Consent rules, change budgets, emergency mode |
| metrics | Ledger snapshots, stability analysis, fairness metrics, audit log |
| email | Global email with swappable providers (console/resend), 11 templates |
| notifications | Push notifications (stubbed), real-time gateway |
| onboarding | Constraint presets, validation, brain API proxy |
| family-context | Age-based solver weight profiles, lazy 24h cache |
| sharing | Share links, HTML calendar, ICS feed export |
| calendar-sync | Google/Apple/Outlook integration, background sync |
| messaging | SMS/WhatsApp via Twilio, conversation engine, AI tools |
| locations | Stub (health check only) |
| holidays | Stub (health check only) |
| common | Decorators, filters, guards, interceptors |
| seeds | Database seeding script |

## Entities (28)

User, Family, FamilyMembership, Child, HandoffLocation, ConstraintSet, Constraint, HolidayCalendar, BaseScheduleVersion, OvernightAssignment, HandoffEvent, Request, ProposalBundle, ProposalOption, Acceptance, PreConsentRule, ChangeBudgetLedger, EmergencyMode, LedgerSnapshot, StabilitySnapshot, AuditLog, ShareLink, NotificationRecord, ConversationSession, MessageLog, DisruptionEvent, CalendarConnection, CalendarEvent.

## Endpoints (~93 total)

### Auth (`/auth`)
| Method | Path | Description |
|--------|------|-------------|
| POST | /dev-login | Dev-only instant login |
| POST | /magic-link | Send magic link email |
| POST | /verify | Exchange token for JWT |
| POST | /refresh | Refresh access token |
| GET | /me | Get current user profile |
| GET | /me/family | Get user's family |
| PATCH | /me | Update profile |
| DELETE | /me | Soft delete account |

### Families (`/families`)
| Method | Path | Description |
|--------|------|-------------|
| POST | / | Create family (auto-adds creator as Parent A) |
| GET | /my-invites | Pending invites for current user |
| POST | /accept-invite | Accept invite by token |
| POST | /accept-invite-by-id | Accept invite by membership ID |
| GET | /:familyId | Get family with members + children |
| PATCH | /:familyId | Update settings |
| POST | /:familyId/invite | Invite member (generates token, sends email) |
| POST | /:familyId/resend-invite | Resend invite email |
| GET | /:familyId/members | List all memberships |

### Children (`/families/:familyId/children`)
| Method | Path | Description |
|--------|------|-------------|
| POST | / | Create child |
| PATCH | /:childId | Update child |

### Schedules (`/families/:familyId`)
| Method | Path | Description |
|--------|------|-------------|
| GET | /calendar | Date-ranged calendar view |
| GET | /schedules/active | Current active version |
| GET | /schedules/history | All versions |
| GET | /schedules/:version | Specific version |
| GET | /schedules/:version/assignments | Assignments in date range |
| POST | /schedules/generate | Generate via optimizer |
| POST | /schedules/manual | Direct assignment creation |

### Constraints (`/families/:familyId/constraints`)
| Method | Path | Description |
|--------|------|-------------|
| GET | / | Active constraint set |
| POST | / | Add constraint |
| PATCH | /:constraintId | Update constraint |
| DELETE | /:constraintId | Remove constraint |
| POST | /validate | Check for conflicts |

**Constraint Types**: LOCKED_NIGHT, MAX_CONSECUTIVE, MIN_CONSECUTIVE, WEEKEND_SPLIT, MAX_TRANSITIONS_PER_WEEK, DAYCARE_EXCHANGE_ONLY, NO_SCHOOL_NIGHT_TRANSITION, HANDOFF_LOCATION_PREFERENCE, FAIRNESS_TARGET, UNAVAILABLE_DAY.

### Requests (`/families/:familyId/requests`)
| Method | Path | Description |
|--------|------|-------------|
| GET | / | List requests (filter by status) |
| GET | /budget | Monthly budget status |
| GET | /:requestId | Single request |
| POST | / | Create request (checks budget) |
| POST | /:requestId/cancel | Cancel request |
| POST | /impact-preview | Score proposed dates |

### Proposals (`/families/:familyId/proposals`)
| Method | Path | Description |
|--------|------|-------------|
| POST | /generate | Generate via optimizer |
| GET | /:requestId | Fetch bundle + options |
| POST | /:optionId/accept | Accept (creates new schedule version) |
| POST | /:requestId/decline | Decline all |

### Guardrails (`/families/:familyId`)
| Method | Path | Description |
|--------|------|-------------|
| GET | /consent-rules | List active rules |
| POST | /consent-rules | Add rule |
| PATCH | /consent-rules/:ruleId | Update rule |
| DELETE | /consent-rules/:ruleId | Remove rule |
| GET | /budgets | Monthly budget status |
| POST | /emergency | Activate emergency mode |
| GET | /emergency | Current status |
| PATCH | /emergency | Extend/change expiry |
| DELETE | /emergency | Cancel emergency |

### Metrics (`/families/:familyId`)
| Method | Path | Description |
|--------|------|-------------|
| GET | /ledger | Snapshots for 2/4/8/12-week windows |
| GET | /stability | Transition count, max consecutive |
| GET | /today | Today's assignment + 7-day outlook |
| GET | /summary | Monthly stats |
| GET | /audit | Append-only change log |

### Onboarding (`/onboarding`)
| Method | Path | Description |
|--------|------|-------------|
| GET | /templates | List preset templates |
| GET | /templates/:templateId | Single template |
| POST | /validate | Validate inputs via brain |
| POST | /conflicts | Detect constraint conflicts |
| POST | /options | Generate schedule options |
| POST | /explain | Explain a recommendation |
| POST | /save-input | Persist wizard input |
| GET | /saved-input/:familyId | Fetch saved input |

### Sharing
| Method | Path | Description |
|--------|------|-------------|
| POST | /families/:familyId/share-links | Create share link |
| GET | /families/:familyId/share-links | List active links |
| DELETE | /families/:familyId/share-links/:linkId | Revoke link |
| GET | /share/:token | Public HTML calendar |
| GET | /share/:token/feed.ics | Public ICS feed |

### Messaging (`/messaging`)
| Method | Path | Description |
|--------|------|-------------|
| POST | /webhook | Twilio inbound webhook |
| POST | /connect | Initiate conversation |
| POST | /status | Delivery status callback |
| GET | /media/:filename | Serve generated images |

### Other
| Path | Description |
|------|-------------|
| GET /notifications | List notifications |
| POST /notifications/:id/read | Mark as read |
| GET /viewer/validate/:token | Validate share token |
| GET /viewer/:token/schedule | Schedule via share token |
| GET /viewer/:token/metrics | Metrics via share token |
| GET /viewer/:token/history | History via share token |
| GET /s/:code | Short link redirect |
| GET /calendar-sync/:familyId/status | Sync status |
| POST /calendar-sync/:familyId/force-sync | Force sync |

## Key Service Methods

### AuthService
- `sendMagicLink(email)` — Rate-limited 5/hour, generates token, sends email
- `verifyMagicLink(token)` — Validates TTL, creates user if new, returns access + refresh
- `refreshAccessToken(token)` — Extends JWT session
- `devLogin(email)` — Dev-only instant login

### FamiliesService
- `create(userId, data)` — Creates family + membership + constraint set v1
- `invite(familyId, userId, data)` — Generates token, sends email
- `acceptInvite(token, userId)` — Redeems invite

### SchedulesService
- `generateBaseSchedule(familyId, userId, body)` — HTTP POST to Python optimizer
- `getActiveSchedule(familyId)` — Current active version
- `getCalendar(familyId, start, end)` — Date-ranged view

### ProposalsService
- `generateProposals(familyId, requestId)` — HTTP POST to optimizer
- `acceptProposal(familyId, optionId, userId)` — Applies as new schedule version

### GuardrailsService
- `activateEmergency(familyId, userId, returnDate, relaxedConstraints)` — Temporary constraint relaxation
- `getBudgetStatus(familyId)` — Monthly spent vs limit

### FamilyContextService
- `getContext(familyId)` — Returns age-derived defaults with 24h cache
- `getAdjustedWeights(context)` — Applies AGE_WEIGHT_MULTIPLIERS to solver weights

## Infrastructure Patterns

- **Auth**: PassportJS JWT + magic link. In-memory token maps (dev), Redis (prod).
- **Database**: TypeORM + Postgres 16. JSONB for familyContext, settings, parameters.
- **Events**: EventEmitter2 for schedule.generated, schedule.updated.
- **Audit**: Append-only AuditLog on all mutations.
- **Optimizer**: HTTP POST to `http://optimizer:8000/solve/*` and `/brain/*`.
- **Email**: Global module, swappable providers via EMAIL_PROVIDER env var.
