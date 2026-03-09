import { describe, it, expect } from 'vitest';
import { PolicyRuleType } from '../../enums/PolicyRuleType';
import { PolicyPriority } from '../../enums/PolicyPriority';
import { validateRuleDefinition, validateRuleParameters } from '../validation';
import { makeRule } from './helpers';
import {
  SiblingCohesionParameters,
  MinBlockLengthParameters,
  SchoolNightRoutineParameters,
  ExchangeLocationParameters,
} from '../types/parameters';

describe('PolicyValidationService', () => {
  describe('validateRuleDefinition', () => {
    it('accepts a valid FAMILY-scoped rule', () => {
      const rule = makeRule<SiblingCohesionParameters>({
        ruleType: PolicyRuleType.SIBLING_COHESION,
        parameters: { allowDivergence: false },
      });
      expect(() => validateRuleDefinition(rule)).not.toThrow();
    });

    it('accepts a valid CHILD-scoped rule', () => {
      const rule = makeRule<MinBlockLengthParameters>({
        ruleType: PolicyRuleType.MIN_BLOCK_LENGTH,
        scope: { scopeType: 'CHILD', childId: 'child-1' },
        parameters: { nights: 2 },
      });
      expect(() => validateRuleDefinition(rule)).not.toThrow();
    });

    it('accepts a valid DATE_RANGE-scoped rule', () => {
      const rule = makeRule<MinBlockLengthParameters>({
        ruleType: PolicyRuleType.MIN_BLOCK_LENGTH,
        scope: { scopeType: 'DATE_RANGE', dateStart: '2026-03-01', dateEnd: '2026-03-14' },
        parameters: { nights: 2 },
      });
      expect(() => validateRuleDefinition(rule)).not.toThrow();
    });

    it('accepts a valid CHILD_DATE_RANGE-scoped rule', () => {
      const rule = makeRule<MinBlockLengthParameters>({
        ruleType: PolicyRuleType.MIN_BLOCK_LENGTH,
        scope: { scopeType: 'CHILD_DATE_RANGE', childId: 'child-1', dateStart: '2026-03-01', dateEnd: '2026-03-14' },
        parameters: { nights: 2 },
      });
      expect(() => validateRuleDefinition(rule)).not.toThrow();
    });

    it('rejects CHILD scope without childId', () => {
      const rule = makeRule<MinBlockLengthParameters>({
        ruleType: PolicyRuleType.MIN_BLOCK_LENGTH,
        scope: { scopeType: 'CHILD' },
        parameters: { nights: 2 },
      });
      expect(() => validateRuleDefinition(rule)).toThrow('requires a childId');
    });

    it('rejects DATE_RANGE scope without dates', () => {
      const rule = makeRule<MinBlockLengthParameters>({
        ruleType: PolicyRuleType.MIN_BLOCK_LENGTH,
        scope: { scopeType: 'DATE_RANGE' },
        parameters: { nights: 2 },
      });
      expect(() => validateRuleDefinition(rule)).toThrow('requires dateStart and dateEnd');
    });

    it('rejects DATE_RANGE scope with dateStart > dateEnd', () => {
      const rule = makeRule<MinBlockLengthParameters>({
        ruleType: PolicyRuleType.MIN_BLOCK_LENGTH,
        scope: { scopeType: 'DATE_RANGE', dateStart: '2026-03-15', dateEnd: '2026-03-01' },
        parameters: { nights: 2 },
      });
      expect(() => validateRuleDefinition(rule)).toThrow('dateStart must be <= dateEnd');
    });
  });

  describe('validateRuleParameters', () => {
    it('validates SiblingCohesion parameters', () => {
      const result = validateRuleParameters(PolicyRuleType.SIBLING_COHESION, { allowDivergence: true, maxSplitNights: 3 });
      expect(result).toEqual({ allowDivergence: true, maxSplitNights: 3 });
    });

    it('validates MinBlockLength parameters', () => {
      const result = validateRuleParameters(PolicyRuleType.MIN_BLOCK_LENGTH, { nights: 2 });
      expect(result).toEqual({ nights: 2 });
    });

    it('validates SchoolNightRoutine parameters', () => {
      const result = validateRuleParameters(PolicyRuleType.SCHOOL_NIGHT_ROUTINE, { maxWeekdayTransitions: 1 });
      expect(result).toEqual({ maxWeekdayTransitions: 1 });
    });

    it('validates ExchangeLocation parameters', () => {
      const result = validateRuleParameters(PolicyRuleType.EXCHANGE_LOCATION, { preferredLocation: 'School', allowedLocations: ['School', 'Home'] });
      expect(result).toEqual({ preferredLocation: 'School', allowedLocations: ['School', 'Home'] });
    });

    it('rejects invalid parameters', () => {
      expect(() => validateRuleParameters(PolicyRuleType.MIN_BLOCK_LENGTH, { nights: -1 })).toThrow('positive integer');
    });

    it('rejects non-object parameters', () => {
      expect(() => validateRuleParameters(PolicyRuleType.MIN_BLOCK_LENGTH, 'not-an-object')).toThrow('non-null object');
    });
  });
});
