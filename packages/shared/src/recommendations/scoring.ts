// ─── V2 Scoring Engine ────────────────────────────────────────────
//
// Zod-validated input, 4-component scoring (ageFit, goalFit,
// logisticsFit, constraintFit), and the recommendBaselineV2()
// orchestrator that produces per-child + aggregate recommendations.

import { z } from 'zod';
import {
  type AgeBandV2,
  type PerChildDefaults,
  type AggregatedDefaults,
  AGE_BAND_DEFAULTS,
  AGE_BAND_ORDER_V2,
  ageInMonths,
  getChildDefaults,
  youngestBand,
  adjustMaxConsecutive,
  aggregateDefaults,
} from './age_baselines';
import { type TemplateDefV2, type TemplateId, TEMPLATES_V2 } from './templates';
import {
  generateRationale,
  generateSuggestedWhen,
  generateTradeoffs,
  getDisclaimers,
} from './explain';
import {
  type ParentPreferenceInput,
  type ScheduleMode,
  type ModeWeightProfile,
  MODE_WEIGHT_PROFILES,
  ALL_SCHEDULE_MODES,
  preferenceFit,
} from './preferences';

// ─── Zod Input Schema ─────────────────────────────────────────────

export const BaselineRecommendationInputSchema = z.object({
  children: z
    .array(
      z
        .object({
          childId: z.string(),
          ageBand: z.string().optional(),
          birthdate: z
            .string()
            .regex(/^\d{4}-\d{2}-\d{2}$/, 'Birthdate must be YYYY-MM-DD')
            .optional(),
        })
        .refine((c) => c.ageBand || c.birthdate, {
          message: 'Each child needs ageBand or birthdate',
        }),
    )
    .min(1),
  anchor: z.object({
    type: z.enum(['daycare', 'school', 'none']),
    days: z.array(z.number().int().min(0).max(6)).optional(),
  }),
  exchangePreference: z.enum(['prefer_anchor', 'ok_in_person', 'unknown']),
  distanceBetweenHomesMinutes: z.number().min(0).optional(),
  goals: z.object({
    stabilityFirst: z.boolean(),
    minimizeSeparation: z.boolean(),
    fairnessStrict: z.boolean(),
  }),
  constraintsSummary: z
    .object({
      lockedNightsCountA: z.number().int().min(0).optional(),
      lockedNightsCountB: z.number().int().min(0).optional(),
      shiftWorkLikelyA: z.boolean().optional(),
      shiftWorkLikelyB: z.boolean().optional(),
      noInPersonExchange: z.boolean().optional(),
    })
    .optional(),
  aggregationMode: z
    .enum(['youngest_child_rules', 'weighted_children'])
    .default('youngest_child_rules'),
});

export type BaselineRecommendationInputV2 = z.infer<
  typeof BaselineRecommendationInputSchema
>;

// ─── Output Types ─────────────────────────────────────────────────

export interface TemplateScoreV2 {
  templateId: TemplateId;
  name: string;
  patternSummary: string;
  score: number;
  confidence: 'low' | 'medium' | 'high';
  suggestedWhen: string[];
  tradeoffs: string[];
  mode?: ScheduleMode;
  debug?: {
    ageFit: number;
    goalFit: number;
    logisticsFit: number;
    constraintFit: number;
    preferenceFit?: number;
  };
}

export interface BaselineRecommendationOutputV2 {
  perChild: Record<
    string,
    {
      ageBand: AgeBandV2;
      defaults: { maxConsecutive: number; maxAway: number };
      templateRanks: TemplateId[];
    }
  >;
  aggregate: {
    derivedFrom: 'youngest_child_rules' | 'weighted_children';
    defaults: { maxConsecutive: number; maxAway: number };
    recommendedTemplates: TemplateScoreV2[];
    rationaleBullets: string[];
  };
  disclaimers: string[];
  debug?: {
    scoreBreakdown: Record<TemplateId, {
      ageFit: number;
      goalFit: number;
      logisticsFit: number;
      constraintFit: number;
      total: number;
    }>;
  };
}

// ─── Scoring Weights ──────────────────────────────────────────────

