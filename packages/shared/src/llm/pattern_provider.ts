// ─── Pattern-Matching LLM Provider ───────────────────────────────────
//
// Deterministic regex + keyword fallback provider.
// Confidence range: 0.3-0.8 (never claims high confidence).

import { RequestType } from '../enums';
import type { LlmContext, LlmInterpretation, LlmProvider } from './types';
import { validateLlmOutput } from './safety';

const DATE_REGEX = /\b(\d{4}-\d{2}-\d{2})\b/g;
const RELATIVE_DATE_REGEX = /\b(next|this)\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday|week|weekend)\b/gi;
const TOMORROW_REGEX = /\btomorrow\b/i;
const MONTH_DAY_REGEX = /\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})(?:st|nd|rd|th)?\b/gi;

const DAY_NAME_TO_DOW: Record<string, number> = {
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
  thursday: 4, friday: 5, saturday: 6,
};

const MONTH_NAME_TO_NUM: Record<string, number> = {
  january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
  july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
};

function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function resolveRelativeDate(modifier: string, target: string, ref: Date): string[] {
  const targetLower = target.toLowerCase();
  const modLower = modifier.toLowerCase();

  if (targetLower === 'weekend') {
    // Find next Saturday from ref
    const refDow = ref.getDay(); // 0=Sun
    let daysToSat = (6 - refDow + 7) % 7;
    if (modLower === 'next' && daysToSat === 0) daysToSat = 7;
    if (modLower === 'this' && daysToSat === 0) daysToSat = 7;
    const sat = new Date(ref);
    sat.setDate(ref.getDate() + (daysToSat || 7));
    const sun = new Date(sat);
    sun.setDate(sat.getDate() + 1);
    return [toIsoDate(sat), toIsoDate(sun)];
  }

  if (targetLower === 'week') {
    if (modLower === 'this') {
      // Remaining days in current ISO week (Mon-Sun)
      const refDow = ref.getDay(); // 0=Sun
      const dates: string[] = [];
      // Days left: from tomorrow to end of week (Sunday)
      const daysLeftToSun = refDow === 0 ? 0 : 7 - refDow;
      for (let i = 1; i <= daysLeftToSun; i++) {
        const d = new Date(ref);
        d.setDate(ref.getDate() + i);
        dates.push(toIsoDate(d));
      }
      return dates;
    }
    // "next week" — all 7 days of next Monday-Sunday
    const refDow = ref.getDay(); // 0=Sun
    const daysToNextMon = refDow === 0 ? 1 : (8 - refDow);
    const dates: string[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(ref);
      d.setDate(ref.getDate() + daysToNextMon + i);
      dates.push(toIsoDate(d));
    }
    return dates;
  }

  // Day name (monday, tuesday, etc.)
  const targetDow = DAY_NAME_TO_DOW[targetLower];
  if (targetDow === undefined) return [];

  const refDow = ref.getDay();
  let daysAhead = (targetDow - refDow + 7) % 7;
  if (modLower === 'next') {
    // "next Monday" = the occurrence in the NEXT week
    if (daysAhead === 0) daysAhead = 7;
    // If modifier is "next", we always want next week's occurrence
    if (daysAhead <= (7 - refDow) % 7 && daysAhead > 0) {
      // Still in current week — push to next
      daysAhead += 7;
    }
  } else {
    // "this Monday" = current week
    if (daysAhead === 0) daysAhead = 7;
  }

  const result = new Date(ref);
  result.setDate(ref.getDate() + daysAhead);
  return [toIsoDate(result)];
}

interface PatternRule {
  keywords: string[];
  requestType: RequestType;
  confidence: number;
  isEmergency: boolean;
}

const PATTERN_RULES: PatternRule[] = [
  // Emergency patterns
  { keywords: ['emergency', 'hospital', 'urgent', 'accident'], requestType: RequestType.NEED_COVERAGE, confidence: 0.7, isEmergency: true },
  { keywords: ['sick', 'ill', 'fever', 'doctor'], requestType: RequestType.NEED_COVERAGE, confidence: 0.6, isEmergency: false },
  // Need coverage patterns
  { keywords: ['cover', 'coverage', 'can\'t', 'cannot', 'unavailable', 'away', 'trip', 'travel'], requestType: RequestType.NEED_COVERAGE, confidence: 0.6, isEmergency: false },
  { keywords: ['work', 'shift', 'meeting', 'conference'], requestType: RequestType.NEED_COVERAGE, confidence: 0.5, isEmergency: false },
  // Want time patterns
  { keywords: ['want', 'would like', 'extra time', 'more time', 'keep', 'have them'], requestType: RequestType.WANT_TIME, confidence: 0.5, isEmergency: false },
  { keywords: ['birthday', 'holiday', 'christmas', 'thanksgiving', 'special'], requestType: RequestType.WANT_TIME, confidence: 0.5, isEmergency: false },
  // Swap patterns
  { keywords: ['swap', 'switch', 'trade', 'exchange days'], requestType: RequestType.SWAP_DATE, confidence: 0.6, isEmergency: false },
  // Bonus week patterns
  { keywords: ['bonus week', 'extra week', 'full week', 'entire week'], requestType: RequestType.BONUS_WEEK, confidence: 0.7, isEmergency: false },
];

