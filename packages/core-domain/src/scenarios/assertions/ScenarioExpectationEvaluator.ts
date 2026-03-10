import {
  ScenarioAssertionResult,
  ScenarioExpectation,
  ScenarioExecutionContext,
  ScenarioFixture,
  ActiveScheduleExpectation,
  ProposalCountExpectation,
  FairnessLedgerExpectation,
  OverlayResolutionExpectation,
  PolicyExpectation,
  CalendarClassificationExpectation,
  ExplanationExpectation,
} from '../types';
import { ScenarioNameResolver } from '../core/ScenarioNameResolver';

const resolver = new ScenarioNameResolver();

/**
 * Evaluates individual expectations against execution context.
 */
export class ScenarioExpectationEvaluator {
  evaluate(
    expectation: ScenarioExpectation,
    context: ScenarioExecutionContext,
    fixture: ScenarioFixture,
  ): ScenarioAssertionResult {
    switch (expectation.type) {
      case 'ACTIVE_SCHEDULE':
        return this.evaluateActiveSchedule(expectation, context, fixture);
      case 'PROPOSAL_COUNT':
        return this.evaluateProposalCount(expectation, context);
      case 'FAIRNESS_LEDGER':
        return this.evaluateFairnessLedger(expectation, context);
      case 'OVERLAY_RESOLUTION':
        return this.evaluateOverlayResolution(expectation, context);
      case 'POLICY_EVALUATION':
        return this.evaluatePolicy(expectation, context);
      case 'CALENDAR_CLASSIFICATION':
        return this.evaluateCalendarClassification(expectation, context);
      case 'EXPLANATION':
        return this.evaluateExplanation(expectation, context);
      case 'DETERMINISM':
        // Handled separately by DeterminismAssertionRunner
        return { expectationType: 'DETERMINISM', passed: true, message: 'Deferred to determinism runner' };
      default:
        return {
          expectationType: (expectation as any).type,
          passed: false,
          message: `Unknown expectation type: ${(expectation as any).type}`,
        };
    }
  }

  private evaluateActiveSchedule(
    exp: ActiveScheduleExpectation,
    context: ScenarioExecutionContext,
    fixture: ScenarioFixture,
  ): ScenarioAssertionResult {
    const failures: string[] = [];

    if (exp.versionNumber !== undefined && context.scheduleVersionNumber !== exp.versionNumber) {
      failures.push(`version: expected ${exp.versionNumber}, got ${context.scheduleVersionNumber}`);
    }

    if (exp.expectedAssignments) {
      for (const expected of exp.expectedAssignments) {
        const childId = context.childIdsByName[expected.childName];
        const parentId = context.parentIdsByName[expected.parentName];
        const actual = context.activeScheduleNights.find(
          n => n.date === expected.date && n.childId === childId,
        );

        if (!actual) {
          failures.push(`missing assignment: ${expected.date} ${expected.childName}`);
        } else if (actual.parentId !== parentId) {
          const actualParentName = Object.entries(context.parentIdsByName)
            .find(([, id]) => id === actual.parentId)?.[0] ?? actual.parentId;
          failures.push(
            `${expected.date} ${expected.childName}: expected ${expected.parentName}, got ${actualParentName}`,
          );
        }
      }
    }

    return {
      expectationType: 'ACTIVE_SCHEDULE',
      passed: failures.length === 0,
      message: failures.length === 0
        ? 'Active schedule matches expectations'
        : `Active schedule mismatches: ${failures.join('; ')}`,
      details: failures.length > 0 ? { failures } : undefined,
    };
  }

  private evaluateProposalCount(
    exp: ProposalCountExpectation,
    context: ScenarioExecutionContext,
  ): ScenarioAssertionResult {
    const pending = context.proposals.filter(p => p.status === 'PENDING').length;
    const accepted = context.proposals.filter(p => p.status === 'ACCEPTED').length;
    const rejected = context.proposals.filter(p => p.status === 'REJECTED').length;
    const invalidated = context.proposals.filter(p => p.status === 'INVALIDATED').length;

    const failures: string[] = [];
    if (pending !== exp.pending) failures.push(`pending: expected ${exp.pending}, got ${pending}`);
    if (exp.accepted !== undefined && accepted !== exp.accepted) failures.push(`accepted: expected ${exp.accepted}, got ${accepted}`);
    if (exp.rejected !== undefined && rejected !== exp.rejected) failures.push(`rejected: expected ${exp.rejected}, got ${rejected}`);
    if (exp.invalidated !== undefined && invalidated !== exp.invalidated) failures.push(`invalidated: expected ${exp.invalidated}, got ${invalidated}`);

    return {
      expectationType: 'PROPOSAL_COUNT',
      passed: failures.length === 0,
      message: failures.length === 0
        ? 'Proposal counts match'
        : `Proposal count mismatches: ${failures.join('; ')}`,
      details: { pending, accepted, rejected, invalidated },
    };
  }

