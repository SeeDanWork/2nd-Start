// ─── Cross-Family Preset Recommendations ─────────────────────────────
//
// Deterministic onboarding suggestions based on common family patterns.
// Pure function, no DB. Returns template ranking priors, suggested
// overlay policies, prompt lead times, and plain-language reasons.

import type { AgeBandV2 } from '../recommendations/age_baselines';
import type { TemplateId } from '../recommendations/templates';
import { AGE_BAND_DEFAULTS } from '../recommendations/age_baselines';
import {
  DisruptionEventType,
  OverlayActionType,
  OverrideStrength,
  LivingArrangement,
} from '../enums';

// ─── Types ────────────────────────────────────────────────────────────

export interface PresetInput {
  locale: string;
  arrangement: LivingArrangement;
  youngestBand: AgeBandV2;
  childCount: number;
  commuteMinutes: number;
  schoolAnchor: boolean;
}

export interface SuggestedPolicy {
  eventType: DisruptionEventType;
  actionType: OverlayActionType;
  strength: OverrideStrength;
  reason: string;
}

export interface PresetOutput {
  templateRanking: TemplateId[];
  suggestedPolicies: SuggestedPolicy[];
  promptLeadTimeHours: number;
  reasons: string[];
}

// ─── Core Function ────────────────────────────────────────────────────

/**
 * Compute preset recommendations for a new family during onboarding.
 *
 * Inputs: locale, arrangement, youngest age band, child count,
 * commute time, school anchor preference.
 *
 * Returns: template ranking, suggested overlay policies, prompt timing,
 * and plain-language explanations.
 */
export function computePresetRecommendations(input: PresetInput): PresetOutput {
  const reasons: string[] = [];
  const suggestedPolicies: SuggestedPolicy[] = [];

  // ── Template Ranking ──────────────────────────────────────────

  // Start from age-band preferred templates
  const bandDefaults = AGE_BAND_DEFAULTS[input.youngestBand];
  const templateRanking: TemplateId[] = [...bandDefaults.preferredTemplates];

  // Arrangement adjustments
  if (input.arrangement === LivingArrangement.PRIMARY_VISITS) {
    // Prioritize primary-friendly templates
    const primaryTemplates: TemplateId[] = ['primary_weekends', 'primary_plus_midweek'];
    for (const t of [...primaryTemplates].reverse()) {
      if (!templateRanking.includes(t)) {
        templateRanking.unshift(t);
      }
    }
    reasons.push('Primary-visits arrangement: prioritized templates with clear primary/visiting structure');
  }

  // Long commute → prefer fewer transitions
  if (input.commuteMinutes > 30) {
    // Push longer-block templates higher
    const longBlockTemplates: TemplateId[] = ['7on7off', '2week_blocks'];
    for (const t of longBlockTemplates) {
      const idx = templateRanking.indexOf(t);
      if (idx > 0) {
        templateRanking.splice(idx, 1);
        templateRanking.unshift(t);
      }
    }
    reasons.push(`${input.commuteMinutes}min commute: prioritized longer-block templates to reduce transitions`);
  }

  // School anchor → emphasize school-based exchanges
  if (input.schoolAnchor) {
    reasons.push('School-anchored: exchanges at school drop-off/pick-up preferred');
  }

  // Multiple children → note sibling unity
  if (input.childCount > 1) {
    reasons.push(`${input.childCount} children: siblings stay together (sibling unity invariant)`);
  }

  // ── Suggested Overlay Policies ────────────────────────────────

  // Always suggest logistics fallback for school closures
  suggestedPolicies.push({
    eventType: DisruptionEventType.SCHOOL_CLOSED,
    actionType: OverlayActionType.LOGISTICS_FALLBACK,
    strength: OverrideStrength.LOGISTICS_ONLY,
    reason: 'Auto-adjust exchange location when school is closed',
  });

  // Holiday logistics
  suggestedPolicies.push({
    eventType: DisruptionEventType.PUBLIC_HOLIDAY,
    actionType: OverlayActionType.LOGISTICS_FALLBACK,
    strength: OverrideStrength.LOGISTICS_ONLY,
    reason: 'Auto-adjust for public holidays',
  });

  // For young children, suggest delaying exchange on illness
  if (['0-6m', '6-12m', '1-2y', '2-3y', '3-5y'].includes(input.youngestBand)) {
    suggestedPolicies.push({
      eventType: DisruptionEventType.CHILD_SICK,
      actionType: OverlayActionType.DELAY_EXCHANGE,
      strength: OverrideStrength.SOFT,
      reason: 'Young children: delay exchange during illness for stability',
    });
  }

  // For long commutes, auto-handle transport failures
  if (input.commuteMinutes > 30) {
    suggestedPolicies.push({
      eventType: DisruptionEventType.TRANSPORT_FAILURE,
      actionType: OverlayActionType.LOGISTICS_FALLBACK,
      strength: OverrideStrength.LOGISTICS_ONLY,
      reason: 'Long commute: auto-adjust for transport disruptions',
    });
  }

  // ── Prompt Lead Time ──────────────────────────────────────────

  let promptLeadTimeHours = 24;
  if (input.commuteMinutes > 45) {
    promptLeadTimeHours = 48;
    reasons.push('Extended prompt lead time (48h) due to long commute');
  }
  if (['0-6m', '6-12m'].includes(input.youngestBand)) {
    promptLeadTimeHours = Math.max(promptLeadTimeHours, 36);
    reasons.push('Infant: extended prompt lead time for care planning');
  }

  return {
    templateRanking,
    suggestedPolicies,
    promptLeadTimeHours,
    reasons,
  };
}
