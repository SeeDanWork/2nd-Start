import { ScenarioFixture } from '../../types';

export const fixture: ScenarioFixture = {
  scenarioId: 'school_closure_overlay_repair',
  label: 'School closure overlay with repair',
  description: 'Active schedule seeded, school closure overlay applied, repair run, proposal accepted.',
  tags: ['repair', 'overlay', 'school-closure', 'fairness'],
  seed: {
    family: { name: 'ClosureFamily' },
    parents: [
      { name: 'Alice', role: 'MOTHER' },
      { name: 'Bob', role: 'FATHER' },
    ],
    children: [
      { name: 'Charlie', birthDate: '2020-01-15' },
    ],
    initialSchedule: {
      windowStart: '2026-03-09',
      windowEnd: '2026-03-22',
      nights: [
        // Week 1: Alice Mon-Thu, Bob Fri-Sun
        { date: '2026-03-09', childName: 'Charlie', parentName: 'Alice' },
        { date: '2026-03-10', childName: 'Charlie', parentName: 'Alice' },
        { date: '2026-03-11', childName: 'Charlie', parentName: 'Alice' },
        { date: '2026-03-12', childName: 'Charlie', parentName: 'Alice' },
        { date: '2026-03-13', childName: 'Charlie', parentName: 'Bob' },
        { date: '2026-03-14', childName: 'Charlie', parentName: 'Bob' },
        { date: '2026-03-15', childName: 'Charlie', parentName: 'Bob' },
        // Week 2: Bob Mon-Thu, Alice Fri-Sun
        { date: '2026-03-16', childName: 'Charlie', parentName: 'Bob' },
        { date: '2026-03-17', childName: 'Charlie', parentName: 'Bob' },
        { date: '2026-03-18', childName: 'Charlie', parentName: 'Bob' },
        { date: '2026-03-19', childName: 'Charlie', parentName: 'Bob' },
        { date: '2026-03-20', childName: 'Charlie', parentName: 'Alice' },
        { date: '2026-03-21', childName: 'Charlie', parentName: 'Alice' },
      ],
    },
  },
  steps: [
    {
      type: 'APPLY_OVERLAY',
      stepId: 'overlay-closure',
      overlays: [
        {
          childName: 'Charlie',
          date: '2026-03-11',
          assignedParentName: 'Bob',
          disruptionType: 'SCHOOL_CLOSURE',
          reason: 'Snow day — school closed',
        },
      ],
    },
    {
      type: 'RUN_REPAIR',
      stepId: 'repair-1',
      repairWindowStart: '2026-03-09',
      repairWindowEnd: '2026-03-22',
      candidateCount: 3,
    },
    {
      type: 'ACCEPT_PROPOSAL',
      stepId: 'accept-repair',
      selection: { strategy: 'FIRST' },
      acceptedAt: '2026-03-11T10:00:00Z',
      acceptedByParentName: 'Alice',
    },
  ],
  expectations: [
    {
      type: 'OVERLAY_RESOLUTION',
      resolvedCount: 1,
    },
    {
      type: 'ACTIVE_SCHEDULE',
      versionNumber: 2,
    },
    {
      type: 'PROPOSAL_COUNT',
      pending: 0,
      accepted: 1,
    },
  ],
};
