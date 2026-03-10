import { SimulationEventPolicy } from '../types';
import { DeterministicEventSampler } from './DeterministicEventSampler';

const sampler = new DeterministicEventSampler();

/**
 * Gates event generation based on configured policies.
 */
export class SimulationEventPolicyEngine {
  allowEvent(input: {
    policyType: SimulationEventPolicy['policyType'];
    date: string;
    seed: string;
    policies: SimulationEventPolicy[];
    parameters?: Record<string, unknown>;
  }): boolean {
    const policy = input.policies.find(p => p.policyType === input.policyType);
    if (!policy || !policy.enabled) return false;

    const threshold = (policy.parameters?.['dailyThreshold'] as number) ?? 0.15;
    const weekdaysOnly = (policy.parameters?.['weekdaysOnly'] as boolean) ?? false;

    if (weekdaysOnly) {
      // Parse date to check day of week (0=Sun..6=Sat)
      const d = new Date(input.date + 'T00:00:00Z');
      const dow = d.getUTCDay();
      if (dow === 0 || dow === 6) return false;
    }

    return sampler.sampleBoolean({
      seed: input.seed,
      key: `${input.policyType}:${input.date}`,
      threshold,
    });
  }
}
