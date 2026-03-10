import { describe, it, expect } from 'vitest';
import { PolicyRuleType } from '../../enums/PolicyRuleType';
import { PolicyPriority } from '../../enums/PolicyPriority';
import { SiblingCohesionRuleEvaluator } from '../rules/SiblingCohesionRuleEvaluator';
import { MinBlockLengthRuleEvaluator } from '../rules/MinBlockLengthRuleEvaluator';
import { SchoolNightRoutineRuleEvaluator } from '../rules/SchoolNightRoutineRuleEvaluator';
import { ExchangeLocationRuleEvaluator } from '../rules/ExchangeLocationRuleEvaluator';
import { ActivityCommitmentRuleEvaluator } from '../rules/ActivityCommitmentRuleEvaluator';
import { TravelDistanceLimitRuleEvaluator } from '../rules/TravelDistanceLimitRuleEvaluator';
import { makeRule, makeContext, makeSchedule, makeNight, makeExchange, PARENT_A, PARENT_B, CHILD_1, CHILD_2 } from './helpers';

describe('SiblingCohesionRuleEvaluator', () => {
  const evaluator = new SiblingCohesionRuleEvaluator();

  it('detects sibling split nights', () => {
    const rule = makeRule({
      ruleType: PolicyRuleType.SIBLING_COHESION,
      parameters: { allowDivergence: false },
    });
    const schedule = makeSchedule({
      nights: [
        makeNight('2026-03-01', CHILD_1, PARENT_A),
        makeNight('2026-03-01', CHILD_2, PARENT_B),
      ],
    });
    const result = evaluator.evaluate({ rule, context: makeContext(), schedule });
    expect(result.violations.length).toBeGreaterThan(0);
    expect(result.violations[0].code).toBe('SIBLING_SPLIT');
  });

  it('no violations when siblings are together', () => {
    const rule = makeRule({
      ruleType: PolicyRuleType.SIBLING_COHESION,
      parameters: { allowDivergence: false },
    });
    const schedule = makeSchedule({
      nights: [
        makeNight('2026-03-01', CHILD_1, PARENT_A),
        makeNight('2026-03-01', CHILD_2, PARENT_A),
      ],
    });
    const result = evaluator.evaluate({ rule, context: makeContext(), schedule });
    expect(result.violations).toHaveLength(0);
  });

  it('respects allowDivergence with maxSplitNights', () => {
    const rule = makeRule({
      ruleType: PolicyRuleType.SIBLING_COHESION,
      parameters: { allowDivergence: true, maxSplitNights: 2 },
    });
    const schedule = makeSchedule({
      nights: [
        makeNight('2026-03-01', CHILD_1, PARENT_A),
        makeNight('2026-03-01', CHILD_2, PARENT_B),
      ],
    });
    const result = evaluator.evaluate({ rule, context: makeContext(), schedule });
    // 1 split night <= maxSplitNights of 2, so no violation
    expect(result.violations).toHaveLength(0);
  });
});

describe('MinBlockLengthRuleEvaluator', () => {
  const evaluator = new MinBlockLengthRuleEvaluator();

  it('detects blocks shorter than minimum', () => {
    const rule = makeRule({
      ruleType: PolicyRuleType.MIN_BLOCK_LENGTH,
      parameters: { nights: 2 },
    });
    // Single night with parent A, then switches to B
    const schedule = makeSchedule({
      nights: [
        makeNight('2026-03-01', CHILD_1, PARENT_A),
        makeNight('2026-03-02', CHILD_1, PARENT_B),
        makeNight('2026-03-03', CHILD_1, PARENT_B),
      ],
    });
    const result = evaluator.evaluate({ rule, context: makeContext(), schedule });
    expect(result.violations.length).toBeGreaterThan(0);
    expect(result.violations[0].code).toBe('SHORT_BLOCK');
  });

  it('no violations when all blocks meet minimum', () => {
    const rule = makeRule({
      ruleType: PolicyRuleType.MIN_BLOCK_LENGTH,
      parameters: { nights: 2 },
    });
    const schedule = makeSchedule({
      nights: [
        makeNight('2026-03-01', CHILD_1, PARENT_A),
        makeNight('2026-03-02', CHILD_1, PARENT_A),
        makeNight('2026-03-03', CHILD_1, PARENT_B),
        makeNight('2026-03-04', CHILD_1, PARENT_B),
      ],
    });
    const result = evaluator.evaluate({ rule, context: makeContext(), schedule });
    expect(result.violations).toHaveLength(0);
  });
});

