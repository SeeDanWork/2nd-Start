// ─── V2 Age-Based Baseline Engine ────────────────────────────────
//
// 9 fine-grained age bands, birthdate→band mapping, per-child defaults,
// multi-child aggregation, and V1↔V2 backward compatibility.

import type { TemplateId } from './templates';

// ─── Types ────────────────────────────────────────────────────────

export type AgeBandV2 =
  | '0-6m'
  | '6-12m'
  | '1-2y'
  | '2-3y'
  | '3-5y'
  | '5-7y'
  | '8-10y'
  | '11-13y'
  | '14-17y';

export type AgeBandV1 = '0-2' | '3-4' | '5-10' | '11-17';

export interface AgeBandDefaults {
  maxConsecutive: number;
  maxAway: number;
  preferredTemplates: TemplateId[];
}

export interface ChildInput {
  childId: string;
  ageBand?: AgeBandV2;
  birthdate?: string;
}

export interface PerChildDefaults {
  childId: string;
  ageBand: AgeBandV2;
  defaults: AgeBandDefaults;
}

export interface AggregatedDefaults {
  derivedFrom: 'youngest_child_rules' | 'weighted_children';
  maxConsecutive: number;
  maxAway: number;
}

// ─── Band Order (youngest → oldest) ──────────────────────────────

export const AGE_BAND_ORDER_V2: AgeBandV2[] = [
  '0-6m',
  '6-12m',
  '1-2y',
  '2-3y',
  '3-5y',
  '5-7y',
  '8-10y',
  '11-13y',
  '14-17y',
];

// ─── Band Defaults Table ──────────────────────────────────────────

export const AGE_BAND_DEFAULTS: Record<AgeBandV2, AgeBandDefaults> = {
  '0-6m': {
    maxConsecutive: 1,
    maxAway: 1,
    preferredTemplates: ['223_daytime', '223'],
  },
  '6-12m': {
    maxConsecutive: 2,
    maxAway: 2,
    preferredTemplates: ['223', '3443'],
  },
  '1-2y': {
    maxConsecutive: 2,
    maxAway: 3,
    preferredTemplates: ['223', '3443'],
  },
  '2-3y': {
    maxConsecutive: 3,
    maxAway: 3,
    preferredTemplates: ['223', '3443', '2255'],
  },
  '3-5y': {
    maxConsecutive: 4,
    maxAway: 4,
    preferredTemplates: ['3443', '2255', '223'],
  },
  '5-7y': {
    maxConsecutive: 5,
    maxAway: 5,
    preferredTemplates: ['2255', '3443', '7on7off'],
  },
  '8-10y': {
    maxConsecutive: 7,
    maxAway: 7,
    preferredTemplates: ['7on7off', '2255'],
  },
  '11-13y': {
    maxConsecutive: 7,
    maxAway: 7,
    preferredTemplates: ['7on7off', '2255', 'primary_plus_midweek'],
  },
  '14-17y': {
    maxConsecutive: 7,
    maxAway: 7,
    preferredTemplates: ['7on7off', '2week_blocks', 'primary_plus_midweek'],
  },
};

// ─── Month boundaries: [lower, upper) in months ──────────────────

const BAND_MONTH_RANGES: [number, number, AgeBandV2][] = [
  [0, 6, '0-6m'],
  [6, 12, '6-12m'],
  [12, 24, '1-2y'],
  [24, 36, '2-3y'],
  [36, 60, '3-5y'],
  [60, 84, '5-7y'],
  [84, 132, '8-10y'],
  [132, 168, '11-13y'],
  [168, Infinity, '14-17y'],
];

// ─── Core Functions ───────────────────────────────────────────────

/**
 * Calculate age in months from birthdate to reference date (UTC-based).
 * Returns floored whole months.
 */
export function ageInMonths(birthdate: string, refDate?: string): number {
  const birth = new Date(birthdate + 'T00:00:00Z');
  const ref = refDate ? new Date(refDate + 'T00:00:00Z') : new Date();

  const yearDiff = ref.getUTCFullYear() - birth.getUTCFullYear();
  const monthDiff = ref.getUTCMonth() - birth.getUTCMonth();
  const dayDiff = ref.getUTCDate() - birth.getUTCDate();

  let months = yearDiff * 12 + monthDiff;
  if (dayDiff < 0) months -= 1;

  return Math.max(0, months);
}

