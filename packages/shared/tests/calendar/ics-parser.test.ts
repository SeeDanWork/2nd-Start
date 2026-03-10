import { describe, it, expect } from 'vitest';
import { parseIcs } from '../../src/calendar/ics-parser';

const MINIMAL_ICS = [
  'BEGIN:VCALENDAR',
  'VERSION:2.0',
  'PRODID:-//Test//Test//EN',
  'BEGIN:VEVENT',
  'UID:event-1@example.com',
  'DTSTART;VALUE=DATE:20260316',
  'DTEND;VALUE=DATE:20260317',
  'SUMMARY:No School - Teacher Workday',
  'END:VEVENT',
  'END:VCALENDAR',
].join('\r\n');

const MULTI_DAY_ICS = [
  'BEGIN:VCALENDAR',
  'VERSION:2.0',
  'BEGIN:VEVENT',
  'UID:spring-break@school.edu',
  'DTSTART;VALUE=DATE:20260315',
  'DTEND;VALUE=DATE:20260320',
  'SUMMARY:Spring Break',
  'DESCRIPTION:No school for students',
  'END:VEVENT',
  'END:VCALENDAR',
].join('\r\n');

const DATETIME_ICS = [
  'BEGIN:VCALENDAR',
  'VERSION:2.0',
  'BEGIN:VEVENT',
  'UID:dismissal@school.edu',
  'DTSTART:20260310T120000Z',
  'DTEND:20260310T130000Z',
  'SUMMARY:Early Dismissal',
  'END:VEVENT',
  'END:VCALENDAR',
].join('\r\n');

const FOLDED_LINES_ICS = [
  'BEGIN:VCALENDAR',
  'VERSION:2.0',
  'BEGIN:VEVENT',
  'UID:folded@example.com',
  'DTSTART;VALUE=DATE:20260401',
  'DTEND;VALUE=DATE:20260402',
  'SUMMARY:Very Long Event Name That Gets',
  ' Folded Across Multiple Lines',
  'END:VEVENT',
  'END:VCALENDAR',
].join('\r\n');

const MULTIPLE_EVENTS_ICS = [
  'BEGIN:VCALENDAR',
  'VERSION:2.0',
  'BEGIN:VEVENT',
  'UID:ev1@test',
  'DTSTART;VALUE=DATE:20260301',
  'DTEND;VALUE=DATE:20260302',
  'SUMMARY:Event One',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'UID:ev2@test',
  'DTSTART;VALUE=DATE:20260305',
  'DTEND;VALUE=DATE:20260306',
  'SUMMARY:Event Two',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'UID:ev3@test',
  'DTSTART;VALUE=DATE:20260310',
  'DTEND;VALUE=DATE:20260311',
  'SUMMARY:Event Three',
  'END:VEVENT',
  'END:VCALENDAR',
].join('\r\n');

describe('parseIcs', () => {
  it('parses a single all-day event', () => {
    const events = parseIcs(MINIMAL_ICS);
    expect(events).toHaveLength(1);
    expect(events[0].uid).toBe('event-1@example.com');
    expect(events[0].summary).toBe('No School - Teacher Workday');
    expect(events[0].startDate).toBe('2026-03-16');
    expect(events[0].endDate).toBe('2026-03-16'); // single day (DTEND exclusive → inclusive)
    expect(events[0].startTime).toBeNull();
    expect(events[0].endTime).toBeNull();
  });

  it('parses multi-day all-day events with exclusive DTEND', () => {
    const events = parseIcs(MULTI_DAY_ICS);
    expect(events).toHaveLength(1);
    expect(events[0].startDate).toBe('2026-03-15');
    expect(events[0].endDate).toBe('2026-03-19'); // 20260320 exclusive → 2026-03-19 inclusive
    expect(events[0].description).toBe('No school for students');
  });

  it('parses date-time events with times', () => {
    const events = parseIcs(DATETIME_ICS);
    expect(events).toHaveLength(1);
    expect(events[0].startDate).toBe('2026-03-10');
    expect(events[0].startTime).toBe('12:00');
    expect(events[0].endTime).toBe('13:00');
  });

  it('handles folded lines', () => {
    const events = parseIcs(FOLDED_LINES_ICS);
    expect(events).toHaveLength(1);
    expect(events[0].summary).toBe('Very Long Event Name That GetsFolded Across Multiple Lines');
  });

  it('parses multiple events', () => {
    const events = parseIcs(MULTIPLE_EVENTS_ICS);
    expect(events).toHaveLength(3);
    expect(events[0].summary).toBe('Event One');
    expect(events[1].summary).toBe('Event Two');
    expect(events[2].summary).toBe('Event Three');
  });

  it('returns empty array for empty input', () => {
    expect(parseIcs('')).toHaveLength(0);
  });

  it('skips events without SUMMARY', () => {
    const ics = [
      'BEGIN:VCALENDAR',
      'BEGIN:VEVENT',
      'UID:nosummary@test',
      'DTSTART;VALUE=DATE:20260301',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');
    expect(parseIcs(ics)).toHaveLength(0);
  });

  it('handles LF-only line endings', () => {
    const ics = MINIMAL_ICS.replace(/\r\n/g, '\n');
    const events = parseIcs(ics);
    expect(events).toHaveLength(1);
    expect(events[0].summary).toBe('No School - Teacher Workday');
  });

  it('is deterministic across multiple calls', () => {
    const a = parseIcs(MULTIPLE_EVENTS_ICS);
    const b = parseIcs(MULTIPLE_EVENTS_ICS);
    expect(a).toEqual(b);
  });
});
