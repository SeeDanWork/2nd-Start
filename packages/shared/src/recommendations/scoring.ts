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
  debug?: {
    ageFit: number;
    goalFit: number;
    logisticsFit: number;
    constraintFit: number;
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
 * 1st in preferred → 1.0, 2nd → 0.8, 3rd → 0.6
 * Not listed: 0.3 baseline, penalized if maxBlock > band's maxConsecutive
 */
export function ageFit(
  template: TemplateDefV2,
  bandDefaults: { maxConsecutive: number; preferredTemplates: TemplateId[] },
): number {
  const idx = bandDefaults.preferredTemplates.indexOf(template.id);
  if (idx === 0) return 1.0;
  if (idx === 1) return 0.8;
  if (idx === 2) return 0.6;

  // Not in preferred list
  let score = 0.3;
  if (template.maxBlock > bandDefaults.maxConsecutive) {
    // Penalize proportionally: how far over the limit
    const overshoot = template.maxBlock - bandDefaults.maxConsecutive;
    score -= Math.min(0.2, overshoot * 0.03);
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
  if (dist > 45 && template.handoffsPer2Weeks >= 5) {
    score -= 0.15;
  }
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
  };
  total: number;
}

function scoreAllTemplates(
  input: BaselineRecommendationInputV2,
  bandDefaults: { maxConsecutive: number; preferredTemplates: TemplateId[] },
): ScoredTemplateInternal[] {
  const weights = getWeights(input.goals);

  return TEMPLATES_V2.map((template) => {
    const scores = {
      ageFit: ageFit(template, bandDefaults),
      goalFit: goalFit(template, input.goals),
      logisticsFit: logisticsFit(
        template,
        input.anchor,
        input.exchangePreference,
        input.distanceBetweenHomesMinutes,
      ),
      constraintFit: constraintFit(template, input.constraintsSummary),
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
  const bandDefaults = AGE_BAND_DEFAULTS[youngestAgeBand];
  const scored = scoreAllTemplates(input, bandDefaults);
  scored.sort((a, b) => b.total - a.total);

  // Step 5: Take top 5 and assign confidence
  const top5 = scored.slice(0, 5);
  const highestScore = top5[0]?.total ?? 0;
  const secondScore = top5[1]?.total ?? 0;
  const scoreGap = highestScore - secondScore;

  const recommendedTemplates: TemplateScoreV2[] = top5.map((s, i) => {
    let confidence: 'low' | 'medium' | 'high';
    if (i === 0) {
      confidence = scoreGap >= 0.15 ? 'high' : scoreGap >= 0.10 ? 'medium' : 'low';
    } else {
      const gap = highestScore - s.total;
      confidence = gap <= 0.05 ? 'medium' : 'low';
    }

    // Pattern string from binary array
    const patternStr = s.template.pattern14
      .map((v) => (v === 0 ? 'A' : 'B'))
      .join('');
    const patternSummary = patternStr.slice(0, 7) + ' ' + patternStr.slice(7);

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
    const childScored = scoreAllTemplates(input, childBandDefaults);
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
    total: number;
  }> = {};
  for (const s of scored) {
    scoreBreakdown[s.template.id] = {
      ageFit: Math.round(s.scores.ageFit * 1000) / 1000,
      goalFit: Math.round(s.scores.goalFit * 1000) / 1000,
      logisticsFit: Math.round(s.scores.logisticsFit * 1000) / 1000,
      constraintFit: Math.round(s.scores.constraintFit * 1000) / 1000,
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
