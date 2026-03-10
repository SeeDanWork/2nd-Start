/**
 * Lightweight ICS (iCalendar RFC 5545) parser.
 *
 * Parses VEVENT blocks from an ICS string. Handles:
 * - All-day events (VALUE=DATE)
 * - Date-time events (VALUE=DATE-TIME or bare YYYYMMDDTHHMMSS)
 * - Folded lines (continuation lines starting with space/tab)
 * - Multi-day events via DTEND
 *
 * Does NOT handle: RRULE recurrence, VTIMEZONE, VALARM.
 * These are not needed for school calendar ingestion.
 */

export interface IcsEvent {
  uid: string;
  summary: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD (inclusive last day)
  startTime: string | null; // HH:mm or null for all-day
  endTime: string | null;
  description: string | null;
  location: string | null;
}

/**
 * Parse an ICS string and extract VEVENT blocks.
 */
export function parseIcs(icsContent: string): IcsEvent[] {
  const unfolded = unfoldLines(icsContent);
  const lines = unfolded.split(/\r?\n/);
  const events: IcsEvent[] = [];

  let inEvent = false;
  let current: Record<string, string> = {};

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed === 'BEGIN:VEVENT') {
      inEvent = true;
      current = {};
      continue;
    }

    if (trimmed === 'END:VEVENT') {
      inEvent = false;
      const event = buildEvent(current);
      if (event) {
        events.push(event);
      }
      continue;
    }

    if (inEvent) {
      const colonIdx = trimmed.indexOf(':');
      if (colonIdx > 0) {
        const key = trimmed.substring(0, colonIdx).toUpperCase();
        const value = trimmed.substring(colonIdx + 1);
        // Store the full key (e.g., "DTSTART;VALUE=DATE") for type detection
        current[key] = value;
      }
    }
  }

  return events;
}

/**
 * Unfold continuation lines per RFC 5545 Section 3.1.
 * Lines starting with a space or tab are appended to the previous line.
 */
function unfoldLines(content: string): string {
  return content.replace(/\r?\n[ \t]/g, '');
}

/**
 * Build an IcsEvent from parsed key-value pairs.
 */
function buildEvent(props: Record<string, string>): IcsEvent | null {
  const summary = findProp(props, 'SUMMARY');
  if (!summary) return null;

  const uid = findProp(props, 'UID') || '';
  const dtStart = findDateProp(props, 'DTSTART');
  const dtEnd = findDateProp(props, 'DTEND');

  if (!dtStart) return null;

  const startParsed = parseIcsDate(dtStart.value, dtStart.isDate);
  if (!startParsed) return null;

  let endParsed = dtEnd ? parseIcsDate(dtEnd.value, dtEnd.isDate) : null;

  // Default: if no DTEND, single-day event
  if (!endParsed) {
    endParsed = { date: startParsed.date, time: startParsed.time };
  }

  // For all-day events, DTEND is exclusive (day after last day)
  // Convert to inclusive end date
  let endDate = endParsed.date;
  if (dtStart.isDate && dtEnd?.isDate) {
    endDate = subtractOneDay(endParsed.date);
    // If start == end after subtraction, it's a single-day event
    if (endDate < startParsed.date) {
      endDate = startParsed.date;
    }
  }

  return {
    uid,
    summary,
    startDate: startParsed.date,
    endDate,
    startTime: startParsed.time,
    endTime: endParsed.time,
    description: findProp(props, 'DESCRIPTION') || null,
    location: findProp(props, 'LOCATION') || null,
  };
}

/**
 * Find a property value, handling parameterized keys like "SUMMARY;LANGUAGE=en".
 */
function findProp(props: Record<string, string>, name: string): string | undefined {
  // Exact match first
  if (props[name] !== undefined) return props[name];

  // Parameterized match (e.g., "SUMMARY;LANGUAGE=EN")
  for (const key of Object.keys(props)) {
    if (key === name || key.startsWith(name + ';')) {
      return props[key];
    }
  }
  return undefined;
}

/**
 * Find a date property, detecting whether it's a DATE or DATE-TIME value.
 */
function findDateProp(props: Record<string, string>, name: string): { value: string; isDate: boolean } | null {
  for (const key of Object.keys(props)) {
    if (key === name || key.startsWith(name + ';')) {
      const isDate = key.includes('VALUE=DATE') && !key.includes('VALUE=DATE-TIME');
      return { value: props[key], isDate };
    }
  }
  return null;
}

/**
 * Parse an ICS date value into { date: 'YYYY-MM-DD', time: 'HH:mm' | null }.
 */
function parseIcsDate(
  value: string,
  isDateOnly: boolean,
): { date: string; time: string | null } | null {
  // Strip timezone ID suffix (e.g., "20260315T080000Z" or "20260315")
  const clean = value.replace(/Z$/, '').trim();

  if (isDateOnly || clean.length === 8) {
    // YYYYMMDD
    const y = clean.substring(0, 4);
    const m = clean.substring(4, 6);
    const d = clean.substring(6, 8);
    if (!y || !m || !d) return null;
    return { date: `${y}-${m}-${d}`, time: null };
  }

  // YYYYMMDDTHHMMSS
  const tIdx = clean.indexOf('T');
  if (tIdx < 0) return null;

  const datePart = clean.substring(0, tIdx);
  const timePart = clean.substring(tIdx + 1);

  const y = datePart.substring(0, 4);
  const mo = datePart.substring(4, 6);
  const d = datePart.substring(6, 8);
  const h = timePart.substring(0, 2);
  const mi = timePart.substring(2, 4);

  if (!y || !mo || !d || !h || !mi) return null;

  return {
    date: `${y}-${mo}-${d}`,
    time: `${h}:${mi}`,
  };
}

/**
 * Subtract one day from a YYYY-MM-DD string.
 */
function subtractOneDay(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().split('T')[0];
}
