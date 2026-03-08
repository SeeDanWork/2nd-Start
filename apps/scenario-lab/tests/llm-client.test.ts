import { describe, it, expect } from 'vitest';
import { classifyIntent, extractEntities, generateExplanation } from '../lib/llm/client';

// LLM router is not running, so all calls should return null gracefully.

describe('LLM client graceful degradation', () => {
  it('classifyIntent returns null when LLM unavailable', async () => {
    const result = await classifyIntent('test message');
    expect(result).toBeNull();
  });

  it('extractEntities returns null when LLM unavailable', async () => {
    const result = await extractEntities('I have 2 kids');
    expect(result).toBeNull();
  });

  it('generateExplanation returns null when LLM unavailable', async () => {
    const result = await generateExplanation('explain this');
    expect(result).toBeNull();
  });

  it('classifyIntent accepts context parameter', async () => {
    const result = await classifyIntent('test', { scenario: 'test' });
    expect(result).toBeNull();
  });
});
