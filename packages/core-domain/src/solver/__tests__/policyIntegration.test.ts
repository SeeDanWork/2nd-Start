import { describe, it, expect } from 'vitest';
import { buildSolverInput } from '../core/SolverInputBuilder';
import { evaluateCandidatePolicies } from '../core/SolverPolicyCoordinator';
import { createDefaultRegistry } from '../../policy/registry/createDefaultRegistry';
import { makeSolverInput, makeWindow, PARENT_A, PARENT_B, CHILD_1, CHILD_2 } from './helpers';
import { CandidateNight, CandidateExchange } from '../types';
import { PolicyRuleType } from '../../enums/PolicyRuleType';
import { PolicyPriority } from '../../enums/PolicyPriority';
import { TypedPolicyRule } from '../../policy/types/TypedPolicyRule';

const registry = createDefaultRegistry();

function makePolicy(overrides: Partial<TypedPolicyRule> & { ruleType: PolicyRuleType; parameters: any }): TypedPolicyRule {
  return {
    id: overrides.id ?? 'policy-1',
    familyId: overrides.familyId ?? 'family-1',
    ruleType: overrides.ruleType,
    priority: overrides.priority ?? PolicyPriority.HARD,
    active: overrides.active ?? true,
    scope: overrides.scope ?? { scopeType: 'FAMILY' },
    parameters: overrides.parameters,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  };
}

describe('SolverPolicyCoordinator', () => {
  it('HARD violations reject candidate', () => {
    const policy = makePolicy({
      ruleType: PolicyRuleType.SIBLING_COHESION,
      priority: PolicyPriority.HARD,
      parameters: { allowDivergence: false },
    });
    const input = makeSolverInput({
      window: makeWindow('2026-03-02', '2026-03-02'),
      activePolicies: [policy],
    });
    const normalized = buildSolverInput(input);

    const nights: CandidateNight[] = [
      { date: '2026-03-02', childId: CHILD_1, parentId: PARENT_A },
      { date: '2026-03-02', childId: CHILD_2, parentId: PARENT_B },
    ];
    const result = evaluateCandidatePolicies(nights, [], normalized, registry);
    expect(result.isFeasible).toBe(false);
    expect(result.evaluation.hardViolations.length).toBeGreaterThan(0);
  });

  it('STRONG violations add penalties but remain feasible', () => {
    const policy = makePolicy({
      ruleType: PolicyRuleType.SIBLING_COHESION,
      priority: PolicyPriority.STRONG,
      parameters: { allowDivergence: false },
    });
    const input = makeSolverInput({
      window: makeWindow('2026-03-02', '2026-03-02'),
      activePolicies: [policy],
    });
    const normalized = buildSolverInput(input);

    const nights: CandidateNight[] = [
      { date: '2026-03-02', childId: CHILD_1, parentId: PARENT_A },
      { date: '2026-03-02', childId: CHILD_2, parentId: PARENT_B },
    ];
    const result = evaluateCandidatePolicies(nights, [], normalized, registry);
    expect(result.isFeasible).toBe(true);
    expect(result.penaltyScore).toBeGreaterThan(0);
    expect(result.evaluation.strongViolations.length).toBeGreaterThan(0);
  });

  it('SOFT guidance is preserved in output', () => {
    const policy = makePolicy({
      ruleType: PolicyRuleType.TRAVEL_DISTANCE_LIMIT,
      priority: PolicyPriority.SOFT,
      parameters: { maxMinutes: 30 },
    });
    const input = makeSolverInput({
      window: makeWindow('2026-03-02', '2026-03-02'),
      activePolicies: [policy],
    });
    const normalized = buildSolverInput(input);

    const nights: CandidateNight[] = [
      { date: '2026-03-02', childId: CHILD_1, parentId: PARENT_A },
    ];
    const exchanges: CandidateExchange[] = [
      { date: '2026-03-02', childId: CHILD_1, fromParentId: PARENT_B, toParentId: PARENT_A, time: null, location: null },
    ];
    const result = evaluateCandidatePolicies(nights, exchanges, normalized, registry);
    expect(result.isFeasible).toBe(true);
    expect(result.evaluation.guidance.length).toBeGreaterThan(0);
  });
});
