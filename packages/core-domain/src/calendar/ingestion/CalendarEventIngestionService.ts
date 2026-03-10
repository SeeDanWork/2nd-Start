import {
  ExternalCalendarEvent,
  CalendarFamilyContext,
  CalendarIngestionResult,
  ClassifiedCalendarEvent,
} from '../types';
import { CalendarIngestionError } from '../errors';
import { CalendarScopeResolver } from '../core/CalendarScopeResolver';
import { CalendarEventKindInferer } from '../classification/CalendarEventKindInferer';
import { CalendarConstraintClassifier } from '../classification/CalendarConstraintClassifier';
import { CalendarEventNormalizer } from './CalendarEventNormalizer';
import { CalendarEventDeduplicator } from './CalendarEventDeduplicator';

export interface CalendarEventIngestionServiceDeps {
  scopeResolver?: CalendarScopeResolver;
  kindInferer?: CalendarEventKindInferer;
  classifier?: CalendarConstraintClassifier;
  normalizer?: CalendarEventNormalizer;
  deduplicator?: CalendarEventDeduplicator;
}

/**
 * Orchestrates normalization, classification, and deduplication of external events.
 */
export class CalendarEventIngestionService {
  private readonly scopeResolver: CalendarScopeResolver;
  private readonly kindInferer: CalendarEventKindInferer;
  private readonly classifier: CalendarConstraintClassifier;
  private readonly normalizer: CalendarEventNormalizer;
  private readonly deduplicator: CalendarEventDeduplicator;

  constructor(deps?: CalendarEventIngestionServiceDeps) {
    this.scopeResolver = deps?.scopeResolver ?? new CalendarScopeResolver();
    this.kindInferer = deps?.kindInferer ?? new CalendarEventKindInferer();
    this.classifier = deps?.classifier ?? new CalendarConstraintClassifier();
    this.normalizer = deps?.normalizer ?? new CalendarEventNormalizer();
    this.deduplicator = deps?.deduplicator ?? new CalendarEventDeduplicator();
  }

  ingestEvents(input: {
    familyId: string;
    events: ExternalCalendarEvent[];
    familyContext: CalendarFamilyContext;
    existingEvents?: ClassifiedCalendarEvent[];
  }): CalendarIngestionResult {
    const { familyId, events, familyContext } = input;
    const existingEvents = input.existingEvents ?? [];

    let inserted = 0;
    let updated = 0;
    let skipped = 0;
    const classifiedEvents: ClassifiedCalendarEvent[] = [];

    // Process in deterministic order (by externalId then startTime)
    const sorted = [...events].sort((a, b) => {
      const ec = a.externalId.localeCompare(b.externalId);
      if (ec !== 0) return ec;
      return a.startTime.localeCompare(b.startTime);
    });

    for (const externalEvent of sorted) {
      // 1. Resolve scope
      const scope = this.scopeResolver.resolveScope({
        event: externalEvent,
        familyContext,
      });

      // 2. Infer kind
      const kind = this.kindInferer.inferKind({ event: externalEvent });

      // 3. Normalize
      const normalized = this.normalizer.normalize({
        familyId,
        externalEvent,
        resolvedScope: scope,
        inferredKind: kind,
      });

      // 4. Deduplicate
      const dedupeResult = this.deduplicator.dedupe({
        source: externalEvent.source,
        externalId: externalEvent.externalId,
        familyId,
        normalizedEvent: normalized,
        existingEvents: [...existingEvents, ...classifiedEvents],
      });

      if (dedupeResult.action === 'SKIP') {
        skipped++;
        continue;
      }

      // 5. Classify
      const classified = this.classifier.classify({ event: normalized });
      classifiedEvents.push(classified);

      if (dedupeResult.action === 'INSERT') {
        inserted++;
      } else {
        updated++;
      }
    }

    return {
      inserted,
      updated,
      skipped,
      events: classifiedEvents,
    };
  }
}
