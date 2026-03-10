import { describe, it, expect } from 'vitest';
import { IntentCandidateValidator } from '../validation/IntentCandidateValidator';
import { IntentType, ExtractedIntentCandidate } from '../types';

describe('IntentCandidateValidator', () => {
  const validator = new IntentCandidateValidator();

  describe('accepts valid payloads', () => {
    it('validates AVAILABILITY_CHANGE payload', () => {
      const candidate: ExtractedIntentCandidate = {
        type: IntentType.AVAILABILITY_CHANGE,
        payload: {
          dateRange: { startDate: '2026-03-10', endDate: '2026-03-12' },
          availability: 'UNAVAILABLE',
          reason: 'business trip',
        },
        confidence: 0.9,
      };
      const result = validator.validateCandidate(candidate);
      expect(result.valid).toBe(true);
      expect(result.candidate).toBeDefined();
      expect(result.candidate!.validationPassed).toBe(true);
    });

    it('validates SWAP_REQUEST payload', () => {
      const candidate: ExtractedIntentCandidate = {
        type: IntentType.SWAP_REQUEST,
        payload: {
          targetDate: '2026-03-15',
          reason: 'conflict',
        },
        confidence: 0.85,
      };
      const result = validator.validateCandidate(candidate);
      expect(result.valid).toBe(true);
    });

    it('validates DISRUPTION_REPORT payload', () => {
      const candidate: ExtractedIntentCandidate = {
        type: IntentType.DISRUPTION_REPORT,
        payload: {
          date: '2026-03-09',
          disruptionType: 'ILLNESS',
          childIds: ['child-1'],
          reason: 'flu',
        },
        confidence: 0.95,
      };
      const result = validator.validateCandidate(candidate);
      expect(result.valid).toBe(true);
    });

    it('validates PROPOSAL_REQUEST payload', () => {
      const candidate: ExtractedIntentCandidate = {
        type: IntentType.PROPOSAL_REQUEST,
        payload: {
          targetDateRange: { startDate: '2026-03-10', endDate: '2026-03-20' },
        },
        confidence: 0.8,
      };
      const result = validator.validateCandidate(candidate);
      expect(result.valid).toBe(true);
    });

    it('validates POLICY_CONFIRMATION payload', () => {
      const candidate: ExtractedIntentCandidate = {
        type: IntentType.POLICY_CONFIRMATION,
        payload: {
          policyId: 'policy-1',
          decision: 'ACCEPT',
        },
        confidence: 0.97,
      };
      const result = validator.validateCandidate(candidate);
      expect(result.valid).toBe(true);
    });
  });

  describe('rejects malformed payloads', () => {
    it('rejects AVAILABILITY_CHANGE with missing dateRange', () => {
      const candidate: ExtractedIntentCandidate = {
        type: IntentType.AVAILABILITY_CHANGE,
        payload: { availability: 'UNAVAILABLE' },
        confidence: 0.9,
      };
      const result = validator.validateCandidate(candidate);
      expect(result.valid).toBe(false);
      expect(result.failures.some(f => f.code === 'PAYLOAD_VALIDATION_ERROR')).toBe(true);
    });

    it('rejects DISRUPTION_REPORT with invalid disruptionType', () => {
      const candidate: ExtractedIntentCandidate = {
        type: IntentType.DISRUPTION_REPORT,
        payload: {
          date: '2026-03-09',
          disruptionType: 'ZOMBIE_APOCALYPSE',
        },
        confidence: 0.9,
      };
      const result = validator.validateCandidate(candidate);
      expect(result.valid).toBe(false);
    });

    it('rejects POLICY_CONFIRMATION with empty policyId', () => {
      const candidate: ExtractedIntentCandidate = {
        type: IntentType.POLICY_CONFIRMATION,
        payload: { policyId: '', decision: 'ACCEPT' },
        confidence: 0.9,
      };
      const result = validator.validateCandidate(candidate);
      expect(result.valid).toBe(false);
    });

    it('rejects date with wrong format', () => {
      const candidate: ExtractedIntentCandidate = {
        type: IntentType.DISRUPTION_REPORT,
        payload: { date: '03/09/2026', disruptionType: 'ILLNESS' },
        confidence: 0.9,
      };
      const result = validator.validateCandidate(candidate);
      expect(result.valid).toBe(false);
    });
  });

  describe('rejects unsupported intent types', () => {
    it('rejects unknown type', () => {
      const candidate: ExtractedIntentCandidate = {
        type: 'MAGICAL_WISH' as any,
        payload: {},
        confidence: 0.9,
      };
      const result = validator.validateCandidate(candidate);
      expect(result.valid).toBe(false);
      expect(result.failures.some(f => f.code === 'UNKNOWN_INTENT_TYPE')).toBe(true);
    });
  });

  describe('rejects invalid confidence values', () => {
    it('rejects confidence > 1', () => {
      const candidate: ExtractedIntentCandidate = {
        type: IntentType.SWAP_REQUEST,
        payload: { targetDate: '2026-03-15' },
        confidence: 1.5,
      };
      const result = validator.validateCandidate(candidate);
      expect(result.valid).toBe(false);
      expect(result.failures.some(f => f.code === 'INVALID_CONFIDENCE')).toBe(true);
    });

    it('rejects negative confidence', () => {
      const candidate: ExtractedIntentCandidate = {
        type: IntentType.SWAP_REQUEST,
        payload: { targetDate: '2026-03-15' },
        confidence: -0.5,
      };
      const result = validator.validateCandidate(candidate);
      expect(result.valid).toBe(false);
    });

    it('rejects non-numeric confidence', () => {
      const candidate: ExtractedIntentCandidate = {
        type: IntentType.SWAP_REQUEST,
        payload: { targetDate: '2026-03-15' },
        confidence: 'high' as any,
      };
      const result = validator.validateCandidate(candidate);
      expect(result.valid).toBe(false);
    });
  });
});
