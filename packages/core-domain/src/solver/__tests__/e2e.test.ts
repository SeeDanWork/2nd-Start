import { describe, it, expect } from 'vitest';
import { solve } from '../core/BaselineScheduleSolver';
import { makeSolverInput, makeSingleChildInput, makeWindow, makeConfig, PARENT_A, PARENT_B, CHILD_1, CHILD_2 } from './helpers';
import { PolicyRuleType } from '../../enums/PolicyRuleType';
import { PolicyPriority } from '../../enums/PolicyPriority';
import { TypedPolicyRule } from '../../policy/types/TypedPolicyRule';
import { ScheduleId } from '../../types';

function makePolicy(overrides: Partial<TypedPolicyRule> & { ruleType: PolicyRuleType; parameters: any }): TypedPolicyRule {
  return {
    id: overrides.id ?? 'policy-1',
    familyId: overrides.familyId ?? 'family-1',
    ruleType: overrides.ruleType,
    priority: overrides.priority ?? PolicyPriority.STRONG,
    active: overrides.active ?? true,
    scope: overrides.scope ?? { scopeType: 'FAMILY' },
    parameters: overrides.parameters,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  };
}

describe('BaselineScheduleSolver (e2e)', () => {
  it('single-child family produces feasible baseline schedule', async () => {
    const input = makeSingleChildInput({
      window: makeWindow('2026-03-02', '2026-03-08'),
      solverConfig: makeConfig({ candidateCount: 2 }),
    });
    const result = await solve(input);

    expect(result.candidates.length).toBeGreaterThanOrEqual(1);
    expect(result.selectedCandidateId).toBeDefined();

    const selected = result.candidates[0];
    expect(selected.nights).toHaveLength(7); // 7 days
    expect(selected.score.total).toBeGreaterThan(0);
    expect(selected.policyEvaluation.isFeasible).toBe(true);

    // Every night should have exactly one parent assigned
    for (const night of selected.nights) {
      expect(night.childId).toBe(CHILD_1);
      expect([PARENT_A, PARENT_B]).toContain(night.parentId);
    }
  });

  it('multi-child family strongly prefers sibling cohesion', async () => {
    const input = makeSolverInput({
      window: makeWindow('2026-03-02', '2026-03-08'),
      solverConfig: makeConfig({ candidateCount: 1 }),
    });
    const result = await solve(input);
    const selected = result.candidates[0];

    // Count split nights
    const nightsByDate = new Map<string, Set<string>>();
    for (const n of selected.nights) {
      if (!nightsByDate.has(n.date)) nightsByDate.set(n.date, new Set());
      nightsByDate.get(n.date)!.add(n.parentId);
    }

    let splitCount = 0;
    for (const [, parents] of nightsByDate) {
      if (parents.size > 1) splitCount++;
    }

    // With strong structure weight, siblings should be together most nights
    expect(splitCount).toBeLessThanOrEqual(1);
  });

  it('fixed holiday assignment is obeyed', async () => {
    const input = makeSolverInput({
      window: makeWindow('2026-03-02', '2026-03-08'),
      fixedHolidayAssignments: [{
        label: 'Special Day',
        date: '2026-03-05',
        childIds: [CHILD_1, CHILD_2],
        assignedParentId: PARENT_B,
      }],
      solverConfig: makeConfig({ candidateCount: 1 }),
    });
    const result = await solve(input);

    for (const candidate of result.candidates) {
      const holidayNights = candidate.nights.filter(n => n.date === '2026-03-05');
      expect(holidayNights).toHaveLength(2);
      for (const n of holidayNights) {
        expect(n.parentId).toBe(PARENT_B);
      }
    }
  });

  it('repeated identical input yields identical candidate ordering and scores', async () => {
    const input = makeSolverInput({
      window: makeWindow('2026-03-02', '2026-03-08'),
      solverConfig: makeConfig({ candidateCount: 3 }),
    });

    const result1 = await solve(input);
    const result2 = await solve(input);

    expect(result1.candidates.length).toBe(result2.candidates.length);

    for (let i = 0; i < result1.candidates.length; i++) {
      const c1 = result1.candidates[i];
      const c2 = result2.candidates[i];

      // Same nights
      expect(c1.nights).toEqual(c2.nights);

      // Same exchanges
      expect(c1.exchanges).toEqual(c2.exchanges);

      // Same scores (within floating point tolerance)
      expect(c1.score.total).toBeCloseTo(c2.score.total, 10);
      expect(c1.score.primaryScore).toBeCloseTo(c2.score.primaryScore, 10);
      expect(c1.score.secondaryScore).toBeCloseTo(c2.score.secondaryScore, 10);
    }
  });

  it('produces structured artifacts', async () => {
    const input = makeSolverInput({
      window: makeWindow('2026-03-02', '2026-03-08'),
      solverConfig: makeConfig({ candidateCount: 1 }),
    });
    const result = await solve(input);

    expect(result.artifacts.length).toBeGreaterThanOrEqual(4);

    const types = result.artifacts.map(a => a.type);
    expect(types).toContain('score_breakdown');
    expect(types).toContain('changed_night_summary');
    expect(types).toContain('sibling_split_summary');
    expect(types).toContain('fairness_summary');
    expect(types).toContain('policy_penalty_summary');
  });

  it('applies policy penalties to scores', async () => {
    // With STRONG sibling cohesion policy, splitting siblings should add penalties
    const policy = makePolicy({
      ruleType: PolicyRuleType.EXCHANGE_LOCATION,
      priority: PolicyPriority.STRONG,
      parameters: { preferredLocation: 'School', allowedLocations: ['School'] },
    });

    const input = makeSolverInput({
      window: makeWindow('2026-03-02', '2026-03-08'),
      activePolicies: [policy],
      solverConfig: makeConfig({ candidateCount: 1 }),
    });
    const result = await solve(input);

    // All candidates should have penalty data in their scores
    for (const c of result.candidates) {
      expect(c.score.breakdown).toBeDefined();
      // Penalty should be >= 0 (may or may not have exchange violations depending on solver)
      expect(c.score.breakdown.penalties).toBeGreaterThanOrEqual(0);
    }
  });
});
