import { describe, it, expect } from 'vitest';
import { CalendarEventIngestionService } from '../ingestion/CalendarEventIngestionService';
import { CalendarConstraintTranslator } from '../translation/CalendarConstraintTranslator';
import { CalendarSolverAdapter } from '../core/CalendarSolverAdapter';
import { makeExternalEvent, makeFamilyContext, FAMILY_ID, PARENT_A_ID, PARENT_B_ID, CHILD_1_ID, CHILD_2_ID } from './helpers';

describe('End-to-end calendar pipeline', () => {
  const ingestionService = new CalendarEventIngestionService();
  const translator = new CalendarConstraintTranslator();
  const adapter = new CalendarSolverAdapter();

  it('external events -> normalization -> classification -> translation -> availability view', () => {
    const events = [
      makeExternalEvent({ externalId: 'e1', title: "Charlie's school day", startTime: '2026-03-10', endTime: '2026-03-10', allDay: true }),
      makeExternalEvent({ externalId: 'e2', title: "Alice's flight to NYC", startTime: '2026-03-11', endTime: '2026-03-12', allDay: true }),
      makeExternalEvent({ externalId: 'e3', title: 'Family picnic', startTime: '2026-03-13T12:00:00', endTime: '2026-03-13T15:00:00' }),
    ];

    // 1. Ingest
    const ingestionResult = ingestionService.ingestEvents({
      familyId: FAMILY_ID,
      events,
      familyContext: makeFamilyContext(),
    });

    expect(ingestionResult.inserted).toBe(3);
    expect(ingestionResult.events.length).toBe(3);

    // Verify classifications
    const schoolEvent = ingestionResult.events.find(e => e.externalId === 'e1');
    expect(schoolEvent!.kind).toBe('SCHOOL');
    expect(schoolEvent!.constraintLevel).toBe('HARD'); // child school = HARD

    const travelEvent = ingestionResult.events.find(e => e.externalId === 'e2');
    expect(travelEvent!.kind).toBe('TRAVEL');

    // 2. Translate
    const translationResult = translator.translate({
      familyId: FAMILY_ID,
      windowStart: '2026-03-09',
      windowEnd: '2026-03-15',
      parentIds: [PARENT_A_ID, PARENT_B_ID],
      childIds: [CHILD_1_ID, CHILD_2_ID],
      events: ingestionResult.events,
    });

    expect(translationResult.constraints.length).toBeGreaterThan(0);
    expect(translationResult.availabilityView).toBeDefined();
    expect(translationResult.availabilityView.familyId).toBe(FAMILY_ID);

    // 3. Solver adapter
    const artifacts = adapter.toCalendarContextArtifacts(translationResult);
    expect(artifacts.length).toBeGreaterThan(0);
    expect(artifacts.some(a => a.type === 'CALENDAR_CONSTRAINT_SUMMARY')).toBe(true);
  });

  it('repeated identical ingestion produces stable results', () => {
    const events = [
      makeExternalEvent({ externalId: 'e1', title: "Charlie's school day", startTime: '2026-03-10', endTime: '2026-03-10', allDay: true }),
    ];

    const r1 = ingestionService.ingestEvents({
      familyId: FAMILY_ID,
      events,
      familyContext: makeFamilyContext(),
    });

    // Re-ingest with first result as existing
    const r2 = ingestionService.ingestEvents({
      familyId: FAMILY_ID,
      events,
      familyContext: makeFamilyContext(),
      existingEvents: r1.events,
    });

    // Should skip all since identical
    expect(r2.skipped).toBe(1);
    expect(r2.inserted).toBe(0);
    expect(r2.events.length).toBe(0);
  });
});