interface Weights {
  ageFit: number;
  goalFit: number;
  logisticsFit: number;
  constraintFit: number;
}

function getWeights(goals: BaselineRecommendationInputV2['goals']): Weights {
  const noGoals =
    !goals.stabilityFirst && !goals.minimizeSeparation && !goals.fairnessStrict;

  let w: Weights;

  if (noGoals) {
    w = { ageFit: 0.40, goalFit: 0.25, logisticsFit: 0.20, constraintFit: 0.15 };
  } else if (goals.stabilityFirst) {
    w = { ageFit: 0.30, goalFit: 0.35, logisticsFit: 0.20, constraintFit: 0.15 };
  } else if (goals.minimizeSeparation) {
    w = { ageFit: 0.30, goalFit: 0.35, logisticsFit: 0.15, constraintFit: 0.20 };
  } else {
    w = { ageFit: 0.40, goalFit: 0.25, logisticsFit: 0.20, constraintFit: 0.15 };
  }

  if (goals.fairnessStrict) {
    w.goalFit += 0.05;
    w.ageFit -= 0.05;
  }

  return w;
}

// ─── 4 Scoring Components ─────────────────────────────────────────

/**
 * ageFit: How well does the template match the age band's preferred list?
 * 1st in preferred → 1.0, 2nd → 0.85, 3rd → 0.70, 4th → 0.55
 * Not listed: 0.25 baseline, penalized if maxBlock > band's maxConsecutive
 * Templates below minimum age get a hard penalty.
 */
export function ageFit(
  template: TemplateDefV2,
  bandDefaults: { maxConsecutive: number; preferredTemplates: TemplateId[] },
  childAgeMonths?: number,
): number {
  // Hard penalty if child is below template's minimum recommended age
  if (childAgeMonths != null && template.minAgeMonths > 0 && childAgeMonths < template.minAgeMonths) {
    return 0.05;
  }

  const idx = bandDefaults.preferredTemplates.indexOf(template.id);
  if (idx === 0) return 1.0;
  if (idx === 1) return 0.85;
  if (idx === 2) return 0.70;
  if (idx === 3) return 0.55;

  // Not in preferred list
  let score = 0.25;
  if (template.maxBlock > bandDefaults.maxConsecutive) {
    // Penalize proportionally: how far over the limit
    const overshoot = template.maxBlock - bandDefaults.maxConsecutive;
    score -= Math.min(0.2, overshoot * 0.04);
  }
  return Math.max(0, score);
}

/**
 * goalFit: How well does the template align with stated goals?
 * No goals → 0.5 baseline.
 * stabilityFirst: rewards low handoffs (linear 1.0→0.0 over 1-8 range)
 * minimizeSeparation: rewards short maxBlock (linear 1.0→0.0 over 1-14 range)
 * fairnessStrict: symmetric→1.0, asymmetric→0.3
 * Multiple goals: average
 */
export function goalFit(
  template: TemplateDefV2,
  goals: BaselineRecommendationInputV2['goals'],
): number {
  const components: number[] = [];

  if (goals.stabilityFirst) {
    // Linear: handoffs=1→1.0, handoffs=8→0.0
    const score = Math.max(0, 1.0 - (template.handoffsPer2Weeks - 1) / 7);
    components.push(score);
  }

  if (goals.minimizeSeparation) {
    // Linear: maxBlock=1→1.0, maxBlock=14→0.0
    const score = Math.max(0, 1.0 - (template.maxBlock - 1) / 13);
    components.push(score);
  }

  if (goals.fairnessStrict) {
    const isSymmetric = template.nightsA === template.nightsB;
    components.push(isSymmetric ? 1.0 : 0.3);
  }

  if (components.length === 0) return 0.5;
  return components.reduce((a, b) => a + b, 0) / components.length;
}

/**
 * logisticsFit: Anchor alignment, distance, exchange preference.
 * Base 0.5. School anchor + prefer_anchor + schoolAligned → +0.25.
 * Distance >45min penalizes high-handoff templates.
 * Distance >90min bonuses for low-handoff templates.
 */
