// ─── Observation Window ──────────────────────────────────────

export interface BehaviorObservationWindow {
  familyId: string;
  startDate: string;
  endDate: string;
}

// ─── Evidence ────────────────────────────────────────────────

export interface ObservationEvidenceRecord {
  evidenceId: string;
  familyId: string;
  evidenceType: string;
  date: string;
  childId?: string;
  parentId?: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
  data: Record<string, unknown>;
  createdAt: string;
}

// ─── Suggestion Types ────────────────────────────────────────

export type PolicySuggestionType =
  | 'PREFERRED_EXCHANGE_DAY'
  | 'PREFERRED_EXCHANGE_LOCATION'
  | 'SCHOOL_CLOSURE_COVERAGE_PREFERENCE'
  | 'MIN_BLOCK_LENGTH_ADJUSTMENT'
  | 'ACTIVITY_RESPONSIBILITY_RULE'
  | 'SIBLING_DIVERGENCE_PREFERENCE';

export type PolicySuggestionStatus =
  | 'PENDING_REVIEW'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'EXPIRED';

// ─── Evidence Summary ────────────────────────────────────────

export interface SuggestionEvidenceSummary {
  occurrenceCount: number;
  windowStart: string;
  windowEnd: string;
  representativeExamples: Array<{
    date: string;
    data: Record<string, unknown>;
  }>;
}

// ─── Policy Suggestion ───────────────────────────────────────

export interface PolicySuggestion {
  suggestionId: string;
  familyId: string;
  suggestionType: PolicySuggestionType;
  status: PolicySuggestionStatus;
  confidenceScore: number;
  evidenceSummary: SuggestionEvidenceSummary;
  proposedRuleType: string;
  proposedPriority: string;
  proposedParameters: Record<string, unknown>;
  proposedScope?: {
    scopeType: 'FAMILY' | 'CHILD' | 'DATE_RANGE' | 'CHILD_DATE_RANGE';
    childId?: string;
    dateStart?: string;
    dateEnd?: string;
  };
  createdAt: string;
  resolvedAt?: string;
  resolvedBy?: string;
  metadata?: Record<string, unknown>;
}

// ─── Suggestion Candidate ────────────────────────────────────

export interface PolicySuggestionCandidate {
  suggestionType: PolicySuggestionType;
  confidenceScore: number;
  proposedRuleType: string;
  proposedPriority: string;
  proposedParameters: Record<string, unknown>;
  proposedScope?: {
    scopeType: 'FAMILY' | 'CHILD' | 'DATE_RANGE' | 'CHILD_DATE_RANGE';
    childId?: string;
    dateStart?: string;
    dateEnd?: string;
  };
  supportingEvidenceIds: string[];
  metadata?: Record<string, unknown>;
}

// ─── Review Bundle ───────────────────────────────────────────

export interface PolicySuggestionReviewBundle {
  suggestionId: string;
  suggestionType: PolicySuggestionType;
  status: PolicySuggestionStatus;
  confidenceScore: number;
  proposedRuleType: string;
  proposedPriority: string;
  proposedParameters: Record<string, unknown>;
  evidenceSummary: SuggestionEvidenceSummary;
  artifacts: Array<{
    type: string;
    data: Record<string, unknown>;
  }>;
}

// ─── Resolution ──────────────────────────────────────────────

export interface SuggestionResolutionInput {
  suggestionId: string;
  decision: 'ACCEPT' | 'REJECT';
  resolvedAt: string;
  resolvedBy: string;
}

export interface SuggestionResolutionResult {
  suggestionId: string;
  status: PolicySuggestionStatus;
  createdPolicyRuleId?: string;
}

// ─── Evidence Link ───────────────────────────────────────────

export interface PolicySuggestionEvidenceLink {
  id: string;
  suggestionId: string;
  evidenceId: string;
  createdAt: string;
}
