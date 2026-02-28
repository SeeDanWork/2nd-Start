// ─── Policy Learning Engine ───────────────────────────────────────────
//
// Reduces prompts over time by detecting consistent decision patterns.
// 2 consecutive same-pattern acceptances → eligible for promotion.
// Pure, deterministic, no ML.

import {
  DisruptionEventType,
  OverlayActionType,
  OverrideStrength,
  PolicySource,
} from '../enums';
import type { PolicyDecisionRecord, OverlayPolicy, PromptingRules, FairnessAccounting } from './types';

// ─── Types ────────────────────────────────────────────────────────────

export interface PromotionEligibility {
  eligible: boolean;
  eventType: DisruptionEventType;
  actionType: OverlayActionType;
  consecutiveAcceptances: number;
  requiredForPromotion: number;
  reason: string;
}

export interface LearnedPolicyDraft {
  familyId: string;
  appliesToEventType: DisruptionEventType;
  actionType: OverlayActionType;
  defaultStrength: OverrideStrength;
  promptingRules: PromptingRules;
  fairnessAccounting: FairnessAccounting;
  source: PolicySource.LEARNED_POLICY;
  basedOnDecisions: string[]; // decision record IDs
}

// ─── Constants ────────────────────────────────────────────────────────

/** Number of consecutive same-pattern acceptances needed for promotion */
const PROMOTION_THRESHOLD = 2;

// ─── Core Functions ───────────────────────────────────────────────────

/**
 * Evaluate whether a family's decisions for a given event type
 * are eligible for promotion to a learned policy.
 *
 * Criteria: 2 consecutive accepted decisions with the same actionType.
 */
export function evaluateForPromotion(
  eventType: DisruptionEventType,
  records: PolicyDecisionRecord[],
): PromotionEligibility {
  // Filter to accepted decisions for this event type, sorted by creation
  // (We rely on the caller to pass records filtered by eventType
  //  and in chronological order)
  const accepted = records.filter((r) => r.accepted === true);

  if (accepted.length < PROMOTION_THRESHOLD) {
    return {
      eligible: false,
      eventType,
      actionType: accepted[0]?.actionTaken as OverlayActionType ?? OverlayActionType.NO_OVERRIDE,
      consecutiveAcceptances: accepted.length,
      requiredForPromotion: PROMOTION_THRESHOLD,
      reason: `Need ${PROMOTION_THRESHOLD} consecutive acceptances, have ${accepted.length}`,
    };
  }

  // Check the last N records for same-pattern consecutive acceptances
  const recent = accepted.slice(-PROMOTION_THRESHOLD);
  const actionTypes = new Set(recent.map((r) => r.actionTaken));

  if (actionTypes.size === 1) {
    const action = recent[0].actionTaken as OverlayActionType;
    return {
      eligible: true,
      eventType,
      actionType: action,
      consecutiveAcceptances: PROMOTION_THRESHOLD,
      requiredForPromotion: PROMOTION_THRESHOLD,
      reason: `${PROMOTION_THRESHOLD} consecutive acceptances of ${action}`,
    };
  }

  // Not eligible: mixed actions
  const lastAction = accepted[accepted.length - 1].actionTaken as OverlayActionType;
  return {
    eligible: false,
    eventType,
    actionType: lastAction,
    consecutiveAcceptances: 1,
    requiredForPromotion: PROMOTION_THRESHOLD,
    reason: 'Mixed action patterns — no consistent preference detected',
  };
}

/**
 * Build a learned policy from eligible decision records.
 * Requires explicit user consent before actual promotion.
 */
export function buildLearnedPolicy(
  familyId: string,
  eligibility: PromotionEligibility,
  records: PolicyDecisionRecord[],
): LearnedPolicyDraft | null {
  if (!eligibility.eligible) return null;

  const accepted = records.filter((r) => r.accepted === true);
  const recent = accepted.slice(-PROMOTION_THRESHOLD);

  return {
    familyId,
    appliesToEventType: eligibility.eventType,
    actionType: eligibility.actionType,
    defaultStrength: OverrideStrength.SOFT,
    promptingRules: {
      leadTimeHours: 0,
      suppressPrompt: true,
      maxAutoApply: 5,
    },
    fairnessAccounting: {
      countsTowardFairness: true,
      createCompensatory: false,
      maxCompensatoryDays: 0,
    },
    source: PolicySource.LEARNED_POLICY,
    basedOnDecisions: recent.map((r) => r.id),
  };
}
