# ADCP Use Cases

Tracks user-facing scenarios across the app. Each use case records the flow, status, and any gaps.

**Status legend:** DONE | PARTIAL | NOT STARTED

---

## 1. Authentication

### UC-1.1: Sign up via magic link
- **Actor:** New user
- **Flow:** Enter email on login screen > Receive magic link email > Paste token > Account created automatically > Redirected to onboarding
- **Status:** DONE
- **Notes:** Token stored in-memory Map (dev). Email logged to console via EmailService.

### UC-1.2: Sign in via magic link (returning user)
- **Actor:** Existing user
- **Flow:** Enter email > Receive magic link > Paste token > JWT issued > Redirected to main app
- **Status:** DONE

### UC-1.3: Refresh expired session
- **Actor:** Any authenticated user
- **Flow:** Access token expires > App sends refresh token > New access + refresh tokens issued
- **Status:** DONE
- **Notes:** Refresh token is opaque, 30-day TTL, stored in-memory Map.

### UC-1.4: Update profile
- **Actor:** Any authenticated user
- **Flow:** Settings > Edit display name, timezone, or notification preferences > Save
- **Status:** DONE

### UC-1.5: Delete account
- **Actor:** Any authenticated user
- **Flow:** Settings > Delete account > Soft-delete (30-day grace period)
- **Status:** DONE

---

## 2. Onboarding & Family Setup

### UC-2.1: Parent A creates family with template
- **Actor:** Parent A (family creator)
- **Flow:** Sign up > View 4 schedule templates (daycare week split, alternating weeks, 2-2-3 rotation, 5-2 split) > Select one > Enter family name > Create family > Template constraints auto-applied > Invite co-parent via email
- **Status:** PARTIAL
- **Notes:** Mobile UI exists. API template endpoint is a stub returning empty array — templates are hardcoded on mobile side. Parent A is the only one who selects a template.

### UC-2.2: Parent A creates family without template
- **Actor:** Parent A
- **Flow:** Sign up > Skip template selection > Enter family name > Create family > Invite co-parent
- **Status:** DONE
- **Notes:** Template step is skippable in onboarding flow.

### UC-2.3: Parent B accepts invite
- **Actor:** Parent B (invited co-parent)
- **Flow:** Sign in > Settings > "Pending Invites" section shows invite card with inviter name/email and family name > Tap "Accept Invite" > Family status changes to ACTIVE (if both parents accepted)
- **Status:** DONE
- **Notes:** Accept is token-free — the API matches the user's email to the pending membership. Invite card shows who sent it.

### UC-2.4: Parent B reviews/negotiates initial constraints
- **Actor:** Parent B
- **Flow:** After accepting invite > Review constraints set by Parent A > Propose changes or add own constraints
- **Status:** NOT STARTED
- **Notes:** No dedicated review screen. Parent B can manually edit constraints in Settings, but there's no guided flow.

### UC-2.5: Caregiver/viewer invited to family
- **Actor:** Parent A or B
- **Flow:** Settings > Family Members > "+ Invite Member" > Enter email, select role (parent_b/caregiver/viewer), set label > Send Invite
- **Status:** DONE
- **Notes:** Full invite editor in Settings with role picker and editable label. API supports all roles. No role-specific permission scoping yet.

### UC-2.6: View family members
- **Actor:** Parent A or B
- **Flow:** Settings > "Family Members" section > See all members with name, role label, and status badge (green "Joined" or yellow "Pending")
- **Status:** DONE

### UC-2.7: Resend invite to pending member
- **Actor:** Parent A or B
- **Flow:** Settings > Family Members > See pending member > Tap "Resend" > New invite token generated, old invalidated, email re-sent
- **Status:** DONE
- **Notes:** Solves the problem of expired tokens after API restart (in-memory token storage).

---

## 3. Child Management

### UC-3.1: Add child to family
- **Actor:** Parent A or B
- **Flow:** Settings > Add child > Enter first name, date of birth, school name > Save
- **Status:** DONE

### UC-3.2: Update child info
- **Actor:** Parent A or B
- **Flow:** Settings > Edit child > Update fields > Save
- **Status:** DONE

---

## 4. Constraints

### UC-4.1: Add constraint manually
- **Actor:** Parent A or B
- **Flow:** Settings > Constraints > Add > Choose type (locked night, max consecutive, weekend split, etc.) > Set parameters > Save
- **Status:** DONE
- **Notes:** Conflict validation exists for locked nights (no double-booking same day to different parents).

