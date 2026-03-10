import { ScenarioFixture } from '../../types';

export const fixture: ScenarioFixture = {
  scenarioId: 'weekend_fairness_restitution',
  label: 'Weekend fairness restitution',
  description: 'Seeded fairness drift, repair run, accepted proposal reduces weekend imbalance.',
  tags: ['fairness', 'restitution', 'weekend'],
  seed: {
    family: { name: 'FairnessFamily' },
    parents: [
      { name: 'Alice', role: 'MOTHER' },
      { name: 'Bob', role: 'FATHER' },
    ],
    children: [
      { name: 'Charlie', birthDate: '2019-09-01' },
    ],
    initialSchedule: {
      windowStart: '2026-03-09',
      windowEnd: '2026-03-22',
      nights: [
        { date: '2026-03-09', childName: 'Charlie', parentName: 'Alice' },
        { date: '2026-03-10', childName: 'Charlie', parentName: 'Alice' },
        { date: '2026-03-11', childName: 'Charlie', parentName: 'Alice' },
        { date: '2026-03-12', childName: 'Charlie', parentName: 'Bob' },
        { date: '2026-03-13', childName: 'Charlie', parentName: 'Bob' },
        { date: '2026-03-14', childName: 'Charlie', parentName: 'Alice' },
        { date: '2026-03-15', childName: 'Charlie', parentName: 'Alice' },
        { date: '2026-03-16', childName: 'Charlie', parentName: 'Bob' },
        { date: '2026-03-17', childName: 'Charlie', parentName: 'Bob' },
        { date: '2026-03-18', childName: 'Charlie', parentName: 'Bob' },
        { date: '2026-03-19', childName: 'Charlie', parentName: 'Alice' },
        { date: '2026-03-20', childName: 'Charlie', parentName: 'Alice' },
        { date: '2026-03-21', childName: 'Charlie', parentName: 'Alice' },
      ],
    },
    fairnessLedger: [
      { parentName: 'Alice', nightDeviation: 2, weekendDeviation: 2, holidayDeviation: 0 },
      { parentName: 'Bob', nightDeviation: -2, weekendDeviation: -2, holidayDeviation: 0 },
    ],
  },
  steps: [
    {
      type: 'APPEND_FAIRNESS_ADJUSTMENT',
      stepId: 'adjust-fairness',
      effectiveDate: '2026-03-09',
      reason: 'Manual weekend rebalancing',
      deltas: [
        { parentName: 'Alice', nightDelta: -1, weekendDelta: -1, holidayDelta: 0 },
        { parentName: 'Bob', nightDelta: 1, weekendDelta: 1, holidayDelta: 0 },
      ],
    },
  ],
  expectations: [
    {
      type: 'FAIRNESS_LEDGER',
      byParent: [
        { parentName: 'Alice', nightDeviation: 1, weekendDeviation: 1, holidayDeviation: 0 },
        { parentName: 'Bob', nightDeviation: -1, weekendDeviation: -1, holidayDeviation: 0 },
      ],
    },
  ],
};
