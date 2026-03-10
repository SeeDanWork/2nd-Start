import { describe, it, expect } from 'vitest';
import { CalendarSolverAdapter } from '../core/CalendarSolverAdapter';
import { CalendarConstraintTranslator } from '../translation/CalendarConstraintTranslator';
import { makeClassifiedEvent, FAMILY_ID, PARENT_A_ID, PARENT_B_ID, CHILD_1_ID, CHILD_2_ID } from './helpers';

describe('CalendarSolverAdapter', () => {
  const adapter = new CalendarSolverAdapter();
  const translator = new CalendarConstraintTranslator();

  function buildTranslation(events: ReturnType<typeof makeClassifiedEvent>[]) {
    return translator.translate({
      familyId: FAMILY_ID,
      windowStart: '2026-03-09',
      windowEnd: '2026-03-15',
      parentIds: [PARENT_A_ID, PARENT_B_ID],
      childIds: [CHILD_1_ID, CHILD_2_ID],
      events,
    });
  }

  it('HARD parent event becomes explicit unavailability', () => {
    const translation = buildTranslation([
      makeClassifiedEvent({
        scopeType: 'PARENT',
        parentId: PARENT_A_ID,
        childId: undefined,
        constraintLevel: 'HARD',
        kind: 'TRAVEL',
        allDay: true,
        startTime: '2026-03-10',
        endTime: '2026-03-10',
      }),
    ]);

    const provider = adapter.toAvailabilityConstraintProvider(translation);
    const assignments = provider.getUnavailableAssignments(
      FAMILY_ID,
      [PARENT_A_ID, PARENT_B_ID],
      [CHILD_1_ID, CHILD_2_ID],
      { startDate: '2026-03-09', endDate: '2026-03-15' },
    );

    // HARD parent event → parent unavailable for all children on that date
    expect(assignments.length).toBe(2); // 2 children
    expect(assignments.every(a => a.parentId === PARENT_A_ID)).toBe(true);
    expect(assignments.every(a => a.date === '2026-03-10')).toBe(true);
  });

  it('STRONG child event is preserved as commitment signal (not unavailability)', () => {
    const translation = buildTranslation([
      makeClassifiedEvent({
        scopeType: 'CHILD',
        childId: CHILD_1_ID,
        parentId: undefined,
        constraintLevel: 'STRONG',
        kind: 'ACTIVITY',
        allDay: true,
        startTime: '2026-03-11',
        endTime: '2026-03-11',
      }),
    ]);

    const provider = adapter.toAvailabilityConstraintProvider(translation);
    const assignments = provider.getUnavailableAssignments(
      FAMILY_ID,
      [PARENT_A_ID, PARENT_B_ID],
      [CHILD_1_ID],
      { startDate: '2026-03-09', endDate: '2026-03-15' },
    );

    // STRONG child event is NOT converted to unavailability
    expect(assignments.length).toBe(0);

    // But artifacts should capture it
    const artifacts = adapter.toCalendarContextArtifacts(translation);
    const commitmentArtifact = artifacts.find(a => a.type === 'CHILD_COMMITMENT_SIGNALS');
    expect(commitmentArtifact).toBeDefined();
  });

  it('SOFT event remains informational — no unavailability', () => {
    const translation = buildTranslation([
      makeClassifiedEvent({
        scopeType: 'FAMILY',
        parentId: undefined,
        childId: undefined,
        constraintLevel: 'SOFT',
        kind: 'INFORMATIONAL',
        allDay: true,
        startTime: '2026-03-12',
        endTime: '2026-03-12',
      }),
    ]);

    const provider = adapter.toAvailabilityConstraintProvider(translation);
    const assignments = provider.getUnavailableAssignments(
      FAMILY_ID,
      [PARENT_A_ID],
      [CHILD_1_ID],
      { startDate: '2026-03-09', endDate: '2026-03-15' },
    );

    expect(assignments.length).toBe(0);
  });

  it('no fabricated unavailable assignments for STRONG parent events', () => {
    const translation = buildTranslation([
      makeClassifiedEvent({
        scopeType: 'PARENT',
        parentId: PARENT_A_ID,
        childId: undefined,
        constraintLevel: 'STRONG',
        kind: 'WORK',
        allDay: true,
        startTime: '2026-03-10',
        endTime: '2026-03-10',
      }),
    ]);

    const provider = adapter.toAvailabilityConstraintProvider(translation);
    const assignments = provider.getUnavailableAssignments(
      FAMILY_ID,
      [PARENT_A_ID],
      [CHILD_1_ID],
      { startDate: '2026-03-09', endDate: '2026-03-15' },
    );

    // STRONG (not HARD) → no unavailability fabricated
    expect(assignments.length).toBe(0);
  });
});
