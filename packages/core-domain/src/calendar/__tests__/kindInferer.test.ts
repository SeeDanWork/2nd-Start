import { describe, it, expect } from 'vitest';
import { CalendarEventKindInferer } from '../classification/CalendarEventKindInferer';
import { makeExternalEvent } from './helpers';

describe('CalendarEventKindInferer', () => {
  const inferer = new CalendarEventKindInferer();

  it('infers SCHOOL from school-like titles', () => {
    expect(inferer.inferKind({ event: makeExternalEvent({ title: 'School pickup' }) })).toBe('SCHOOL');
    expect(inferer.inferKind({ event: makeExternalEvent({ title: 'Parent-teacher conference' }) })).toBe('SCHOOL');
    expect(inferer.inferKind({ event: makeExternalEvent({ title: 'Math class' }) })).toBe('SCHOOL');
  });

  it('infers TRAVEL from travel-like titles', () => {
    expect(inferer.inferKind({ event: makeExternalEvent({ title: 'Flight to NYC' }) })).toBe('TRAVEL');
    expect(inferer.inferKind({ event: makeExternalEvent({ title: 'Business trip' }) })).toBe('TRAVEL');
  });

  it('infers ACTIVITY from activity-like titles', () => {
    expect(inferer.inferKind({ event: makeExternalEvent({ title: 'Soccer practice' }) })).toBe('ACTIVITY');
    expect(inferer.inferKind({ event: makeExternalEvent({ title: 'Piano lesson' }) })).toBe('ACTIVITY');
    expect(inferer.inferKind({ event: makeExternalEvent({ title: 'Ballet recital' }) })).toBe('ACTIVITY');
  });

  it('infers WORK from work-like titles', () => {
    expect(inferer.inferKind({ event: makeExternalEvent({ title: 'Team meeting' }) })).toBe('WORK');
    expect(inferer.inferKind({ event: makeExternalEvent({ title: 'Morning shift' }) })).toBe('WORK');
  });

  it('infers MEDICAL from medical titles', () => {
    expect(inferer.inferKind({ event: makeExternalEvent({ title: 'Dentist appointment' }) })).toBe('MEDICAL');
    expect(inferer.inferKind({ event: makeExternalEvent({ title: 'Pediatrician checkup' }) })).toBe('MEDICAL');
  });

  it('infers DAYCARE from daycare titles', () => {
    expect(inferer.inferKind({ event: makeExternalEvent({ title: 'Daycare drop-off' }) })).toBe('DAYCARE');
  });

  it('infers CLOSURE from closure titles', () => {
    expect(inferer.inferKind({ event: makeExternalEvent({ title: 'Snow day - no school' }) })).toBe('CLOSURE');
  });

  it('falls back to OTHER for unrecognized titles', () => {
    expect(inferer.inferKind({ event: makeExternalEvent({ title: 'Random event xyz' }) })).toBe('OTHER');
  });

  it('uses metadata kind hint when title has no match', () => {
    expect(inferer.inferKind({
      event: makeExternalEvent({ title: 'Something', metadata: { kind: 'MEDICAL' } }),
    })).toBe('MEDICAL');
  });
});