### UC-4.2: Edit constraint
- **Actor:** Parent A or B
- **Flow:** Settings > Constraints > Select constraint > Edit parameters or hardness > Save
- **Status:** DONE

### UC-4.3: Remove constraint
- **Actor:** Parent A or B
- **Flow:** Settings > Constraints > Select > Delete
- **Status:** DONE

### UC-4.4: Validate constraint set feasibility
- **Actor:** Parent A or B
- **Flow:** Settings > Constraints > Validate > System checks for conflicts and feasibility
- **Status:** DONE

---

## 5. Schedule Generation & Viewing

### UC-5.1: Generate schedule via optimizer
- **Actor:** Parent A or B
- **Flow:** Settings > Generate schedule > Set horizon dates + options > API calls Python CP-SAT solver > New immutable schedule version created > Calendar updated
- **Status:** DONE
- **Notes:** Requires optimizer Docker container running.

### UC-5.2: Create manual schedule
- **Actor:** Parent A or B
- **Flow:** Provide array of date-to-parent assignments > New schedule version created
- **Status:** DONE

### UC-5.3: View calendar
- **Actor:** Any family member
- **Flow:** Calendar tab > Month view > Color-coded assignments per parent > Navigate months
- **Status:** DONE

### UC-5.4: View schedule history
- **Actor:** Any family member
- **Flow:** API returns all immutable schedule versions for the family
- **Status:** DONE
- **Notes:** No mobile UI for browsing version history yet.

---

## 6. Change Requests

### UC-6.1: Request coverage (need someone to cover my days)
- **Actor:** Parent A or B
- **Flow:** Requests tab > "Need Coverage" > Select dates > Add reason tag + note > Submit
- **Status:** DONE

### UC-6.2: Request extra time
- **Actor:** Parent A or B
- **Flow:** Requests tab > "Want Extra Time" > Select dates > Add reason > Submit
- **Status:** DONE

### UC-6.3: Request date swap
- **Actor:** Parent A or B
- **Flow:** Requests tab > "Swap Dates" > Select dates > Submit
- **Status:** DONE

### UC-6.4: Cancel request
- **Actor:** Request creator
- **Flow:** Requests tab > Select active request > Cancel
- **Status:** DONE

### UC-6.5: Preview impact before submitting
- **Actor:** Parent A or B
- **Flow:** Before submitting request > View fairness + stability impact preview
- **Status:** DONE

### UC-6.6: View change budget
- **Actor:** Parent A or B
- **Flow:** Requests tab > See remaining requests for the period
- **Status:** DONE

---

## 7. Proposals

### UC-7.1: Generate proposals for a request
- **Actor:** System (triggered by request creator)
- **Flow:** Request submitted > API calls optimizer > Multiple proposal options generated with fairness/stability scores
- **Status:** DONE

### UC-7.2: Review and accept proposal
- **Actor:** Other parent (not the requester)
- **Flow:** View proposal options > Compare calendar diffs, fairness impact, penalty scores > Accept one option > Schedule updated
- **Status:** DONE

### UC-7.3: Decline all proposals
- **Actor:** Other parent
- **Flow:** View proposals > Decline > Request marked declined > No schedule change
- **Status:** DONE

### UC-7.4: Proposal auto-expires
- **Actor:** System
- **Flow:** 48 hours pass with no action > Proposal expires > No schedule change
- **Status:** PARTIAL
- **Notes:** Expiry logic exists in data model but no background job/cron triggers it automatically.

---

## 8. Guardrails

### UC-8.1: Set consent rules
- **Actor:** Parent A or B
- **Flow:** Settings > Consent rules > Add rule (fairness band, max transitions, max streak, request type) > Set threshold
- **Status:** DONE

### UC-8.2: View change budgets
- **Actor:** Parent A or B
- **Flow:** Settings > View remaining budget per parent for current period
- **Status:** DONE

### UC-8.3: Activate emergency mode
- **Actor:** Parent A or B
- **Flow:** Settings > Emergency > Activate > Set return-to-baseline date > Select constraints to relax
- **Status:** DONE

### UC-8.4: End emergency mode early
- **Actor:** Parent A or B
- **Flow:** Settings > Emergency > Cancel > Normal constraints restored
- **Status:** DONE

