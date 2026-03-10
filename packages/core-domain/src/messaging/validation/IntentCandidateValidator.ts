import {
  ExtractedIntentCandidate,
  ValidatedIntentCandidate,
  InterpretationFailure,
} from '../types';
import { IntentValidationError } from '../errors';
import { IntentSchemaRegistry } from './IntentSchemaRegistry';

export interface CandidateValidationResult {
  valid: boolean;
  candidate?: ValidatedIntentCandidate;
  failures: InterpretationFailure[];
}

/**
 * Validates extracted intent candidates against schemas.
 */
export class IntentCandidateValidator {
  private readonly registry: IntentSchemaRegistry;

  constructor(registry?: IntentSchemaRegistry) {
    this.registry = registry ?? new IntentSchemaRegistry();
  }

  validateCandidate(candidate: ExtractedIntentCandidate): CandidateValidationResult {
    const failures: InterpretationFailure[] = [];

    // 1. Validate type
    if (!this.registry.isKnownType(candidate.type)) {
      failures.push({
        code: 'UNKNOWN_INTENT_TYPE',
        message: `Unknown intent type: ${candidate.type}`,
      });
      return { valid: false, failures };
    }

    // 2. Validate confidence bounds
    if (typeof candidate.confidence !== 'number' ||
        candidate.confidence < 0 ||
        candidate.confidence > 1) {
      failures.push({
        code: 'INVALID_CONFIDENCE',
        message: `Confidence must be between 0 and 1, got: ${candidate.confidence}`,
      });
      return { valid: false, failures };
    }

    // 3. Validate payload against schema
    const schema = this.registry.getSchema(candidate.type);
    if (!schema) {
      failures.push({
        code: 'NO_SCHEMA',
        message: `No schema registered for type: ${candidate.type}`,
      });
      return { valid: false, failures };
    }

    const result = schema.safeParse(candidate.payload);
    if (!result.success) {
      for (const issue of result.error.issues) {
        failures.push({
          code: 'PAYLOAD_VALIDATION_ERROR',
          message: `${issue.path.join('.')}: ${issue.message}`,
          details: { path: issue.path, code: issue.code },
        });
      }
      return { valid: false, failures };
    }

    return {
      valid: true,
      candidate: {
        type: candidate.type,
        payload: result.data as Record<string, unknown>,
        confidence: candidate.confidence,
        extractionNotes: candidate.extractionNotes,
        validationPassed: true,
      },
      failures: [],
    };
  }
}