  private evaluateFairnessLedger(
    exp: FairnessLedgerExpectation,
    context: ScenarioExecutionContext,
  ): ScenarioAssertionResult {
    const failures: string[] = [];

    for (const expected of exp.byParent) {
      const parentId = context.parentIdsByName[expected.parentName];
      if (!parentId) {
        failures.push(`Unknown parent: ${expected.parentName}`);
        continue;
      }
      const actual = context.fairnessLedger[parentId];
      if (!actual) {
        failures.push(`No ledger entry for ${expected.parentName}`);
        continue;
      }
      if (actual.nightDeviation !== expected.nightDeviation) {
        failures.push(`${expected.parentName} nightDeviation: expected ${expected.nightDeviation}, got ${actual.nightDeviation}`);
      }
      if (actual.weekendDeviation !== expected.weekendDeviation) {
        failures.push(`${expected.parentName} weekendDeviation: expected ${expected.weekendDeviation}, got ${actual.weekendDeviation}`);
      }
      if (actual.holidayDeviation !== expected.holidayDeviation) {
        failures.push(`${expected.parentName} holidayDeviation: expected ${expected.holidayDeviation}, got ${actual.holidayDeviation}`);
      }
    }

    return {
      expectationType: 'FAIRNESS_LEDGER',
      passed: failures.length === 0,
      message: failures.length === 0
        ? 'Fairness ledger matches'
        : `Fairness ledger mismatches: ${failures.join('; ')}`,
    };
  }

  private evaluateOverlayResolution(
    exp: OverlayResolutionExpectation,
    context: ScenarioExecutionContext,
  ): ScenarioAssertionResult {
    const passed = context.resolvedOverlayCount === exp.resolvedCount;
    return {
      expectationType: 'OVERLAY_RESOLUTION',
      passed,
      message: passed
        ? `Overlay resolution count matches: ${exp.resolvedCount}`
        : `Overlay resolution: expected ${exp.resolvedCount}, got ${context.resolvedOverlayCount}`,
    };
  }

  private evaluatePolicy(
    exp: PolicyExpectation,
    context: ScenarioExecutionContext,
  ): ScenarioAssertionResult {
    if (!context.latestPolicyEvaluation) {
      return {
        expectationType: 'POLICY_EVALUATION',
        passed: false,
        message: 'No policy evaluation was run',
      };
    }

    const failures: string[] = [];
    const pe = context.latestPolicyEvaluation;

    if (exp.hardViolationCount !== undefined && pe.hardViolationCount !== exp.hardViolationCount) {
      failures.push(`hard violations: expected ${exp.hardViolationCount}, got ${pe.hardViolationCount}`);
    }
    if (exp.strongViolationCount !== undefined && pe.strongViolationCount !== exp.strongViolationCount) {
      failures.push(`strong violations: expected ${exp.strongViolationCount}, got ${pe.strongViolationCount}`);
    }
    if (exp.softViolationCount !== undefined && pe.softViolationCount !== exp.softViolationCount) {
      failures.push(`soft violations: expected ${exp.softViolationCount}, got ${pe.softViolationCount}`);
    }

    return {
      expectationType: 'POLICY_EVALUATION',
      passed: failures.length === 0,
      message: failures.length === 0
        ? 'Policy evaluation matches'
        : `Policy evaluation mismatches: ${failures.join('; ')}`,
    };
  }

  private evaluateCalendarClassification(
    exp: CalendarClassificationExpectation,
    context: ScenarioExecutionContext,
  ): ScenarioAssertionResult {
    const failures: string[] = [];

    for (const expected of exp.expected) {
      const actual = context.calendarEvents.find(
        e => e.title.toLowerCase().includes(expected.title.toLowerCase()),
      );
      if (!actual) {
        failures.push(`Event not found: ${expected.title}`);
        continue;
      }
      if (actual.constraintLevel !== expected.constraintLevel) {
        failures.push(`${expected.title}: expected level ${expected.constraintLevel}, got ${actual.constraintLevel}`);
      }
      if (expected.kind && actual.kind !== expected.kind) {
        failures.push(`${expected.title}: expected kind ${expected.kind}, got ${actual.kind}`);
      }
    }

    return {
      expectationType: 'CALENDAR_CLASSIFICATION',
      passed: failures.length === 0,
      message: failures.length === 0
        ? 'Calendar classifications match'
        : `Calendar classification mismatches: ${failures.join('; ')}`,
    };
  }

  private evaluateExplanation(
    exp: ExplanationExpectation,
    context: ScenarioExecutionContext,
  ): ScenarioAssertionResult {
    const matching = context.explanationBundles.filter(
      b => b.targetType === exp.targetType,
    );

    if (matching.length === 0) {
      return {
        expectationType: 'EXPLANATION',
        passed: false,
        message: `No explanation bundle found for target type: ${exp.targetType}`,
      };
    }

    const bundle = matching[matching.length - 1]; // latest
    const failures: string[] = [];

    if (exp.minimumRecordCount !== undefined && bundle.recordCount < exp.minimumRecordCount) {
      failures.push(`record count: expected >= ${exp.minimumRecordCount}, got ${bundle.recordCount}`);
    }

    if (exp.requiredCodes) {
      for (const code of exp.requiredCodes) {
        if (!bundle.codes.includes(code)) {
          failures.push(`missing required code: ${code}`);
        }
      }
    }

    return {
      expectationType: 'EXPLANATION',
      passed: failures.length === 0,
      message: failures.length === 0
        ? 'Explanation expectations met'
        : `Explanation mismatches: ${failures.join('; ')}`,
      details: { actualCodes: bundle.codes, recordCount: bundle.recordCount },
    };
  }
}
