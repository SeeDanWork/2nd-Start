import { ScenarioFixture } from '../types';
import { ScenarioFixtureValidationError } from '../errors';

/**
 * Validates a scenario fixture for structural correctness.
 */
export class ScenarioFixtureValidator {
  validateFixture(fixture: ScenarioFixture): void {
    if (!fixture.scenarioId || !fixture.label) {
      throw new ScenarioFixtureValidationError('scenarioId and label are required');
    }

    if (!fixture.seed || !fixture.seed.family || !fixture.seed.parents?.length) {
      throw new ScenarioFixtureValidationError('seed must include family and at least one parent');
    }

    // Validate unique step IDs
    const stepIds = new Set<string>();
    for (const step of fixture.steps) {
      if (stepIds.has(step.stepId)) {
        throw new ScenarioFixtureValidationError(
          `Duplicate step id: ${step.stepId}`,
        );
      }
      stepIds.add(step.stepId);
    }

    // Collect known parent and child names from seed
    const parentNames = new Set(fixture.seed.parents.map(p => p.name));
    const childNames = new Set((fixture.seed.children ?? []).map(c => c.name));

    // Validate parent/child references in initial schedule
    if (fixture.seed.initialSchedule) {
      for (const night of fixture.seed.initialSchedule.nights) {
        if (!childNames.has(night.childName)) {
          throw new ScenarioFixtureValidationError(
            `Unknown child name in initial schedule: ${night.childName}`,
          );
        }
        if (!parentNames.has(night.parentName)) {
          throw new ScenarioFixtureValidationError(
            `Unknown parent name in initial schedule: ${night.parentName}`,
          );
        }
      }

      // Check duplicate assignments (same child + date)
      const assignmentKeys = new Set<string>();
      for (const night of fixture.seed.initialSchedule.nights) {
        const key = `${night.date}:${night.childName}`;
        if (assignmentKeys.has(key)) {
          throw new ScenarioFixtureValidationError(
            `Duplicate assignment in initial schedule: ${key}`,
          );
        }
        assignmentKeys.add(key);
      }
    }

    // Validate fairness ledger parent references
    if (fixture.seed.fairnessLedger) {
      for (const entry of fixture.seed.fairnessLedger) {
        if (!parentNames.has(entry.parentName)) {
          throw new ScenarioFixtureValidationError(
            `Unknown parent name in fairness ledger: ${entry.parentName}`,
          );
        }
      }
    }

    // Validate step references
    for (const step of fixture.steps) {
      if (step.type === 'APPLY_OVERLAY') {
        for (const overlay of step.overlays) {
          if (!childNames.has(overlay.childName)) {
            throw new ScenarioFixtureValidationError(
              `Unknown child name in overlay step ${step.stepId}: ${overlay.childName}`,
            );
          }
          if (!parentNames.has(overlay.assignedParentName)) {
            throw new ScenarioFixtureValidationError(
              `Unknown parent name in overlay step ${step.stepId}: ${overlay.assignedParentName}`,
            );
          }
        }
      }

      if (step.type === 'ACCEPT_PROPOSAL' && !parentNames.has(step.acceptedByParentName)) {
        throw new ScenarioFixtureValidationError(
          `Unknown parent name in accept step ${step.stepId}: ${step.acceptedByParentName}`,
        );
      }

      if (step.type === 'REJECT_PROPOSAL' && !parentNames.has(step.rejectedByParentName)) {
        throw new ScenarioFixtureValidationError(
          `Unknown parent name in reject step ${step.stepId}: ${step.rejectedByParentName}`,
        );
      }

      if (step.type === 'APPEND_FAIRNESS_ADJUSTMENT') {
        for (const delta of step.deltas) {
          if (!parentNames.has(delta.parentName)) {
            throw new ScenarioFixtureValidationError(
              `Unknown parent name in fairness adjustment step ${step.stepId}: ${delta.parentName}`,
            );
          }
        }
      }
    }

    // Validate expectations structure
    for (const exp of fixture.expectations) {
      if (exp.type === 'ACTIVE_SCHEDULE' && exp.expectedAssignments) {
        for (const a of exp.expectedAssignments) {
          if (!childNames.has(a.childName)) {
            throw new ScenarioFixtureValidationError(
              `Unknown child name in active schedule expectation: ${a.childName}`,
            );
          }
          if (!parentNames.has(a.parentName)) {
            throw new ScenarioFixtureValidationError(
              `Unknown parent name in active schedule expectation: ${a.parentName}`,
            );
          }
        }

        // Check duplicate expected assignments
        const keys = new Set<string>();
        for (const a of exp.expectedAssignments) {
          const key = `${a.date}:${a.childName}`;
          if (keys.has(key)) {
            throw new ScenarioFixtureValidationError(
              `Duplicate expected assignment: ${key}`,
            );
          }
          keys.add(key);
        }
      }

      if (exp.type === 'FAIRNESS_LEDGER') {
        for (const entry of exp.byParent) {
          if (!parentNames.has(entry.parentName)) {
            throw new ScenarioFixtureValidationError(
              `Unknown parent name in fairness ledger expectation: ${entry.parentName}`,
            );
          }
        }
      }

      if (exp.type === 'DETERMINISM' && exp.rerunCount < 1) {
        throw new ScenarioFixtureValidationError(
          'DETERMINISM expectation rerunCount must be >= 1',
        );
      }
    }
  }
}
