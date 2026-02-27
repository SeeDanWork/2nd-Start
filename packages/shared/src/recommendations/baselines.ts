// ─── Baseline Split Recommendations ────────────────────────────────
//
// Deterministic, rules-based pre-solver recommendations.
// Suggests age-appropriate schedule templates and max-consecutive defaults
// based on children's ages, logistics, and parent goals.

// ─── Types ─────────────────────────────────────────────────────────

/** @deprecated Use AgeBandV2 from age_baselines.ts instead */
export type AgeBand = '0-2' | '3-4' | '5-10' | '11-17';

/** @deprecated Use BaselineRecommendationInputV2 from scoring.ts instead */
export interface BaselineInput {
  childrenAgeBands: AgeBand[];
  schoolOrDaycareAnchor: 'daycare' | 'school' | 'none';
  exchangePreference: 'prefer_school_daycare' | 'ok_in_person' | 'unknown';
  distanceBetweenHomesMinutes?: number;
  parentConstraintsSummary?: {
    lockedNightsCountA?: number;
    lockedNightsCountB?: number;
    shiftWorkLikelyA?: boolean;
    shiftWorkLikelyB?: boolean;
  };
  goals: {
    stabilityFirst: boolean;
    minimizeSeparation: boolean;
    fairnessStrict: boolean;
  };
}

/** @deprecated Use TemplateScoreV2 from scoring.ts instead */
export interface TemplateRecommendation {
  templateId: string;
  name: string;
  patternSummary: string;
  typicalHandoffsPer2Weeks: number;
  suggestedWhen: string[];
  tradeoffs: string[];
  confidence: 'low' | 'medium' | 'high';
}

/** @deprecated Use BaselineRecommendationOutputV2 from scoring.ts instead */
export interface BaselineRecommendation {
  maxConsecutiveNightsDefault: number;
  maxDaysAwayDefault: number;
  recommendedTemplates: TemplateRecommendation[];
  rationale: string[];
}

// ─── Template Catalog ──────────────────────────────────────────────

interface TemplateDef {
  id: string;
  name: string;
  pattern: string;
  handoffsPer2Weeks: number;
  maxBlock: number;
  nightsA: number;
  nightsB: number;
  schoolAligned: boolean;
  suggestedWhenBase: string[];
  tradeoffsBase: string[];
}

const TEMPLATES: TemplateDef[] = [
  {
    id: '2-2-3',
    name: '2-2-3 Rotation',
    pattern: 'AABBAAA BBAABBB',
    handoffsPer2Weeks: 6,
    maxBlock: 3,
    nightsA: 7,
    nightsB: 7,
    schoolAligned: false,
    suggestedWhenBase: [
      'Young children (under 5) who benefit from frequent contact with both parents',
      'Parents who live close together and can handle more handoffs',
    ],
    tradeoffsBase: [
      'High number of transitions can be disruptive for school-age children',
      'Requires good co-parent communication due to frequent exchanges',
    ],
  },
  {
    id: '3-4-4-3',
    name: '3-4-4-3 Rotation',
    pattern: 'AAABBBB BBBAAAA',
    handoffsPer2Weeks: 4,
    maxBlock: 4,
    nightsA: 7,
    nightsB: 7,
    schoolAligned: true,
    suggestedWhenBase: [
      'Balanced schedule with mid-week exchanges',
      'School or daycare can serve as a natural handoff point',
    ],
    tradeoffsBase: [
      '4-day blocks may be long for very young children',
      'Mid-week transitions can be logistically challenging without school/daycare',
    ],
  },
  {
    id: '2-2-5-5',
    name: '2-2-5-5 Split',
    pattern: 'AABBAAAAA BBBBB',
    handoffsPer2Weeks: 4,
    maxBlock: 5,
    nightsA: 7,
    nightsB: 7,
    schoolAligned: false,
    suggestedWhenBase: [
      'Mix of short and longer blocks for gradual adjustment',
      'Families wanting equal time with moderate transitions',
    ],
    tradeoffsBase: [
      '5-day blocks may be too long for toddlers',
      'Uneven block lengths can feel inconsistent',
    ],
  },
  {
    id: '5-2-2-5',
    name: '5-2-2-5 Split',
    pattern: 'AAAAABB AABBBBB',
    handoffsPer2Weeks: 4,
    maxBlock: 5,
    nightsA: 7,
    nightsB: 7,
    schoolAligned: true,
    suggestedWhenBase: [
      'School-week stability with weekend transitions',
      'Children who need consistent weekday routines',
    ],
    tradeoffsBase: [
      'Weekday parent bears most school logistics',
      '5-day stretches may be hard for younger children',
    ],
  },
  {
    id: 'week-on-week-off',
    name: 'Alternating Weeks',
    pattern: 'AAAAAAA BBBBBBB',
    handoffsPer2Weeks: 2,
    maxBlock: 7,
    nightsA: 7,
    nightsB: 7,
    schoolAligned: false,
    suggestedWhenBase: [
      'Older children and teenagers who can handle longer separations',
      'Parents who live far apart and need fewer handoffs',
    ],
    tradeoffsBase: [
      '7-day separation is too long for young children',
      'Can feel like a long time away from the other parent',
    ],
  },
  {
    id: 'primary-weekends',
    name: 'Primary + Weekends',
    pattern: 'AAAAABB AAAAABB',
    handoffsPer2Weeks: 4,
    maxBlock: 5,
    nightsA: 10,
    nightsB: 4,
    schoolAligned: true,
    suggestedWhenBase: [
      'One parent is the primary caregiver during the week',
      'When work schedules or distance make equal split impractical',
    ],
    tradeoffsBase: [
      'Not a 50/50 split — one parent gets significantly more time',
      'Weekend parent misses weekday routines and school involvement',
    ],
  },
];

