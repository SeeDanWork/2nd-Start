import { SimulationMetricSnapshot, SimulationAggregateMetrics } from '../types';

/**
 * Builds aggregate metrics from a series of snapshots.
 */
export class SimulationAggregateMetricBuilder {
  buildAggregates(snapshots: SimulationMetricSnapshot[]): SimulationAggregateMetrics {
    if (snapshots.length === 0) {
      return {
        maxScheduleChurnRate: 0,
        averageScheduleChurnRate: 0,
        maxTransitionCount: 0,
        averageTransitionCount: 0,
        maxFairnessDeviationMagnitude: 0,
        finalFairnessDeviationMagnitude: 0,
        maxSiblingDivergenceRate: 0,
        averagePendingProposalCount: 0,
      };
    }

    const last = snapshots[snapshots.length - 1];

    return {
      maxScheduleChurnRate: Math.max(...snapshots.map(s => s.scheduleChurnRate)),
      averageScheduleChurnRate: this.avg(snapshots.map(s => s.scheduleChurnRate)),
      maxTransitionCount: Math.max(...snapshots.map(s => s.averageTransitionCount)),
      averageTransitionCount: this.avg(snapshots.map(s => s.averageTransitionCount)),
      maxFairnessDeviationMagnitude: Math.max(...snapshots.map(s => s.fairnessDeviationMagnitude)),
      finalFairnessDeviationMagnitude: last.fairnessDeviationMagnitude,
      maxSiblingDivergenceRate: Math.max(...snapshots.map(s => s.siblingDivergenceRate)),
      averagePendingProposalCount: this.avg(snapshots.map(s => s.pendingProposalCount)),
    };
  }

  private avg(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((sum, v) => sum + v, 0) / values.length;
  }
}
