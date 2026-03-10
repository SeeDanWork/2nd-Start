// ─── LLM Interpretation Types ─────────────────────────────────────────

import type { RequestType } from '../enums';

export interface LlmContext {
  familyId: string;
  parentRole: string;
  childrenAges: number[];
  currentScheduleSummary?: string;
  /** Reference date for resolving relative dates (ISO string, defaults to today) */
  referenceDate?: string;
}

export interface LlmInterpretation {
  /** Detected request type */
  requestType: RequestType | null;
  /** Extracted dates (ISO strings) */
  dates: string[];
  /** Whether this seems like an emergency */
  isEmergency: boolean;
  /** Confidence score 0.0 - 1.0 */
  confidence: number;
  /** Human-readable summary of what was understood */
  summary: string;
  /** Raw extracted keywords for debugging */
  extractedKeywords: string[];
  /** Whether the input was flagged as unsafe */
  isSafe: boolean;
  /** Reason if flagged as unsafe */
  unsafeReason: string | null;
}

export interface LlmProvider {
  /** Provider name for logging */
  name: string;
  /** Interpret a natural language request */
  interpret(input: string, context: LlmContext): Promise<LlmInterpretation>;
}