// ─── Age-Band Base Scores ──────────────────────────────────────────

const AGE_SCORES: Record<string, Record<AgeBand, number>> = {
  '2-2-3':            { '0-2': 90, '3-4': 75, '5-10': 50, '11-17': 30 },
  '3-4-4-3':          { '0-2': 60, '3-4': 80, '5-10': 75, '11-17': 60 },
  '2-2-5-5':          { '0-2': 40, '3-4': 65, '5-10': 80, '11-17': 70 },
  '5-2-2-5':          { '0-2': 30, '3-4': 55, '5-10': 85, '11-17': 75 },
  'week-on-week-off': { '0-2': 10, '3-4': 30, '5-10': 60, '11-17': 90 },
  'primary-weekends': { '0-2': 20, '3-4': 40, '5-10': 55, '11-17': 70 },
};

// ─── Max Consecutive by Youngest Age Band ──────────────────────────

const MAX_CONSECUTIVE_BY_AGE: Record<AgeBand, number> = {
  '0-2': 2,
  '3-4': 3,
  '5-10': 5,
  '11-17': 7,
};

const AGE_BAND_ORDER: AgeBand[] = ['0-2', '3-4', '5-10', '11-17'];

function youngestAgeBand(bands: AgeBand[]): AgeBand {
  let youngest: AgeBand = '11-17';
  for (const band of bands) {
    if (AGE_BAND_ORDER.indexOf(band) < AGE_BAND_ORDER.indexOf(youngest)) {
      youngest = band;
    }
  }
  return youngest;
}

// ─── Scoring ───────────────────────────────────────────────────────

interface ScoredTemplate {
  template: TemplateDef;
  score: number;
}

function scoreTemplates(input: BaselineInput): ScoredTemplate[] {
  const youngest = youngestAgeBand(input.childrenAgeBands);
  const { goals } = input;

  return TEMPLATES.map((t) => {
    // Step 1: Age-band base score
    let score = AGE_SCORES[t.id][youngest];

    // Step 2: Goal modifiers (±20 max combined)
    if (goals.stabilityFirst) {
      score += t.handoffsPer2Weeks <= 3 ? 15 : 0;
      score += t.handoffsPer2Weeks >= 5 ? -10 : 0;
    }
    if (goals.minimizeSeparation) {
      score += t.maxBlock <= 3 ? 15 : 0;
      score += t.maxBlock >= 7 ? -10 : 0;
    }
    if (goals.fairnessStrict) {
      const isSymmetric = t.nightsA === t.nightsB;
      score += isSymmetric ? 10 : -5;
    }

    // Step 3: Logistics modifiers
    const hasSchoolAnchor =
      input.schoolOrDaycareAnchor === 'school' ||
      input.schoolOrDaycareAnchor === 'daycare';
    const prefersSchoolExchange =
      input.exchangePreference === 'prefer_school_daycare';

    if (hasSchoolAnchor && prefersSchoolExchange && t.schoolAligned) {
      score += 10;
    }

    const dist = input.distanceBetweenHomesMinutes ?? 0;
    if (dist > 45) {
      score += t.handoffsPer2Weeks <= 3 ? 10 : 0;
      score += t.handoffsPer2Weeks >= 5 ? -10 : 0;
    }
    if (dist > 90) {
      if (t.id === 'week-on-week-off' || t.id === 'primary-weekends') {
        score += 10;
      }
    }

    // Step 4: Constraint modifiers
    const constraints = input.parentConstraintsSummary;
    if (constraints) {
      const eitherHasLockedNights =
        (constraints.lockedNightsCountA ?? 0) >= 3 ||
        (constraints.lockedNightsCountB ?? 0) >= 3;
      if (eitherHasLockedNights) {
        score += t.handoffsPer2Weeks >= 5 ? -15 : 0;
      }

      const shiftWork =
        constraints.shiftWorkLikelyA || constraints.shiftWorkLikelyB;
      if (shiftWork) {
        // Predictable-block templates: maxBlock >= 5
        score += t.maxBlock >= 5 ? 10 : 0;
      }
    }

    return { template: t, score };
  });
}

