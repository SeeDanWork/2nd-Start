import { describe, it, expect } from 'vitest';
import { classifyIntent, extractOptionNumber } from '../intent-classifier';

describe('Intent Classifier', () => {
  describe('STATUS_CHECK', () => {
    it.each([
      'status',
      'STATUS',
      'tonight',
      'who has the kids',
      "what's the schedule",
      'today',
    ])('classifies "%s" as STATUS_CHECK', (text) => {
      const result = classifyIntent(text);
      expect(result.type).toBe('STATUS_CHECK');
      expect(result.confidence).toBeGreaterThanOrEqual(0.6);
    });
  });

  describe('SWAP_REQUEST', () => {
    it.each([
      'swap 3/15',
      'SWAP March 15',
      'trade 3/20',
      'switch March 10',
    ])('classifies "%s" as SWAP_REQUEST', (text) => {
      const result = classifyIntent(text);
      expect(result.type).toBe('SWAP_REQUEST');
    });
  });

  describe('COVERAGE_REQUEST', () => {
    it.each([
      'cover 3/15',
      'COVER March 20',
      'need coverage 3/10',
    ])('classifies "%s" as COVERAGE_REQUEST', (text) => {
      const result = classifyIntent(text);
      expect(result.type).toBe('COVERAGE_REQUEST');
    });
  });

  describe('DISRUPTION_REPORT', () => {
    it.each([
      'sick 3/15',
      'SICK',
      'ill today',
      'emergency',
    ])('classifies "%s" as DISRUPTION_REPORT', (text) => {
      const result = classifyIntent(text);
      expect(result.type).toBe('DISRUPTION_REPORT');
    });
  });

  describe('PROPOSAL_ACCEPT', () => {
    it.each([
      'accept',
      'ACCEPT',
      'yes accept',
      'approve',
      'accept 1',
      'accept option 2',
    ])('classifies "%s" as PROPOSAL_ACCEPT', (text) => {
      const result = classifyIntent(text);
      expect(result.type).toBe('PROPOSAL_ACCEPT');
    });
  });

  describe('PROPOSAL_DECLINE', () => {
    it.each([
      'decline',
      'DECLINE',
      'reject',
      'no',
    ])('classifies "%s" as PROPOSAL_DECLINE', (text) => {
      const result = classifyIntent(text);
      expect(result.type).toBe('PROPOSAL_DECLINE');
    });
  });

  describe('HELP', () => {
    it.each([
      'help',
      'HELP',
      'commands',
      '?',
    ])('classifies "%s" as HELP', (text) => {
      const result = classifyIntent(text);
      expect(result.type).toBe('HELP');
    });
  });

  describe('STOP', () => {
    it.each([
      'stop',
      'STOP',
      'unsubscribe',
      'opt out',
    ])('classifies "%s" as STOP', (text) => {
      const result = classifyIntent(text);
      expect(result.type).toBe('STOP');
    });
  });

  describe('UNKNOWN', () => {
    it.each([
      'hello there',
      'random gibberish xyz',
      'sounds good thanks',
    ])('classifies "%s" as UNKNOWN', (text) => {
      const result = classifyIntent(text);
      expect(result.type).toBe('UNKNOWN');
    });
  });

  describe('Date extraction', () => {
    it('extracts MM/DD dates', () => {
      const result = classifyIntent('swap 3/15');
      expect(result.extractedDates).toBeDefined();
      expect(result.extractedDates!.length).toBeGreaterThan(0);
      expect(result.extractedDates![0]).toContain('03-15');
    });

    it('extracts "Month Day" dates', () => {
      const result = classifyIntent('cover March 20');
      expect(result.extractedDates).toBeDefined();
      expect(result.extractedDates!.length).toBeGreaterThan(0);
    });

    it('extracts "tomorrow"', () => {
      const result = classifyIntent('swap tomorrow');
      expect(result.extractedDates).toBeDefined();
      expect(result.extractedDates!.length).toBe(1);
    });
  });

  describe('extractOptionNumber', () => {
    it('extracts "option 1"', () => {
      expect(extractOptionNumber('option 1')).toBe(1);
    });

    it('extracts bare number', () => {
      expect(extractOptionNumber('2')).toBe(2);
    });

    it('returns null for no number', () => {
      expect(extractOptionNumber('accept')).toBeNull();
    });
  });

  describe('Confidence scoring', () => {
    it('high confidence for exact keywords', () => {
      const result = classifyIntent('status');
      expect(result.confidence).toBeGreaterThanOrEqual(0.9);
    });

    it('preserves raw text', () => {
      const result = classifyIntent('swap 3/15');
      expect(result.rawText).toBe('swap 3/15');
    });
  });
});
