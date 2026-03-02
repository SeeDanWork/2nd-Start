// ─── Text → Structured Data Parsers ────────────────────────────────
//
// Regex-based, order-independent parsers for free-text family
// descriptions and disruption scenarios. Always returns valid
// data structures with sensible defaults.

import type { BaselineRecommendationInputV2 } from '@adcp/shared';
import {
  DisruptionEventType,
  DisruptionScope,
  DisruptionSource,
  OverrideStrength,
} from '@adcp/shared';
import type { DisruptionEvent } from '@adcp/shared';

// ─── Helpers ─────────────────────────────────────────────────────────

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Subtract months from today to get a synthetic birthdate. */
function subtractMonths(months: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - months);
  return d.toISOString().slice(0, 10);
}

/** Subtract years from today (approximate via months). */
function subtractYears(years: number): string {
  return subtractMonths(years * 12);
}

let idCounter = 0;
function syntheticId(): string {
  return `synth-${++idCounter}-${Date.now()}`;
}

// ─── parseFamilyInput ────────────────────────────────────────────────

export interface ParseFamilyResult {
  input: BaselineRecommendationInputV2;
  warnings: string[];
}

export function parseFamilyInput(text: string): ParseFamilyResult {
  const warnings: string[] = [];
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const full = text.toLowerCase();

  // ── Children ──
  const children: Array<{ childId: string; birthdate?: string; ageBand?: string }> = [];

  // "kids ages 3 and 7", "children ages 2, 5, and 10"
  const agesMatch = full.match(/(?:kids?|children?|child)\s+(?:ages?\s+)?([\d,\s]+(?:and\s+\d+)?)/);
  if (agesMatch) {
    const nums = agesMatch[1].replace(/and/g, ',').split(',').map((s) => s.trim()).filter(Boolean);
    for (const n of nums) {
      const age = parseInt(n, 10);
      if (!isNaN(age) && age >= 0 && age <= 18) {
        children.push({ childId: syntheticId(), birthdate: subtractYears(age) });
      }
    }
  }

  // "8 month old", "14 months"
  const monthMatches = full.matchAll(/(\d+)\s*(?:month|mo)s?\s*(?:old)?/g);
  for (const m of monthMatches) {
    const months = parseInt(m[1], 10);
    if (!isNaN(months) && months >= 0 && months <= 216) {
      children.push({ childId: syntheticId(), birthdate: subtractMonths(months) });
    }
  }

  // "born 2022-05-15" or "child born 2020-01-01"
  const bornMatches = full.matchAll(/born\s+(\d{4}-\d{2}-\d{2})/g);
  for (const m of bornMatches) {
    children.push({ childId: syntheticId(), birthdate: m[1] });
  }

  // Standalone YYYY-MM-DD dates that look like birthdates (before 2024)
  if (children.length === 0) {
    const dateMatches = full.matchAll(/\b(\d{4})-(\d{2})-(\d{2})\b/g);
    for (const m of dateMatches) {
      const year = parseInt(m[1], 10);
      if (year >= 2005 && year <= 2026) {
        children.push({ childId: syntheticId(), birthdate: m[0] });
      }
    }
  }

  // "N year old" / "N-year-old"
  if (children.length === 0) {
    const yearOldMatches = full.matchAll(/(\d+)[\s-]*year[\s-]*old/g);
    for (const m of yearOldMatches) {
      const age = parseInt(m[1], 10);
      if (!isNaN(age) && age >= 0 && age <= 18) {
        children.push({ childId: syntheticId(), birthdate: subtractYears(age) });
      }
    }
  }

  if (children.length === 0) {
    warnings.push('No children detected — defaulting to one 5-year-old child');
    children.push({ childId: syntheticId(), birthdate: subtractYears(5) });
  }

  // ── Arrangement ──
  let arrangement: 'shared' | 'primary_visits' | 'undecided' = 'shared';
  if (/\bprimary\b/.test(full)) arrangement = 'primary_visits';
  else if (/\bundecided\b/.test(full)) arrangement = 'undecided';

  // ── Goals ──
  const goals = {
    stabilityFirst: /\bstabilit/i.test(full),
    minimizeSeparation: /\bminimi[sz]e\s+separation\b/i.test(full) || /\bless\s+separation\b/i.test(full),
    fairnessStrict: /\bfairness\b/i.test(full) || /\b50\s*\/\s*50\b/.test(full) || /\bequal\b/i.test(full),
  };

  // ── Anchor ──
  let anchorType: 'daycare' | 'school' | 'none' = 'none';
  if (/\bdaycare\b/i.test(full) || /\bpreschool\b/i.test(full)) anchorType = 'daycare';
  else if (/\bschool\b/i.test(full)) anchorType = 'school';
  const anchorDays = anchorType !== 'none' ? [1, 2, 3, 4, 5] : undefined;

  // ── Distance ──
  let distance = 15;
  const distMatch = full.match(/(\d+)\s*(?:min(?:utes?)?)\s*(?:apart|away|drive|commute)?/);
  if (distMatch) distance = parseInt(distMatch[1], 10);

  // ── Exchange preference ──
  let exchangePreference: 'prefer_anchor' | 'ok_in_person' | 'unknown' = 'unknown';
  if (/\bprefer\s*anchor\b/i.test(full)) exchangePreference = 'prefer_anchor';
  else if (/\bin\s*person\b/i.test(full)) exchangePreference = 'ok_in_person';
  else if (anchorType !== 'none') exchangePreference = 'prefer_anchor';

  // ── Constraints ──
  const constraintsSummary: BaselineRecommendationInputV2['constraintsSummary'] = {};
  const lockedA = full.match(/(?:father|dad|parent\s*a)\s*(?:has\s+)?(\d+)\s*locked\s*nights?/);
  const lockedB = full.match(/(?:mother|mom|parent\s*b)\s*(?:has\s+)?(\d+)\s*locked\s*nights?/);
  if (lockedA) constraintsSummary.lockedNightsCountA = parseInt(lockedA[1], 10);
  if (lockedB) constraintsSummary.lockedNightsCountB = parseInt(lockedB[1], 10);
  if (/\bshift\s*work\b/i.test(full)) {
    constraintsSummary.shiftWorkLikelyA = true;
  }
  if (/\bno\s*in[\s-]*person\b/i.test(full)) {
    constraintsSummary.noInPersonExchange = true;
  }

  // Also try "N locked nights" without specifying parent
  if (!lockedA && !lockedB) {
    const lockedGeneral = full.match(/(\d+)\s*locked\s*nights?/);
    if (lockedGeneral) {
      constraintsSummary.lockedNightsCountA = parseInt(lockedGeneral[1], 10);
    }
  }

  return {
    input: {
      children,
      anchor: { type: anchorType, days: anchorDays },
      exchangePreference,
      distanceBetweenHomesMinutes: distance,
      goals,
      constraintsSummary,
      aggregationMode: 'youngest_child_rules',
    },
    warnings,
  };
}