// ─── Max Consecutive Nights ────────────────────────────────────────

function computeMaxConsecutive(input: BaselineInput): number {
  const youngest = youngestAgeBand(input.childrenAgeBands);
  let maxCon = MAX_CONSECUTIVE_BY_AGE[youngest];

  if (input.goals.stabilityFirst) {
    maxCon += 1;
  }
  if (input.goals.minimizeSeparation) {
    maxCon -= 1;
  }

  // Clamp to [2, 7]
  return Math.max(2, Math.min(7, maxCon));
}

// ─── Build Suggestion Reasons ──────────────────────────────────────

function buildSuggestedWhen(t: TemplateDef, input: BaselineInput): string[] {
  const reasons = [...t.suggestedWhenBase];

  const dist = input.distanceBetweenHomesMinutes ?? 0;
  if (dist > 45 && t.handoffsPer2Weeks <= 3) {
    reasons.push('Good for families with longer distance between homes');
  }
  if (
    input.schoolOrDaycareAnchor !== 'none' &&
    input.exchangePreference === 'prefer_school_daycare' &&
    t.schoolAligned
  ) {
    reasons.push('Aligns well with school/daycare handoff preference');
  }

  return reasons;
}

function buildTradeoffs(t: TemplateDef, input: BaselineInput): string[] {
  const tradeoffs = [...t.tradeoffsBase];

  const dist = input.distanceBetweenHomesMinutes ?? 0;
  if (dist > 45 && t.handoffsPer2Weeks >= 5) {
    tradeoffs.push('Many handoffs may be difficult given the distance between homes');
  }

  return tradeoffs;
}

// ─── Build Rationale ───────────────────────────────────────────────

function buildRationale(input: BaselineInput, maxCon: number): string[] {
  const youngest = youngestAgeBand(input.childrenAgeBands);
  const bullets: string[] = [];

  bullets.push(
    `Based on youngest child age band (${youngest}), recommended max consecutive nights: ${maxCon}`,
  );

  if (input.goals.stabilityFirst) {
    bullets.push('Stability-first goal favors fewer handoffs and longer blocks');
  }
  if (input.goals.minimizeSeparation) {
    bullets.push('Minimize-separation goal favors shorter blocks and more frequent contact');
  }
  if (input.goals.fairnessStrict) {
    bullets.push('Strict fairness goal favors near 50/50 time splits');
  }

  const dist = input.distanceBetweenHomesMinutes ?? 0;
  if (dist > 45) {
    bullets.push(
      `Distance between homes (${dist} min) favors fewer transitions`,
    );
  }

  if (input.childrenAgeBands.length > 1) {
    bullets.push(
      'Multiple children — recommendations based on youngest child\'s needs',
    );
  }

  bullets.push(
    'These recommendations are a starting point, not legal or professional advice. Adjust based on your family\'s unique needs.',
  );

  return bullets;
}

// ─── Public API ────────────────────────────────────────────────────

/** @deprecated Use recommendBaselineV2 from scoring.ts instead */
export function recommendBaselines(
  input: BaselineInput,
): BaselineRecommendation {
  const scored = scoreTemplates(input);

  // Sort descending by score
  scored.sort((a, b) => b.score - a.score);

  // Take top 5
  const top5 = scored.slice(0, 5);
  const highestScore = top5[0].score;

  const recommendedTemplates: TemplateRecommendation[] = top5.map((s) => {
    let confidence: 'low' | 'medium' | 'high';
    if (s.score === highestScore) {
      confidence = 'high';
    } else if (highestScore - s.score <= 10) {
      confidence = 'medium';
    } else {
      confidence = 'low';
    }

    return {
      templateId: s.template.id,
      name: s.template.name,
      patternSummary: s.template.pattern,
      typicalHandoffsPer2Weeks: s.template.handoffsPer2Weeks,
      suggestedWhen: buildSuggestedWhen(s.template, input),
      tradeoffs: buildTradeoffs(s.template, input),
      confidence,
    };
  });

  const maxCon = computeMaxConsecutive(input);

  return {
    maxConsecutiveNightsDefault: maxCon,
    maxDaysAwayDefault: maxCon,
    recommendedTemplates,
    rationale: buildRationale(input, maxCon),
  };
}
