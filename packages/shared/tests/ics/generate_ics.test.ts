import { describe, it, expect } from 'vitest';
import { generateIcsString, IcsScheduleDay } from '../../src/ics';

describe('generateIcsString', () => {
  it('returns valid VCALENDAR with no VEVENTs for empty array', () => {
    const result = generateIcsString([]);
    expect(result).toContain('BEGIN:VCALENDAR');
    expect(result).toContain('END:VCALENDAR');
    expect(result).not.toContain('BEGIN:VEVENT');
  });

  it('uses "Father\'s Night" for parent_a by default', () => {
    const days: IcsScheduleDay[] = [{ date: '2025-06-15', assignedTo: 'parent_a' }];
    const result = generateIcsString(days);
    expect(result).toContain("SUMMARY:Father's Night");
  });

  it('uses "Mother\'s Night" for parent_b by default', () => {
    const days: IcsScheduleDay[] = [{ date: '2025-06-15', assignedTo: 'parent_b' }];
    const result = generateIcsString(days);
    expect(result).toContain("SUMMARY:Mother's Night");
  });

  it('respects custom parent labels', () => {
    const days: IcsScheduleDay[] = [{ date: '2025-06-15', assignedTo: 'parent_a' }];
    const result = generateIcsString(days, { parentALabel: 'Dad' });
    expect(result).toContain("SUMMARY:Dad's Night");
  });

  it('sets DTEND to date + 1 day (including month/year boundaries)', () => {
    const days: IcsScheduleDay[] = [
      { date: '2025-01-31', assignedTo: 'parent_a' },
      { date: '2025-12-31', assignedTo: 'parent_b' },
    ];
    const result = generateIcsString(days);
    // Jan 31 → Feb 1
    expect(result).toContain('DTSTART;VALUE=DATE:20250131');
    expect(result).toContain('DTEND;VALUE=DATE:20250201');
    // Dec 31 → Jan 1 of next year
    expect(result).toContain('DTSTART;VALUE=DATE:20251231');
    expect(result).toContain('DTEND;VALUE=DATE:20260101');
  });

  it('uses CRLF line endings throughout', () => {
    const days: IcsScheduleDay[] = [{ date: '2025-06-15', assignedTo: 'parent_a' }];
    const result = generateIcsString(days);
    // Every line should end with \r\n — no bare \n (split by \r\n and rejoin should equal original minus trailing CRLF)
    const lines = result.split('\r\n');
    // Last element after split is empty string (trailing CRLF)
    expect(lines[lines.length - 1]).toBe('');
    // No bare \n within lines
    for (const line of lines) {
      expect(line).not.toContain('\n');
    }
  });

  it('produces multiple VEVENTs for multiple days', () => {
    const days: IcsScheduleDay[] = [
      { date: '2025-06-15', assignedTo: 'parent_a' },
      { date: '2025-06-16', assignedTo: 'parent_b' },
      { date: '2025-06-17', assignedTo: 'parent_a' },
    ];
    const result = generateIcsString(days);
    const eventCount = (result.match(/BEGIN:VEVENT/g) || []).length;
    expect(eventCount).toBe(3);
  });

  it('generates unique UIDs across events', () => {
    const days: IcsScheduleDay[] = [
      { date: '2025-06-15', assignedTo: 'parent_a' },
      { date: '2025-06-16', assignedTo: 'parent_b' },
    ];
    const result = generateIcsString(days);
    const uids = (result.match(/UID:.+/g) || []);
    expect(uids.length).toBe(2);
    expect(uids[0]).not.toBe(uids[1]);
  });

  it('produces deterministic UIDs when prefix is given', () => {
    const days: IcsScheduleDay[] = [
      { date: '2025-06-15', assignedTo: 'parent_a' },
      { date: '2025-06-16', assignedTo: 'parent_b' },
    ];
    const result = generateIcsString(days, { uidPrefix: 'fam123-v2' });
    expect(result).toContain('UID:adcp-fam123-v2-20250615@adcp.app');
    expect(result).toContain('UID:adcp-fam123-v2-20250616@adcp.app');
  });

  it('contains all required ICS fields', () => {
    const days: IcsScheduleDay[] = [{ date: '2025-06-15', assignedTo: 'parent_a' }];
    const result = generateIcsString(days);
    // Calendar-level
    expect(result).toContain('PRODID:');
    expect(result).toContain('VERSION:2.0');
    expect(result).toContain('CALSCALE:GREGORIAN');
    // Event-level
    expect(result).toContain('DTSTAMP:');
    expect(result).toContain('STATUS:CONFIRMED');
    expect(result).toContain('TRANSP:TRANSPARENT');
    expect(result).toContain('CATEGORIES:ADCP,Co-Parenting');
  });
});
