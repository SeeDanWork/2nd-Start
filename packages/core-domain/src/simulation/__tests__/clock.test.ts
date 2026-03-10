import { describe, it, expect } from 'vitest';
import { SimulationClock } from '../core/SimulationClock';

describe('SimulationClock', () => {
  const clock = new SimulationClock();

  it('builds correct number of steps for a date range', () => {
    const steps = clock.buildSteps({ startDate: '2026-03-09', endDate: '2026-03-15', granularity: 'DAY' });
    expect(steps).toHaveLength(7);
    expect(steps[0].stepIndex).toBe(0);
    expect(steps[0].date).toBe('2026-03-09');
    expect(steps[6].stepIndex).toBe(6);
    expect(steps[6].date).toBe('2026-03-15');
  });

  it('builds single step for same start and end', () => {
    const steps = clock.buildSteps({ startDate: '2026-03-09', endDate: '2026-03-09', granularity: 'DAY' });
    expect(steps).toHaveLength(1);
    expect(steps[0].date).toBe('2026-03-09');
  });

  it('returns empty for end before start', () => {
    const steps = clock.buildSteps({ startDate: '2026-03-15', endDate: '2026-03-09', granularity: 'DAY' });
    expect(steps).toHaveLength(0);
  });

  it('handles month boundaries', () => {
    const steps = clock.buildSteps({ startDate: '2026-03-30', endDate: '2026-04-02', granularity: 'DAY' });
    expect(steps).toHaveLength(4);
    expect(steps[0].date).toBe('2026-03-30');
    expect(steps[1].date).toBe('2026-03-31');
    expect(steps[2].date).toBe('2026-04-01');
    expect(steps[3].date).toBe('2026-04-02');
  });

  it('assigns sequential stepIndex values', () => {
    const steps = clock.buildSteps({ startDate: '2026-03-01', endDate: '2026-03-14', granularity: 'DAY' });
    for (let i = 0; i < steps.length; i++) {
      expect(steps[i].stepIndex).toBe(i);
    }
  });
});
