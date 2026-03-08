import { describe, it, expect, beforeEach } from 'vitest';
import { CaseManager, MediationCase } from '../lib/conversation/case-manager';

let mgr: CaseManager;

beforeEach(() => {
  mgr = new CaseManager();
});

describe('CaseManager — openCase', () => {
  it('creates a case with correct defaults', () => {
    const c = mgr.openCase('session-1', 'disruption', 'parent_a', 'Child is sick');
    expect(c.id).toBeTruthy();
    expect(c.id.length).toBe(16);
    expect(c.sessionId).toBe('session-1');
    expect(c.type).toBe('disruption');
    expect(c.status).toBe('open');
    expect(c.initiator).toBe('parent_a');
    expect(c.summary).toBe('Child is sick');
    expect(c.objections).toEqual([]);
    expect(c.relatedEventIds).toEqual([]);
    expect(c.resolvedAt).toBeNull();
  });

  it('stores structured request', () => {
    const req = { eventType: 'child_sick', duration: 'today_only' };
    const c = mgr.openCase('session-1', 'disruption', 'parent_a', 'Sick', req);
    expect(c.structuredRequest).toEqual(req);
  });
});

describe('CaseManager — getCase', () => {
  it('retrieves existing case', () => {
    const c = mgr.openCase('session-1', 'disruption', 'parent_a', 'Test');
    expect(mgr.getCase(c.id)).toBe(c);
  });

  it('returns null for unknown', () => {
    expect(mgr.getCase('nonexistent')).toBeNull();
  });
});

describe('CaseManager — getCasesForSession', () => {
  it('returns all cases for a session', () => {
    mgr.openCase('session-1', 'disruption', 'parent_a', 'Case 1');
    mgr.openCase('session-1', 'coverage_request', 'parent_b', 'Case 2');
    mgr.openCase('session-2', 'feedback_thread', 'parent_a', 'Other session');

    const cases = mgr.getCasesForSession('session-1');
    expect(cases).toHaveLength(2);
  });
});

describe('CaseManager — getActiveCases', () => {
  it('excludes resolved and closed cases', () => {
    const c1 = mgr.openCase('session-1', 'disruption', 'parent_a', 'Active');
    const c2 = mgr.openCase('session-1', 'coverage_request', 'parent_b', 'Resolved');
    mgr.transitionStatus(c2.id, 'resolved', 'Done');

    const active = mgr.getActiveCases('session-1');
    expect(active).toHaveLength(1);
    expect(active[0].id).toBe(c1.id);
  });
});

describe('CaseManager — transitionStatus', () => {
  it('transitions and records history', () => {
    const c = mgr.openCase('session-1', 'disruption', 'parent_a', 'Test');
    mgr.transitionStatus(c.id, 'awaiting_clarification', 'Need duration');

    expect(c.status).toBe('awaiting_clarification');
    expect(c.statusHistory).toHaveLength(1);
    expect(c.statusHistory[0].from).toBe('open');
    expect(c.statusHistory[0].to).toBe('awaiting_clarification');
    expect(c.statusHistory[0].reason).toBe('Need duration');
  });

  it('sets resolvedAt on resolved', () => {
    const c = mgr.openCase('session-1', 'disruption', 'parent_a', 'Test');
    mgr.transitionStatus(c.id, 'resolved', 'Accepted');
    expect(c.resolvedAt).toBeTruthy();
  });

  it('sets closedAt on closed', () => {
    const c = mgr.openCase('session-1', 'disruption', 'parent_a', 'Test');
    mgr.transitionStatus(c.id, 'closed', 'Done');
    expect(c.closedAt).toBeTruthy();
  });

  it('throws for unknown case', () => {
    expect(() => mgr.transitionStatus('nonexistent', 'resolved', 'x')).toThrow();
  });

  it('supports multiple transitions', () => {
    const c = mgr.openCase('session-1', 'disruption', 'parent_a', 'Test');
    mgr.transitionStatus(c.id, 'awaiting_clarification', 'Need info');
    mgr.transitionStatus(c.id, 'proposals_pending', 'Got info');
    mgr.transitionStatus(c.id, 'awaiting_selection', 'Proposals ready');

    expect(c.status).toBe('awaiting_selection');
    expect(c.statusHistory).toHaveLength(3);
  });
});

describe('CaseManager — setPendingResponse', () => {
  it('sets pending response', () => {
    const c = mgr.openCase('session-1', 'disruption', 'parent_a', 'Test');
    mgr.setPendingResponse(c.id, 'parent_b');
    expect(c.pendingResponseFrom).toBe('parent_b');
  });
});

describe('CaseManager — linkProposalBundle', () => {
  it('links a bundle', () => {
    const c = mgr.openCase('session-1', 'disruption', 'parent_a', 'Test');
    mgr.linkProposalBundle(c.id, 'bundle-123');
    expect(c.linkedProposalBundleId).toBe('bundle-123');
  });
});

describe('CaseManager — selectProposal', () => {
  it('records selection', () => {
    const c = mgr.openCase('session-1', 'disruption', 'parent_a', 'Test');
    mgr.selectProposal(c.id, 'option-A');
    expect(c.selectedOptionId).toBe('option-A');
  });
});

describe('CaseManager — addObjection', () => {
  it('records objection', () => {
    const c = mgr.openCase('session-1', 'disruption', 'parent_a', 'Test');
    mgr.addObjection(c.id, 'parent_b', 'fairness', 'This is unfair');

    expect(c.objections).toHaveLength(1);
    expect(c.objections[0].from).toBe('parent_b');
    expect(c.objections[0].type).toBe('fairness');
    expect(c.objections[0].recordedAt).toBeTruthy();
  });
});

describe('CaseManager — scheduleFollowup', () => {
  it('schedules follow-up', () => {
    const c = mgr.openCase('session-1', 'disruption', 'parent_a', 'Test');
    mgr.scheduleFollowup(c.id, '2026-03-10', 'Has the child recovered?');

    expect(c.followup.required).toBe(true);
    expect(c.followup.scheduledFor).toBe('2026-03-10');
    expect(c.followup.question).toBe('Has the child recovered?');
  });
});

describe('CaseManager — addRelatedEvent', () => {
  it('adds event IDs without duplicates', () => {
    const c = mgr.openCase('session-1', 'disruption', 'parent_a', 'Test');
    mgr.addRelatedEvent(c.id, 'event-1');
    mgr.addRelatedEvent(c.id, 'event-2');
    mgr.addRelatedEvent(c.id, 'event-1'); // duplicate

    expect(c.relatedEventIds).toEqual(['event-1', 'event-2']);
  });
});

describe('CaseManager — findActiveCaseByType', () => {
  it('finds active case by type', () => {
    mgr.openCase('session-1', 'disruption', 'parent_a', 'Sick');
    mgr.openCase('session-1', 'feedback_thread', 'parent_b', 'Feedback');

    const disruption = mgr.findActiveCaseByType('session-1', 'disruption');
    expect(disruption).toBeTruthy();
    expect(disruption!.type).toBe('disruption');

    expect(mgr.findActiveCaseByType('session-1', 'logistics_issue')).toBeNull();
  });
});

describe('CaseManager — serialization', () => {
  it('serializes and deserializes', () => {
    mgr.openCase('session-1', 'disruption', 'parent_a', 'Test 1');
    mgr.openCase('session-1', 'coverage_request', 'parent_b', 'Test 2');

    const json = mgr.toJSON();
    const restored = CaseManager.fromJSON(json);

    expect(restored.getCasesForSession('session-1')).toHaveLength(2);
  });
});
