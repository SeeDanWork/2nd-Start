import { describe, it, expect } from 'vitest';
import { buildRepairWindow } from '../core/RepairWindowBuilder';
import { makeAlternatingSchedule, makeOverlay, CHILD_1, PARENT_B } from './helpers';

describe('RepairWindowBuilder', () => {
  it('derives default window from earliest overlay', () => {
    const schedule = makeAlternatingSchedule('2026-03-02', '2026-03-30');
    const overlays = [
      makeOverlay('2026-03-10', CHILD_1, PARENT_B),
      makeOverlay('2026-03-05', CHILD_1, PARENT_B),
    ];

    const window = buildRepairWindow({
      activeSchedule: schedule,
      overlays,
      maxRepairDays: 14,
    });

    expect(window.startDate).toBe('2026-03-05');
    expect(window.endDate).toBe('2026-03-18');
  });

  it('clips requested window to schedule bounds', () => {
    const schedule = makeAlternatingSchedule('2026-03-02', '2026-03-15');

    const window = buildRepairWindow({
      activeSchedule: schedule,
      overlays: [makeOverlay('2026-03-05', CHILD_1, PARENT_B)],
      maxRepairDays: 30,
      requestedWindow: { startDate: '2026-02-01', endDate: '2026-04-30' },
    });

    expect(window.startDate).toBe('2026-03-02');
    expect(window.endDate).toBe('2026-03-15');
  });

  it('respects maxRepairDays', () => {
    const schedule = makeAlternatingSchedule('2026-03-02', '2026-03-30');
    const overlays = [makeOverlay('2026-03-05', CHILD_1, PARENT_B)];

    const window = buildRepairWindow({
      activeSchedule: schedule,
      overlays,
      maxRepairDays: 7,
    });

    expect(window.startDate).toBe('2026-03-05');
    expect(window.endDate).toBe('2026-03-11');
  });

  it('deterministic output for same input', () => {
    const schedule = makeAlternatingSchedule('2026-03-02', '2026-03-30');
    const overlays = [makeOverlay('2026-03-05', CHILD_1, PARENT_B)];

    const w1 = buildRepairWindow({ activeSchedule: schedule, overlays, maxRepairDays: 14 });
    const w2 = buildRepairWindow({ activeSchedule: schedule, overlays, maxRepairDays: 14 });

    expect(w1).toEqual(w2);
  });
});
