// ── Case Manager ─────────────────────────────────────────────
// Manages mediation cases. A case represents any interaction
// requiring coordination between parents: disruptions, coverage
// requests, schedule changes, fairness reviews, etc.
//
// Cases give conversations memory and link both parents into
// one shared mediated flow.

import { randomBytes } from 'crypto';

// ── Case Types ──

export type CaseType =
  | 'disruption'
  | 'coverage_request'
  | 'schedule_change_request'
  | 'fairness_review'
  | 'logistics_issue'
  | 'feedback_thread'
  | 'onboarding';

export type CaseStatus =
  | 'open'
  | 'awaiting_clarification'
  | 'awaiting_other_parent'
  | 'proposals_pending'
  | 'awaiting_selection'
  | 'resolution_pending'
  | 'followup_pending'
  | 'resolved'
  | 'closed';

// ── Case Model ──

export interface MediationCase {
  id: string;
  sessionId: string;
  type: CaseType;
  status: CaseStatus;
  initiator: 'parent_a' | 'parent_b' | 'system';
  /** Who the system is currently waiting on for a response */
  pendingResponseFrom: 'parent_a' | 'parent_b' | 'system' | null;
  /** Short description of what this case is about */
  summary: string;
  /** Structured request extracted from parent message */
  structuredRequest: Record<string, unknown> | null;
  /** Linked proposal bundle ID, if any */
  linkedProposalBundleId: string | null;
  /** Selected proposal option ID */
  selectedOptionId: string | null;
  /** Structured objections recorded during this case */
  objections: Array<{
    from: 'parent_a' | 'parent_b';
    type: string;
    description: string;
    recordedAt: string;
  }>;
  /** Follow-up requirements */
  followup: {
    required: boolean;
    scheduledFor: string | null;
    question: string | null;
  };
  /** Full audit trail of status changes */
  statusHistory: Array<{
    from: CaseStatus;
    to: CaseStatus;
    timestamp: string;
    reason: string;
  }>;
  /** Related event IDs from the event stream */
  relatedEventIds: string[];
  createdAt: string;
  resolvedAt: string | null;
  closedAt: string | null;
}

// ── Case Manager ──

export class CaseManager {
  private cases = new Map<string, MediationCase>();

  /** Open a new case. */
  openCase(
    sessionId: string,
    type: CaseType,
    initiator: MediationCase['initiator'],
    summary: string,
    structuredRequest?: Record<string, unknown>,
  ): MediationCase {
    const now = new Date().toISOString();
    const c: MediationCase = {
      id: randomBytes(8).toString('hex'),
      sessionId,
      type,
      status: 'open',
      initiator,
      pendingResponseFrom: null,
      summary,
      structuredRequest: structuredRequest || null,
      linkedProposalBundleId: null,
      selectedOptionId: null,
      objections: [],
      followup: { required: false, scheduledFor: null, question: null },
      statusHistory: [],
      relatedEventIds: [],
      createdAt: now,
      resolvedAt: null,
      closedAt: null,
    };
    this.cases.set(c.id, c);
    return c;
  }

  /** Get a case by ID. */
  getCase(caseId: string): MediationCase | null {
    return this.cases.get(caseId) || null;
  }

  /** Get all cases for a session. */
  getCasesForSession(sessionId: string): MediationCase[] {
    return Array.from(this.cases.values())
      .filter(c => c.sessionId === sessionId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  /** Get active (non-closed) cases for a session. */
  getActiveCases(sessionId: string): MediationCase[] {
    return this.getCasesForSession(sessionId)
      .filter(c => c.status !== 'closed' && c.status !== 'resolved');
  }

  /** Get the most recent active case. */
  getActiveCase(sessionId: string): MediationCase | null {
    const active = this.getActiveCases(sessionId);
    return active.length > 0 ? active[active.length - 1] : null;
  }

  /** Find active case by type. */
  findActiveCaseByType(sessionId: string, type: CaseType): MediationCase | null {
    return this.getActiveCases(sessionId).find(c => c.type === type) || null;
  }

  /** Transition case status. */
  transitionStatus(
    caseId: string,
    newStatus: CaseStatus,
    reason: string,
  ): MediationCase {
    const c = this.cases.get(caseId);
    if (!c) throw new Error(`Case ${caseId} not found`);

    const now = new Date().toISOString();
    c.statusHistory.push({
      from: c.status,
      to: newStatus,
      timestamp: now,
      reason,
    });
    c.status = newStatus;

    if (newStatus === 'resolved') c.resolvedAt = now;
    if (newStatus === 'closed') c.closedAt = now;

    return c;
  }

  /** Set who the system is waiting on for a response. */
  setPendingResponse(caseId: string, parent: MediationCase['pendingResponseFrom']): void {
    const c = this.cases.get(caseId);
    if (c) c.pendingResponseFrom = parent;
  }

  /** Link a proposal bundle to the case. */
  linkProposalBundle(caseId: string, bundleId: string): void {
    const c = this.cases.get(caseId);
    if (c) c.linkedProposalBundleId = bundleId;
  }

  /** Record a proposal selection. */
  selectProposal(caseId: string, optionId: string): void {
    const c = this.cases.get(caseId);
    if (c) c.selectedOptionId = optionId;
  }

  /** Record a structured objection. */
  addObjection(
    caseId: string,
    from: 'parent_a' | 'parent_b',
    type: string,
    description: string,
  ): void {
    const c = this.cases.get(caseId);
    if (c) {
      c.objections.push({
        from,
        type,
        description,
        recordedAt: new Date().toISOString(),
      });
    }
  }

  /** Schedule a follow-up. */
  scheduleFollowup(caseId: string, scheduledFor: string, question: string): void {
    const c = this.cases.get(caseId);
    if (c) {
      c.followup = { required: true, scheduledFor, question };
    }
  }

  /** Link an event to a case. */
  addRelatedEvent(caseId: string, eventId: string): void {
    const c = this.cases.get(caseId);
    if (c && !c.relatedEventIds.includes(eventId)) {
      c.relatedEventIds.push(eventId);
    }
  }

  /** Set structured request. */
  setStructuredRequest(caseId: string, request: Record<string, unknown>): void {
    const c = this.cases.get(caseId);
    if (c) c.structuredRequest = request;
  }

  /** Serialize all cases. */
  toJSON(): MediationCase[] {
    return Array.from(this.cases.values());
  }

  /** Restore from serialized data. */
  static fromJSON(data: MediationCase[]): CaseManager {
    const mgr = new CaseManager();
    for (const c of data) {
      mgr.cases.set(c.id, c);
    }
    return mgr;
  }
}