export function logisticsFit(
  template: TemplateDefV2,
  anchor: BaselineRecommendationInputV2['anchor'],
  exchangePreference: BaselineRecommendationInputV2['exchangePreference'],
  distanceMinutes?: number,
): number {
  let score = 0.5;

  const hasAnchor = anchor.type === 'school' || anchor.type === 'daycare';
  if (hasAnchor && exchangePreference === 'prefer_anchor' && template.schoolAligned) {
    score += 0.25;
  }

  const dist = distanceMinutes ?? 0;

  // Close distance (≤30 min) makes frequent handoffs easy
  if (dist <= 30 && template.handoffsPer2Weeks <= 4) {
    // Longer blocks don't leverage the convenience of proximity
    score -= 0.10;
  }

  // Medium distance penalizes high handoffs
  if (dist > 45 && template.handoffsPer2Weeks >= 5) {
    score -= 0.15;
  }

  // Long distance rewards low handoffs
  if (dist > 90) {
    const lowHandoffTemplates: TemplateId[] = [
      '7on7off',
      '2week_blocks',
      'primary_weekends',
    ];
    if (lowHandoffTemplates.includes(template.id)) {
      score += 0.15;
    }
  }

  // ok_in_person with school anchor: schoolAligned gets a small boost
  if (hasAnchor && exchangePreference === 'ok_in_person' && template.schoolAligned) {
    score += 0.10;
  }

  return Math.max(0, Math.min(1, score));
}

/**
 * constraintFit: Locked nights, shift work, exchange restrictions.
 * Base 0.5. Locked nights ≥3 penalizes frequent handoffs.
 * Shift work bonuses long blocks. noInPersonExchange bonuses schoolAligned.
 */
export function constraintFit(
  template: TemplateDefV2,
  constraints?: BaselineRecommendationInputV2['constraintsSummary'],
): number {
  if (!constraints) return 0.5;
  let score = 0.5;

  const eitherLocked =
    (constraints.lockedNightsCountA ?? 0) >= 3 ||
    (constraints.lockedNightsCountB ?? 0) >= 3;
  if (eitherLocked && template.handoffsPer2Weeks >= 5) {
    score -= 0.2;
  }

  const shiftWork =
    constraints.shiftWorkLikelyA || constraints.shiftWorkLikelyB;
  if (shiftWork && template.maxBlock >= 5) {
    score += 0.15;
  }

  if (constraints.noInPersonExchange && template.schoolAligned) {
    score += 0.15;
  }

  return Math.max(0, Math.min(1, score));
}

// ─── Template Scoring Pipeline ────────────────────────────────────

interface ScoredTemplateInternal {
  template: TemplateDefV2;
  scores: {
    ageFit: number;
    goalFit: number;
    logisticsFit: number;
    constraintFit: number;
    preferenceFit: number;
  };
  total: number;
}

function scoreAllTemplates(
  input: BaselineRecommendationInputV2,
  bandDefaults: { maxConsecutive: number; preferredTemplates: TemplateId[] },
  childAgeMonths?: number,
  preferences?: ParentPreferenceInput,
): ScoredTemplateInternal[] {
  const weights = getWeights(input.goals);

  return TEMPLATES_V2.map((template) => {
    const scores = {
      ageFit: ageFit(template, bandDefaults, childAgeMonths),
      goalFit: goalFit(template, input.goals),
      logisticsFit: logisticsFit(
        template,
        input.anchor,
        input.exchangePreference,
        input.distanceBetweenHomesMinutes,
      ),
      constraintFit: constraintFit(template, input.constraintsSummary),
      preferenceFit: preferences ? preferenceFit(template, preferences) : 0,
    };

    const total =
      weights.ageFit * scores.ageFit +
      weights.goalFit * scores.goalFit +
      weights.logisticsFit * scores.logisticsFit +
      weights.constraintFit * scores.constraintFit;

    return { template, scores, total };
  });
}

// ─── Orchestrator ─────────────────────────────────────────────────

