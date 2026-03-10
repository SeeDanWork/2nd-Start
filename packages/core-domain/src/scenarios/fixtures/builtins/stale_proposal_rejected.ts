import { ScenarioFixture } from '../../types';

export const fixture: ScenarioFixture = {
  scenarioId: 'stale_proposal_rejected',
  label: 'Stale proposal invalidation',
  description: 'Generate proposals, accept one, verify siblings are invalidated.',
  tags: ['proposal', 'invalidation', 'stale'],
  seed: {
    family: { name: 'StaleFamily' },
    parents: [
      { name: 'Alice', role: 'MOTHER' },
      { name: 'Bob', role: 'FATHER' },
    ],
    children: [
      { name: 'Charlie', birthDate: '2020-08-01' },
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
      type: 'PROPOSAL_COUNT',
      pending: 0,
      accepted: 1,
    },
  ],
};
