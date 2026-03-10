import {
  IncomingMessage,
  ExtractionFamilyContext,
  MessageInterpretationResult,
  ValidatedIntentCandidate,
  InterpretationFailure,
} from '../types';
import { MessageInterpretationError } from '../errors';
import { IntentExtractionProvider } from '../extraction/IntentExtractionProvider';
import { IntentCandidateValidator } from '../validation/IntentCandidateValidator';
import { IntentResolutionCoordinator } from '../resolution/IntentResolutionCoordinator';
import { MessageInterpretationPersistence } from './MessageInterpretationPersistence';

export interface MessageInterpretationServiceDeps {
  extractionProvider: IntentExtractionProvider;
  familyContextLoader: FamilyContextLoader;
  validator?: IntentCandidateValidator;
  resolutionCoordinator?: IntentResolutionCoordinator;
  persistence?: MessageInterpretationPersistence;
}

export interface FamilyContextLoader {
  loadContext(familyId: string): Promise<ExtractionFamilyContext>;
}

/**
 * Main pipeline: message -> extraction -> validation -> resolution -> result.
 */
export class MessageInterpretationService {
  private readonly extractionProvider: IntentExtractionProvider;
  private readonly familyContextLoader: FamilyContextLoader;
  private readonly validator: IntentCandidateValidator;
  private readonly resolutionCoordinator: IntentResolutionCoordinator;
  private readonly persistence: MessageInterpretationPersistence | null;

  constructor(deps: MessageInterpretationServiceDeps) {
    this.extractionProvider = deps.extractionProvider;
    this.familyContextLoader = deps.familyContextLoader;
    this.validator = deps.validator ?? new IntentCandidateValidator();
    this.resolutionCoordinator = deps.resolutionCoordinator ?? new IntentResolutionCoordinator();
    this.persistence = deps.persistence ?? null;
  }

  async interpretMessage(input: {
    message: IncomingMessage;
    referenceTimeIso: string;
  }): Promise<MessageInterpretationResult> {
    const { message, referenceTimeIso } = input;

    // 1. Load family context
    const familyContext = await this.familyContextLoader.loadContext(message.familyId);

    // 2. Extract candidates via provider
    let extractionResponse;
    try {
      extractionResponse = await this.extractionProvider.extract({ message, familyContext });
    } catch (err) {
      const result: MessageInterpretationResult = {
        status: 'INVALID',
        failures: [{
          code: 'EXTRACTION_FAILED',
          message: err instanceof Error ? err.message : String(err),
        }],
      };
      if (this.persistence) {
        await this.persistence.persistInterpretationResult({ message, result });
      }
      return result;
    }

    if (extractionResponse.candidates.length === 0) {
      const result: MessageInterpretationResult = {
        status: 'INVALID',
        failures: [{ code: 'NO_CANDIDATES', message: 'No intent candidates extracted' }],
        providerMetadata: extractionResponse.providerMetadata,
      };
      if (this.persistence) {
        await this.persistence.persistInterpretationResult({ message, result });
      }
      return result;
    }

    // 3. Validate all candidates
    const validated: ValidatedIntentCandidate[] = [];
    const validationFailures: InterpretationFailure[] = [];

    for (const candidate of extractionResponse.candidates) {
      const validationResult = this.validator.validateCandidate(candidate);
      if (validationResult.valid && validationResult.candidate) {
        validated.push(validationResult.candidate);
      } else {
        validationFailures.push(...validationResult.failures);
      }
    }

    if (validated.length === 0) {
      const result: MessageInterpretationResult = {
        status: 'INVALID',
        failures: validationFailures,
        providerMetadata: extractionResponse.providerMetadata,
      };
      if (this.persistence) {
        await this.persistence.persistInterpretationResult({ message, result });
      }
      return result;
    }

    // 4. Sort by confidence descending, then by type for determinism
    validated.sort((a, b) => {
      const cd = b.confidence - a.confidence;
      if (cd !== 0) return cd;
      return a.type.localeCompare(b.type);
    });

    // 5. Check for ambiguity: top two candidates with same confidence but different types
    if (validated.length >= 2 &&
        validated[0].confidence === validated[1].confidence &&
        validated[0].type !== validated[1].type) {
      const result: MessageInterpretationResult = {
        status: 'AMBIGUOUS',
        failures: [{
          code: 'TIED_CANDIDATES',
          message: `Top candidates tied: ${validated[0].type} vs ${validated[1].type}`,
          details: { types: [validated[0].type, validated[1].type] },
        }],
        clarificationHints: [
          `Did you mean ${validated[0].type} or ${validated[1].type}?`,
        ],
        providerMetadata: extractionResponse.providerMetadata,
      };
      if (this.persistence) {
        await this.persistence.persistInterpretationResult({ message, result });
      }
      return result;
    }

    // 6. Resolve the best candidate
    const bestCandidate = validated[0];
    const resolutionResult = this.resolutionCoordinator.resolve({
      message,
      candidate: bestCandidate,
      familyContext,
      referenceTimeIso,
    });

    // Attach provider metadata
    resolutionResult.providerMetadata = extractionResponse.providerMetadata;

    // 7. Persist
    if (this.persistence) {
      await this.persistence.persistInterpretationResult({ message, result: resolutionResult });
    }

    return resolutionResult;
  }
}