/**
 * Map a birthdate string (YYYY-MM-DD) to an AgeBandV2.
 */
export function birthdateToAgeBand(birthdate: string, refDate?: string): AgeBandV2 {
  const months = ageInMonths(birthdate, refDate);
  for (const [lower, upper, band] of BAND_MONTH_RANGES) {
    if (months >= lower && months < upper) return band;
  }
  return '14-17y'; // fallback for 18+
}

/**
 * Resolve a child's age band. Birthdate takes precedence if provided.
 */
export function resolveChildAgeBand(
  child: ChildInput,
  refDate?: string,
): AgeBandV2 {
  if (child.birthdate) {
    return birthdateToAgeBand(child.birthdate, refDate);
  }
  if (child.ageBand) {
    return child.ageBand;
  }
  throw new Error(
    `Child ${child.childId} has neither birthdate nor ageBand`,
  );
}

/**
 * Get defaults for a single child.
 */
export function getChildDefaults(
  child: ChildInput,
  refDate?: string,
): PerChildDefaults {
  const ageBand = resolveChildAgeBand(child, refDate);
  return {
    childId: child.childId,
    ageBand,
    defaults: AGE_BAND_DEFAULTS[ageBand],
  };
}

/**
 * Return the youngest (most restrictive) band from a list.
 */
export function youngestBand(bands: AgeBandV2[]): AgeBandV2 {
  if (bands.length === 0) throw new Error('No bands provided');
  let youngest = bands[0];
  for (const band of bands) {
    if (AGE_BAND_ORDER_V2.indexOf(band) < AGE_BAND_ORDER_V2.indexOf(youngest)) {
      youngest = band;
    }
  }
  return youngest;
}

/**
 * Adjust maxConsecutive based on parent goals.
 * - stabilityFirst: +1 (cap 7 for <14y, cap 14 for 14-17y)
 * - minimizeSeparation: -1 (floor 1)
 */
export function adjustMaxConsecutive(
  base: number,
  goals: { stabilityFirst: boolean; minimizeSeparation: boolean },
  band: AgeBandV2,
): number {
  let adjusted = base;
  if (goals.stabilityFirst) adjusted += 1;
  if (goals.minimizeSeparation) adjusted -= 1;

  const cap = band === '14-17y' ? 14 : 7;
  return Math.max(1, Math.min(cap, adjusted));
}

/**
 * Aggregate per-child defaults into a single recommendation.
 */
export function aggregateDefaults(
  perChild: PerChildDefaults[],
  mode: 'youngest_child_rules' | 'weighted_children',
): AggregatedDefaults {
  if (perChild.length === 0) throw new Error('No children provided');

  if (mode === 'youngest_child_rules') {
    const youngest = youngestBand(perChild.map((c) => c.ageBand));
    const defs = AGE_BAND_DEFAULTS[youngest];
    return {
      derivedFrom: 'youngest_child_rules',
      maxConsecutive: defs.maxConsecutive,
      maxAway: defs.maxAway,
    };
  }

  // weighted_children: average, rounded down
  const avgConsecutive =
    perChild.reduce((sum, c) => sum + c.defaults.maxConsecutive, 0) /
    perChild.length;
  const avgAway =
    perChild.reduce((sum, c) => sum + c.defaults.maxAway, 0) /
    perChild.length;

  return {
    derivedFrom: 'weighted_children',
    maxConsecutive: Math.floor(avgConsecutive),
    maxAway: Math.floor(avgAway),
  };
}

// ─── V1 ↔ V2 Mapping ─────────────────────────────────────────────

const V1_TO_V2_MAP: Record<AgeBandV1, AgeBandV2> = {
  '0-2': '1-2y',
  '3-4': '3-5y',
  '5-10': '8-10y',
  '11-17': '14-17y',
};

const V2_TO_V1_MAP: Record<AgeBandV2, AgeBandV1> = {
  '0-6m': '0-2',
  '6-12m': '0-2',
  '1-2y': '0-2',
  '2-3y': '0-2',
  '3-5y': '3-4',
  '5-7y': '5-10',
  '8-10y': '5-10',
  '11-13y': '11-17',
  '14-17y': '11-17',
};

export function mapV1toV2(v1: AgeBandV1): AgeBandV2 {
  return V1_TO_V2_MAP[v1];
}

export function mapV2toV1(v2: AgeBandV2): AgeBandV1 {
  return V2_TO_V1_MAP[v2];
}
