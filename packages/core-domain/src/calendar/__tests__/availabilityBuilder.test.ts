import { describe, it, expect } from 'vitest';
import { CalendarAvailabilityBuilder } from '../translation/CalendarAvailabilityBuilder';
import { CalendarConstraintRecord } from '../types';
import { FAMILY_ID, PARENT_A_ID, PARENT_B_ID, CHILD_1_ID, CHILD_2_ID } from './helpers';

function makeConstraint(overrides?: Partial<CalendarConstraintRecord>): CalendarConstraintRecord {
  return {
    eventId: 'ext-1',
    familyId: FAMILY_ID,
    scopeType: 'PARENT',
    parentId: PARENT_A_ID,
    date: '2026-03-10',
    constraintLevel: 'STRONG',
    kind: 'WORK',
    title: 'Meeting',
    source: 'google',
    ...overrides,
  };
}

describe('CalendarAvailabilityBuilder', () => {
  const builder = new CalendarAvailabilityBuilder();

  it('groups constraints by parent correctly', () => {
    const constraints = [
      makeConstraint({ parentId: PARENT_A_ID, eventId: 'e1' }),
      makeConstraint({ parentId: PARENT_B_ID, eventId: 'e2' }),
    ];

    const view = builder.buildAvailabilityView({
      familyId: FAMILY_ID,
      windowStart: '2026-03-09',
      windowEnd: '2026-03-15',
      constraints,
      parentIds: [PARENT_A_ID, PARENT_B_ID],
      childIds: [CHILD_1_ID],
    });

    expect(view.parentConstraints[PARENT_A_ID]).toHaveLength(1);
    expect(view.parentConstraints[PARENT_B_ID]).toHaveLength(1);
  });

  it('groups constraints by child correctly', () => {
    const constraints = [
      makeConstraint({ scopeType: 'CHILD', childId: CHILD_1_ID, parentId: undefined, kind: 'SCHOOL', eventId: 'e1' }),
      makeConstraint({ scopeType: 'CHILD', childId: CHILD_2_ID, parentId: undefined, kind: 'ACTIVITY', eventId: 'e2' }),
    ];

    const view = builder.buildAvailabilityView({
      familyId: FAMILY_ID,
      windowStart: '2026-03-09',
      windowEnd: '2026-03-15',
      constraints,
      parentIds: [PARENT_A_ID],
      childIds: [CHILD_1_ID, CHILD_2_ID],
    });

    expect(view.childConstraints[CHILD_1_ID]).toHaveLength(1);
    expect(view.childConstraints[CHILD_2_ID]).toHaveLength(1);
  });

  it('includes family constraints separately', () => {
    const constraints = [
      makeConstraint({ scopeType: 'FAMILY', parentId: undefined, childId: undefined, kind: 'HOLIDAY' }),
    ];

    const view = builder.buildAvailabilityView({
      familyId: FAMILY_ID,
      windowStart: '2026-03-09',
      windowEnd: '2026-03-15',
      constraints,
      parentIds: [PARENT_A_ID],
      childIds: [CHILD_1_ID],
    });

    expect(view.familyConstraints).toHaveLength(1);
  });

  it('deterministic ordering for repeated identical input', () => {
    const constraints = [
      makeConstraint({ eventId: 'e-b', date: '2026-03-11' }),
      makeConstraint({ eventId: 'e-a', date: '2026-03-10' }),
    ];

    const v1 = builder.buildAvailabilityView({
      familyId: FAMILY_ID, windowStart: '2026-03-09', windowEnd: '2026-03-15',
      constraints, parentIds: [PARENT_A_ID], childIds: [CHILD_1_ID],
    });
    const v2 = builder.buildAvailabilityView({
      familyId: FAMILY_ID, windowStart: '2026-03-09', windowEnd: '2026-03-15',
      constraints: [...constraints].reverse(), parentIds: [PARENT_A_ID], childIds: [CHILD_1_ID],
    });

    expect(v1.parentConstraints[PARENT_A_ID].map(c => c.eventId))
      .toEqual(v2.parentConstraints[PARENT_A_ID].map(c => c.eventId));
  });
});