describe('SchoolNightRoutineRuleEvaluator', () => {
  const evaluator = new SchoolNightRoutineRuleEvaluator();

  it('detects excessive weekday transitions', () => {
    const rule = makeRule({
      ruleType: PolicyRuleType.SCHOOL_NIGHT_ROUTINE,
      parameters: { maxWeekdayTransitions: 0 },
    });
    // 2026-03-02 is Monday, 2026-03-03 is Tuesday
    const schedule = makeSchedule({
      nights: [
        makeNight('2026-03-02', CHILD_1, PARENT_A),
        makeNight('2026-03-03', CHILD_1, PARENT_B),
      ],
    });
    const result = evaluator.evaluate({ rule, context: makeContext(), schedule });
    expect(result.violations.length).toBeGreaterThan(0);
    expect(result.violations[0].code).toBe('EXCESSIVE_WEEKDAY_TRANSITIONS');
  });

  it('no violations when within limit', () => {
    const rule = makeRule({
      ruleType: PolicyRuleType.SCHOOL_NIGHT_ROUTINE,
      parameters: { maxWeekdayTransitions: 1 },
    });
    // One weekday transition
    const schedule = makeSchedule({
      nights: [
        makeNight('2026-03-02', CHILD_1, PARENT_A),
        makeNight('2026-03-03', CHILD_1, PARENT_B),
      ],
    });
    const result = evaluator.evaluate({ rule, context: makeContext(), schedule });
    expect(result.violations).toHaveLength(0);
  });
});

describe('ExchangeLocationRuleEvaluator', () => {
  const evaluator = new ExchangeLocationRuleEvaluator();

  it('flags disallowed locations as violations', () => {
    const rule = makeRule({
      ruleType: PolicyRuleType.EXCHANGE_LOCATION,
      parameters: { preferredLocation: 'School', allowedLocations: ['School', 'Library'] },
    });
    const schedule = makeSchedule({
      exchanges: [makeExchange('2026-03-01', CHILD_1, PARENT_A, PARENT_B, '18:00', 'Parking Lot')],
    });
    const result = evaluator.evaluate({ rule, context: makeContext(), schedule });
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0].code).toBe('DISALLOWED_LOCATION');
  });

  it('flags non-preferred allowed locations as penalties', () => {
    const rule = makeRule({
      ruleType: PolicyRuleType.EXCHANGE_LOCATION,
      parameters: { preferredLocation: 'School', allowedLocations: ['School', 'Library'] },
    });
    const schedule = makeSchedule({
      exchanges: [makeExchange('2026-03-01', CHILD_1, PARENT_A, PARENT_B, '18:00', 'Library')],
    });
    const result = evaluator.evaluate({ rule, context: makeContext(), schedule });
    expect(result.violations).toHaveLength(0);
    expect(result.penalties).toHaveLength(1);
  });

  it('no issues when location matches preferred', () => {
    const rule = makeRule({
      ruleType: PolicyRuleType.EXCHANGE_LOCATION,
      parameters: { preferredLocation: 'School', allowedLocations: ['School'] },
    });
    const schedule = makeSchedule({
      exchanges: [makeExchange('2026-03-01', CHILD_1, PARENT_A, PARENT_B, '18:00', 'School')],
    });
    const result = evaluator.evaluate({ rule, context: makeContext(), schedule });
    expect(result.violations).toHaveLength(0);
    expect(result.penalties).toHaveLength(0);
  });
});

describe('ActivityCommitmentRuleEvaluator', () => {
  const evaluator = new ActivityCommitmentRuleEvaluator();

  it('detects wrong parent on activity date', () => {
    const rule = makeRule({
      ruleType: PolicyRuleType.ACTIVITY_COMMITMENT,
      parameters: {
        activityLabel: 'Soccer',
        preferredResponsibleParentId: PARENT_A,
        fixedDates: ['2026-03-05'],
      },
    });
    const schedule = makeSchedule({
      nights: [makeNight('2026-03-05', CHILD_1, PARENT_B)],
    });
    const result = evaluator.evaluate({ rule, context: makeContext(), schedule });
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0].code).toBe('ACTIVITY_PARENT_MISMATCH');
  });

  it('no violations when correct parent is assigned', () => {
    const rule = makeRule({
      ruleType: PolicyRuleType.ACTIVITY_COMMITMENT,
      parameters: {
        activityLabel: 'Soccer',
        preferredResponsibleParentId: PARENT_A,
        fixedDates: ['2026-03-05'],
      },
    });
    const schedule = makeSchedule({
      nights: [makeNight('2026-03-05', CHILD_1, PARENT_A)],
    });
    const result = evaluator.evaluate({ rule, context: makeContext(), schedule });
    expect(result.violations).toHaveLength(0);
  });
});

describe('TravelDistanceLimitRuleEvaluator', () => {
  const evaluator = new TravelDistanceLimitRuleEvaluator();

  it('emits guidance when exchanges exist', () => {
    const rule = makeRule({
      ruleType: PolicyRuleType.TRAVEL_DISTANCE_LIMIT,
      parameters: { maxMinutes: 30 },
    });
    const schedule = makeSchedule({
      exchanges: [makeExchange('2026-03-01', CHILD_1, PARENT_A, PARENT_B)],
    });
    const result = evaluator.evaluate({ rule, context: makeContext(), schedule });
    expect(result.guidance).toHaveLength(1);
    expect(result.violations).toHaveLength(0);
  });

  it('no guidance when no exchanges', () => {
    const rule = makeRule({
      ruleType: PolicyRuleType.TRAVEL_DISTANCE_LIMIT,
      parameters: { maxMinutes: 30 },
    });
    const schedule = makeSchedule({ exchanges: [] });
    const result = evaluator.evaluate({ rule, context: makeContext(), schedule });
    expect(result.guidance).toHaveLength(0);
  });
});
