import { ParentRole } from '../enums';

// ─── Feedback ──────────────────────────────────────────────

export enum FeedbackCategory {
  FAIRNESS = 'fairness',
  TRANSITIONS = 'transitions',
  INCONVENIENCE = 'inconvenience',
  ROUTINE = 'routine',
  TIMING = 'timing',
}

export interface StructuredFeedback {
  category: FeedbackCategory;
  severity: 1 | 2 | 3;
  freeText?: string;
}

export interface WeightDelta {
  fairnessDeviation: number;
  totalTransitions: number;
  nonDaycareHandoffs: number;
  weekendFragmentation: number;
  schoolNightDisruption: number;
}

// ─── Calendar Diff Labels ──────────────────────────────────

export interface LabeledCalendarDiff {
  date: string;
  oldParent: ParentRole;
  newParent: ParentRole;
  isRequested: boolean;
  isCompensation: boolean;
}

// ─── Fairness Explanation ──────────────────────────────────

export interface FairnessExplanation {
  fairnessDeltaText: string;
  transitionImpactText: string;
  routineImpactText: string;
  compensationSummary: string | null;
  overallAssessment: 'favorable' | 'neutral' | 'unfavorable';
}

// ─── Guided Proposal Response ──────────────────────────────

export interface GuidedProposalResponse {
  optionId: string;
  rank: number;
  label: string;
  explanation: FairnessExplanation;
  labeledDiffs: LabeledCalendarDiff[];
  isAutoApprovable: boolean;
  penaltyScore: number;
}

// ─── Pre-Conflict Alerts ───────────────────────────────────

export enum AlertType {
  FAIRNESS_DRIFT = 'fairness_drift',
  LONG_STRETCH = 'long_stretch',
  BUDGET_LOW = 'budget_low',
}

export interface PreConflictAlert {
  type: AlertType;
  familyId: string;
  severity: 'warning' | 'critical';
  message: string;
  metric: string;
  currentValue: number;
  thresholdValue: number;
  referenceDate: string;
}
