import { describe, it, expect } from 'vitest';
import { computeOverlay, toSolverPayload, type CurrentAssignment } from '../../src/disruption/overlay_engine';
import type { DisruptionEvent, DisruptionOverlayResult } from '../../src/disruption/types';
import type { ResolvedPolicy } from '../../src/disruption/policy_resolver';
import {
  DisruptionEventType,
  DisruptionScope,
  DisruptionSource,
  OverrideStrength,
  OverlayActionType,
  PolicySource,
} from '../../src/enums';

function makeEvent(overrides: Partial<DisruptionEvent> = {}): DisruptionEvent {
  return {
    id: 'evt-1',
    familyId: 'fam-1',
    type: DisruptionEventType.CHILD_SICK,
    scope: DisruptionScope.HOUSEHOLD,
    source: DisruptionSource.USER_DECLARED,
    overrideStrength: OverrideStrength.SOFT,
    startDate: '2026-03-10',
    endDate: '2026-03-12',
    metadata: {},
    reportedBy: 'user-1',
    resolvedAt: null,
    ...overrides,
  };
}

function makePolicy(actionType: OverlayActionType): ResolvedPolicy {
  return {
    actionType,
    strength: OverrideStrength.SOFT,
    source: PolicySource.GLOBAL_DEFAULT,
    policyId: null,
    description: 'test policy',
  };
}

const assignments: CurrentAssignment[] = [
  { date: '2026-03-10', assignedTo: 'parent_a' },
  { date: '2026-03-11', assignedTo: 'parent_a' },
  { date: '2026-03-12', assignedTo: 'parent_b' },
  { date: '2026-03-13', assignedTo: 'parent_b' },
];

describe('computeOverlay', () => {
  it('NO_OVERRIDE produces no locks or adjustments', () => {
    const result = computeOverlay(
      makeEvent(),
      makePolicy(OverlayActionType.NO_OVERRIDE),
      assignments,
    );
    expect(result.locks).toHaveLength(0);
    expect(result.logisticsAdjustments).toHaveLength(0);
    expect(result.weightAdjustments).toHaveLength(0);
    expect(result.requiresProposal).toBe(false);
    expect(result.reasons[0]).toContain('sovereignty');
  });

  it('LOGISTICS_FALLBACK produces logistics adjustments, no locks', () => {
    const result = computeOverlay(
      makeEvent({ type: DisruptionEventType.SCHOOL_CLOSED }),
      makePolicy(OverlayActionType.LOGISTICS_FALLBACK),
      assignments,
    );
    expect(result.locks).toHaveLength(0);
    expect(result.logisticsAdjustments).toHaveLength(3); // 3 days
    expect(result.logisticsAdjustments[0].newLocation).toBe('home');
  });

  it('BLOCK_ASSIGNMENT locks affected days to other parent', () => {
    const event = makeEvent({
      type: DisruptionEventType.PARENT_TRAVEL,
      metadata: { affectedParent: 'parent_a' },
    });
    const result = computeOverlay(
      event,
      makePolicy(OverlayActionType.BLOCK_ASSIGNMENT),
      assignments,
    );
    expect(result.locks).toHaveLength(3);
    // All locked to parent_b (because parent_a is traveling)
    for (const lock of result.locks) {
      expect(lock.assignedTo).toBe('parent_b');
    }
    expect(result.compensatoryDays.length).toBeGreaterThan(0);
  });

  it('BLOCK_ASSIGNMENT locks to current when no affected parent', () => {
    const result = computeOverlay(
      makeEvent({ type: DisruptionEventType.CAMP_WEEK }),
      makePolicy(OverlayActionType.BLOCK_ASSIGNMENT),
      assignments,
    );
    // Should lock to current assignment (parent_a for 10,11, parent_b for 12)
    const lockMap = new Map(result.locks.map((l) => [l.date, l.assignedTo]));
    expect(lockMap.get('2026-03-10')).toBe('parent_a');
    expect(lockMap.get('2026-03-11')).toBe('parent_a');
    expect(lockMap.get('2026-03-12')).toBe('parent_b');
  });

  it('DELAY_EXCHANGE locks to current assignment', () => {
    const result = computeOverlay(
      makeEvent(),
      makePolicy(OverlayActionType.DELAY_EXCHANGE),
      assignments,
    );
    expect(result.locks).toHaveLength(3);
    expect(result.locks[0].reason).toContain('exchange delayed');
  });

  it('GENERATE_PROPOSALS sets requiresProposal and adds weight adjustment', () => {
    const result = computeOverlay(
      makeEvent({ type: DisruptionEventType.SUMMER_PERIOD }),
      makePolicy(OverlayActionType.GENERATE_PROPOSALS),
      assignments,
    );
    expect(result.requiresProposal).toBe(true);
    expect(result.weightAdjustments).toHaveLength(1);
    expect(result.weightAdjustments[0].key).toBe('fairnessDeviation');
    expect(result.weightAdjustments[0].multiplier).toBe(1.5);
  });

  it('long disruption (>72h) adds fairness weight adjustment', () => {
    const event = makeEvent({
      startDate: '2026-03-10',
      endDate: '2026-03-15', // 6 days > 72h
    });
    const result = computeOverlay(
      event,
      makePolicy(OverlayActionType.DELAY_EXCHANGE),
      assignments,
    );
    const fairnessAdj = result.weightAdjustments.find((a) => a.key === 'fairnessDeviation');
    expect(fairnessAdj).toBeDefined();
    expect(fairnessAdj!.multiplier).toBe(1.3);
  });
});

