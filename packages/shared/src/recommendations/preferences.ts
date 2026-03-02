// ─── Parent Preference Scoring (5th Component) ──────────────────────
//
// Adds a preferenceFit() scoring component and mode-dependent weight
// profiles to support three schedule output modes:
//   Evidence Best - pure developmental recommendation
//   Parent Vision - shaped by parent preferences
//   Balanced      - blended approach
//
// Safety: ageFit minAgeMonths hard penalty (0.05) fires before any
// weighting, so age-inappropriate templates are blocked in ALL modes.

import { z } from 'zod';
import type { TemplateDefV2, TemplateId } from './templates';

// ─── Types ────────────────────────────────────────────────────────

export type ScheduleMode = 'evidence' | 'parent_vision' | 'balanced';

export interface ParentPreferenceInput {
  /** 0-100, how much time parent_a wants (50 = equal) */
  targetSharePct: number;
  /** 1-7, preferred handoff ceiling per week */
  maxHandoffsPerWeek: number;
  /** 1-14, max nights away from child */
  maxConsecutiveAway: number;
  /** Weekend arrangement preference */
  weekendPreference: 'equal' | 'primary_a' | 'primary_b' | 'alternating';
  /** Direct template pick (optional) */
  preferredTemplateId?: TemplateId;
  /** How much each preference matters (0-1 each) */
  priorityWeights: {
    timeSplit: number;
    handoffs: number;
    weekends: number;
  };
}

// ─── Zod Schema ──────────────────────────────────────────────────

export const ParentPreferenceInputSchema = z.object({
  targetSharePct: z.number().min(0).max(100),
  maxHandoffsPerWeek: z.number().int().min(1).max(7),
  maxConsecutiveAway: z.number().int().min(1).max(14),
  weekendPreference: z.enum(['equal', 'primary_a', 'primary_b', 'alternating']),
  preferredTemplateId: z.string().optional(),
  priorityWeights: z.object({
    timeSplit: z.number().min(0).max(1),
    handoffs: z.number().min(0).max(1),
    weekends: z.number().min(0).max(1),
  }),
});

// ─── Mode Weight Profiles ────────────────────────────────────────

export interface ModeWeightProfile {
  ageFit: number;
  goalFit: number;
  logisticsFit: number;
  constraintFit: number;
  preferenceFit: number;
}

export const MODE_WEIGHT_PROFILES: Record<ScheduleMode, ModeWeightProfile> = {
  evidence: {
    ageFit: 0.40,
    goalFit: 0.25,
    logisticsFit: 0.20,
    constraintFit: 0.15,
    preferenceFit: 0.00,
  },
  parent_vision: {
    ageFit: 0.15,
    goalFit: 0.10,
    logisticsFit: 0.10,
    constraintFit: 0.00,
    preferenceFit: 0.65,
  },
  balanced: {
    ageFit: 0.25,
    goalFit: 0.20,
    logisticsFit: 0.15,
    constraintFit: 0.10,
    preferenceFit: 0.30,
  },
};

export const ALL_SCHEDULE_MODES: ScheduleMode[] = ['evidence', 'parent_vision', 'balanced'];

// ─── Weekend Pattern Detection ───────────────────────────────────

/**
 * Determines the weekend pattern from a template's 14-day pattern.
 * Weekends are indices 5-6 (Sat-Sun in week 1) and 12-13 (week 2).
 * Pattern uses Mon=0 convention.
 */
function detectWeekendPattern(pattern14: (0 | 1)[]): 'equal' | 'primary_a' | 'primary_b' | 'alternating' {
  // For patterns shorter than 14, tile to 14
  const p: (0 | 1)[] = [];
  for (let i = 0; i < 14; i++) {
    p.push(pattern14[i % pattern14.length]);
  }

  // Sat=5, Sun=6 in week 1; Sat=12, Sun=13 in week 2
  const wk1A = (p[5] === 0 ? 1 : 0) + (p[6] === 0 ? 1 : 0); // A's weekend nights wk1
  const wk2A = (p[12] === 0 ? 1 : 0) + (p[13] === 0 ? 1 : 0); // A's weekend nights wk2
  const totalA = wk1A + wk2A;
  const totalB = 4 - totalA;

  // Check if weeks alternate (one week mostly A, other mostly B)
  if ((wk1A >= 2 && wk2A === 0) || (wk1A === 0 && wk2A >= 2)) {
    return 'alternating';
  }
  if (totalA === totalB) return 'equal';
  if (totalA > totalB) return 'primary_a';
  return 'primary_b';
}

// ─── preferenceFit Scoring ───────────────────────────────────────

/**
 * 5th scoring component: how well does the template match parent preferences?
 *
 * Components:
 * - splitFit: 1 - |templateShare - targetShare| / 50
 * - handoffFit: 1 - |handoffsPerWeek - maxHandoffs| / 4  (clamped 0-1)
 * - consecutiveFit: 1 - max(0, maxBlock - maxConsecutiveAway) / 10
 * - weekendFit: boolean match on weekend pattern
 * - directPickBonus: +0.3 if template matches preferredTemplateId
 *
 * Weighted average using priorityWeights.
 */
export function preferenceFit(
  template: TemplateDefV2,
  prefs: ParentPreferenceInput,
): number {
  // Split fit: how close is the template's A-share to the target?
  const templateSharePct = (template.nightsA / (template.nightsA + template.nightsB)) * 100;
  const splitFit = Math.max(0, 1 - Math.abs(templateSharePct - prefs.targetSharePct) / 50);

  // Handoff fit: how close is handoff count to preference?
  const handoffsPerWeek = template.handoffsPer2Weeks / 2;
  const handoffFit = Math.max(0, Math.min(1, 1 - Math.abs(handoffsPerWeek - prefs.maxHandoffsPerWeek) / 4));

  // Consecutive fit: penalty if maxBlock exceeds preferred max
  const consecutiveFit = Math.max(0, 1 - Math.max(0, template.maxBlock - prefs.maxConsecutiveAway) / 10);

  // Weekend fit: does the template's weekend pattern match preference?
  const templateWeekend = detectWeekendPattern(template.pattern14);
  const weekendFit = templateWeekend === prefs.weekendPreference ? 1.0 : 0.3;

  // Direct pick bonus
  const directPickBonus = prefs.preferredTemplateId === template.id ? 0.3 : 0;

  // Weighted average using priority weights
  const pw = prefs.priorityWeights;
  const totalWeight = pw.timeSplit + pw.handoffs + pw.weekends;

  let score: number;
  if (totalWeight === 0) {
    // Equal weight fallback
    score = (splitFit + handoffFit + weekendFit) / 3;
  } else {
    score =
      (pw.timeSplit * splitFit +
        pw.handoffs * handoffFit +
        pw.weekends * weekendFit) /
      totalWeight;
  }

  // Blend in consecutiveFit (always matters)
  score = score * 0.8 + consecutiveFit * 0.2;

  // Add direct pick bonus (can push above 1.0, capped below)
  score += directPickBonus;

  return Math.max(0, Math.min(1, score));
}
