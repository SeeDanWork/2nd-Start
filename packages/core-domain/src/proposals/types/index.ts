import { ScheduleDiff } from '../../diff';

// ── Proposal Origin ──

export type ProposalOrigin = 'BASELINE_SOLVER' | 'REPAIR_SOLVER' | 'MANUAL_BRANCH';

// ── Generation ──

export interface ProposalCandidateInput {
  candidateId: string;
  nights: Array<{
    date: string;
    childId: string;
    parentId: string;
  }>;
  exchanges: Array<{
    date: string;
    childId: string;
    fromParentId: string;
    toParentId: string;
    time?: string | null;
    location?: string | null;
  }>;
  scoreBreakdown?: Record<string, unknown>;
  fairnessProjection?: Record<string, unknown>;
  stabilityDelta?: number;
  artifacts?: ProposalArtifact[];
}

export interface ProposalGenerationInput {
  familyId: string;
  baseScheduleVersionId: string;
  origin: ProposalOrigin;
  candidates: ProposalCandidateInput[];
  createdBy: string;
  type: string;
  expiresAt?: string;
  overlayIds?: string[];
}

// ── Review ──

export interface ProposalScoreSummary {
  totalScore?: number;
  primaryScore?: number;
  secondaryScore?: number;
  breakdown?: Record<string, unknown>;
  penalties?: number;
}

export interface ProposalFairnessSummary {
  projectedNightDeviationByParentId?: Record<string, number>;
  projectedWeekendDeviationByParentId?: Record<string, number>;
  projectedHolidayDeviationByParentId?: Record<string, number>;
}

export interface ProposalReviewMetadata {
  generatedAt: string;
  origin: ProposalOrigin;
  candidateId?: string;
  overlayIds?: string[];
  baseVersionNumber?: number;
}

export interface ProposalReviewBundle {
  proposalId: string;
  proposalStatus: string;
  baseScheduleVersionId: string;
  proposalScheduleId: string;
  diff: ScheduleDiff;
  scoreSummary: ProposalScoreSummary;
  fairnessSummary?: ProposalFairnessSummary;
  artifacts: ProposalArtifact[];
  metadata: ProposalReviewMetadata;
}

// ── Acceptance ──

export interface ProposalAcceptanceInput {
  proposalId: string;
  acceptedBy: string;
  acceptedAt: string;
}

export interface ProposalAcceptanceResult {
  newScheduleVersionId: string;
  newVersionNumber: number;
  archivedScheduleVersionId: string;
  acceptedProposalId: string;
  invalidatedProposalIds: string[];
  resolvedOverlayIds: string[];
  fairnessArtifacts: ProposalArtifact[];
}

// ── Artifact ──

export interface ProposalArtifact {
  type: string;
  data: Record<string, unknown>;
}
