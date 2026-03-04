import { describe, it, expect } from 'vitest';
import { PatternProvider } from '../../src/llm/pattern_provider';
import { RequestType } from '../../src/enums';
import type { LlmContext } from '../../src/llm/types';

const provider = new PatternProvider();
const ctx: LlmContext = {
  familyId: 'fam-1',
  parentRole: 'parent_a',
  childrenAges: [7],
};

const ctxWithRef: LlmContext = {
  ...ctx,
  referenceDate: '2027-03-04', // Thursday
};

describe('LLM Pattern Provider — Regression Tests', () => {
  it('1. Parent travel → NEED_COVERAGE', async () => {
    const r = await provider.interpret('I need to travel for work next week, 2027-03-15 to 2027-03-19', ctx);
    expect(r.requestType).toBe(RequestType.NEED_COVERAGE);
    expect(r.dates).toContain('2027-03-15');
    expect(r.confidence).toBeGreaterThanOrEqual(0.5);
  });

  it('2. Share change → WANT_TIME', async () => {
    const r = await provider.interpret('I would like to have more time with the kids on 2027-04-01', ctx);
    expect(r.requestType).toBe(RequestType.WANT_TIME);
    expect(r.confidence).toBeGreaterThanOrEqual(0.4);
  });

  it('3. Sick child → NEED_COVERAGE (emergency-like)', async () => {
    const r = await provider.interpret('The kids are sick with fever, I need help covering 2027-03-20', ctx);
    expect(r.requestType).toBe(RequestType.NEED_COVERAGE);
    expect(r.dates).toContain('2027-03-20');
  });

  it('4. Exchange constraint → SWAP_DATE', async () => {
    const r = await provider.interpret('Can we swap 2027-03-22 for 2027-03-29?', ctx);
    expect(r.requestType).toBe(RequestType.SWAP_DATE);
    expect(r.dates).toHaveLength(2);
  });

  it('5. School closure → NEED_COVERAGE', async () => {
    const r = await provider.interpret('School is closed on 2027-03-25, I cannot take time off work', ctx);
    expect(r.requestType).toBe(RequestType.NEED_COVERAGE);
  });

  it('6. Camp week → NEED_COVERAGE', async () => {
    const r = await provider.interpret('Kids are away at camp, I am unavailable 2027-07-01 through 2027-07-05', ctx);
    expect(r.requestType).toBe(RequestType.NEED_COVERAGE);
  });

  it('7. Simulation/ambiguous → low confidence', async () => {
    const r = await provider.interpret('What would happen if we changed things around?', ctx);
    expect(r.confidence).toBeLessThanOrEqual(0.5);
  });

  it('8. Holiday request → WANT_TIME', async () => {
    const r = await provider.interpret('I want the kids for Christmas 2027-12-24 and 2027-12-25', ctx);
    expect(r.requestType).toBe(RequestType.WANT_TIME);
    expect(r.dates).toContain('2027-12-24');
  });

  it('9. Reduce exchanges → low confidence (ambiguous)', async () => {
    const r = await provider.interpret('Can we reduce the number of exchanges per week?', ctx);
    // This is not a specific request type
    expect(r.confidence).toBeLessThanOrEqual(0.5);
  });

  it('10. Work schedule change → NEED_COVERAGE', async () => {
    const r = await provider.interpret('My work shift changed, I have a meeting on 2027-04-10', ctx);
    expect(r.requestType).toBe(RequestType.NEED_COVERAGE);
  });

  it('11. Ambiguous input → null requestType', async () => {
    const r = await provider.interpret('Hmm I am not sure what to do', ctx);
    expect(r.requestType).toBeNull();
    expect(r.confidence).toBeLessThanOrEqual(0.5);
  });

  it('12. Exact dates → extracts all dates', async () => {
    const r = await provider.interpret(
      'I need coverage for 2027-05-01, 2027-05-02, and 2027-05-03',
      ctx,
    );
    expect(r.dates).toEqual(['2027-05-01', '2027-05-02', '2027-05-03']);
  });
});

describe('LLM Pattern Provider — Relative Date Parsing', () => {
  it('13. "next Monday" with ref=2027-03-04 (Thu) → extracts 2027-03-08', async () => {
    // 2027-03-04 is a Thursday. "next Monday" = Monday of next week = 2027-03-08
    const r = await provider.interpret('I am traveling next Monday', ctxWithRef);
    expect(r.dates).toContain('2027-03-08');
  });

  it('14. "tomorrow" with ref=2027-03-04 → extracts 2027-03-05', async () => {
    const r = await provider.interpret('sick child tomorrow', ctxWithRef);
    expect(r.dates).toContain('2027-03-05');
  });

  it('15. "March 15th" with ref=2027-03-04 → extracts 2027-03-15', async () => {
    const r = await provider.interpret('March 15th trip with the kids', ctxWithRef);
    expect(r.dates).toContain('2027-03-15');
  });

  it('16. "this weekend" with ref=2027-03-04 (Thu) → extracts Sat+Sun', async () => {
    const r = await provider.interpret('I want the kids this weekend', ctxWithRef);
    expect(r.dates).toContain('2027-03-06');
    expect(r.dates).toContain('2027-03-07');
  });

  it('17. Mixed ISO + relative dates → all extracted and sorted', async () => {
    const r = await provider.interpret(
      'I need coverage on 2027-03-20 and also tomorrow',
      ctxWithRef,
    );
    expect(r.dates).toContain('2027-03-05');
    expect(r.dates).toContain('2027-03-20');
    // Should be sorted
    expect(r.dates.indexOf('2027-03-05')).toBeLessThan(r.dates.indexOf('2027-03-20'));
  });

  it('18. "April 2" with ref year → extracts 2027-04-02', async () => {
    const r = await provider.interpret('Can we cover April 2?', ctxWithRef);
    expect(r.dates).toContain('2027-04-02');
  });

  it('19. No reference date → relative dates still resolved using today', async () => {
    const r = await provider.interpret('sick child tomorrow', ctx);
    // Should have at least one date (tomorrow from today)
    expect(r.dates.length).toBeGreaterThanOrEqual(1);
  });
});
