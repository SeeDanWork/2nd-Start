/**
 * Determinism Stress Tests
 *
 * Verifies: same inputs → same outputs across N runs.
 * Covers: interpreter pipeline, LLM pattern matching, disruption overlay.
 */

import { describe, it, expect } from 'vitest';
import { interpretChangeRequest } from '../../src/interpreter/interpret';
import { ApplyMode } from '../../src/interpreter/types';
import {
  ParentRole,
  RequestType,
  DisruptionEventType,
  DisruptionScope,
  DisruptionSource,
  OverrideStrength,
  OverlayActionType,
  PolicySource,
} from '../../src/enums';
import { PatternProvider } from '../../src/llm/pattern_provider';
import { computeOverlay, type CurrentAssignment } from '../../src/disruption/overlay_engine';
import type { ResolvedPolicy } from '../../src/disruption/policy_resolver';
import type { RawChangeRequestInput } from '../../src/interpreter/canonicalize';
import type { AssignmentRecord } from '../../src/interpreter/stability_budget';
import type { LlmContext } from '../../src/llm/types';
import type { DisruptionEvent } from '../../src/disruption/types';
import { createHash } from 'crypto';

// ─── Helpers ─────────────────────────────────────────────────────────

function hashObj(obj: unknown): string {
  return createHash('sha256').update(JSON.stringify(obj)).digest('hex').slice(0, 12);
}

function makeRaw(overrides: Partial<RawChangeRequestInput> = {}): RawChangeRequestInput {
  return {
    id: 'req-det-1',
    familyId: 'fam-det',
    requestingParent: ParentRole.PARENT_A,
    requestType: RequestType.NEED_COVERAGE,
    dates: ['2027-03-15', '2027-03-16', '2027-03-10'],
    createdAt: '2027-03-01T00:00:00Z',
    ...overrides,
  };
}

const emptyAssignments: AssignmentRecord[] = [];

function buildAssignments(startDate: string, days: number): AssignmentRecord[] {
  const out: AssignmentRecord[] = [];
  const start = new Date(startDate + 'T00:00:00');
  for (let i = 0; i < days; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const iso = d.toISOString().slice(0, 10);
    out.push({ date: iso, assignedTo: i % 2 === 0 ? 'parent_a' : 'parent_b' });
  }
  return out;
}

const provider = new PatternProvider();
const llmCtx: LlmContext = {
  familyId: 'fam-det',
  parentRole: 'parent_a',
  childrenAges: [7],
  referenceDate: '2027-03-04',
};

// ─── 1. Interpreter Determinism (20 runs) ────────────────────────────

describe('Determinism — Interpreter Pipeline (20 runs)', () => {
  const scenarios = [
    {
      name: 'simple_need_coverage',
      raw: makeRaw(),
      prev: emptyAssignments,
      curr: emptyAssignments,
    },
    {
      name: 'short_disruption_auto_overlay',
      raw: makeRaw({
        disruptionEventId: 'evt-1',
        disruptionEventType: DisruptionEventType.CHILD_SICK,
        disruptionDurationHours: 24,
        hasPreConsent: true,
      }),
      prev: emptyAssignments,
      curr: emptyAssignments,
    },
    {
      name: 'long_disruption_propose',
      raw: makeRaw({
        disruptionEventId: 'evt-2',
        disruptionEventType: DisruptionEventType.PARENT_TRAVEL,
        disruptionDurationHours: 120,
      }),
      prev: emptyAssignments,
      curr: emptyAssignments,
    },
    {
      name: 'bonus_week_regenerate',
      raw: makeRaw({
        requestType: RequestType.BONUS_WEEK,
        dates: Array.from({ length: 7 }, (_, i) => {
          const d = new Date('2027-04-07');
          d.setDate(d.getDate() + i);
          return d.toISOString().slice(0, 10);
        }),
      }),
      prev: emptyAssignments,
      curr: emptyAssignments,
    },
    {
      name: 'budget_exceeded_regenerate',
      raw: makeRaw(),
      prev: Array.from({ length: 10 }, (_, i) => {
        const d = new Date('2027-03-05');
        d.setDate(d.getDate() + i);
        return { date: d.toISOString().slice(0, 10), assignedTo: 'parent_a' };
      }),
      curr: Array.from({ length: 10 }, (_, i) => {
        const d = new Date('2027-03-05');
        d.setDate(d.getDate() + i);
        return { date: d.toISOString().slice(0, 10), assignedTo: 'parent_b' };
      }),
      refDate: '2027-03-28',
    },
  ];

  for (const scenario of scenarios) {
    it(`${scenario.name}: 20 runs produce identical output`, () => {
      const hashes: string[] = [];

      for (let run = 0; run < 20; run++) {
        const result = interpretChangeRequest({
          rawRequest: scenario.raw,
          previousAssignments: scenario.prev,
          currentAssignments: scenario.curr,
          referenceDate: (scenario as any).refDate,
        });

        // Hash the deterministic fields (exclude solve timing)
        const deterministicFields = {
          canonical: result.canonical,
          validationErrors: result.validationErrors,
          isValid: result.isValid,
          applyMode: result.applyMode,
          stabilityBudget: result.stabilityBudget,
          consentSatisfied: result.consentSatisfied,
          reasons: result.reasons,
          overlayLockDates: result.overlayLockDates,
          computedEffectiveDate: result.computedEffectiveDate,
        };
        hashes.push(hashObj(deterministicFields));
      }

      // All 20 hashes must be identical
      const unique = new Set(hashes);
      expect(unique.size).toBe(1);
    });
  }
});

