import {
  InterpretedIntent,
  ExtractionFamilyContext,
  InterpretationFailure,
} from '../types';

export interface InterpretationValidationResult {
  valid: boolean;
  failures: InterpretationFailure[];
}

/**
 * Validates a final interpreted intent before persistence.
 */
export class MessageInterpretationValidator {
  validate(
    intent: InterpretedIntent,
    familyContext: ExtractionFamilyContext,
  ): InterpretationValidationResult {
    const failures: InterpretationFailure[] = [];

    // Family must match
    if (intent.familyId !== familyContext.familyId) {
      failures.push({
        code: 'FAMILY_MISMATCH',
        message: `Intent familyId ${intent.familyId} does not match context ${familyContext.familyId}`,
      });
    }

    // Sender parent must be in family
    const parentIds = familyContext.parents.map(p => p.id);
    if (!parentIds.includes(intent.parentId)) {
      failures.push({
        code: 'UNKNOWN_SENDER',
        message: `Sender parent ${intent.parentId} not found in family context`,
      });
    }

    // Resolved parent IDs must be in family
    if (intent.resolvedEntities.parentIds) {
      for (const pid of intent.resolvedEntities.parentIds) {
        if (!parentIds.includes(pid)) {
          failures.push({
            code: 'UNKNOWN_RESOLVED_PARENT',
            message: `Resolved parent ${pid} not found in family context`,
          });
        }
      }
    }

    // Resolved child IDs must be in family
    if (intent.resolvedEntities.childIds) {
      const childIds = familyContext.children.map(c => c.id);
      for (const cid of intent.resolvedEntities.childIds) {
        if (!childIds.includes(cid)) {
          failures.push({
            code: 'UNKNOWN_RESOLVED_CHILD',
            message: `Resolved child ${cid} not found in family context`,
          });
        }
      }
    }

    return {
      valid: failures.length === 0,
      failures,
    };
  }
}
