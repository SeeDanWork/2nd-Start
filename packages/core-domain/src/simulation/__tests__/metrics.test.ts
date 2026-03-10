import { describe, it, expect } from 'vitest';
import { computeScheduleChurnRate } from '../metrics/ScheduleChurnMetric';
import { computeAverageTransitionCount } from '../metrics/TransitionCountMetric';
import { computeFairnessDeviationMagnitude } from '../metrics/FairnessDeviationMetric';
import { computeSiblingDivergenceRate } from '../metrics/SiblingDivergenceMetric';
import { computeDisruptionRecoveryOpenCount } from '../metrics/DisruptionRecoveryMetric';
import { computePendingProposalCount } from '../metrics/PendingProposalMetric';
import { SimulationAggregateMetricBuilder } from '../metrics/SimulationAggregateMetricBuilder';
import { SimulationMetricCollector } from '../metrics/SimulationMetricCollector';
import { SimulationExecutionContext } from '../types';

function makeContext(overrides: Partial<SimulationExecutionContext> = {}): SimulationExecutionContext {
  return {
    familyId: 'family:Test',
    parentIdsByName: { Alice: 'parent:Alice', Bob: 'parent:Bob' },
    childIdsByName: { Charlie: 'child:Charlie', Dana: 'child:Dana' },
    activeScheduleNights: [],
    activeScheduleExchanges: [],
    appliedOverlays: [],
    proposals: [],
    fairnessLedger: {
      'parent:Alice': { nightDeviation: 0, weekendDeviation: 0, holidayDeviation: 0 },
      'parent:Bob': { nightDeviation: 0, weekendDeviation: 0, holidayDeviation: 0 },
    },
    calendarEvents: [],
    resolvedOverlayCount: 0,
    scheduleVersionNumber: 1,
    totalChurnedNights: 0,
    totalStepsWithSchedule: 0,
    ...overrides,
  };
}

