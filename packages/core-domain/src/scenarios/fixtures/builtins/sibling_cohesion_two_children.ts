import { ScenarioFixture } from '../../types';

export const fixture: ScenarioFixture = {
  scenarioId: 'sibling_cohesion_two_children',
  label: 'Sibling cohesion — two children',
  description: 'Two children, sibling cohesion policy active. Baseline solve should keep siblings together.',
  tags: ['baseline', 'sibling-cohesion', 'policy'],
  seed: {
    family: { name: 'SiblingFamily' },
    parents: [
      { name: 'Alice', role: 'MOTHER' },
      { name: 'Bob', role: 'FATHER' },
    ],
    children: [
      { name: 'Charlie', birthDate: '2019-03-10' },
      { name: 'Dana', birthDate: '2021-07-20' },
    ],
    policies: [
      {
        ruleType: 'SIBLING_COHESION',
        priority: 'HARD',
        parameters: { requireTogether: true },
        label: 'Siblings must stay together',
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