export function recommendBaselineV2(
  rawInput: BaselineRecommendationInputV2,
): BaselineRecommendationOutputV2 {
  // Validate with Zod
  const input = BaselineRecommendationInputSchema.parse(rawInput);

  // Step 1: Per-child defaults
  const perChildList: PerChildDefaults[] = input.children.map((child) =>
    getChildDefaults(
      { childId: child.childId, ageBand: child.ageBand as AgeBandV2, birthdate: child.birthdate },
    ),
  );

  // Step 2: Aggregate defaults
  const aggDefaults: AggregatedDefaults = aggregateDefaults(
    perChildList,
    input.aggregationMode,
  );

  // Step 3: Adjust for goals
  const youngestAgeBand = youngestBand(perChildList.map((c) => c.ageBand));
  const adjustedMaxConsecutive = adjustMaxConsecutive(
    aggDefaults.maxConsecutive,
    input.goals,
    youngestAgeBand,
  );
  const adjustedMaxAway = adjustMaxConsecutive(
    aggDefaults.maxAway,
    input.goals,
    youngestAgeBand,
  );

  // Step 4: Score templates against aggregate band
  // Compute youngest child's age in months for minAgeMonths penalty
  const youngestChild = perChildList.reduce((youngest, c) => {
    const cIdx = AGE_BAND_ORDER_V2.indexOf(c.ageBand);
    const yIdx = AGE_BAND_ORDER_V2.indexOf(youngest.ageBand);
    return cIdx < yIdx ? c : youngest;
  }, perChildList[0]);
  const youngestBirthdate = input.children.find(
    (c) => c.childId === youngestChild.childId,
  )?.birthdate;
  const youngestAgeMonths = youngestBirthdate
    ? ageInMonths(youngestBirthdate)
    : undefined;

  const bandDefaults = AGE_BAND_DEFAULTS[youngestAgeBand];
  const scored = scoreAllTemplates(input, bandDefaults, youngestAgeMonths);
  scored.sort((a, b) => b.total - a.total);

  // Step 5: Take top 5 and assign confidence
  // Use relative gap (gap / topScore) since logistics+constraint flatten absolute gaps
  const top5 = scored.slice(0, 5);
  const highestScore = top5[0]?.total ?? 0;
  const secondScore = top5[1]?.total ?? 0;
  const scoreGap = highestScore - secondScore;
  const relativeGap = highestScore > 0 ? scoreGap / highestScore : 0;

  const recommendedTemplates: TemplateScoreV2[] = top5.map((s, i) => {
    let confidence: 'low' | 'medium' | 'high';
    if (i === 0) {
      // Relative gap: 15%+ of top score = high, 8%+ = medium
      confidence = relativeGap >= 0.15 ? 'high' : relativeGap >= 0.08 ? 'medium' : 'low';
    } else {
      const gap = highestScore - s.total;
      const relGap = highestScore > 0 ? gap / highestScore : 0;
      confidence = relGap <= 0.08 ? 'medium' : 'low';
    }

    // Pattern string from binary array, split into 7-day weeks
    const patternStr = s.template.pattern14
      .map((v) => (v === 0 ? 'A' : 'B'))
      .join('');
    const weeks: string[] = [];
    for (let w = 0; w < patternStr.length; w += 7) {
      weeks.push(patternStr.slice(w, w + 7));
    }
    const patternSummary = weeks.join(' ');

    return {
      templateId: s.template.id,
      name: s.template.name,
      patternSummary,
      score: Math.round(s.total * 1000) / 1000,
      confidence,
      suggestedWhen: generateSuggestedWhen(s.template, input),
      tradeoffs: generateTradeoffs(s.template, input),
      debug: {
        ageFit: Math.round(s.scores.ageFit * 1000) / 1000,
        goalFit: Math.round(s.scores.goalFit * 1000) / 1000,
        logisticsFit: Math.round(s.scores.logisticsFit * 1000) / 1000,
        constraintFit: Math.round(s.scores.constraintFit * 1000) / 1000,
      },
    };
  });

  // Step 6: Build per-child output
  const perChild: BaselineRecommendationOutputV2['perChild'] = {};
  for (const child of perChildList) {
    const childBandDefaults = AGE_BAND_DEFAULTS[child.ageBand];
    const childBirthdate = input.children.find(
      (c) => c.childId === child.childId,
    )?.birthdate;
    const childAgeMonths = childBirthdate
      ? ageInMonths(childBirthdate)
      : undefined;
    const childScored = scoreAllTemplates(input, childBandDefaults, childAgeMonths);
    childScored.sort((a, b) => b.total - a.total);

    perChild[child.childId] = {
      ageBand: child.ageBand,
      defaults: {
        maxConsecutive: adjustMaxConsecutive(
          child.defaults.maxConsecutive,
          input.goals,
          child.ageBand,
        ),
        maxAway: adjustMaxConsecutive(
          child.defaults.maxAway,
          input.goals,
          child.ageBand,
        ),
      },
      templateRanks: childScored.slice(0, 5).map((s) => s.template.id),
    };
  }

  // Step 7: Generate rationale
  const rationaleBullets = generateRationale(
    input,
    {
      derivedFrom: aggDefaults.derivedFrom,
      maxConsecutive: adjustedMaxConsecutive,
      maxAway: adjustedMaxAway,
      youngestBand: youngestAgeBand,
    },
    recommendedTemplates.map((t) => ({
      template: TEMPLATES_V2.find((tt) => tt.id === t.templateId)!,
      score: t.score,
      confidence: t.confidence,
    })),
  );

  // Step 8: Build debug breakdown
  const scoreBreakdown: Record<string, {
    ageFit: number;
    goalFit: number;
    logisticsFit: number;
    constraintFit: number;
    preferenceFit: number;
    total: number;
  }> = {};
  for (const s of scored) {
    scoreBreakdown[s.template.id] = {
      ageFit: Math.round(s.scores.ageFit * 1000) / 1000,
      goalFit: Math.round(s.scores.goalFit * 1000) / 1000,
      logisticsFit: Math.round(s.scores.logisticsFit * 1000) / 1000,
      constraintFit: Math.round(s.scores.constraintFit * 1000) / 1000,
      preferenceFit: Math.round(s.scores.preferenceFit * 1000) / 1000,
      total: Math.round(s.total * 1000) / 1000,
    };
  }

  return {
    perChild,
    aggregate: {
      derivedFrom: aggDefaults.derivedFrom,
      defaults: {
        maxConsecutive: adjustedMaxConsecutive,
        maxAway: adjustedMaxAway,
      },
      recommendedTemplates,
      rationaleBullets,
    },
    disclaimers: getDisclaimers(),
    debug: { scoreBreakdown: scoreBreakdown as any },
  };
}

