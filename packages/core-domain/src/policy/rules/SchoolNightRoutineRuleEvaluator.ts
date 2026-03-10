import { DateTime } from 'luxon';
import { PolicyRuleType } from '../../enums/PolicyRuleType';
import { PolicyRuleEvaluator } from '../registry/PolicyRegistry';
import { SchoolNightRoutineParameters } from '../types/parameters';
import { PolicyRuleEvaluationInput, PolicyRuleEvaluationOutput, PolicyViolation, PolicyImpactRecord } from '../types/evaluation';
import { validateSchoolNightRoutineParameters } from '../types/schemas';

/** Default protected weekdays: Mon-Thu (1-4). Sun-Thu nights precede school days. */
const DEFAULT_PROTECTED_WEEKDAYS = [1, 2, 3, 4];

export class SchoolNightRoutineRuleEvaluator implements PolicyRuleEvaluator<SchoolNightRoutineParameters> {
  supports(ruleType: PolicyRuleType): boolean {
    return ruleType === PolicyRuleType.SCHOOL_NIGHT_ROUTINE;
  }

  validateParameters(input: unknown): SchoolNightRoutineParameters {
    return validateSchoolNightRoutineParameters(input);
  }

  evaluate(input: PolicyRuleEvaluationInput<SchoolNightRoutineParameters>): PolicyRuleEvaluationOutput {
    const { rule, schedule } = input;
    const params = rule.parameters;
    const protectedDays = new Set(params.protectedWeekdays ?? DEFAULT_PROTECTED_WEEKDAYS);
    const violations: PolicyViolation[] = [];
    const impacts: PolicyImpactRecord[] = [];

    // Group nights by child, sorted by date
    const childNights = new Map<string, { date: string; parentId: string }[]>();
    for (const night of schedule.nights) {
      if (!childNights.has(night.childId)) {
        childNights.set(night.childId, []);
      }
      childNights.get(night.childId)!.push({ date: night.date, parentId: night.parentId });
    }

    const sortedChildIds = [...childNights.keys()].sort();

    for (const childId of sortedChildIds) {
      const nights = childNights.get(childId)!;
      nights.sort((a, b) => a.date.localeCompare(b.date));

      // Count weekday transitions (parent changes on protected weekdays)
      let weekdayTransitions = 0;
      for (let i = 1; i < nights.length; i++) {
        if (nights[i].parentId !== nights[i - 1].parentId) {
          const dt = DateTime.fromISO(nights[i].date);
          // Luxon weekday: 1=Mon..7=Sun
          if (protectedDays.has(dt.weekday)) {
            weekdayTransitions++;
          }
        }
      }

      if (weekdayTransitions > params.maxWeekdayTransitions) {
        const v: PolicyViolation = {
          ruleId: rule.id,
          ruleType: rule.ruleType,
          priority: rule.priority,
          childId,
          code: 'EXCESSIVE_WEEKDAY_TRANSITIONS',
          message: `${weekdayTransitions} weekday transitions for child ${childId} exceeds max ${params.maxWeekdayTransitions}`,
          data: { weekdayTransitions, maxWeekdayTransitions: params.maxWeekdayTransitions },
        };
        violations.push(v);
        impacts.push({
          ruleId: rule.id, ruleType: rule.ruleType, priority: rule.priority,
          impactType: 'VIOLATION', childId, message: v.message, data: v.data,
        });
      }
    }

    return { violations, penalties: [], guidance: [], impacts };
  }
}
