import { describe, it, expect } from 'vitest';
import { PolicyRuleType } from '../../enums/PolicyRuleType';
import { PolicyPriority } from '../../enums/PolicyPriority';
import { evaluatePolicies } from '../evaluation/PolicyEvaluationEngine';
import { createDefaultRegistry } from '../registry/createDefaultRegistry';
import { makeRule, makeContext, makeSchedule, makeNight, makeExchange, PARENT_A, PARENT_B, CHILD_1, CHILD_2 } from './helpers';

const registry = createDefaultRegistry();

describe('PolicyEvaluationEngine', () => {
  it('returns isFeasible=true when no HARD violations', () => {
    const rules = [
      makeRule({
        ruleType: PolicyRuleType.MIN_BLOCK_LENGTH,
        priority: PolicyPriority.STRONG,
        parameters: { nights: 2 },
      }),
    ];
    const schedule = makeSchedule({
      nights: [
        makeNight('2026-03-01', CHILD_1, PARENT_A),
        makeNight('2026-03-02', CHILD_1, PARENT_B),
      ],
    });
    const result = evaluatePolicies(rules, schedule, makeContext(), registry);
    expect(result.isFeasible).toBe(true);
    // Strong violation present
    expect(result.strongViolations.length).toBeGreaterThan(0);
    expect(result.hardViolations).toHaveLength(0);
  });

  it('returns isFeasible=false when HARD violations exist', () => {
    const rules = [
      makeRule({
        ruleType: PolicyRuleType.SIBLING_COHESION,
        priority: PolicyPriority.HARD,
        parameters: { allowDivergence: false },
      }),
    ];
    const schedule = makeSchedule({
      nights: [
        makeNight('2026-03-01', CHILD_1, PARENT_A),
        makeNight('2026-03-01', CHILD_2, PARENT_B),
      ],
    });
    const result = evaluatePolicies(rules, schedule, makeContext(), registry);
    expect(result.isFeasible).toBe(false);
    expect(result.hardViolations.length).toBeGreaterThan(0);
  });

  it('sorts SOFT violations separately', () => {
    const rules = [
      makeRule({
        id: 'r1',
        ruleType: PolicyRuleType.MIN_BLOCK_LENGTH,
        priority: PolicyPriority.SOFT,
        parameters: { nights: 2 },
      }),
    ];
    const schedule = makeSchedule({
      nights: [
        makeNight('2026-03-01', CHILD_1, PARENT_A),
        makeNight('2026-03-02', CHILD_1, PARENT_B),
      ],
    });
    const result = evaluatePolicies(rules, schedule, makeContext(), registry);
    expect(result.softViolations.length).toBeGreaterThan(0);
    expect(result.hardViolations).toHaveLength(0);
    expect(result.strongViolations).toHaveLength(0);
  });

  it('skips inactive rules', () => {
    const rules = [
      makeRule({
        ruleType: PolicyRuleType.SIBLING_COHESION,
        priority: PolicyPriority.HARD,
        active: false,
        parameters: { allowDivergence: false },
      }),
    ];
    const schedule = makeSchedule({
      nights: [
        makeNight('2026-03-01', CHILD_1, PARENT_A),
        makeNight('2026-03-01', CHILD_2, PARENT_B),
      ],
    });
    const result = evaluatePolicies(rules, schedule, makeContext(), registry);
    expect(result.isFeasible).toBe(true);
    expect(result.hardViolations).toHaveLength(0);
  });

  it('skips rules for different family', () => {
    const rules = [
      makeRule({
        ruleType: PolicyRuleType.SIBLING_COHESION,
        priority: PolicyPriority.HARD,
        familyId: 'other-family',
        parameters: { allowDivergence: false },
      }),
    ];
    const schedule = makeSchedule({
      nights: [
        makeNight('2026-03-01', CHILD_1, PARENT_A),
        makeNight('2026-03-01', CHILD_2, PARENT_B),
      ],
    });
    const result = evaluatePolicies(rules, schedule, makeContext(), registry);
    expect(result.isFeasible).toBe(true);
  });

  it('evaluates multiple rules and aggregates results', () => {
    const rules = [
      makeRule({
        id: 'r1',
        ruleType: PolicyRuleType.SIBLING_COHESION,
        priority: PolicyPriority.HARD,
        parameters: { allowDivergence: false },
      }),
      makeRule({
        id: 'r2',
        ruleType: PolicyRuleType.EXCHANGE_LOCATION,
        priority: PolicyPriority.STRONG,
        parameters: { preferredLocation: 'School', allowedLocations: ['School'] },
      }),
    ];
    const schedule = makeSchedule({
      nights: [
        makeNight('2026-03-01', CHILD_1, PARENT_A),
        makeNight('2026-03-01', CHILD_2, PARENT_B),
      ],
      exchanges: [
        makeExchange('2026-03-01', CHILD_1, PARENT_A, PARENT_B, '18:00', 'Parking Lot'),
      ],
    });
    const result = evaluatePolicies(rules, schedule, makeContext(), registry);
    expect(result.isFeasible).toBe(false);
    expect(result.hardViolations.length).toBeGreaterThan(0);
    expect(result.strongViolations.length).toBeGreaterThan(0);
    expect(result.impacts.length).toBeGreaterThan(1);
  });

  it('collects penalties from exchange location evaluator', () => {
    const rules = [
      makeRule({
        ruleType: PolicyRuleType.EXCHANGE_LOCATION,
        priority: PolicyPriority.SOFT,
        parameters: { preferredLocation: 'School', allowedLocations: ['School', 'Library'] },
      }),
    ];
    const schedule = makeSchedule({
      exchanges: [
        makeExchange('2026-03-01', CHILD_1, PARENT_A, PARENT_B, '18:00', 'Library'),
      ],
    });
    const result = evaluatePolicies(rules, schedule, makeContext(), registry);
    expect(result.penalties).toHaveLength(1);
    expect(result.penalties[0].scoreImpact).toBe(-5);
  });

  it('collects guidance from travel distance evaluator', () => {
    const rules = [
      makeRule({
        ruleType: PolicyRuleType.TRAVEL_DISTANCE_LIMIT,
        priority: PolicyPriority.SOFT,
        parameters: { maxMinutes: 30 },
      }),
    ];
    const schedule = makeSchedule({
      exchanges: [
        makeExchange('2026-03-01', CHILD_1, PARENT_A, PARENT_B),
      ],
    });
    const result = evaluatePolicies(rules, schedule, makeContext(), registry);
    expect(result.guidance).toHaveLength(1);
  });

  it('returns empty results for no rules', () => {
    const result = evaluatePolicies([], makeSchedule(), makeContext(), registry);
    expect(result.isFeasible).toBe(true);
    expect(result.hardViolations).toHaveLength(0);
    expect(result.penalties).toHaveLength(0);
    expect(result.guidance).toHaveLength(0);
    expect(result.impacts).toHaveLength(0);
  });
});
