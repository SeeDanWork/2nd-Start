import { baseLayout } from './base-layout';

export interface EmergencyReturnData {
  familyName: string;
}

export function renderEmergencyReturn(data: EmergencyReturnData): { subject: string; html: string } {
  return {
    subject: 'Emergency mode ending',
    html: baseLayout('Emergency Mode Ending', `
      <h2>Emergency mode is ending</h2>
      <p>Emergency mode for <strong>${data.familyName || 'your family'}</strong> has ended.</p>
      <p>The regular schedule and constraints are now back in effect.</p>
    `),
  };
}
