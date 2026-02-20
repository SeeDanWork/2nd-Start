import { baseLayout } from './base-layout';

export interface ProposalReceivedData {
  requesterName: string;
  requestType: string;
  dates: string;
}

export function renderProposalReceived(data: ProposalReceivedData): { subject: string; html: string } {
  return {
    subject: 'New schedule proposal received',
    html: baseLayout('New Proposal', `
      <h2>New schedule proposal</h2>
      <p><strong>${data.requesterName}</strong> has submitted a <strong>${data.requestType}</strong> request
         for <strong>${data.dates}</strong>.</p>
      <p>Proposal options have been generated. Please review them in the app and choose one, or decline.</p>
      <p class="muted">Proposals expire after 48 hours if no action is taken.</p>
    `),
  };
}
