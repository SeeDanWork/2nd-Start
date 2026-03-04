// ─── LLM Safety Validation ───────────────────────────────────────────
//
// Validates LLM output to ensure:
// 1. No custody-related language (this is scheduling, not legal)
// 2. No schedule generation (LLM interprets, solver generates)
// 3. Confidence threshold enforcement

import type { LlmInterpretation } from './types';

const UNSAFE_PATTERNS = [
  /\bcustody\b/i,
  /\blegal\b/i,
  /\bcourt\b/i,
  /\bjudge\b/i,
  /\blawyer\b/i,
  /\battorney\b/i,
  /\bdivorce\b/i,
  /\bvisitation\s+rights?\b/i,
  /\bparental\s+rights?\b/i,
];

const GENERATION_PATTERNS = [
  /\bgenerate\s+(?:a\s+)?schedule\b/i,
  /\bcreate\s+(?:a\s+)?schedule\b/i,
  /\bmake\s+(?:a\s+)?schedule\b/i,
  /\bhere(?:'s| is)\s+(?:a\s+)?(?:new\s+)?schedule\b/i,
];

/** Minimum confidence below which we reject the interpretation. */
export const MINIMUM_CONFIDENCE_THRESHOLD = 0.3;

/**
 * Validate LLM output for safety and correctness.
 * Mutates the interpretation to flag unsafe content.
 */
export function validateLlmOutput(
  interpretation: LlmInterpretation,
  originalInput: string,
): LlmInterpretation {
  // Check for custody/legal language in original input
  for (const pattern of UNSAFE_PATTERNS) {
    if (pattern.test(originalInput)) {
      return {
        ...interpretation,
        isSafe: false,
        unsafeReason: 'Input contains custody/legal language. This tool handles scheduling only.',
        confidence: 0,
        requestType: null,
      };
    }
  }

  // Check for schedule generation attempts in the summary
  for (const pattern of GENERATION_PATTERNS) {
    if (pattern.test(interpretation.summary)) {
      return {
        ...interpretation,
        isSafe: false,
        unsafeReason: 'LLM attempted to generate a schedule. Only the solver can generate schedules.',
        confidence: 0,
        requestType: null,
      };
    }
  }

  // Enforce confidence threshold
  if (interpretation.confidence < MINIMUM_CONFIDENCE_THRESHOLD) {
    return {
      ...interpretation,
      requestType: null,
      summary: 'Confidence too low to determine request type',
    };
  }

  return interpretation;
}
