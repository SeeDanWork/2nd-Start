import { SimulationStep } from '../types';

/**
 * Builds a deterministic sequence of simulation steps.
 */
export class SimulationClock {
  buildSteps(input: {
    startDate: string;
    endDate: string;
    granularity: 'DAY';
  }): SimulationStep[] {
    const steps: SimulationStep[] = [];
    const start = new Date(input.startDate + 'T00:00:00Z');
    const end = new Date(input.endDate + 'T00:00:00Z');

    let current = new Date(start);
    let stepIndex = 0;

    while (current <= end) {
      steps.push({
        stepIndex,
        date: current.toISOString().split('T')[0],
      });
      stepIndex++;
      current.setUTCDate(current.getUTCDate() + 1);
    }

    return steps;
  }
}
