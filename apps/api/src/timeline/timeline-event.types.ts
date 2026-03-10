/**
 * Timeline Event Types — the event vocabulary for accelerated simulation.
 *
 * Per SMS Pilot Contract §1: The simulator differs only in clock source,
 * SMS transport, and identity resolution. All events feed through the
 * same live application services.
 */

export enum TimelineEventType {
  // Schedule lifecycle
  SCHEDULE_GENERATED = 'SCHEDULE_GENERATED',
  SCHEDULE_VERSION_ACTIVATED = 'SCHEDULE_VERSION_ACTIVATED',

  // Parent-initiated (SMS equivalent)
  INBOUND_MESSAGE = 'INBOUND_MESSAGE',
  DISRUPTION_REPORTED = 'DISRUPTION_REPORTED',
  SWAP_REQUESTED = 'SWAP_REQUESTED',
  COVERAGE_REQUESTED = 'COVERAGE_REQUESTED',
  EXTRA_TIME_REQUESTED = 'EXTRA_TIME_REQUESTED',
  PROPOSAL_ACCEPTED = 'PROPOSAL_ACCEPTED',
  PROPOSAL_DECLINED = 'PROPOSAL_DECLINED',

  // System-generated
  PROPOSAL_EXPIRED = 'PROPOSAL_EXPIRED',
  HANDOFF_REMINDER = 'HANDOFF_REMINDER',
  PRECONFLICT_ALERT = 'PRECONFLICT_ALERT',
  FAIRNESS_CHECK = 'FAIRNESS_CHECK',
  BUDGET_RESET = 'BUDGET_RESET',

  // Simulation control
  ADVANCE_DAY = 'ADVANCE_DAY',
  CHECKPOINT = 'CHECKPOINT',
}

export interface TimelineEvent {
  id: string;
  type: TimelineEventType;
  scheduledAt: Date;
  actorId: string | null;
  familyId: string;
  payload: Record<string, unknown>;
  processedAt?: Date;
  result?: Record<string, unknown>;
  error?: string;
}

export interface TimelineCheckpoint {
  id: string;
  timelineId: string;
  virtualDate: Date;
  createdAt: Date;
  label: string;
  stateSnapshot: {
    currentDate: string;
    eventsProcessed: number;
    activeScheduleVersionId: string | null;
    pendingRequestIds: string[];
    fairnessSnapshot: Record<string, unknown> | null;
  };
}

export interface TimelineConfig {
  familyId: string;
  startDate: string;
  endDate: string;
  speedMultiplier: number;
  autoAdvance: boolean;
  parentPersonas: {
    parentA: string | null;
    parentB: string | null;
  };
}

export interface TimelineStatus {
  id: string;
  familyId: string;
  config: TimelineConfig;
  currentDate: string;
  state: 'idle' | 'running' | 'paused' | 'completed';
  eventsProcessed: number;
  eventsRemaining: number;
  checkpoints: TimelineCheckpoint[];
  startedAt: Date | null;
  lastAdvancedAt: Date | null;
}
