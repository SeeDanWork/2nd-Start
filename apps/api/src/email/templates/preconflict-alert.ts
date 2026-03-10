import { baseLayout } from './base-layout';

export interface PreConflictAlertData {
  message: string;
  severity: string;
  metric: string;
}

export function renderPreConflictAlert(data: PreConflictAlertData): { subject: string; html: string } {
  const severityLabel = data.severity === 'critical' ? 'Action Needed' : 'Heads Up';
  return {
    subject: `${severityLabel}: Schedule alert`,
    html: baseLayout('Schedule Alert', `
      <h2>${severityLabel}</h2>
      <p>${data.message}</p>
      <p>Open the app to review your schedule and take action if needed.</p>
    `),
  };
}
