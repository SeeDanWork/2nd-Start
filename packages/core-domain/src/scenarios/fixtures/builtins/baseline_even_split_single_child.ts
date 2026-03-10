import { ScenarioFixture } from '../../types';

export const fixture: ScenarioFixture = {
  scenarioId: 'baseline_even_split_single_child',
  label: 'Baseline even split — single child',
  description: 'One child, two parents, no disruptions. Baseline solve, proposals generated, one accepted.',
  tags: ['baseline', 'single-child', 'acceptance'],
  seed: {
    family: { name: 'TestFamily' },
    parents: [
      { name: 'Alice', role: 'MOTHER' },
      { name: 'Bob', role: 'FATHER' },
    ],
    children: [
      { name: 'Charlie', birthDate: '2020-06-15' },
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