// ─── parseDisruptionInput ────────────────────────────────────────────

const EVENT_TYPE_KEYWORDS: Array<[RegExp, DisruptionEventType]> = [
  [/\bsick\s*child\b|\bchild\s*(?:is\s*)?sick\b|\bkid\s*(?:is\s*)?sick\b/, DisruptionEventType.CHILD_SICK],
  [/\bcaregiver\s*sick\b|\bparent\s*sick\b|\bmom\s*sick\b|\bdad\s*sick\b/, DisruptionEventType.CAREGIVER_SICK],
  [/\bholiday\b/, DisruptionEventType.PUBLIC_HOLIDAY],
  [/\bschool\s*closed?\b|\bclosure\b/, DisruptionEventType.SCHOOL_CLOSED],
  [/\bhalf[\s-]*day\b/, DisruptionEventType.SCHOOL_HALF_DAY],
  [/\bemergency\b/, DisruptionEventType.EMERGENCY_CLOSURE],
  [/\btravel\b|\btrip\b/, DisruptionEventType.PARENT_TRAVEL],
  [/\btransport\b|\bcar\s*broke\b|\bno\s*ride\b/, DisruptionEventType.TRANSPORT_FAILURE],
  [/\bfamily\s*event\b|\bwedding\b|\breunion\b|\bfuneral\b/, DisruptionEventType.FAMILY_EVENT],
  [/\bcamp\b/, DisruptionEventType.CAMP_WEEK],
  [/\bbreak\b|\bspring\s*break\b|\bwinter\s*break\b/, DisruptionEventType.BREAK],
  [/\bsummer\b/, DisruptionEventType.SUMMER_PERIOD],
];

