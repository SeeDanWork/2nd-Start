import {
  IncomingMessage,
  ValidatedIntentCandidate,
  ExtractionFamilyContext,
  MessageInterpretationResult,
  InterpretedIntent,
  ResolvedEntityMap,
  InterpretationFailure,
} from '../types';
import { EntityReferenceResolver } from './EntityReferenceResolver';
import { DateReferenceResolver } from './DateReferenceResolver';

/**
 * Coordinates entity and date resolution to produce a final interpreted intent.
 */
export class IntentResolutionCoordinator {
  private readonly entityResolver: EntityReferenceResolver;
  private readonly dateResolver: DateReferenceResolver;

  constructor(
    entityResolver?: EntityReferenceResolver,
    dateResolver?: DateReferenceResolver,
  ) {
    this.entityResolver = entityResolver ?? new EntityReferenceResolver();
    this.dateResolver = dateResolver ?? new DateReferenceResolver();
  }

  resolve(input: {
    message: IncomingMessage;
    candidate: ValidatedIntentCandidate;
    familyContext: ExtractionFamilyContext;
    referenceTimeIso: string;
  }): MessageInterpretationResult {
    const failures: InterpretationFailure[] = [];

    // 1. Resolve entities
    const entityResult = this.entityResolver.resolveEntities({
      message: input.message,
      candidate: input.candidate,
      familyContext: input.familyContext,
    });
    failures.push(...entityResult.ambiguities);

    // 2. Resolve dates
    const dateResult = this.dateResolver.resolveDates({
      message: input.message,
      candidate: input.candidate,
      referenceTimeIso: input.referenceTimeIso,
      timezone: input.familyContext.timezone,
    });
    failures.push(...dateResult.ambiguities);

    // 3. Merge resolved entities
    const resolvedEntities: ResolvedEntityMap = {
      ...entityResult.resolved,
      dates: dateResult.resolvedDates.length > 0 ? dateResult.resolvedDates : undefined,
      dateRanges: dateResult.resolvedDateRanges.length > 0 ? dateResult.resolvedDateRanges : undefined,
    };

    if (dateResult.unresolvedTokens.length > 0) {
      resolvedEntities.unresolvedTokens = [
        ...(resolvedEntities.unresolvedTokens ?? []),
        ...dateResult.unresolvedTokens,
      ];
    }

    // 4. Check for blocking ambiguities
    if (failures.some(f => f.code.startsWith('AMBIGUOUS_'))) {
      return {
        status: 'AMBIGUOUS',
        failures,
        clarificationHints: failures
          .filter(f => f.code.startsWith('AMBIGUOUS_'))
          .map(f => f.message),
      };
    }

    // 5. Build interpreted intent
    const interpretedIntent: InterpretedIntent = {
      familyId: input.message.familyId,
      parentId: input.message.senderParentId,
      type: input.candidate.type,
      payload: input.candidate.payload,
      confidence: input.candidate.confidence,
      resolvedEntities,
      createdAt: input.referenceTimeIso,
    };

    return {
      status: 'SUCCESS',
      interpretedIntent,
      failures: failures.length > 0 ? failures : undefined,
    };
  }
}