describe('Metrics', () => {
  describe('ScheduleChurnRate', () => {
    it('returns 0 when no previous schedule', () => {
      const ctx = makeContext({ activeScheduleNights: [{ date: '2026-03-10', childId: 'c1', parentId: 'p1' }] });
      expect(computeScheduleChurnRate(ctx)).toBe(0);
    });

    it('returns 0 when schedule unchanged', () => {
      const nights = [
        { date: '2026-03-10', childId: 'c1', parentId: 'p1' },
        { date: '2026-03-11', childId: 'c1', parentId: 'p2' },
      ];
      const ctx = makeContext({
        activeScheduleNights: nights,
        previousScheduleNights: [...nights],
      });
      expect(computeScheduleChurnRate(ctx)).toBe(0);
    });

    it('returns correct rate when nights changed', () => {
      const ctx = makeContext({
        activeScheduleNights: [
          { date: '2026-03-10', childId: 'c1', parentId: 'p2' },
          { date: '2026-03-11', childId: 'c1', parentId: 'p1' },
        ],
        previousScheduleNights: [
          { date: '2026-03-10', childId: 'c1', parentId: 'p1' },
          { date: '2026-03-11', childId: 'c1', parentId: 'p1' },
        ],
      });
      expect(computeScheduleChurnRate(ctx)).toBe(0.5);
    });
  });

  describe('TransitionCount', () => {
    it('returns 0 for empty schedule', () => {
      expect(computeAverageTransitionCount(makeContext())).toBe(0);
    });

    it('counts transitions correctly', () => {
      const ctx = makeContext({
        activeScheduleNights: [
          { date: '2026-03-10', childId: 'c1', parentId: 'p1' },
          { date: '2026-03-11', childId: 'c1', parentId: 'p2' },
          { date: '2026-03-12', childId: 'c1', parentId: 'p2' },
          { date: '2026-03-13', childId: 'c1', parentId: 'p1' },
        ],
      });
      expect(computeAverageTransitionCount(ctx)).toBe(2);
    });
  });

  describe('FairnessDeviationMagnitude', () => {
    it('returns 0 for balanced ledger', () => {
      expect(computeFairnessDeviationMagnitude(makeContext())).toBe(0);
    });

    it('returns max absolute deviation', () => {
      const ctx = makeContext({
        fairnessLedger: {
          'p1': { nightDeviation: 3, weekendDeviation: -1, holidayDeviation: 0 },
          'p2': { nightDeviation: -3, weekendDeviation: 1, holidayDeviation: -5 },
        },
      });
      expect(computeFairnessDeviationMagnitude(ctx)).toBe(5);
    });
  });

  describe('SiblingDivergenceRate', () => {
    it('returns 0 for single child', () => {
      const ctx = makeContext({
        activeScheduleNights: [
          { date: '2026-03-10', childId: 'c1', parentId: 'p1' },
        ],
      });
      expect(computeSiblingDivergenceRate(ctx)).toBe(0);
    });

    it('returns 1 when siblings always split', () => {
      const ctx = makeContext({
        activeScheduleNights: [
          { date: '2026-03-10', childId: 'c1', parentId: 'p1' },
          { date: '2026-03-10', childId: 'c2', parentId: 'p2' },
        ],
      });
      expect(computeSiblingDivergenceRate(ctx)).toBe(1);
    });

    it('returns 0 when siblings always together', () => {
      const ctx = makeContext({
        activeScheduleNights: [
          { date: '2026-03-10', childId: 'c1', parentId: 'p1' },
          { date: '2026-03-10', childId: 'c2', parentId: 'p1' },
        ],
      });
      expect(computeSiblingDivergenceRate(ctx)).toBe(0);
    });
  });

  describe('DisruptionRecoveryOpenCount', () => {
    it('counts unresolved overlays', () => {
      const ctx = makeContext({
        appliedOverlays: [
          { childId: 'c1', date: '2026-03-10', assignedParentId: 'p1', disruptionType: 'ILLNESS' },
          { childId: 'c2', date: '2026-03-11', assignedParentId: 'p2', disruptionType: 'TRAVEL' },
        ],
      });
      expect(computeDisruptionRecoveryOpenCount(ctx)).toBe(2);
    });
  });

  describe('PendingProposalCount', () => {
    it('counts only pending proposals', () => {
      const ctx = makeContext({
        proposals: [
          { proposalId: 'p1', status: 'PENDING', origin: 'test' },
          { proposalId: 'p2', status: 'ACCEPTED', origin: 'test' },
          { proposalId: 'p3', status: 'PENDING', origin: 'test' },
        ],
      });
      expect(computePendingProposalCount(ctx)).toBe(2);
    });
  });

  describe('SimulationMetricCollector', () => {
    it('collects all metrics in a snapshot', () => {
      const collector = new SimulationMetricCollector();
      const ctx = makeContext({
        activeScheduleNights: [
          { date: '2026-03-10', childId: 'c1', parentId: 'p1' },
        ],
      });
      const snapshot = collector.collectSnapshot({ date: '2026-03-10', context: ctx });
      expect(snapshot.date).toBe('2026-03-10');
      expect(typeof snapshot.scheduleChurnRate).toBe('number');
      expect(typeof snapshot.averageTransitionCount).toBe('number');
      expect(typeof snapshot.fairnessDeviationMagnitude).toBe('number');
      expect(typeof snapshot.siblingDivergenceRate).toBe('number');
      expect(typeof snapshot.disruptionRecoveryOpenCount).toBe('number');
      expect(typeof snapshot.pendingProposalCount).toBe('number');
    });
  });

  describe('SimulationAggregateMetricBuilder', () => {
    it('returns zeros for empty snapshots', () => {
      const builder = new SimulationAggregateMetricBuilder();
      const agg = builder.buildAggregates([]);
      expect(agg.maxScheduleChurnRate).toBe(0);
      expect(agg.averageScheduleChurnRate).toBe(0);
    });

    it('computes max and average correctly', () => {
      const builder = new SimulationAggregateMetricBuilder();
      const agg = builder.buildAggregates([
        { date: 'd1', scheduleChurnRate: 0.2, averageTransitionCount: 3, fairnessDeviationMagnitude: 1, siblingDivergenceRate: 0, disruptionRecoveryOpenCount: 0, pendingProposalCount: 1 },
        { date: 'd2', scheduleChurnRate: 0.8, averageTransitionCount: 5, fairnessDeviationMagnitude: 2, siblingDivergenceRate: 0.5, disruptionRecoveryOpenCount: 1, pendingProposalCount: 0 },
      ]);
      expect(agg.maxScheduleChurnRate).toBe(0.8);
      expect(agg.averageScheduleChurnRate).toBe(0.5);
      expect(agg.maxTransitionCount).toBe(5);
      expect(agg.finalFairnessDeviationMagnitude).toBe(2);
    });
  });
});
