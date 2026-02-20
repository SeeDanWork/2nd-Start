import { baseLayout } from './base-layout';

export interface FairnessDriftData {
  currentSplit: string;
  targetSplit: string;
  driftPercent: number;
}

export function renderFairnessDrift(data: FairnessDriftData): { subject: string; html: string } {
  return {
    subject: 'Weekly fairness check',
    html: baseLayout('Fairness Check', `
      <h2>Fairness drift detected</h2>
      <p>The current schedule has drifted from the target split.</p>
      <ul>
        <li><strong>Current split:</strong> ${data.currentSplit}</li>
        <li><strong>Target split:</strong> ${data.targetSplit}</li>
        <li><strong>Drift:</strong> ${data.driftPercent}%</li>
      </ul>
      <p>The optimizer will correct this automatically in the next schedule generation. No action is required.</p>
    `),
  };
}
