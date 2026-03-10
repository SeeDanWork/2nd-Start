import { describe, it, expect } from 'vitest';
import { CalendarEventIngestionService } from '../ingestion/CalendarEventIngestionService';
import { makeExternalEvent, makeFamilyContext, makeClassifiedEvent, FAMILY_ID } from './helpers';

describe('CalendarEventIngestionService', () => {
  const service = new CalendarEventIngestionService();

  it('ingests and classifies a batch of external events', () => {
    const events = [
      makeExternalEvent({ externalId: 'e1', title: "Charlie's soccer practice" }),
      makeExternalEvent({ externalId: 'e2', title: "Alice's business trip", startTime: '2026-03-11T00:00:00', endTime: '2026-03-13T00:00:00' }),
      makeExternalEvent({ externalId: 'e3', title: 'Family dinner' }),
    ];

    const result = service.ingestEvents({
      familyId: FAMILY_ID,
      events,
      familyContext: makeFamilyContext(),
    });

    expect(result.inserted).toBe(3);
    expect(result.skipped).toBe(0);
    expect(result.events.length).toBe(3);

    // Each event should be classified
    for (const event of result.events) {
      expect(event.constraintLevel).toBeDefined();
      expect(event.classificationReason).toBeTruthy();
      expect(event.confidence).toBeGreaterThan(0);
    }
  });

  it('updates existing events when deduped', () => {
    const existing = [
      makeClassifiedEvent({
        externalId: 'e1',
        source: 'google',
        title: 'Old title',
      }),
    ];

    const events = [
      makeExternalEvent({ externalId: 'e1', title: 'Updated title' }),
    ];

    const result = service.ingestEvents({
      familyId: FAMILY_ID,
      events,
      familyContext: makeFamilyContext(),
      existingEvents: existing,
    });

    expect(result.updated).toBe(1);
    expect(result.inserted).toBe(0);
  });

  it('skips identical existing events', () => {
    const existing = [makeClassifiedEvent()];
    const events = [makeExternalEvent()]; // Same externalId, same content

    const result = service.ingestEvents({
      familyId: FAMILY_ID,
      events,
      familyContext: makeFamilyContext(),
      existingEvents: existing,
    });

    expect(result.skipped).toBe(1);
    expect(result.inserted).toBe(0);
    expect(result.events.length).toBe(0);
  });

  it('returns deterministic summary ordering', () => {
    const events = [
      makeExternalEvent({ externalId: 'e-z', title: 'School event' }),
      makeExternalEvent({ externalId: 'e-a', title: 'Another event' }),
    ];

    const r1 = service.ingestEvents({ familyId: FAMILY_ID, events, familyContext: makeFamilyContext() });
    const r2 = service.ingestEvents({ familyId: FAMILY_ID, events: [...events].reverse(), familyContext: makeFamilyContext() });

    expect(r1.events.map(e => e.externalId)).toEqual(r2.events.map(e => e.externalId));
  });
});
