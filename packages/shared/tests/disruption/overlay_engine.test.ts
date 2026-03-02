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
import {
  SOLVER_PRECEDENCE_HIERARCHY,
  SCHOOL_NIGHT_HOLIDAY_MULTIPLIER,
} from '../../src/constants';

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
    // 3 disruption locks + up to 3 compensatory locks = 6
    expect(result.locks.length).toBeGreaterThanOrEqual(3);
    // Disruption locks are assigned to parent_b (because parent_a is traveling)
    const disruptionLocks = result.locks.filter((l) => !l.reason.includes('compensatory'));
    for (const lock of disruptionLocks) {
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

  it('Rule C: PUBLIC_HOLIDAY reduces school-night penalty for night before', () => {
    const event = makeEvent({
      type: DisruptionEventType.PUBLIC_HOLIDAY,
      startDate: '2026-03-16', // Monday holiday
      endDate: '2026-03-16',
    });
    const result = computeOverlay(
      event,
      makePolicy(OverlayActionType.LOGISTICS_FALLBACK),
      assignments,
    );
    // Night before (2026-03-15, Sunday night) should have reduced schoolNightDisruption
    const schoolAdj = result.weightAdjustments.find(
      (a) => a.key === 'schoolNightDisruption' && a.date === '2026-03-15',
    );
    expect(schoolAdj).toBeDefined();
    expect(schoolAdj!.multiplier).toBe(0.1);
    expect(schoolAdj!.reason).toContain('Rule C');
    expect(result.reasons).toEqual(
      expect.arrayContaining([expect.stringContaining('Rule C')]),
    );
  });

  it('Rule C: SCHOOL_CLOSED reduces school-night penalty for each night before', () => {
    const event = makeEvent({
      type: DisruptionEventType.SCHOOL_CLOSED,
      startDate: '2026-03-10',
      endDate: '2026-03-11', // 2-day closure
    });
    const result = computeOverlay(
      event,
      makePolicy(OverlayActionType.LOGISTICS_FALLBACK),
      assignments,
    );
    // Should have adjustments for nights before both days (2026-03-09 and 2026-03-10)
    const schoolAdjs = result.weightAdjustments.filter(
      (a) => a.key === 'schoolNightDisruption',
    );
    expect(schoolAdjs).toHaveLength(2);
    expect(schoolAdjs.map((a) => a.date).sort()).toEqual(['2026-03-09', '2026-03-10']);
  });

  it('Rule C: EMERGENCY_CLOSURE also triggers school-night reduction', () => {
    const event = makeEvent({
      type: DisruptionEventType.EMERGENCY_CLOSURE,
      startDate: '2026-03-10',
      endDate: '2026-03-10',
    });
    const result = computeOverlay(
      event,
      makePolicy(OverlayActionType.LOGISTICS_FALLBACK),
      assignments,
    );
    const schoolAdj = result.weightAdjustments.find(
      (a) => a.key === 'schoolNightDisruption',
    );
    expect(schoolAdj).toBeDefined();
    expect(schoolAdj!.date).toBe('2026-03-09');
  });

  it('Rule C: non-school events (CHILD_SICK) do NOT reduce school-night penalty', () => {
    const result = computeOverlay(
      makeEvent({ type: DisruptionEventType.CHILD_SICK }),
      makePolicy(OverlayActionType.DELAY_EXCHANGE),
      assignments,
    );
    const schoolAdjs = result.weightAdjustments.filter(
      (a) => a.key === 'schoolNightDisruption',
    );
    expect(schoolAdjs).toHaveLength(0);
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

describe('SOLVER_PRECEDENCE_HIERARCHY (§8)', () => {
  it('contains exactly 7 tiers in strict ascending order', () => {
    expect(SOLVER_PRECEDENCE_HIERARCHY).toHaveLength(7);
    for (let i = 0; i < SOLVER_PRECEDENCE_HIERARCHY.length; i++) {
      expect(SOLVER_PRECEDENCE_HIERARCHY[i].tier).toBe(i + 1);
    }
  });

  it('tier 1 is hard constraints (absolute, never relaxed)', () => {
    expect(SOLVER_PRECEDENCE_HIERARCHY[0].name).toBe('hard_constraints');
  });

  it('tier 2 is young-child stability (safety-critical)', () => {
    expect(SOLVER_PRECEDENCE_HIERARCHY[1].name).toBe('young_child_stability');
  });

  it('fairness (tier 5) is always below stability (tier 2)', () => {
    const stability = SOLVER_PRECEDENCE_HIERARCHY.find((h) => h.name === 'young_child_stability')!;
    const fairness = SOLVER_PRECEDENCE_HIERARCHY.find((h) => h.name === 'fairness_and_weekend_goals')!;
    expect(stability.tier).toBeLessThan(fairness.tier);
  });

  it('logistics (tier 7) is always the lowest priority', () => {
    const logistics = SOLVER_PRECEDENCE_HIERARCHY[SOLVER_PRECEDENCE_HIERARCHY.length - 1];
    expect(logistics.name).toBe('logistics_optimizations');
    expect(logistics.tier).toBe(7);
  });
});

describe('SCHOOL_NIGHT_HOLIDAY_MULTIPLIER', () => {
  it('is a small positive number (near-zero, weekend-like)', () => {
    expect(SCHOOL_NIGHT_HOLIDAY_MULTIPLIER).toBeGreaterThan(0);
    expect(SCHOOL_NIGHT_HOLIDAY_MULTIPLIER).toBeLessThanOrEqual(0.2);
  });
});
