import { describe, it, expect } from 'vitest';
import { CalendarConstraintTranslator } from '../translation/CalendarConstraintTranslator';
import { makeClassifiedEvent, FAMILY_ID, PARENT_A_ID, CHILD_1_ID } from './helpers';

describe('CalendarConstraintTranslator', () => {
  const translator = new CalendarConstraintTranslator();

  it('multi-day all-day event splits deterministically by date', () => {
    const event = makeClassifiedEvent({
      allDay: true,
      startTime: '2026-03-10',
      endTime: '2026-03-12',
    });

    const result = translator.translate({
      familyId: FAMILY_ID,
      windowStart: '2026-03-09',
      windowEnd: '2026-03-15',
      parentIds: [PARENT_A_ID],
      childIds: [CHILD_1_ID],
      events: [event],
    });

    // Should produce 3 records (Mar 10, 11, 12)
    expect(result.constraints.length).toBe(3);
    expect(result.constraints.map(c => c.date)).toEqual(['2026-03-10', '2026-03-11', '2026-03-12']);
  });

  it('all-day event outside window is excluded', () => {
    const event = makeClassifiedEvent({
      allDay: true,
      startTime: '2026-03-01',
      endTime: '2026-03-02',
    });

    const result = translator.translate({
      familyId: FAMILY_ID,
      windowStart: '2026-03-10',
      windowEnd: '2026-03-15',
      parentIds: [PARENT_A_ID],
      childIds: [CHILD_1_ID],
      events: [event],
    });

    expect(result.constraints.length).toBe(0);
  });

  it('timed single-day event produces one record with times', () => {
    const event = makeClassifiedEvent({
      allDay: false,
      startTime: '2026-03-10T09:00:00',
      endTime: '2026-03-10T17:00:00',
    });

    const result = translator.translate({
      familyId: FAMILY_ID,
      windowStart: '2026-03-09',
      windowEnd: '2026-03-15',
      parentIds: [PARENT_A_ID],
      childIds: [CHILD_1_ID],
      events: [event],
    });

    expect(result.constraints.length).toBe(1);
    expect(result.constraints[0].date).toBe('2026-03-10');
    expect(result.constraints[0].startTime).toBe('2026-03-10T09:00:00');
  });

  it('scoped constraints preserve parent/child/family links', () => {
    const parentEvent = makeClassifiedEvent({
      scopeType: 'PARENT',
      parentId: PARENT_A_ID,
      childId: undefined,
      allDay: true,
      startTime: '2026-03-10',
      endTime: '2026-03-10',
    });
    const childEvent = makeClassifiedEvent({
      externalId: 'ext-2',
      scopeType: 'CHILD',
      childId: CHILD_1_ID,
      parentId: undefined,
      allDay: true,
      startTime: '2026-03-11',
      endTime: '2026-03-11',
    });

    const result = translator.translate({
      familyId: FAMILY_ID,
      windowStart: '2026-03-09',
      windowEnd: '2026-03-15',
      parentIds: [PARENT_A_ID],
      childIds: [CHILD_1_ID],
      events: [parentEvent, childEvent],
    });

    expect(result.constraints.length).toBe(2);
    const parent = result.constraints.find(c => c.scopeType === 'PARENT');
    const child = result.constraints.find(c => c.scopeType === 'CHILD');
    expect(parent!.parentId).toBe(PARENT_A_ID);
    expect(child!.childId).toBe(CHILD_1_ID);
  });

  it('output ordering is deterministic', () => {
    const events = [
      makeClassifiedEvent({ externalId: 'ext-b', allDay: true, startTime: '2026-03-11', endTime: '2026-03-11' }),
      makeClassifiedEvent({ externalId: 'ext-a', allDay: true, startTime: '2026-03-10', endTime: '2026-03-10' }),
    ];

    const r1 = translator.translate({
      familyId: FAMILY_ID, windowStart: '2026-03-09', windowEnd: '2026-03-15',
      parentIds: [PARENT_A_ID], childIds: [CHILD_1_ID], events,
    });
    const r2 = translator.translate({
      familyId: FAMILY_ID, windowStart: '2026-03-09', windowEnd: '2026-03-15',
      parentIds: [PARENT_A_ID], childIds: [CHILD_1_ID], events: [...events].reverse(),
    });

    expect(r1.constraints.map(c => c.date)).toEqual(r2.constraints.map(c => c.date));
    expect(r1.constraints.map(c => c.eventId)).toEqual(r2.constraints.map(c => c.eventId));
  });
});