function extractKeywords(input: string): string[] {
  const lower = input.toLowerCase();
  const found: string[] = [];
  for (const rule of PATTERN_RULES) {
    for (const kw of rule.keywords) {
      if (lower.includes(kw)) {
        found.push(kw);
      }
    }
  }
  return [...new Set(found)];
}

function extractDates(input: string, referenceDate?: string): string[] {
  const dates: string[] = [];

  // 1. ISO dates
  const isoMatches = input.match(DATE_REGEX);
  if (isoMatches) {
    dates.push(...isoMatches);
  }

  // 2. Relative dates (requires a reference date)
  const ref = referenceDate ? new Date(referenceDate + 'T00:00:00') : new Date();
  // Ensure ref is a valid date before proceeding
  if (!isNaN(ref.getTime())) {
    // "tomorrow"
    if (TOMORROW_REGEX.test(input)) {
      const tomorrow = new Date(ref);
      tomorrow.setDate(ref.getDate() + 1);
      dates.push(toIsoDate(tomorrow));
    }

    // "next/this Monday", "next week", "this weekend", etc.
    let relMatch: RegExpExecArray | null;
    const relRegex = new RegExp(RELATIVE_DATE_REGEX.source, 'gi');
    while ((relMatch = relRegex.exec(input)) !== null) {
      const resolved = resolveRelativeDate(relMatch[1], relMatch[2], ref);
      dates.push(...resolved);
    }

    // "March 15th", "April 2", etc.
    let monthMatch: RegExpExecArray | null;
    const monthRegex = new RegExp(MONTH_DAY_REGEX.source, 'gi');
    while ((monthMatch = monthRegex.exec(input)) !== null) {
      const monthNum = MONTH_NAME_TO_NUM[monthMatch[1].toLowerCase()];
      const dayNum = parseInt(monthMatch[2], 10);
      if (monthNum !== undefined && dayNum >= 1 && dayNum <= 31) {
        const year = ref.getFullYear();
        const resolved = new Date(year, monthNum, dayNum);
        if (!isNaN(resolved.getTime())) {
          dates.push(toIsoDate(resolved));
        }
      }
    }
  }

  // Dedup and sort
  const unique = [...new Set(dates)];
  unique.sort();
  return unique;
}

function matchPattern(input: string): { rule: PatternRule; matchCount: number } | null {
  const lower = input.toLowerCase();
  let bestMatch: { rule: PatternRule; matchCount: number } | null = null;

  for (const rule of PATTERN_RULES) {
    const matchCount = rule.keywords.filter((kw) => lower.includes(kw)).length;
    if (matchCount > 0) {
      if (!bestMatch || matchCount > bestMatch.matchCount ||
          (matchCount === bestMatch.matchCount && rule.confidence > bestMatch.rule.confidence)) {
        bestMatch = { rule, matchCount };
      }
    }
  }

  return bestMatch;
}

export class PatternProvider implements LlmProvider {
  name = 'pattern_matching';

  async interpret(input: string, context: LlmContext): Promise<LlmInterpretation> {
    const keywords = extractKeywords(input);
    const dates = extractDates(input, context.referenceDate);
    const match = matchPattern(input);

    let result: LlmInterpretation;

    if (match) {
      // Scale confidence by match count (more keywords = more confident, cap at 0.8)
      const scaledConfidence = Math.min(0.8, match.rule.confidence + (match.matchCount - 1) * 0.05);

      result = {
        requestType: match.rule.requestType,
        dates,
        isEmergency: match.rule.isEmergency,
        confidence: scaledConfidence,
        summary: `Detected ${match.rule.requestType} request based on keywords: ${keywords.join(', ')}`,
        extractedKeywords: keywords,
        isSafe: true,
        unsafeReason: null,
      };
    } else {
      result = {
        requestType: null,
        dates,
        isEmergency: false,
        confidence: 0.3,
        summary: 'Could not determine request type from input',
        extractedKeywords: keywords,
        isSafe: true,
        unsafeReason: null,
      };
    }

    // Apply safety validation
    const safetyResult = validateLlmOutput(result, input);
    return safetyResult;
  }
}
