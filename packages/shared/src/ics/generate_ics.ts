// ─── ICS (RFC 5545) Calendar Export ─────────────────────────────────
//
// Generates a standard .ics file that any calendar app can import.
// All-day events, CRLF line endings, deterministic UIDs.

export interface IcsScheduleDay {
  date: string;                              // "YYYY-MM-DD"
  assignedTo: 'parent_a' | 'parent_b';
}

export interface IcsExportOptions {
  parentALabel?: string;   // default "Father"
  parentBLabel?: string;   // default "Mother"
  eventSuffix?: string;    // default "'s Night"
  uidPrefix?: string;      // for deterministic UIDs
}

const CRLF = '\r\n';

function formatDateValue(dateStr: string): string {
  return dateStr.replace(/-/g, '');
}

function nextDay(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + 1);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}${m}${day}`;
}

function makeDtstamp(): string {
  return new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

function makeUid(dateStr: string, prefix?: string): string {
  if (prefix) {
    return `adcp-${prefix}-${formatDateValue(dateStr)}@adcp.app`;
  }
  return `adcp-${Date.now()}-${formatDateValue(dateStr)}@adcp.app`;
}

export function generateIcsString(days: IcsScheduleDay[], options?: IcsExportOptions): string {
  const parentALabel = options?.parentALabel ?? 'Father';
  const parentBLabel = options?.parentBLabel ?? 'Mother';
  const suffix = options?.eventSuffix ?? "'s Night";
  const uidPrefix = options?.uidPrefix;
  const dtstamp = makeDtstamp();

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//ADCP//Co-Parenting Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ];

  for (const day of days) {
    const label = day.assignedTo === 'parent_a' ? parentALabel : parentBLabel;
    const summary = `${label}${suffix}`;

    lines.push('BEGIN:VEVENT');
    lines.push(`DTSTART;VALUE=DATE:${formatDateValue(day.date)}`);
    lines.push(`DTEND;VALUE=DATE:${nextDay(day.date)}`);
    lines.push(`SUMMARY:${summary}`);
    lines.push(`UID:${makeUid(day.date, uidPrefix)}`);
    lines.push(`DTSTAMP:${dtstamp}`);
    lines.push('STATUS:CONFIRMED');
    lines.push('TRANSP:TRANSPARENT');
    lines.push('CATEGORIES:ADCP,Co-Parenting');
    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');

  return lines.join(CRLF) + CRLF;
}
