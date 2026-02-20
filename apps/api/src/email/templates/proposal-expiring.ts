import { baseLayout } from './base-layout';

export interface ProposalExpiringData {
  hoursLeft: number;
  dates: string;
}

export function renderProposalExpiring(data: ProposalExpiringData): { subject: string; html: string } {
  return {
    subject: 'Proposal expiring soon',
    html: baseLayout('Proposal Expiring', `
      <h2>Proposal expiring soon</h2>
      <p>A schedule proposal for <strong>${data.dates}</strong> will expire
         in <strong>${data.hoursLeft} hour${data.hoursLeft !== 1 ? 's' : ''}</strong>.</p>
      <p>Please review and respond in the app before it expires. If no action is taken, the proposal will be automatically declined.</p>
    `),
  };
}
