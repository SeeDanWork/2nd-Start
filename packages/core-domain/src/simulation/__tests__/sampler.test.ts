import { describe, it, expect } from 'vitest';
import { DeterministicEventSampler } from '../events/DeterministicEventSampler';

describe('DeterministicEventSampler', () => {
  const sampler = new DeterministicEventSampler();

  it('returns consistent probability for same seed+key', () => {
    const p1 = sampler.sampleProbability({ seed: 'test', key: 'day1' });
    const p2 = sampler.sampleProbability({ seed: 'test', key: 'day1' });
    expect(p1).toBe(p2);
  });

  it('returns different probabilities for different keys', () => {
    const p1 = sampler.sampleProbability({ seed: 'test', key: 'day1' });
    const p2 = sampler.sampleProbability({ seed: 'test', key: 'day2' });
    expect(p1).not.toBe(p2);
  });

  it('returns value in [0, 1)', () => {
    for (let i = 0; i < 100; i++) {
      const p = sampler.sampleProbability({ seed: 'test', key: `iter:${i}` });
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThan(1);
    }
  });

  it('sampleBoolean returns boolean deterministically', () => {
    const b1 = sampler.sampleBoolean({ seed: 'test', key: 'x', threshold: 0.5 });
    const b2 = sampler.sampleBoolean({ seed: 'test', key: 'x', threshold: 0.5 });
    expect(b1).toBe(b2);
  });

  it('sampleItem picks consistently from array', () => {
    const items = ['a', 'b', 'c', 'd'];
    const pick1 = sampler.sampleItem(items, 'seed1', 'key1');
    const pick2 = sampler.sampleItem(items, 'seed1', 'key1');
    expect(pick1).toBe(pick2);
    expect(items).toContain(pick1);
  });

  it('sampleItem works with single-element array', () => {
    const item = sampler.sampleItem(['only'], 'seed', 'key');
    expect(item).toBe('only');
  });
});