### UC-8.5: Emergency mode auto-returns to normal
- **Actor:** System
- **Flow:** Return-to-baseline date reached > Emergency mode ends > Normal schedule resumes
- **Status:** NOT STARTED
- **Notes:** No background job/cron to trigger auto-return.

---

## 9. Metrics & Audit

### UC-9.1: View today's snapshot
- **Actor:** Any family member
- **Flow:** Home tab > See tonight's assignment, next handoff, fairness delta, stability, pending requests
- **Status:** DONE

### UC-9.2: View fairness ledger
- **Actor:** Any family member
- **Flow:** API returns overnight counts per parent across time windows (2/4/8/12 weeks)
- **Status:** DONE
- **Notes:** No dedicated mobile screen — data shown in summary on Home tab.

### UC-9.3: View stability metrics
- **Actor:** Any family member
- **Flow:** API returns transitions count, max consecutive nights, school-night changes
- **Status:** DONE

### UC-9.4: View audit log
- **Actor:** Any family member
- **Flow:** API returns paginated history of all mutations (schedule generated, proposal accepted, constraint changed, etc.)
- **Status:** DONE
- **Notes:** No mobile UI for audit log yet.

### UC-9.5: View monthly summary
- **Actor:** Any family member
- **Flow:** API returns aggregated stats for a given month
- **Status:** DONE

---

## 10. Sharing

### UC-10.1: Create share link
- **Actor:** Parent A or B
- **Flow:** Settings > Share > Create link > Choose scope (calendar readonly, ICS feed, handoff schedule) > Set expiry > Link generated
- **Status:** DONE

### UC-10.2: View shared calendar (public)
- **Actor:** Anyone with the link
- **Flow:** Open share link in browser > See read-only calendar view
- **Status:** DONE

### UC-10.3: Subscribe to ICS feed
- **Actor:** Anyone with the link
- **Flow:** Add ICS feed URL to Google Calendar / Apple Calendar > Auto-syncs
- **Status:** DONE

### UC-10.4: Revoke share link
- **Actor:** Link creator
- **Flow:** Settings > Share > Delete link > Link no longer works
- **Status:** DONE

---

## 11. Notifications

### UC-11.1: Receive email notifications
- **Actor:** Any family member
- **Flow:** System event (proposal received, accepted, expiring, expired, emergency, handoff, budget low, fairness drift) > Email sent if user preferences allow
- **Status:** PARTIAL
- **Notes:** EmailService + templates exist for all 9 notification types. NotificationService checks user preferences. But no module actually calls `NotificationService.send()` yet — triggers not wired.

### UC-11.2: Receive push notifications
- **Actor:** Any family member
- **Flow:** System event > Push notification sent to device
- **Status:** NOT STARTED
- **Notes:** Push provider is a logger stub only.

### UC-11.3: View notification history
- **Actor:** Any authenticated user
- **Flow:** API returns list of past notifications with read/unread status
- **Status:** DONE

### UC-11.4: Mark notification as read
- **Actor:** Any authenticated user
- **Flow:** Select notification > Mark read
- **Status:** DONE

### UC-11.5: Configure notification preferences
- **Actor:** Any authenticated user
- **Flow:** Settings > Toggle email on/off, set reminder hours before handoff
- **Status:** DONE

---

## 12. Holidays

### UC-12.1: Manage holiday schedule
- **Actor:** Parent A or B
- **Flow:** Add holidays/school breaks > Optimizer accounts for them in schedule generation
- **Status:** NOT STARTED
- **Notes:** HolidaysModule exists but service is an empty stub. Only a health endpoint is exposed.

---

## Appendix: Cross-Cutting Gaps

| Gap | Impact | Notes |
|-----|--------|-------|
| No background jobs/cron | UC-7.4, UC-8.5 | Proposal expiry and emergency auto-return need scheduled triggers |
| Notification triggers not wired | UC-11.1 | EmailService ready but no module calls NotificationService.send() |
| In-memory token storage | UC-1.1 | Magic link + invite tokens use Maps, not Redis. Resend (UC-2.7) mitigates invite token loss on restart. |
| No test suite | All | No unit or integration tests exist |
| Onboarding templates API stub | UC-2.1 | Templates hardcoded on mobile, API returns empty |
| No role-based permissions | UC-2.5 | Caregiver/viewer roles exist but no permission scoping |
