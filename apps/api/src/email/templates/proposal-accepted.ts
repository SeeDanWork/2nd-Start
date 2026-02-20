import { baseLayout } from './base-layout';

export interface ProposalAcceptedData {
  accepterName: string;
  dates: string;
}

export function renderProposalAccepted(data: ProposalAcceptedData): { subject: string; html: string } {
  return {
    subject: 'Schedule proposal accepted',
    html: baseLayout('Proposal Accepted', `
      <h2>Proposal accepted</h2>
      <p><strong>${data.accepterName}</strong> has accepted a schedule proposal
         for <strong>${data.dates}</strong>.</p>
      <p>Your calendar has been updated with the new schedule.</p>
    `),
  };
}
