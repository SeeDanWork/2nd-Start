import { DisruptionType } from '../../enums/DisruptionType';

// ── Intent Type ──

export const IntentType = {
  AVAILABILITY_CHANGE: 'AVAILABILITY_CHANGE',
  SWAP_REQUEST: 'SWAP_REQUEST',
  DISRUPTION_REPORT: 'DISRUPTION_REPORT',
  PROPOSAL_REQUEST: 'PROPOSAL_REQUEST',
  POLICY_CONFIRMATION: 'POLICY_CONFIRMATION',
} as const;

export type IntentType = (typeof IntentType)[keyof typeof IntentType];

// ── Incoming Message ──

export interface IncomingMessage {
  messageId: string;
  familyId: string;
  senderParentId: string;
  text: string;
  receivedAt: string;
  channel?: string;
  metadata?: Record<string, unknown>;
}

// ── Extraction ──

export interface ExtractedIntentCandidate {
  type: IntentType;
  payload: Record<string, unknown>;
  confidence: number;
  extractionNotes?: string[];
}

export interface IntentExtractionResponse {
  candidates: ExtractedIntentCandidate[];
  rawModelOutput?: string;
  providerMetadata?: Record<string, unknown>;
}

// ── Family Context for Extraction ──

export interface ExtractionFamilyContext {
  familyId: string;
  parents: Array<{
    id: string;
    name: string;
    role?: string;
  }>;
  children: Array<{
    id: string;
    name: string;
    birthDate?: string;
  }>;
  activePolicySuggestions?: Array<{
    id: string;
    label: string;
  }>;
  timezone?: string;
}

// ── Resolved Entities ──

export interface ResolvedEntityMap {
  parentIds?: string[];
  childIds?: string[];
  dates?: string[];
  dateRanges?: Array<{
    startDate: string;
    endDate: string;
  }>;
  unresolvedTokens?: string[];
}

// ── Validated Candidate ──

export interface ValidatedIntentCandidate {
  type: IntentType;
  payload: Record<string, unknown>;
  confidence: number;
  extractionNotes?: string[];
  validationPassed: true;
}

// ── Interpreted Intent ──

export interface InterpretedIntent {
  intentId?: string;
  familyId: string;
  parentId: string;
  type: IntentType;
  payload: Record<string, unknown>;
  confidence: number;
  resolvedEntities: ResolvedEntityMap;
  createdAt: string;
}

// ── Interpretation Failure ──

export interface InterpretationFailure {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

// ── Interpretation Result ──

export type InterpretationStatus = 'SUCCESS' | 'AMBIGUOUS' | 'INVALID';

export interface MessageInterpretationResult {
  status: InterpretationStatus;
  interpretedIntent?: InterpretedIntent;
  failures?: InterpretationFailure[];
  clarificationHints?: string[];
  providerMetadata?: Record<string, unknown>;
}

// ── Workflow Route ──

export interface WorkflowRouteResult {
  routeType: string;
  accepted: boolean;
  reason?: string;
  data?: Record<string, unknown>;
}

// ── Entity Resolution ──

export interface EntityResolutionResult {
  resolved: ResolvedEntityMap;
  ambiguities: InterpretationFailure[];
}

// ── Date Resolution ──

export interface DateResolutionResult {
  resolvedDates: string[];
  resolvedDateRanges: Array<{ startDate: string; endDate: string }>;
  unresolvedTokens: string[];
  ambiguities: InterpretationFailure[];
}

// ── Intent Payload Types ──

export interface AvailabilityChangePayload {
  dateRange: {
    startDate: string;
    endDate: string;
  };
  availability: 'AVAILABLE' | 'UNAVAILABLE';
  reason?: string;
}

export interface SwapRequestPayload {
  targetDate?: string;
  targetDateRange?: {
    startDate: string;
    endDate: string;
  };
  requestedWithParentId?: string;
  reason?: string;
}

export interface DisruptionReportPayload {
  date: string;
  disruptionType: DisruptionType;
  childIds?: string[];
  reason?: string;
}

export interface ProposalRequestPayload {
  targetDate?: string;
  targetDateRange?: {
    startDate: string;
    endDate: string;
  };
  reason?: string;
}

export interface PolicyConfirmationPayload {
  policyId: string;
  decision: 'ACCEPT' | 'REJECT';
}

// ── Intent Persistence ──

export interface IntentRecord {
  id: string;
  familyId: string;
  parentId: string;
  type: IntentType;
  payload: Record<string, unknown>;
  confidence: number;
  messageId?: string | null;
  status?: string | null;
  resolutionMetadata?: Record<string, unknown> | null;
  providerMetadata?: Record<string, unknown> | null;
  rawText?: string | null;
  createdAt: string;
}
