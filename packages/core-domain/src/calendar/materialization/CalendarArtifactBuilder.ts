import {
  CalendarArtifact,
  CalendarIngestionResult,
  CalendarTranslationResult,
  ClassifiedCalendarEvent,
} from '../types';

/**
 * Builds audit artifacts from calendar operations.
 */
export function buildIngestionArtifact(result: CalendarIngestionResult): CalendarArtifact {
  return {
    type: 'INGESTION_SUMMARY',
    data: {
      inserted: result.inserted,
      updated: result.updated,
      skipped: result.skipped,
      totalEvents: result.events.length,
    },
  };
}

export function buildClassificationArtifact(events: ClassifiedCalendarEvent[]): CalendarArtifact {
  const hardCount = events.filter(e => e.constraintLevel === 'HARD').length;
  const strongCount = events.filter(e => e.constraintLevel === 'STRONG').length;
  const softCount = events.filter(e => e.constraintLevel === 'SOFT').length;

  return {
    type: 'CLASSIFICATION_SUMMARY',
    data: {
      totalEvents: events.length,
      hardCount,
      strongCount,
      softCount,
      kinds: [...new Set(events.map(e => e.kind))].sort(),
    },
  };
}

export function buildWindowConstraintArtifact(result: CalendarTranslationResult): CalendarArtifact {
  return {
    type: 'WINDOW_CONSTRAINT_SUMMARY',
    data: {
      familyId: result.familyId,
      windowStart: result.windowStart,
      windowEnd: result.windowEnd,
      totalConstraints: result.constraints.length,
      parentCount: Object.keys(result.availabilityView.parentConstraints).length,
      childCount: Object.keys(result.availabilityView.childConstraints).length,
      familyConstraintCount: result.availabilityView.familyConstraints.length,
    },
  };
}

export function buildUnresolvedScopeArtifact(
  unresolvedTokens: string[],
): CalendarArtifact {
  return {
    type: 'UNRESOLVED_SCOPE_SUMMARY',
    data: {
      unresolvedCount: unresolvedTokens.length,
      tokens: unresolvedTokens,
    },
  };
}
