import { describe, it, expect } from 'vitest';
import { CalendarEventDeduplicator } from '../ingestion/CalendarEventDeduplicator';
import { makeNormalizedEvent, makeClassifiedEvent, FAMILY_ID } from './helpers';

describe('CalendarEventDeduplicator', () => {
  const deduplicator = new CalendarEventDeduplicator();

  it('exact source/externalId match with changes returns UPDATE', () => {
    const existing = makeClassifiedEvent({ externalId: 'ext-1', source: 'google' });
    const normalized = makeNormalizedEvent({
      externalId: 'ext-1',
      source: 'google',
      title: 'Updated Meeting Title',
    });

    const result = deduplicator.dedupe({
      source: 'google',
      externalId: 'ext-1',
      familyId: FAMILY_ID,
      normalizedEvent: normalized,
      existingEvents: [existing],
    });

    expect(result.action).toBe('UPDATE');
    expect(result.matchedEventId).toBe('ext-1');
  });

  it('exact source/externalId match without changes returns SKIP', () => {
    const existing = makeClassifiedEvent();
    const normalized = makeNormalizedEvent();

    const result = deduplicator.dedupe({
      source: 'google',
      externalId: 'ext-1',
      familyId: FAMILY_ID,
      normalizedEvent: normalized,
      existingEvents: [existing],
    });

    expect(result.action).toBe('SKIP');
  });

  it('non-matching event returns INSERT', () => {
    const existing = makeClassifiedEvent({ externalId: 'ext-old', source: 'google', title: 'Old Event' });
    const normalized = makeNormalizedEvent({ externalId: 'ext-new', title: 'Completely Different Event', startTime: '2026-03-15T10:00:00' });

    const result = deduplicator.dedupe({
      source: 'google',
      externalId: 'ext-new',
      familyId: FAMILY_ID,
      normalizedEvent: normalized,
      existingEvents: [existing],
    });

    expect(result.action).toBe('INSERT');
  });

  it('deterministic action for repeated identical input', () => {
    const existing = makeClassifiedEvent();
    const normalized = makeNormalizedEvent();

    const r1 = deduplicator.dedupe({
      source: 'google',
      externalId: 'ext-1',
      familyId: FAMILY_ID,
      normalizedEvent: normalized,
      existingEvents: [existing],
    });

    const r2 = deduplicator.dedupe({
      source: 'google',
      externalId: 'ext-1',
      familyId: FAMILY_ID,
      normalizedEvent: normalized,
      existingEvents: [existing],
    });

    expect(r1.action).toBe(r2.action);
  });
});
