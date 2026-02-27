// ─── Family Context Defaults ──────────────────────────────────────
//
// Lightweight function for the API to compute age-derived defaults
// without the full Zod-validated recommendation pipeline.

import type { TemplateId } from './templates';
import type { AgeBandV2 } from './age_baselines';
import {
  AGE_BAND_DEFAULTS,
  AGE_BAND_ORDER_V2,
  birthdateToAgeBand,
  youngestBand as getYoungestBand,
  adjustMaxConsecutive,
} from './age_baselines';

// ─── Types ────────────────────────────────────────────────────────

export type SolverWeightProfile = 'infant' | 'young_child' | 'school_age' | 'teen';

export interface FamilyGoals {
  stabilityFirst: boolean;
  minimizeSeparation: boolean;
  fairnessStrict: boolean;
}

export interface FamilyContextDefaults {
  youngestBand: AgeBandV2;
  maxConsecutive: number;
  maxAway: number;
  preferredTemplateIds: TemplateId[];
  perChild: Array<{
    childId: string;
    ageBand: AgeBandV2;
    maxConsecutive: number;
    maxAway: number;
  }>;
  solverWeightProfile: SolverWeightProfile;
  livingArrangement: string;
}

// ─── Band → Solver Weight Profile Mapping ─────────────────────────

const BAND_TO_PROFILE: Record<AgeBandV2, SolverWeightProfile> = {
  '0-6m': 'infant',
  '6-12m': 'infant',
  '1-2y': 'young_child',
  '2-3y': 'young_child',
  '3-5y': 'young_child',
  '5-7y': 'school_age',
  '8-10y': 'school_age',
  '11-13y': 'teen',
  '14-17y': 'teen',
};

// ─── Default fallback (school-age) ────────────────────────────────

const SCHOOL_AGE_BAND: AgeBandV2 = '5-7y';

const DEFAULT_GOALS: FamilyGoals = {
  stabilityFirst: false,
  minimizeSeparation: false,
  fairnessStrict: false,
};

// ─── Core Function ────────────────────────────────────────────────

/**
 * Compute family-level age-derived defaults from children's birthdates.
 *
 * Children without `dateOfBirth` are skipped. If no valid children remain,
 * falls back to school-age defaults.
 */
export function computeFamilyContextDefaults(
  children: Array<{ childId: string; dateOfBirth: string | null }>,
  goals?: FamilyGoals,
  livingArrangement?: string,
): FamilyContextDefaults {
  const g = goals ?? DEFAULT_GOALS;

  // Filter to children with valid birthdates
  const validChildren = children.filter(
    (c): c is { childId: string; dateOfBirth: string } => c.dateOfBirth !== null,
  );

  const arrangement = livingArrangement ?? 'shared';

  // Fallback: no valid children → school-age defaults
  if (validChildren.length === 0) {
    const defs = AGE_BAND_DEFAULTS[SCHOOL_AGE_BAND];
    const adjMax = adjustMaxConsecutive(defs.maxConsecutive, g, SCHOOL_AGE_BAND);
    const adjAway = adjustMaxConsecutive(defs.maxAway, g, SCHOOL_AGE_BAND);
    const fallbackTemplates: TemplateId[] = [...defs.preferredTemplates];
    if (arrangement === 'primary_visits') {
      const primaryIds: TemplateId[] = ['primary_weekends', 'primary_plus_midweek'];
      for (const id of [...primaryIds].reverse()) {
        if (!fallbackTemplates.includes(id)) {
          fallbackTemplates.unshift(id);
        }
      }
    }
    return {
      youngestBand: SCHOOL_AGE_BAND,
      maxConsecutive: adjMax,
      maxAway: adjAway,
      preferredTemplateIds: fallbackTemplates,
      perChild: [],
      solverWeightProfile: BAND_TO_PROFILE[SCHOOL_AGE_BAND],
      livingArrangement: arrangement,
    };
  }

  // Compute per-child age bands and defaults
  const perChild = validChildren.map((c) => {
    const band = birthdateToAgeBand(c.dateOfBirth);
    const defs = AGE_BAND_DEFAULTS[band];
    return {
      childId: c.childId,
      ageBand: band,
      maxConsecutive: adjustMaxConsecutive(defs.maxConsecutive, g, band),
      maxAway: adjustMaxConsecutive(defs.maxAway, g, band),
    };
  });

  // Youngest band drives family-level defaults
  const bands = perChild.map((c) => c.ageBand);
  const youngest = getYoungestBand(bands);
  const youngestDefs = AGE_BAND_DEFAULTS[youngest];

  // Family-level adjusted values come from youngest child
  const maxConsecutive = adjustMaxConsecutive(youngestDefs.maxConsecutive, g, youngest);
  const maxAway = adjustMaxConsecutive(youngestDefs.maxAway, g, youngest);

  // Preferred templates from youngest band
  const preferredTemplateIds = [...youngestDefs.preferredTemplates];

  // Prepend primary templates for primary_visits arrangement
  if (arrangement === 'primary_visits') {
    const primaryIds: TemplateId[] = ['primary_weekends', 'primary_plus_midweek'];
    for (const id of [...primaryIds].reverse()) {
      if (!preferredTemplateIds.includes(id)) {
        preferredTemplateIds.unshift(id);
      }
    }
  }

  // Solver weight profile from youngest band
  const solverWeightProfile = BAND_TO_PROFILE[youngest];

  return {
    youngestBand: youngest,
    maxConsecutive,
    maxAway,
    preferredTemplateIds,
    perChild,
    solverWeightProfile,
    livingArrangement: arrangement,
  };
}
