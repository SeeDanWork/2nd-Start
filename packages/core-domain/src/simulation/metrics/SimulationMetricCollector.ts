import { SimulationExecutionContext, SimulationMetricSnapshot } from '../types';
import { computeScheduleChurnRate } from './ScheduleChurnMetric';
import { computeAverageTransitionCount } from './TransitionCountMetric';
import { computeFairnessDeviationMagnitude } from './FairnessDeviationMetric';
import { computeSiblingDivergenceRate } from './SiblingDivergenceMetric';
import { computeDisruptionRecoveryOpenCount } from './DisruptionRecoveryMetric';
import { computePendingProposalCount } from './PendingProposalMetric';

/**
 * Collects a metric snapshot from the current simulation context.
 */
export class SimulationMetricCollector {
  collectSnapshot(input: {
    date: string;
    context: SimulationExecutionContext;
  }): SimulationMetricSnapshot {
    const { date, context } = input;
    return {
      date,
      scheduleChurnRate: computeScheduleChurnRate(context),
      averageTransitionCount: computeAverageTransitionCount(context),
      fairnessDeviationMagnitude: computeFairnessDeviationMagnitude(context),
      siblingDivergenceRate: computeSiblingDivergenceRate(context),
      disruptionRecoveryOpenCount: computeDisruptionRecoveryOpenCount(context),
      pendingProposalCount: computePendingProposalCount(context),
    };
  }
}
