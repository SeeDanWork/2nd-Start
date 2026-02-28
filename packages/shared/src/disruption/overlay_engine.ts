// ─── Overlay Engine ───────────────────────────────────────────────────
//
// Core engine: event + policy + current assignments → overlay result.
// Pure functions — no DB, no side effects.

import {
  DisruptionEventType,
  OverlayActionType,
  OverrideStrength,
} from '../enums';
import type {
  DisruptionEvent,
  DisruptionOverlayResult,
  OverlayLock,
  LogisticsAdjustment,
  WeightAdjustment,
  SolverPayloadOverlay,
  SolverLockedNight,
} from './types';
import type { ResolvedPolicy } from './policy_resolver';

// ─── Date Helpers ─────────────────────────────────────────────────────

function datesInRange(start: string, end: string): string[] {
  const dates: string[] = [];
  const current = new Date(start + 'T00:00:00Z');
  const endDate = new Date(end + 'T00:00:00Z');
  while (current <= endDate) {
    dates.push(current.toISOString().split('T')[0]);
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return dates;
}

function durationHours(start: string, end: string): number {
  const s = new Date(start + 'T00:00:00Z').getTime();
  const e = new Date(end + 'T23:59:59Z').getTime();
  return (e - s) / (1000 * 60 * 60);
}

// ─── Overlay Computation ──────────────────────────────────────────────

export interface CurrentAssignment {
  date: string;
  assignedTo: string;  // 'parent_a' | 'parent_b'
}

/**
 * Compute overlay result for a disruption event given resolved policy
 * and current schedule assignments.
 */
export function computeOverlay(
  event: DisruptionEvent,
  policy: ResolvedPolicy,
  currentAssignments: CurrentAssignment[],
): DisruptionOverlayResult {
  const dates = datesInRange(event.startDate, event.endDate);
  const locks: OverlayLock[] = [];
  const logisticsAdjustments: LogisticsAdjustment[] = [];
  const weightAdjustments: WeightAdjustment[] = [];
  const reasons: string[] = [];
  let requiresProposal = false;
  const compensatoryDays: string[] = [];

  const assignmentMap = new Map(
    currentAssignments.map((a) => [a.date, a.assignedTo]),
  );

  switch (policy.actionType) {
    case OverlayActionType.NO_OVERRIDE:
      reasons.push('No override applied — base schedule sovereignty (Rule A)');
      break;

    case OverlayActionType.LOGISTICS_FALLBACK:
      // Rule B: Exchange location changes, assignment stays
      for (const date of dates) {
        logisticsAdjustments.push({
          date,
          originalLocation: 'school',
          newLocation: 'home',
          reason: `${event.type}: exchange location fallback`,
        });
      }
      reasons.push(`Logistics fallback for ${dates.length} day(s)`);
      break;

    case OverlayActionType.BLOCK_ASSIGNMENT: {
      // Lock affected days to the OTHER parent (or current if no metadata)
      const blockedParent = (event.metadata?.affectedParent as string) || null;
      for (const date of dates) {
        const current = assignmentMap.get(date);
        if (blockedParent) {
          // Block from the affected parent → assign to the other
          const otherParent = blockedParent === 'parent_a' ? 'parent_b' : 'parent_a';
          locks.push({
            date,
            assignedTo: otherParent,
            reason: `${event.type}: blocked from ${blockedParent}`,
          });
        } else if (current) {
          // Keep current assignment as a lock
          locks.push({
            date,
            assignedTo: current,
            reason: `${event.type}: locked to current assignment`,
          });
        }
      }
      reasons.push(`Blocked ${dates.length} day(s) due to ${event.type}`);

      // Schedule compensatory days after disruption
      if (dates.length > 0) {
        const afterEnd = new Date(event.endDate + 'T00:00:00Z');
        for (let i = 1; i <= Math.min(dates.length, 3); i++) {
          const compDate = new Date(afterEnd);
          compDate.setUTCDate(compDate.getUTCDate() + i);
          compensatoryDays.push(compDate.toISOString().split('T')[0]);
        }
      }
      break;
    }

    case OverlayActionType.DELAY_EXCHANGE:
      // Rule D: Short disruption — keep current, delay any transitions
      for (const date of dates) {
        const current = assignmentMap.get(date);
        if (current) {
          locks.push({
            date,
            assignedTo: current,
            reason: `${event.type}: exchange delayed (short disruption ≤72h)`,
          });
        }
      }
      reasons.push(`Exchange delayed for ${dates.length} day(s)`);
      break;

    case OverlayActionType.GENERATE_PROPOSALS:
      // Rule E: Long disruption — solver should rebalance
      requiresProposal = true;
      // Increase fairness weight to ensure rebalancing
      weightAdjustments.push({
        key: 'fairnessDeviation',
        multiplier: 1.5,
        reason: `${event.type}: increased fairness weight for rebalancing`,
      });
      reasons.push(`Proposal generation required for ${dates.length}-day disruption`);
      break;
  }

  // Duration-based weight adjustments
  const hours = durationHours(event.startDate, event.endDate);
  if (hours > 72 && policy.actionType !== OverlayActionType.GENERATE_PROPOSALS) {
    weightAdjustments.push({
      key: 'fairnessDeviation',
      multiplier: 1.3,
      reason: 'Long disruption (>72h): increased fairness concern',
    });
  }

  return {
    eventId: event.id,
    eventType: event.type,
    actionTaken: policy.actionType,
    locks,
    logisticsAdjustments,
    weightAdjustments,
    reasons,
    requiresProposal,
    compensatoryDays,
  };
}

// ─── Solver Payload Translation ───────────────────────────────────────

/**
 * Translate overlay results to solver-compatible payload additions.
 */
export function toSolverPayload(
  overlays: DisruptionOverlayResult[],
): SolverPayloadOverlay {
  const disruption_locks: SolverLockedNight[] = [];
  const weightMultipliers = new Map<string, number>();
  const disruption_context: SolverPayloadOverlay['disruption_context'] = [];

  for (const overlay of overlays) {
    // Collect locks
    for (const lock of overlay.locks) {
      disruption_locks.push({
        parent: lock.assignedTo,
        date: lock.date,
        source: 'disruption',
      });
    }

    // Merge weight adjustments (multiply together)
    for (const adj of overlay.weightAdjustments) {
      const current = weightMultipliers.get(adj.key) ?? 1.0;
      weightMultipliers.set(adj.key, current * adj.multiplier);
    }

    // Context for audit
    const dates = overlay.locks.map((l) => l.date);
    disruption_context.push({
      event_id: overlay.eventId,
      event_type: overlay.eventType,
      action: overlay.actionTaken,
      dates,
    });
  }

  const weight_adjustments: Record<string, number> = {};
  for (const [key, mult] of weightMultipliers) {
    weight_adjustments[key] = mult;
  }

  return {
    disruption_locks,
    weight_adjustments,
    disruption_context,
  };
}
