import { DateTime } from 'luxon';
import {
  IncomingMessage,
  ValidatedIntentCandidate,
  DateResolutionResult,
  InterpretationFailure,
} from '../types';

/**
 * Resolves date references from messages into ISO dates.
 * Uses an explicit reference time — never hidden current time.
 */
export class DateReferenceResolver {
  resolveDates(input: {
    message: IncomingMessage;
    candidate: ValidatedIntentCandidate;
    referenceTimeIso: string;
    timezone?: string;
  }): DateResolutionResult {
    const resolved: DateResolutionResult = {
      resolvedDates: [],
      resolvedDateRanges: [],
      unresolvedTokens: [],
      ambiguities: [],
    };

    const tz = input.timezone ?? 'UTC';
    const refDt = DateTime.fromISO(input.referenceTimeIso, { zone: tz });

    if (!refDt.isValid) {
      resolved.ambiguities.push({
        code: 'INVALID_REFERENCE_TIME',
        message: `Invalid reference time: ${input.referenceTimeIso}`,
      });
      return resolved;
    }

    const payload = input.candidate.payload;

    // Resolve explicit dates in payload
    this.resolvePayloadDates(payload, resolved, refDt, tz);

    // Resolve relative date tokens from message text
    this.resolveRelativeDateTokens(input.message.text, resolved, refDt, tz);

    // Deduplicate resolved dates
    resolved.resolvedDates = [...new Set(resolved.resolvedDates)].sort();

    return resolved;
  }

  private resolvePayloadDates(
    payload: Record<string, unknown>,
    result: DateResolutionResult,
    refDt: DateTime,
    tz: string,
  ): void {
    // Single date fields
    for (const key of ['date', 'targetDate']) {
      const val = payload[key];
      if (typeof val === 'string' && val.match(/^\d{4}-\d{2}-\d{2}$/)) {
        result.resolvedDates.push(val);
      }
    }

    // Date range fields
    for (const key of ['dateRange', 'targetDateRange']) {
      const range = payload[key];
      if (range && typeof range === 'object' && 'startDate' in (range as any) && 'endDate' in (range as any)) {
        const r = range as { startDate: string; endDate: string };
        if (r.startDate.match(/^\d{4}-\d{2}-\d{2}$/) && r.endDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
          result.resolvedDateRanges.push({ startDate: r.startDate, endDate: r.endDate });
        }
      }
    }
  }

  private resolveRelativeDateTokens(
    text: string,
    result: DateResolutionResult,
    refDt: DateTime,
    tz: string,
  ): void {
    const lower = text.toLowerCase();

    // "today"
    if (lower.includes('today')) {
      result.resolvedDates.push(refDt.toISODate()!);
    }

    // "tomorrow"
    if (lower.includes('tomorrow')) {
      result.resolvedDates.push(refDt.plus({ days: 1 }).toISODate()!);
    }

    // "this weekend"
    if (lower.includes('this weekend')) {
      const thisWeekend = this.getThisWeekend(refDt);
      result.resolvedDateRanges.push(thisWeekend);
    }

    // "next weekend"
    if (lower.includes('next weekend')) {
      const nextWeekend = this.getNextWeekend(refDt);
      result.resolvedDateRanges.push(nextWeekend);
    }

    // Weekday names (simple: next occurrence)
    const weekdays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    for (let i = 0; i < weekdays.length; i++) {
      const dayName = weekdays[i];
      // Match standalone day name (not part of "this weekend" etc.)
      const pattern = new RegExp(`\\b${dayName}\\b`);
      if (pattern.test(lower) && !lower.includes('weekend')) {
        const targetDow = i + 1; // Luxon: 1=Monday...7=Sunday
        const resolved = this.getNextWeekday(refDt, targetDow);
        result.resolvedDates.push(resolved);
      }
    }

    // Month/day forms: "March 15" or "3/15"
    const monthDayPattern = /\b(\d{1,2})\/(\d{1,2})\b/;
    const monthDayMatch = lower.match(monthDayPattern);
    if (monthDayMatch) {
      const month = parseInt(monthDayMatch[1], 10);
      const day = parseInt(monthDayMatch[2], 10);
      if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
        let year = refDt.year;
        const candidate = DateTime.fromObject({ year, month, day }, { zone: tz });
        if (candidate.isValid) {
          // Use next occurrence
          if (candidate < refDt.startOf('day')) {
            year++;
          }
          const finalDate = DateTime.fromObject({ year, month, day }, { zone: tz });
          if (finalDate.isValid) {
            result.resolvedDates.push(finalDate.toISODate()!);
          }
        }
      }
    }

    // Named month + day: "March 15", "march 15th"
    const months = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
    for (let m = 0; m < months.length; m++) {
      const monthPattern = new RegExp(`\\b${months[m]}\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b`);
      const match = lower.match(monthPattern);
      if (match) {
        const day = parseInt(match[1], 10);
        const month = m + 1;
        let year = refDt.year;
        const candidate = DateTime.fromObject({ year, month, day }, { zone: tz });
        if (candidate.isValid) {
          if (candidate < refDt.startOf('day')) {
            year++;
          }
          const finalDate = DateTime.fromObject({ year, month, day }, { zone: tz });
          if (finalDate.isValid) {
            result.resolvedDates.push(finalDate.toISODate()!);
          }
        }
      }
    }
  }

  private getThisWeekend(refDt: DateTime): { startDate: string; endDate: string } {
    // Saturday of this week
    const daysUntilSaturday = (6 - refDt.weekday + 7) % 7;
    const saturday = refDt.plus({ days: daysUntilSaturday || 7 });
    const sunday = saturday.plus({ days: 1 });
    // If already weekend, use current weekend
    if (refDt.weekday >= 6) {
      const thisSat = refDt.weekday === 6 ? refDt : refDt.minus({ days: 1 });
      const thisSun = thisSat.plus({ days: 1 });
      return { startDate: thisSat.toISODate()!, endDate: thisSun.toISODate()! };
    }
    return { startDate: saturday.toISODate()!, endDate: sunday.toISODate()! };
  }

  private getNextWeekend(refDt: DateTime): { startDate: string; endDate: string } {
    // If currently weekend, skip to next
    let daysUntilSaturday = (6 - refDt.weekday + 7) % 7;
    if (daysUntilSaturday === 0) daysUntilSaturday = 7;
    // "next weekend" always means the weekend after "this weekend"
    const saturday = refDt.plus({ days: daysUntilSaturday + 7 });
    const sunday = saturday.plus({ days: 1 });
    // If weekday, next weekend = the weekend after this coming one
    if (refDt.weekday < 6) {
      const thisSat = refDt.plus({ days: daysUntilSaturday });
      const nextSat = thisSat.plus({ days: 7 });
      const nextSun = nextSat.plus({ days: 1 });
      return { startDate: nextSat.toISODate()!, endDate: nextSun.toISODate()! };
    }
    return { startDate: saturday.toISODate()!, endDate: sunday.toISODate()! };
  }

  private getNextWeekday(refDt: DateTime, targetDow: number): string {
    let daysAhead = targetDow - refDt.weekday;
    if (daysAhead <= 0) daysAhead += 7;
    return refDt.plus({ days: daysAhead }).toISODate()!;
  }
}