const MONTH_MAP: Record<string, number> = {
  jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2,
  apr: 3, april: 3, may: 4, jun: 5, june: 5, jul: 6, july: 6,
  aug: 7, august: 7, sep: 8, september: 8, oct: 9, october: 9,
  nov: 10, november: 10, dec: 11, december: 11,
};

function parseDate(text: string): string | null {
  // YYYY-MM-DD
  const isoMatch = text.match(/(\d{4}-\d{2}-\d{2})/);
  if (isoMatch) return isoMatch[1];

  // "March 10", "Oct 5"
  const namedMatch = text.match(/\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2})\b/i);
  if (namedMatch) {
    const month = MONTH_MAP[namedMatch[1].toLowerCase()];
    const day = parseInt(namedMatch[2], 10);
    if (month !== undefined && day >= 1 && day <= 31) {
      const year = new Date().getFullYear();
      return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  // "tomorrow", "today"
  if (/\btomorrow\b/i.test(text)) {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  }
  if (/\btoday\b/i.test(text)) {
    return todayStr();
  }

  return null;
}

function parseDuration(text: string): number {
  const daysMatch = text.match(/(\d+)\s*days?/i);
  if (daysMatch) return parseInt(daysMatch[1], 10);

  const weekMatch = text.match(/(\d+)\s*weeks?/i);
  if (weekMatch) return parseInt(weekMatch[1], 10) * 7;

  return 1; // default 1 day
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + days - 1);
  return d.toISOString().slice(0, 10);
}

export function parseDisruptionInput(text: string): DisruptionEvent[] {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const events: DisruptionEvent[] = [];

  for (const line of lines) {
    const lower = line.toLowerCase();

    // Determine event type
    let eventType = DisruptionEventType.OTHER_DECLARED;
    for (const [regex, type] of EVENT_TYPE_KEYWORDS) {
      if (regex.test(lower)) {
        eventType = type;
        break;
      }
    }

    // Parse date
    const startDate = parseDate(line) ?? todayStr();
    const duration = parseDuration(lower);
    const endDate = addDays(startDate, duration);

    // Parse affected parent
    let reportedBy: string | null = null;
    if (/\bfather\b|\bdad\b|\bparent\s*a\b/i.test(lower)) reportedBy = 'parent_a';
    else if (/\bmother\b|\bmom\b|\bparent\s*b\b/i.test(lower)) reportedBy = 'parent_b';

    // Determine strength from keywords
    let strength = OverrideStrength.SOFT;
    if (/\bhard\b|\bmust\b|\babsolute\b/i.test(lower)) strength = OverrideStrength.HARD;
    else if (/\blogistics\b/i.test(lower)) strength = OverrideStrength.LOGISTICS_ONLY;

    events.push({
      id: syntheticId(),
      familyId: 'synthetic-family',
      type: eventType,
      scope: DisruptionScope.HOUSEHOLD,
      source: DisruptionSource.USER_DECLARED,
      overrideStrength: strength,
      startDate,
      endDate,
      metadata: reportedBy ? { affectedParent: reportedBy } : {},
      reportedBy,
      resolvedAt: null,
    });
  }

  return events;
}