describe('toSolverPayload', () => {
  it('returns empty payload for no overlays', () => {
    const payload = toSolverPayload([]);
    expect(payload.disruption_locks).toHaveLength(0);
    expect(Object.keys(payload.weight_adjustments)).toHaveLength(0);
    expect(payload.disruption_context).toHaveLength(0);
  });

  it('merges locks from multiple overlays', () => {
    const overlays: DisruptionOverlayResult[] = [
      {
        eventId: 'e1',
        eventType: DisruptionEventType.PARENT_TRAVEL,
        actionTaken: OverlayActionType.BLOCK_ASSIGNMENT,
        locks: [{ date: '2026-03-10', assignedTo: 'parent_b', reason: 'travel' }],
        logisticsAdjustments: [],
        weightAdjustments: [],
        reasons: [],
        requiresProposal: false,
        compensatoryDays: [],
      },
      {
        eventId: 'e2',
        eventType: DisruptionEventType.SCHOOL_CLOSED,
        actionTaken: OverlayActionType.LOGISTICS_FALLBACK,
        locks: [],
        logisticsAdjustments: [],
        weightAdjustments: [{ key: 'fairnessDeviation', multiplier: 1.3, reason: 'test' }],
        reasons: [],
        requiresProposal: false,
        compensatoryDays: [],
      },
    ];

    const payload = toSolverPayload(overlays);
    expect(payload.disruption_locks).toHaveLength(1);
    expect(payload.disruption_locks[0].date).toBe('2026-03-10');
    expect(payload.weight_adjustments.fairnessDeviation).toBe(1.3);
    expect(payload.disruption_context).toHaveLength(2);
  });

  it('multiplies weight adjustments from multiple overlays', () => {
    const overlays: DisruptionOverlayResult[] = [
      {
        eventId: 'e1',
        eventType: DisruptionEventType.CHILD_SICK,
        actionTaken: OverlayActionType.DELAY_EXCHANGE,
        locks: [],
        logisticsAdjustments: [],
        weightAdjustments: [{ key: 'fairnessDeviation', multiplier: 1.3, reason: 'a' }],
        reasons: [],
        requiresProposal: false,
        compensatoryDays: [],
      },
      {
        eventId: 'e2',
        eventType: DisruptionEventType.SUMMER_PERIOD,
        actionTaken: OverlayActionType.GENERATE_PROPOSALS,
        locks: [],
        logisticsAdjustments: [],
        weightAdjustments: [{ key: 'fairnessDeviation', multiplier: 1.5, reason: 'b' }],
        reasons: [],
        requiresProposal: true,
        compensatoryDays: [],
      },
    ];

    const payload = toSolverPayload(overlays);
    // 1.3 * 1.5 = 1.95
    expect(payload.weight_adjustments.fairnessDeviation).toBeCloseTo(1.95);
  });

  it('produces valid solver shape with parent and date fields', () => {
    const overlays: DisruptionOverlayResult[] = [
      {
        eventId: 'e1',
        eventType: DisruptionEventType.PARENT_TRAVEL,
        actionTaken: OverlayActionType.BLOCK_ASSIGNMENT,
        locks: [
          { date: '2026-03-10', assignedTo: 'parent_b', reason: 'test' },
          { date: '2026-03-11', assignedTo: 'parent_b', reason: 'test' },
        ],
        logisticsAdjustments: [],
        weightAdjustments: [],
        reasons: [],
        requiresProposal: false,
        compensatoryDays: [],
      },
    ];

    const payload = toSolverPayload(overlays);
    for (const lock of payload.disruption_locks) {
      expect(lock).toHaveProperty('parent');
      expect(lock).toHaveProperty('date');
      expect(lock).toHaveProperty('source', 'disruption');
      expect(['parent_a', 'parent_b']).toContain(lock.parent);
    }
  });
});
