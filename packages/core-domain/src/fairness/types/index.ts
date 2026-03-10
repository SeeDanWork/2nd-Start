import { ScheduleSnapshot } from '../../models/ScheduleSnapshot';

// ── Ledger State ──

export interface FairnessLedgerState {
  familyId: string;
  byParentId: Record<string, {
    nightDeviation: number;
    weekendDeviation: number;
    holidayDeviation: number;
    updatedAt?: string;
  }>;
}

// ── Ledger Row ──

export interface FairnessLedgerRow {
  id: string;
  familyId: string;
  parentId: string;
  nightDeviation: number;
  weekendDeviation: number;
  holidayDeviation: number;
  lastReason?: string;
  lastSourceType?: string;
  lastSourceId?: string;
  updatedAt: string;
}

// ── Event Record ──

export interface FairnessLedgerEventRecord {
  id: string;
  familyId: string;
  parentId: string;
  eventType: string;
  sourceType: string;
  sourceId?: string;
  nightDelta: number;
  weekendDelta: number;
  holidayDelta: number;
  reason?: string;
  effectiveDate: string;
  createdAt: string;
  idempotencyKey?: string;
  metadata?: Record<string, unknown>;
}

// ── Deltas ──

export interface FairnessDelta {
  parentId: string;
  nightDelta: number;
  weekendDelta: number;
  holidayDelta: number;
}

export interface FairnessDeltaBatch {
  familyId: string;
  sourceType: string;
  sourceId?: string;
  eventType: string;
  effectiveDate: string;
  reason?: string;
  deltas: FairnessDelta[];
  metadata?: Record<string, unknown>;
}

// ── Event Types ──

export const FairnessEventType = {
  OVERLAY_DRIFT: 'OVERLAY_DRIFT',
  REPAIR_RESTITUTION: 'REPAIR_RESTITUTION',
  PROPOSAL_ACCEPTANCE_RECONCILIATION: 'PROPOSAL_ACCEPTANCE_RECONCILIATION',
  MANUAL_ADJUSTMENT: 'MANUAL_ADJUSTMENT',
} as const;

export type FairnessEventType = typeof FairnessEventType[keyof typeof FairnessEventType];

// ── Projection ──

export interface FairnessProjectionInput {
  familyId: string;
  currentLedger: FairnessLedgerState;
  scheduleWindowStart: string;
  scheduleWindowEnd: string;
  activeSchedule?: ScheduleSnapshot;
  candidateSchedule?: ScheduleSnapshot;
}

export interface FairnessProjectionResult {
  familyId: string;
  projectedState: FairnessLedgerState;
  projectionDeltas: FairnessDelta[];
  summary: {
    totalNightDeviationMagnitude: number;
    totalWeekendDeviationMagnitude: number;
    totalHolidayDeviationMagnitude: number;
  };
}

// ── Artifact ──

export interface FairnessArtifact {
  type: string;
  data: Record<string, unknown>;
}
