import { baseLayout } from './base-layout';

export interface EmergencyActivatedData {
  activatedByName: string;
  reason: string;
  durationDays: number;
}

export function renderEmergencyActivated(data: EmergencyActivatedData): { subject: string; html: string } {
  return {
    subject: 'Emergency mode activated',
    html: baseLayout('Emergency Mode', `
      <h2>Emergency mode activated</h2>
      <p><strong>${data.activatedByName}</strong> has activated emergency mode.</p>
      <p><strong>Reason:</strong> ${data.reason || 'Not specified'}</p>
      <p><strong>Duration:</strong> ${data.durationDays} day${data.durationDays !== 1 ? 's' : ''}</p>
      <p>Some scheduling constraints have been temporarily relaxed. The schedule will return to normal when emergency mode ends.</p>
    `),
  };
}
