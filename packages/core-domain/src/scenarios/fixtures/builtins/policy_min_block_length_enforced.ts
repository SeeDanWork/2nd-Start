import { ScenarioFixture } from '../../types';

export const fixture: ScenarioFixture = {
  scenarioId: 'policy_min_block_length_enforced',
  label: 'Policy — min block length enforced',
  description: 'Min block length policy active, baseline solve with policy evaluation.',
  tags: ['policy', 'min-block-length', 'baseline'],
  seed: {
    family: { name: 'PolicyFamily' },
    parents: [
      { name: 'Alice', role: 'MOTHER' },
      { name: 'Bob', role: 'FATHER' },
    ],
    children: [
      { name: 'Charlie', birthDate: '2020-02-10' },
    ],
    policies: [
      {
        ruleType: 'MIN_BLOCK_LENGTH',
        priority: 'STRONG',
        parameters: { minNights: 2 },
        label: 'Minimum 2 consecutive nights',
      },
    ],
  },
  steps: [
    {
      type: 'SOLVE_BASELINE',
      stepId: 'solve-1',
      windowStart: '2026-03-09',
      windowEnd: '2026-03-22',
      candidateCount: 3,
    },
    {
      type: 'ACCEPT_PROPOSAL',
      stepId: 'accept-1',
      selection: { strategy: 'FIRST' },
      acceptedAt: '2026-03-08T12:00:00Z',
      acceptedByParentName: 'Alice',
    },
  ],
  expectations: [
    {
      type: 'ACTIVE_SCHEDULE',
      versionNumber: 1,
    },
    {
      type: 'PROPOSAL_COUNT',
      pending: 0,
      accepted: 1,
    },
  ],
};