// ─── 2. LLM Pattern Provider Determinism (20 runs) ──────────────────

describe('Determinism — LLM Pattern Provider (20 runs)', () => {
  const inputs = [
    'I need coverage for 2027-03-15 and 2027-03-16',
    'Can we swap 2027-03-22 for 2027-03-29?',
    'The kids are sick with fever tomorrow',
    'I am traveling next Monday',
    'I would like to have the kids this weekend',
    'March 15th trip with the family',
    'What would happen if we changed things around?',
    'bonus week starting 2027-04-07',
  ];

  for (const input of inputs) {
    it(`"${input.slice(0, 40)}...": 20 runs identical`, async () => {
      const hashes: string[] = [];
      for (let run = 0; run < 20; run++) {
        const result = await provider.interpret(input, llmCtx);
        hashes.push(hashObj(result));
      }
      const unique = new Set(hashes);
      expect(unique.size).toBe(1);
    });
  }
});

// ─── 3. Disruption Mapping Determinism (20 runs) ────────────────────

describe('Determinism — Disruption Overlay (20 runs)', () => {
  const baseAssignments: CurrentAssignment[] = Array.from({ length: 14 }, (_, i) => {
    const d = new Date('2027-03-01');
    d.setDate(d.getDate() + i);
    return {
      date: d.toISOString().slice(0, 10),
      assignedTo: i % 2 === 0 ? 'parent_a' : 'parent_b',
    };
  });

  function makeEvent(type: DisruptionEventType): DisruptionEvent {
    return {
      id: `evt-det-${type}`,
      familyId: 'fam-det',
      type,
      scope: DisruptionScope.HOUSEHOLD,
      source: DisruptionSource.USER_DECLARED,
      overrideStrength: OverrideStrength.SOFT,
      startDate: '2027-03-05',
      endDate: '2027-03-07',
      metadata: {},
      reportedBy: 'parent_a',
      resolvedAt: null,
    };
  }

  function makePolicy(action: OverlayActionType): ResolvedPolicy {
    return {
      actionType: action,
      strength: OverrideStrength.SOFT,
      source: PolicySource.GLOBAL_DEFAULT,
      policyId: null,
      description: 'determinism test policy',
    };
  }

  const eventTypes: Array<{ type: DisruptionEventType; action: OverlayActionType; name: string }> = [
    { type: DisruptionEventType.CHILD_SICK, action: OverlayActionType.BLOCK_ASSIGNMENT, name: 'CHILD_SICK' },
    { type: DisruptionEventType.PARENT_TRAVEL, action: OverlayActionType.BLOCK_ASSIGNMENT, name: 'PARENT_TRAVEL' },
    { type: DisruptionEventType.SCHOOL_CLOSED, action: OverlayActionType.LOGISTICS_FALLBACK, name: 'SCHOOL_CLOSED' },
    { type: DisruptionEventType.EMERGENCY_CLOSURE, action: OverlayActionType.REQUIRE_PROPOSAL, name: 'EMERGENCY_CLOSURE' },
  ];

  for (const { type, action, name } of eventTypes) {
    it(`${name}: 20 runs produce identical overlay`, () => {
      const event = makeEvent(type);
      const policy = makePolicy(action);

      const hashes: string[] = [];
      for (let run = 0; run < 20; run++) {
        const result = computeOverlay(event, policy, baseAssignments);
        hashes.push(hashObj(result));
      }
      const unique = new Set(hashes);
      expect(unique.size).toBe(1);
    });
  }
});

// ─── 4. Explanation Field Determinism (via Interpreter, 10 runs) ─────

describe('Determinism — Explanation Fields (10 runs)', () => {
  it('interpreter reasons array identical across 10 runs', () => {
    const hashes: string[] = [];
    for (let run = 0; run < 10; run++) {
      const result = interpretChangeRequest({
        rawRequest: makeRaw({ isEmergency: true }),
        previousAssignments: emptyAssignments,
        currentAssignments: emptyAssignments,
      });
      hashes.push(hashObj({
        reasons: result.reasons,
        consentSatisfied: result.consentSatisfied,
        applyMode: result.applyMode,
      }));
    }
    expect(new Set(hashes).size).toBe(1);
  });
});
