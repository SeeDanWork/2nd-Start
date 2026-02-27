// ─── Rationale & Explanation Layer ────────────────────────────────
//
// Generates human-readable bullets, suggestedWhen, tradeoffs, and
// disclaimers for the V2 recommendation engine.
// Language rules: no "should/must/best"; use "common starting point",
// "often works", "good default".

import type { AgeBandV2 } from './age_baselines';
import type { TemplateDefV2 } from './templates';

// ─── Types ────────────────────────────────────────────────────────

export interface RecommendationInput {
  children: { childId: string; ageBand?: string; birthdate?: string }[];
  anchor: { type: 'daycare' | 'school' | 'none'; days?: number[] };
  exchangePreference: 'prefer_anchor' | 'ok_in_person' | 'unknown';
  distanceBetweenHomesMinutes?: number;
  goals: {
    stabilityFirst: boolean;
    minimizeSeparation: boolean;
    fairnessStrict: boolean;
  };
  constraintsSummary?: {
    lockedNightsCountA?: number;
    lockedNightsCountB?: number;
    shiftWorkLikelyA?: boolean;
    shiftWorkLikelyB?: boolean;
    noInPersonExchange?: boolean;
  };
  aggregationMode?: 'youngest_child_rules' | 'weighted_children';
}

export interface AggregateResult {
  derivedFrom: 'youngest_child_rules' | 'weighted_children';
  maxConsecutive: number;
  maxAway: number;
  youngestBand: AgeBandV2;
}

export interface TemplateScore {
  template: TemplateDefV2;
  score: number;
  confidence: 'low' | 'medium' | 'high';
}

// ─── Band Labels ──────────────────────────────────────────────────

const BAND_LABELS: Record<AgeBandV2, string> = {
  '0-6m': '0–6 months',
  '6-12m': '6–12 months',
  '1-2y': '1–2 years',
  '2-3y': '2–3 years',
  '3-5y': '3–5 years',
  '5-7y': '5–7 years',
  '8-10y': '8–10 years',
  '11-13y': '11–13 years',
  '14-17y': '14–17 years',
};

// ─── Rationale Bullets ────────────────────────────────────────────

export function generateRationale(
  input: RecommendationInput,
  aggregate: AggregateResult,
  topTemplates: TemplateScore[],
): string[] {
  const bullets: string[] = [];

  // Age band context
  const bandLabel = BAND_LABELS[aggregate.youngestBand] ?? aggregate.youngestBand;
  if (input.children.length > 1) {
    bullets.push(
      `Based on the youngest child's age (${bandLabel}), a common starting point is up to ${aggregate.maxConsecutive} consecutive nights`,
    );
  } else {
    bullets.push(
      `For a child in the ${bandLabel} age range, a common starting point is up to ${aggregate.maxConsecutive} consecutive nights`,
    );
  }

  // Goal context
  if (input.goals.stabilityFirst) {
    bullets.push(
      'A stability-focused approach tends to favor fewer handoffs and longer blocks',
    );
  }
  if (input.goals.minimizeSeparation) {
    bullets.push(
      'Prioritizing frequent contact tends to favor shorter blocks and more transitions',
    );
  }
  if (input.goals.fairnessStrict) {
    bullets.push(
      'An equal-time goal favors schedules close to a 50/50 split',
    );
  }

  // Distance context
  const dist = input.distanceBetweenHomesMinutes ?? 0;
  if (dist > 45) {
    bullets.push(
      `With ${dist} minutes between homes, fewer transitions per week can help reduce travel burden`,
    );
  }

  // Top template context
  if (topTemplates.length > 0) {
    const top = topTemplates[0];
    bullets.push(
      `The ${top.template.name} schedule is a common default for this situation`,
    );
  }

  // Multi-child context
  if (input.children.length > 1) {
    const modeLabel =
      aggregate.derivedFrom === 'youngest_child_rules'
        ? "the youngest child's needs"
        : 'an average across all children';
    bullets.push(`Recommendations are based on ${modeLabel}`);
  }

  return bullets;
}

// ─── Per-Template SuggestedWhen ───────────────────────────────────

export function generateSuggestedWhen(
  template: TemplateDefV2,
  input: RecommendationInput,
): string[] {
  const reasons = [...template.suggestedWhenBase];

  const dist = input.distanceBetweenHomesMinutes ?? 0;
  if (dist > 45 && template.handoffsPer2Weeks <= 3) {
    reasons.push('Can work well for families with longer distance between homes');
  }

  if (
    input.anchor.type !== 'none' &&
    input.exchangePreference === 'prefer_anchor' &&
    template.schoolAligned
  ) {
    reasons.push('Aligns with a school/daycare handoff preference');
  }

  if (
    input.goals.fairnessStrict &&
    template.nightsA === template.nightsB
  ) {
    reasons.push('Provides an equal time split between both parents');
  }

  return reasons;
}

// ─── Per-Template Tradeoffs ───────────────────────────────────────

export function generateTradeoffs(
  template: TemplateDefV2,
  input: RecommendationInput,
): string[] {
  const tradeoffs = [...template.tradeoffsBase];

  const dist = input.distanceBetweenHomesMinutes ?? 0;
  if (dist > 45 && template.handoffsPer2Weeks >= 5) {
    tradeoffs.push(
      'Many handoffs may be challenging given the distance between homes',
    );
  }

  if (
    input.goals.fairnessStrict &&
    template.nightsA !== template.nightsB
  ) {
    tradeoffs.push(
      'This schedule does not provide an equal time split',
    );
  }

  return tradeoffs;
}

// ─── Disclaimers ──────────────────────────────────────────────────

export function getDisclaimers(): string[] {
  return [
    'These recommendations are a starting point — you can change them anytime.',
    'This is not legal or professional advice. Consider consulting a family law professional for your specific situation.',
  ];
}
