// ─── Policy Resolution ────────────────────────────────────────────────
//
// 3-tier resolution: family-specific > learned > global > safe fallback.
// Pure functions — no DB access.

import {
  DisruptionEventType,
  OverlayActionType,
  OverrideStrength,
  PolicySource,
} from '../enums';
import type { OverlayPolicy } from './types';
import { getDefaultPolicy, type DefaultPolicyEntry } from './default_policies';

// ─── Types ────────────────────────────────────────────────────────────

export interface ResolvedPolicy {
  actionType: OverlayActionType;
  strength: OverrideStrength;
  source: PolicySource;
  policyId: string | null;
  description: string;
}

// ─── Safe Fallback ────────────────────────────────────────────────────

const SAFE_FALLBACK: ResolvedPolicy = {
  actionType: OverlayActionType.NO_OVERRIDE,
  strength: OverrideStrength.NONE,
  source: PolicySource.GLOBAL_DEFAULT,
  policyId: null,
  description: 'Safe fallback: no override applied',
};

// ─── Resolution ───────────────────────────────────────────────────────

/**
 * Resolve the applicable policy for a given event type.
 *
 * Precedence:
 * 1. Family-specific (source=FAMILY_SPECIFIC, familyId matches, isActive)
 * 2. Learned (source=LEARNED_POLICY, familyId matches, isActive)
 * 3. Global default (from DEFAULT_POLICIES table)
 * 4. Safe fallback (NO_OVERRIDE)
 */
export function resolvePolicy(
  eventType: DisruptionEventType,
  familyPolicies: OverlayPolicy[],
): ResolvedPolicy {
  // Filter to active policies matching this event type
  const matching = familyPolicies.filter(
    (p) => p.appliesToEventType === eventType && p.isActive,
  );

  // 1. Family-specific
  const familySpecific = matching.find(
    (p) => p.source === PolicySource.FAMILY_SPECIFIC,
  );
  if (familySpecific) {
    return {
      actionType: familySpecific.actionType,
      strength: familySpecific.defaultStrength,
      source: PolicySource.FAMILY_SPECIFIC,
      policyId: familySpecific.id,
      description: `Family-specific policy for ${eventType}`,
    };
  }

  // 2. Learned
  const learned = matching.find(
    (p) => p.source === PolicySource.LEARNED_POLICY,
  );
  if (learned) {
    return {
      actionType: learned.actionType,
      strength: learned.defaultStrength,
      source: PolicySource.LEARNED_POLICY,
      policyId: learned.id,
      description: `Learned policy for ${eventType}`,
    };
  }

  // 3. Global default
  const globalDefault = getDefaultPolicy(eventType);
  return fromDefaultEntry(globalDefault);
}

/**
 * Convert a DefaultPolicyEntry to a ResolvedPolicy.
 */
function fromDefaultEntry(entry: DefaultPolicyEntry): ResolvedPolicy {
  return {
    actionType: entry.actionType,
    strength: entry.defaultStrength,
    source: PolicySource.GLOBAL_DEFAULT,
    policyId: null,
    description: entry.description,
  };
}

/**
 * Always returns a safe NO_OVERRIDE result.
 */
export function safeFallback(): ResolvedPolicy {
  return { ...SAFE_FALLBACK };
}