// ─── Three-Mode Output ───────────────────────────────────────────

export interface ThreeModeRecommendation {
  mode: ScheduleMode;
  recommendedTemplates: TemplateScoreV2[];
  /** Score breakdown keyed by templateId */
  scoreBreakdown: Record<string, {
    ageFit: number;
    goalFit: number;
    logisticsFit: number;
    constraintFit: number;
    preferenceFit: number;
    total: number;
  }>;
}

export interface ThreeModeOutput {
  evidence: ThreeModeRecommendation;
  parentVision: ThreeModeRecommendation;
  balanced: ThreeModeRecommendation;
  /** Full recommendation output from evidence mode (backward compatible) */
  baselineOutput: BaselineRecommendationOutputV2;
}

/**
 * Produces 3 ranked template lists from a single scoring pass by applying
 * mode-dependent weight profiles. The evidence mode is identical to
 * recommendBaselineV2() output.
 */
export function recommendThreeModes(
  rawInput: BaselineRecommendationInputV2,
  preferences: ParentPreferenceInput,
): ThreeModeOutput {
  // Validate
  const input = BaselineRecommendationInputSchema.parse(rawInput);

  // Get the baseline output (evidence mode — unchanged behavior)
  const baselineOutput = recommendBaselineV2(input);

  // Resolve child age info for scoring
  const perChildList = input.children.map((child) =>
    getChildDefaults(
      { childId: child.childId, ageBand: child.ageBand as AgeBandV2, birthdate: child.birthdate },
    ),
  );
  const youngestAgeBand = youngestBand(perChildList.map((c) => c.ageBand));
  const youngestChild = perChildList.reduce((youngest, c) => {
    const cIdx = AGE_BAND_ORDER_V2.indexOf(c.ageBand);
    const yIdx = AGE_BAND_ORDER_V2.indexOf(youngest.ageBand);
    return cIdx < yIdx ? c : youngest;
  }, perChildList[0]);
  const youngestBirthdate = input.children.find(
    (c) => c.childId === youngestChild.childId,
  )?.birthdate;
  const youngestAgeMonths = youngestBirthdate
    ? ageInMonths(youngestBirthdate)
    : undefined;
  const bandDefaults = AGE_BAND_DEFAULTS[youngestAgeBand];

  // Score all templates once (with preference scores computed)
  const rawScored = scoreAllTemplates(input, bandDefaults, youngestAgeMonths, preferences);

  // For each mode, apply mode-specific weights and produce a ranked list
  function buildModeResult(mode: ScheduleMode): ThreeModeRecommendation {
    const modeWeights: ModeWeightProfile = MODE_WEIGHT_PROFILES[mode];

    // Compute mode-weighted totals
    const modeScored = rawScored.map((s) => {
      const total =
        modeWeights.ageFit * s.scores.ageFit +
        modeWeights.goalFit * s.scores.goalFit +
        modeWeights.logisticsFit * s.scores.logisticsFit +
        modeWeights.constraintFit * s.scores.constraintFit +
        modeWeights.preferenceFit * s.scores.preferenceFit;
      return { ...s, total };
    });

    // Sort by total descending
    modeScored.sort((a, b) => b.total - a.total);

    // Take top 5
    const top5 = modeScored.slice(0, 5);
    const highestScore = top5[0]?.total ?? 0;
    const secondScore = top5[1]?.total ?? 0;
    const scoreGap = highestScore - secondScore;
    const relativeGap = highestScore > 0 ? scoreGap / highestScore : 0;

    const recommendedTemplates: TemplateScoreV2[] = top5.map((s, i) => {
      let confidence: 'low' | 'medium' | 'high';
      if (i === 0) {
        confidence = relativeGap >= 0.15 ? 'high' : relativeGap >= 0.08 ? 'medium' : 'low';
      } else {
        const gap = highestScore - s.total;
        const relGap = highestScore > 0 ? gap / highestScore : 0;
        confidence = relGap <= 0.08 ? 'medium' : 'low';
      }

      const patternStr = s.template.pattern14
        .map((v) => (v === 0 ? 'A' : 'B'))
        .join('');
      const weeks: string[] = [];
      for (let w = 0; w < patternStr.length; w += 7) {
        weeks.push(patternStr.slice(w, w + 7));
      }

      return {
        templateId: s.template.id,
        name: s.template.name,
        patternSummary: weeks.join(' '),
        score: Math.round(s.total * 1000) / 1000,
        confidence,
        suggestedWhen: generateSuggestedWhen(s.template, input),
        tradeoffs: generateTradeoffs(s.template, input),
        mode,
        debug: {
          ageFit: Math.round(s.scores.ageFit * 1000) / 1000,
          goalFit: Math.round(s.scores.goalFit * 1000) / 1000,
          logisticsFit: Math.round(s.scores.logisticsFit * 1000) / 1000,
          constraintFit: Math.round(s.scores.constraintFit * 1000) / 1000,
          preferenceFit: Math.round(s.scores.preferenceFit * 1000) / 1000,
        },
      };
    });

    // Build score breakdown for all templates
    const scoreBreakdown: ThreeModeRecommendation['scoreBreakdown'] = {};
    for (const s of modeScored) {
      scoreBreakdown[s.template.id] = {
        ageFit: Math.round(s.scores.ageFit * 1000) / 1000,
        goalFit: Math.round(s.scores.goalFit * 1000) / 1000,
        logisticsFit: Math.round(s.scores.logisticsFit * 1000) / 1000,
        constraintFit: Math.round(s.scores.constraintFit * 1000) / 1000,
        preferenceFit: Math.round(s.scores.preferenceFit * 1000) / 1000,
        total: Math.round(s.total * 1000) / 1000,
      };
    }

    return { mode, recommendedTemplates, scoreBreakdown };
  }

  return {
    evidence: buildModeResult('evidence'),
    parentVision: buildModeResult('parent_vision'),
    balanced: buildModeResult('balanced'),
    baselineOutput,
  };
}
