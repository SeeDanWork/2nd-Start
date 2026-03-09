import { describe, it, expect } from 'vitest';
import { PolicyRuleType } from '../../enums/PolicyRuleType';
import { PolicyPriority } from '../../enums/PolicyPriority';
import { isPolicyApplicable, doesPolicyScopeMatchDate, doesPolicyScopeMatchChild } from '../applicability';
import { makeRule, makeContext, FAMILY_ID } from './helpers';
import { MinBlockLengthParameters } from '../types/parameters';

const baseParams: MinBlockLengthParameters = { nights: 2 };

describe('PolicyApplicability', () => {
  describe('isPolicyApplicable', () => {
    it('returns false for inactive rules', () => {
      const rule = makeRule({ ruleType: PolicyRuleType.MIN_BLOCK_LENGTH, parameters: baseParams, active: false });
      expect(isPolicyApplicable(rule, makeContext())).toBe(false);
    });

    it('returns false for wrong family', () => {
      const rule = makeRule({ ruleType: PolicyRuleType.MIN_BLOCK_LENGTH, parameters: baseParams, familyId: 'other-family' });
      expect(isPolicyApplicable(rule, makeContext())).toBe(false);
    });

    it('returns true for FAMILY scope', () => {
      const rule = makeRule({ ruleType: PolicyRuleType.MIN_BLOCK_LENGTH, parameters: baseParams, scope: { scopeType: 'FAMILY' } });
      expect(isPolicyApplicable(rule, makeContext())).toBe(true);
    });

    it('returns true for CHILD scope (always applicable at schedule level)', () => {
      const rule = makeRule({ ruleType: PolicyRuleType.MIN_BLOCK_LENGTH, parameters: baseParams, scope: { scopeType: 'CHILD', childId: 'child-1' } });
      expect(isPolicyApplicable(rule, makeContext())).toBe(true);
    });

    it('returns true for DATE_RANGE that overlaps schedule', () => {
      const rule = makeRule({
        ruleType: PolicyRuleType.MIN_BLOCK_LENGTH,
        parameters: baseParams,
        scope: { scopeType: 'DATE_RANGE', dateStart: '2026-03-05', dateEnd: '2026-03-20' },
      });
      expect(isPolicyApplicable(rule, makeContext())).toBe(true);
    });

    it('returns false for DATE_RANGE that does not overlap schedule', () => {
      const rule = makeRule({
        ruleType: PolicyRuleType.MIN_BLOCK_LENGTH,
        parameters: baseParams,
        scope: { scopeType: 'DATE_RANGE', dateStart: '2026-04-01', dateEnd: '2026-04-14' },
      });
      expect(isPolicyApplicable(rule, makeContext())).toBe(false);
    });

    it('returns true for DATE_RANGE with missing bounds', () => {
      const rule = makeRule({
        ruleType: PolicyRuleType.MIN_BLOCK_LENGTH,
        parameters: baseParams,
        scope: { scopeType: 'DATE_RANGE' },
      });
      expect(isPolicyApplicable(rule, makeContext())).toBe(true);
    });
  });

  describe('doesPolicyScopeMatchDate', () => {
    it('FAMILY scope matches any date', () => {
      const rule = makeRule({ ruleType: PolicyRuleType.MIN_BLOCK_LENGTH, parameters: baseParams, scope: { scopeType: 'FAMILY' } });
      expect(doesPolicyScopeMatchDate(rule, '2026-05-01')).toBe(true);
    });

    it('DATE_RANGE scope matches date within range', () => {
      const rule = makeRule({
        ruleType: PolicyRuleType.MIN_BLOCK_LENGTH,
        parameters: baseParams,
        scope: { scopeType: 'DATE_RANGE', dateStart: '2026-03-01', dateEnd: '2026-03-14' },
      });
      expect(doesPolicyScopeMatchDate(rule, '2026-03-07')).toBe(true);
    });

    it('DATE_RANGE scope does not match date outside range', () => {
      const rule = makeRule({
        ruleType: PolicyRuleType.MIN_BLOCK_LENGTH,
        parameters: baseParams,
        scope: { scopeType: 'DATE_RANGE', dateStart: '2026-03-01', dateEnd: '2026-03-14' },
      });
      expect(doesPolicyScopeMatchDate(rule, '2026-03-20')).toBe(false);
    });
  });

  describe('doesPolicyScopeMatchChild', () => {
    it('FAMILY scope matches any child', () => {
      const rule = makeRule({ ruleType: PolicyRuleType.MIN_BLOCK_LENGTH, parameters: baseParams, scope: { scopeType: 'FAMILY' } });
      expect(doesPolicyScopeMatchChild(rule, 'any-child')).toBe(true);
    });

    it('CHILD scope matches the specified child', () => {
      const rule = makeRule({
        ruleType: PolicyRuleType.MIN_BLOCK_LENGTH,
        parameters: baseParams,
        scope: { scopeType: 'CHILD', childId: 'child-1' },
      });
      expect(doesPolicyScopeMatchChild(rule, 'child-1')).toBe(true);
    });

    it('CHILD scope does not match a different child', () => {
      const rule = makeRule({
        ruleType: PolicyRuleType.MIN_BLOCK_LENGTH,
        parameters: baseParams,
        scope: { scopeType: 'CHILD', childId: 'child-1' },
      });
      expect(doesPolicyScopeMatchChild(rule, 'child-2')).toBe(false);
    });
  });
});
