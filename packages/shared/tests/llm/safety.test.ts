import { describe, it, expect } from 'vitest';
import { validateLlmOutput, MINIMUM_CONFIDENCE_THRESHOLD } from '../../src/llm/safety';
import { RequestType } from '../../src/enums';
import type { LlmInterpretation } from '../../src/llm/types';

function makeInterpretation(overrides: Partial<LlmInterpretation> = {}): LlmInterpretation {
  return {
    requestType: RequestType.NEED_COVERAGE,
    dates: ['2027-03-15'],
    isEmergency: false,
    confidence: 0.6,
    summary: 'Detected need_coverage request',
    extractedKeywords: ['coverage'],
    isSafe: true,
    unsafeReason: null,
    ...overrides,
  };
}

describe('validateLlmOutput — safety', () => {
  it('flags custody-related language', () => {
    const result = validateLlmOutput(makeInterpretation(), 'I want full custody of my child');
    expect(result.isSafe).toBe(false);
    expect(result.unsafeReason).toContain('custody');
    expect(result.requestType).toBeNull();
  });

  it('flags legal language', () => {
    const result = validateLlmOutput(makeInterpretation(), 'My lawyer says I should get more time');
    expect(result.isSafe).toBe(false);
    expect(result.unsafeReason).toContain('custody/legal');
  });

  it('flags court language', () => {
    const result = validateLlmOutput(makeInterpretation(), 'The court ordered visitation rights');
    expect(result.isSafe).toBe(false);
  });

  it('passes safe input through', () => {
    const result = validateLlmOutput(makeInterpretation(), 'I need coverage for next week');
    expect(result.isSafe).toBe(true);
    expect(result.requestType).toBe(RequestType.NEED_COVERAGE);
  });

  it('rejects below minimum confidence threshold', () => {
    const result = validateLlmOutput(
      makeInterpretation({ confidence: 0.1 }),
      'some random text',
    );
    expect(result.requestType).toBeNull();
  });

  it('allows at minimum confidence threshold', () => {
    const result = validateLlmOutput(
      makeInterpretation({ confidence: MINIMUM_CONFIDENCE_THRESHOLD }),
      'I need coverage',
    );
    expect(result.requestType).toBe(RequestType.NEED_COVERAGE);
  });

  it('flags schedule generation in summary', () => {
    const result = validateLlmOutput(
      makeInterpretation({ summary: "Here's a new schedule for you" }),
      'normal input',
    );
    expect(result.isSafe).toBe(false);
    expect(result.unsafeReason).toContain('generate a schedule');
  });
});
